// Headless Chrome driven over the DevTools protocol, used in scripts/check.mjs and
// scripts/export-pdf.mjs. The protocol is used in place of the --dump-dom, --screenshot, and
// --print-to-pdf flags, since requestAnimationFrame is stopped after one or two frames under these
// flags, and it is awaited in the print layout of reveal.js. The messages are sent over
// --remote-debugging-pipe as JSON terminated with a NUL byte, on file descriptors 3 and 4, hence an
// npm package is not required.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function chromePaths(env, platform) {
  if (platform === 'darwin') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
    return [
      ...roots.map((root) => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ...roots.map((root) => join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
    ];
  }
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  return (env.PATH ?? '').split(delimiter).flatMap((dir) => names.map((name) => join(dir, name)));
}

export function findChrome({ env = process.env, platform = process.platform } = {}) {
  const paths = env.CHROME_PATH ? [env.CHROME_PATH] : chromePaths(env, platform);
  const path = paths.find((candidate) => existsSync(candidate));
  if (!path) {
    const where = env.CHROME_PATH ? ` at ${env.CHROME_PATH}` : '';
    throw new Error(`Chrome not found${where}. Set CHROME_PATH to the Chrome executable.`);
  }
  return path;
}

export function deckUrl(deck, query = '', hash = '') {
  return `${pathToFileURL(resolve(deck)).href}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// after the browser has exited, files can still be written to the profile, hence the whole removal
// is retried. The retries of rmSync are not enough, since only the last rmdir is repeated with them
export async function removeProfile(profile) {
  for (let attempt = 1; ; attempt++) {
    try {
      rmSync(profile, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 25) throw error;
      await sleep(200);
    }
  }
}

/**
 * Starts Chrome and returns an object with newPage() and close(). With offline set, every host
 * name is mapped to a failed lookup, thus each network load of a deck is reported as an error. A
 * request that is not answered within timeout ms fails.
 */
export async function launch({ offline = true, timeout = 120000 } = {}) {
  const chrome = findChrome();
  const profile = mkdtempSync(join(tmpdir(), 'beeson-chrome-'));
  const args = [
    '--headless=new',
    '--remote-debugging-pipe',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    // WebGL is required in the tycho viewer, and without a GPU it is not available in Chromium 159
    // unless this flag is set
    '--enable-unsafe-swiftshader',
    // a prompt of the macOS keychain is never answered on a machine without a login session
    '--use-mock-keychain',
    // the sandbox of Chrome cannot be started on the Ubuntu runners of GitHub, and the pages are local
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ...(offline ? ['--host-resolver-rules=MAP * ~NOTFOUND'] : []),
    'about:blank',
  ];
  const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-2000);
  });
  const exited = new Promise((done) => child.once('exit', done));
  // rejected when Chrome exits, so that a request in flight is not left unsettled
  const crashed = new Promise((_, fail) => {
    child.once('exit', (code, signal) => fail(new Error(`Chrome exited with ${signal ?? `code ${code}`}\n${stderr}`)));
  });
  crashed.catch(() => {});
  // a write after an exit of Chrome fails, and the exit is reported with crashed
  child.stdio[3].on('error', () => {});

  function answered(promise, what) {
    let timer;
    const late = new Promise((_, fail) => {
      timer = setTimeout(() => fail(new Error(`Chrome did not answer ${what} within ${timeout} ms\n${stderr}`)), timeout);
    });
    return Promise.race([promise, late, crashed]).finally(() => clearTimeout(timer));
  }

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  let buffer = '';
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', (chunk) => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.id && pending.has(message.id)) {
        const { done, fail } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) fail(new Error(`${message.error.message} (${message.error.code})`));
        else done(message.result);
      } else if (message.method) {
        for (const listener of listeners) listener(message);
      }
    }
  });

  function send(method, params = {}, sessionId) {
    const id = nextId++;
    child.stdio[3].write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    return answered(new Promise((done, fail) => pending.set(id, { done, fail })), method);
  }

  async function newPage({ width = 1920, height = 1080 } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    const errors = [];
    const onEvent = ({ method, params, sessionId: from }) => {
      if (from !== sessionId) return;
      if (method === 'Runtime.exceptionThrown') {
        const details = params.exceptionDetails;
        errors.push(details.exception?.description ?? details.text);
      } else if (method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(params.type)) {
        errors.push(`console.${params.type}: ${params.args.map((a) => a.value ?? a.description).join(' ')}`);
      } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
        // failed loads of scripts, styles, fonts, and images are reported here
        errors.push(`${params.entry.text} ${params.entry.url ?? ''}`.trim());
      }
    };
    listeners.add(onEvent);
    await Promise.all([call('Page.enable'), call('Runtime.enable'), call('Log.enable')]);
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

    async function evaluate(expression) {
      const { result, exceptionDetails } = await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    }

    return {
      errors,
      evaluate,
      async goto(url) {
        const loaded = new Promise((done) => {
          const onLoad = ({ method, sessionId: from }) => {
            if (from === sessionId && method === 'Page.loadEventFired') {
              listeners.delete(onLoad);
              done();
            }
          };
          listeners.add(onLoad);
        });
        const { errorText } = await call('Page.navigate', { url });
        if (errorText) throw new Error(`${url}: ${errorText}`);
        await answered(loaded, `the load of ${url}`);
      },
      // polls the expression every 50 ms until it is truthy, and fails after timeout ms
      async waitFor(expression, timeout = 15000) {
        const start = Date.now();
        while (!(await evaluate(expression))) {
          if (Date.now() - start > timeout) {
            throw new Error(`timed out waiting for ${expression}\n${errors.join('\n')}`);
          }
          await sleep(50);
        }
      },
      async screenshot() {
        const { data } = await call('Page.captureScreenshot', { format: 'png' });
        return Buffer.from(data, 'base64');
      },
      async pdf() {
        const { data } = await call('Page.printToPDF', {
          preferCSSPageSize: true,
          printBackground: true,
          displayHeaderFooter: false,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        });
        return Buffer.from(data, 'base64');
      },
      async close() {
        listeners.delete(onEvent);
        await send('Target.closeTarget', { targetId });
      },
    };
  }

  async function close() {
    try {
      await Promise.race([send('Browser.close').catch(() => {}), sleep(2000)]);
    } finally {
      child.kill();
      await exited;
      await removeProfile(profile);
    }
  }

  return { newPage, close };
}

// resolves once reveal.js is ready, the web fonts are loaded, and, in a deck with MathJax, every
// formula is typeset
export const deckSettled = `(async () => {
  if (!window.Reveal?.isReady()) return false;
  await document.fonts.ready;
  await window.MathJax?.startup?.promise;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return true;
})()`;
