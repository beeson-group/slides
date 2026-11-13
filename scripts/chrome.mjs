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
 * name is mapped to a failed lookup, thus each network load of a deck is reported as an error.
 * Without it, only 127.0.0.1 is reached. A request that is not answered within timeout ms fails.
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
    // the paravirtual GPU of the macOS runners of GitHub fails at times to create a WebGL context,
    // hence WebGL is drawn there in SwiftShader, as on the Linux runners
    ...(process.env.CI && process.platform === 'darwin' ? ['--use-angle=swiftshader'] : []),
    // the sandbox of Chrome cannot be started on the Ubuntu runners of GitHub, and the pages are local
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    // without offline, only the server of scripts/webdriver.mjs at 127.0.0.1 is reached. With the
    // network, Chrome downloads components and models into the profile in the background, and on
    // Windows such a file is still locked when the profile is removed
    `--host-resolver-rules=MAP * ~NOTFOUND${offline ? '' : ', EXCLUDE 127.0.0.1'}`,
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
    // an expression that is not answered is named by its start, to tell which read of a test hung
    const what = typeof params.expression === 'string' ? `${method} of ${params.expression.slice(0, 300)}` : method;
    return answered(new Promise((done, fail) => pending.set(id, { done, fail })), what);
  }

  // with mobile set, the page is laid out as on a phone, with touch and a coarse pointer, and scale
  // is the device pixel ratio. with motion set, the page is shown without reduced motion, which is
  // the setting of the macOS and Windows runners of GitHub, hence a backdrop is traced there too.
  // without drafts, the unsaved edits that the editor keeps in the storage of the browser 1 s after
  // its last change are not written, since they were offered on a card to the next page of a test
  async function newPage({ width = 1920, height = 1080, mobile = false, scale = 1, motion = false, drafts = false } = {}) {
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
      } else if (method === 'Log.entryAdded' && (params.entry.level === 'error' || params.entry.text.includes('GL_INVALID'))) {
        // failed loads of scripts, styles, fonts, and images are reported here, and an invalid call
        // of WebGL only as a warning
        errors.push(`${params.entry.text} ${params.entry.url ?? ''}`.trim());
      }
    };
    listeners.add(onEvent);
    await Promise.all([call('Page.enable'), call('Runtime.enable'), call('Log.enable')]);
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
    if (mobile) await call('Emulation.setTouchEmulationEnabled', { enabled: true });
    if (motion) await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    if (!drafts) {
      await call('Page.addScriptToEvaluateOnNewDocument', {
        source: `{
          const set = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (!String(key).startsWith('beeson-draft:')) set.call(this, key, value);
          };
        }`,
      });
    }

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
      // sends a command of the DevTools protocol to the page, e.g. Emulation.setCPUThrottlingRate
      send: call,
      // on a Windows runner of GitHub, about one page in a few thousand is refused one of its
      // files with net::ERR_NO_BUFFER_SPACE, while ports and memory are free. such a page is loaded
      // again, twice at most, and the error of the load before is dropped
      async goto(url) {
        const load = async (method, params) => {
          const loaded = new Promise((done) => {
            const onLoad = ({ method: event, sessionId: from }) => {
              if (from === sessionId && event === 'Page.loadEventFired') {
                listeners.delete(onLoad);
                done();
              }
            };
            listeners.add(onLoad);
          });
          const { errorText } = await call(method, params);
          if (errorText) throw new Error(`${url}: ${errorText}`);
          await answered(loaded, `the load of ${url}`);
        };
        const refused = () => {
          const kept = errors.filter((error) => !error.includes('net::ERR_NO_BUFFER_SPACE'));
          const found = kept.length < errors.length;
          errors.splice(0, errors.length, ...kept);
          return found;
        };
        await load('Page.navigate', { url });
        for (let n = 0; n < 2 && refused(); n++) await load('Page.reload', { ignoreCache: true });
      },
      // polls the expression every 50 ms until it is truthy, and fails after timeout ms
      // an expression evaluated while the page is loaded anew is answered with an error, hence it
      // is read as not yet true
      async waitFor(expression, timeout = 15000) {
        const start = Date.now();
        const loading = (error) => {
          if (!/Inspected target navigated or closed/.test(error.message)) throw error;
          return false;
        };
        while (!(await evaluate(expression).catch(loading))) {
          if (Date.now() - start > timeout) {
            throw new Error(`timed out waiting for ${expression}\n${errors.join('\n')}`);
          }
          await sleep(50);
        }
      },
      // clip is a box of the document, with x, y, width, height, and scale
      async screenshot(clip) {
        const { data } = await call('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
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
    let timer;
    try {
      await Promise.race([send('Browser.close').catch(() => {}), new Promise((done) => (timer = setTimeout(done, 2000)))]);
    } finally {
      clearTimeout(timer);
      child.kill();
      await exited;
      // chrome_crashpad_handler and GoogleUpdater inherit the stderr of Chrome and outlive it, and an
      // open pipe would keep this process alive until they exit
      for (const stream of child.stdio) stream?.destroy();
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
  // a backdrop drawn from a file of polylines is loaded after the start of the deck
  await Promise.all((window.Beeson?.backdrops ?? []).map((backdrop) => backdrop.ready));
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return true;
})()`;

/** Opens a deck at url in the print view of reveal.js, with ?print-pdf in url, and waits until it can be printed. */
export async function printView(page, url) {
  await page.goto(url);
  // loading-scroll-mode is removed from the viewport after the pdf-ready event of reveal.js. on a
  // slow runner, the pages of the demo deck at a pixel ratio of 2 are laid out in over 15 s
  await page.waitFor(`!!document.querySelector('.pdf-page')
    && !document.querySelector('.reveal-viewport.loading-scroll-mode')`, 120000);
  await page.waitFor(deckSettled);
  // reveal.js clones a slide for each of its steps after the load event, which does not wait for
  // the clones, and a video that has not loaded a frame is printed as a black panel. A clone with
  // preload none or metadata is printed black as well when its server answers Range requests, hence
  // every video is loaded with preload auto. The videos are loaded one after the other, since on a
  // slow machine some of the videos that are loaded at once do not get a frame. A hidden video is not
  // printed, and it may not load a frame at all. A tycho viewer is replaced by its still in
  // src/print.ts, unless it shows an error
  await page.evaluate(`(async () => {
    for (const video of document.querySelectorAll('video')) {
      if (video.preload === 'auto') continue;
      video.preload = 'auto';
      video.load();
      if (!video.getClientRects().length) continue;
      await new Promise((done) => {
        video.addEventListener('loadeddata', done, { once: true });
        video.addEventListener('error', done, { once: true });
        setTimeout(done, 5000);
      });
    }
  })()`);
  await page.waitFor(`[...document.querySelectorAll('video')].every((video) => video.readyState >= 2 || video.error || !video.getClientRects().length)
    && [...document.querySelectorAll('tycho-viewer')].every((viewer) => viewer.shadowRoot?.querySelector('.status.error'))
    && [...document.images].every((image) => image.complete)`, 60000);
  await page.waitFor(deckSettled);
}
