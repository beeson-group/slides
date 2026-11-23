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

const leftProfiles = new Set();

function leaveProfile(profile, error) {
  process.stderr.write(`The profile of Chrome at ${profile} was left behind: ${error.message}\n`);
  if (!leftProfiles.size) {
    process.once('exit', () => {
      for (const left of leftProfiles) {
        try {
          rmSync(left, { recursive: true, force: true });
        } catch {}
      }
    });
  }
  leftProfiles.add(profile);
}

export function chromeArgs({ profile, offline = true, wholeFrames = false, platform = process.platform, ci = Boolean(process.env.CI) } = {}) {
  return [
    '--headless=new',
    '--remote-debugging-pipe',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    '--enable-unsafe-swiftshader',
    ...(ci && platform === 'darwin' ? ['--use-angle=swiftshader'] : []),
    ...(ci && platform === 'win32' ? ['--use-angle=d3d11-warp', '--disable-gpu-compositing'] : []),
    ...(platform === 'linux' ? ['--no-sandbox'] : []),
    ...(platform === 'darwin' ? ['--disable-features=MacAppCodeSignClone'] : []),
    ...(platform === 'win32' ? ['--disable-features=TcpPortRandomizationWin'] : []),
    `--host-resolver-rules=MAP * ~NOTFOUND${offline ? '' : ', EXCLUDE 127.0.0.1'}`,
    ...(wholeFrames ? ['--run-all-compositor-stages-before-draw'] : []),
    ...(wholeFrames ? ['--disable-lcd-text'] : []),
    'about:blank',
  ];
}

const CRASH_LINE_WAIT = 2000;

const LOADING = `(() => {
  const loaded = new Set(performance.getEntriesByType('resource').map((e) => e.name));
  const files = [...document.querySelectorAll('script[src], link[rel="stylesheet"][href], img[src], iframe[src], video[src], source[src]')].map((el) => el.src || el.href);
  return { url: location.href, readyState: document.readyState, resourceTimingFull: loaded.size >= 250, unloaded: files.filter((f) => !loaded.has(f)) };
})()`;

const LAUNCHES = 3;

const PRINT_PER_PAGE = 1000;

export async function launch({ probe = 10000, ...options } = {}) {
  if (!probe) return start(options);
  for (let n = 1; ; n++) {
    const browser = await start(options);
    let page;
    try {
      page = await browser.newPage({ width: 16, height: 16 });
    } catch (error) {
      await browser.close();
      throw error;
    }
    const shot = await page.send('Page.captureScreenshot', { format: 'png' }, probe).then(() => null, (error) => error);
    if (!shot) return browser;
    await browser.close();
    if (n === LAUNCHES || !shot.message.includes('did not answer Page.captureScreenshot')) throw shot;
  }
}

async function start({ offline = true, timeout = 120000, setup = 15000, wholeFrames = false } = {}) {
  const chrome = findChrome();
  const profile = mkdtempSync(join(tmpdir(), 'beeson-chrome-'));
  const args = chromeArgs({ profile, offline, wholeFrames });
  const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  let networkCrashes = 0;
  const onNetworkCrash = new Set();
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-2000);
    if (!chunk.includes('Network service crashed')) return;
    networkCrashes++;
    for (const listener of onNetworkCrash) listener();
  });
  let hasExited = false;
  let started = false;
  const exited = new Promise((done) => child.once('exit', (...a) => {
    hasExited = true;
    done(...a);
  }));
  const crashed = new Promise((_, fail) => {
    child.once('exit', (code, signal) => fail(new Error(`Chrome exited with ${signal ?? `code ${code}`}\n${stderr}`)));
  });
  crashed.catch(() => {});
  child.stdio[3].on('error', () => {});

  function answered(promise, what, limit = timeout) {
    let timer;
    const late = new Promise((_, fail) => {
      timer = setTimeout(() => fail(new Error(`Chrome did not answer ${what} within ${limit} ms\n${stderr}`)), limit);
    });
    return Promise.race([promise, late, crashed]).finally(() => clearTimeout(timer));
  }

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  const parts = [];
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', (chunk) => {
    let end;
    while ((end = chunk.indexOf('\0')) >= 0) {
      parts.push(chunk.slice(0, end));
      chunk = chunk.slice(end + 1);
      const message = JSON.parse(parts.join(''));
      parts.length = 0;
      if (message.id && pending.has(message.id)) {
        const { done, fail } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) fail(new Error(`${message.error.message} (${message.error.code})`));
        else done(message.result);
      } else if (message.method) {
        for (const listener of listeners) listener(message);
      }
    }
    if (chunk) parts.push(chunk);
  });

  function send(method, params = {}, sessionId, limit = timeout) {
    const id = nextId++;
    child.stdio[3].write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    const what = typeof params.expression === 'string' ? `${method} of ${params.expression.slice(0, 300)}` : method;
    return answered(new Promise((done, fail) => pending.set(id, { done, fail, sessionId })), what, limit)
      .finally(() => pending.delete(id));
  }

  function failCalls(sessionId, error) {
    for (const call of pending.values()) if (call.sessionId === sessionId) call.fail(error);
  }

  async function newPage({ width = 1920, height = 1080, mobile = false, scale = 1, motion = false, drafts = false } = {}) {
    const setupLimit = Math.min(timeout, setup);
    const cleanupLimit = Math.min(timeout, 2000);
    let targetId;
    let sessionId;
    let call;
    let errors;
    let onEvent;
    let closed = false;
    for (let n = 0; ; n++) {
      targetId = null;
      errors = [];
      onEvent = null;
      let onCrash;
      try {
        ({ targetId } = await send('Target.createTarget', { url: 'about:blank' }, undefined, started ? setupLimit : timeout));
        started = true;
        ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, undefined, setupLimit));
        call = (method, params, limit = timeout) => send(method, params, sessionId, limit);
        onEvent = ({ method, params, sessionId: from }) => {
          if (from !== sessionId) return;
          if (method === 'Runtime.exceptionThrown') {
            const details = params.exceptionDetails;
            errors.push(details.exception?.description ?? details.text);
          } else if (method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(params.type)) {
            errors.push(`console.${params.type}: ${params.args.map((a) => a.value ?? a.description).join(' ')}`);
          } else if (method === 'Log.entryAdded' && (params.entry.level === 'error' || params.entry.text.includes('GL_INVALID'))) {
            errors.push(`${params.entry.text} ${params.entry.url ?? ''}`.trim());
          }
        };
        listeners.add(onEvent);
        const targetLost = new Promise((_, fail) => {
          onCrash = ({ method, params, sessionId: from }) => {
            if (
              (from === sessionId && method === 'Inspector.targetCrashed') ||
              (method === 'Target.targetCrashed' && params?.targetId === targetId) ||
              (method === 'Target.detachedFromTarget' && params?.sessionId === sessionId)
            ) {
              fail(new Error(`Chrome target ${targetId} closed during setup (${method})`));
            }
          };
          listeners.add(onCrash);
        });
        targetLost.catch(() => {});
        const settingUp = (async () => {
          await Promise.all([
            call('Page.enable', {}, setupLimit),
            call('Runtime.enable', {}, setupLimit),
            call('Log.enable', {}, setupLimit),
          ]);
          await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile }, setupLimit);
          if (mobile) await call('Emulation.setTouchEmulationEnabled', { enabled: true }, setupLimit);
          if (motion) await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, setupLimit);
          if (!drafts) {
            await call('Page.addScriptToEvaluateOnNewDocument', {
              source: `{
                const set = Storage.prototype.setItem;
                Storage.prototype.setItem = function (key, value) {
                  if (!String(key).startsWith('beeson-draft:')) set.call(this, key, value);
                };
              }`,
            }, setupLimit);
          }
        })();
        settingUp.catch(() => {});
        await Promise.race([settingUp, targetLost]);
        listeners.delete(onCrash);
        const ask = call;
        call = (method, params, limit) => (closed
          ? Promise.reject(new Error(`${method} was not sent, since the page is closed`))
          : ask(method, params, limit));
        break;
      } catch (error) {
        if (onEvent) listeners.delete(onEvent);
        if (onCrash) listeners.delete(onCrash);
        if (targetId && !hasExited) {
          await send('Target.closeTarget', { targetId }, undefined, cleanupLimit).catch(() => {});
        }
        if (hasExited || n === 2) throw error;
      }
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

    const next = (method) => {
      let on;
      const heard = new Promise((done) => {
        on = ({ method: event, params, sessionId: from }) => {
          if (from !== sessionId || event !== method) return;
          listeners.delete(on);
          done(params);
        };
        listeners.add(on);
      });
      return { heard, stop: () => listeners.delete(on) };
    };

    return {
      errors,
      evaluate,
      send: call,
      next: (method, limit = timeout) => {
        const { heard, stop } = next(method);
        return answered(heard, method, limit).finally(stop);
      },
      async goto(url) {
        const once = async (method, params) => {
          const { heard, stop } = next('Page.loadEventFired');
          try {
            const { errorText } = await call(method, params);
            if (errorText) throw new Error(`${url}: ${errorText}`);
            await answered(heard, `the load of ${url}`).catch(async (error) => {
              const state = await answered(evaluate(LOADING), 'the state of the page', 5000).catch((e) => e.message.split('\n')[0]);
              error.message = error.message.replace('\n', `, and the page holds ${JSON.stringify(state)}\n`);
              throw error;
            });
          } finally {
            stop();
          }
        };
        const load = async (method, params) => {
          for (let n = 0; ; n++) {
            const seen = networkCrashes;
            let crash;
            const crashed = new Promise((done) => onNetworkCrash.add((crash = done)));
            const attempt = once(method, params);
            attempt.catch(() => {});
            try {
              if ((await Promise.race([attempt.then(() => 'loaded'), crashed])) === 'loaded') return;
            } catch (error) {
              if (networkCrashes === seen && error.message.includes('net::ERR_ABORTED')) await Promise.race([crashed, sleep(CRASH_LINE_WAIT)]);
              if (networkCrashes === seen || n === 2) throw error;
            } finally {
              onNetworkCrash.delete(crash);
            }
            if (n === 2) throw new Error(`${url}: the network service of Chrome crashed three times`);
          }
        };
        const before = errors.length;
        const refused = () => {
          const found = errors.slice(before).some((error) => error.includes('net::ERR_NO_BUFFER_SPACE'));
          if (found) errors.splice(before);
          return found;
        };
        await load('Page.navigate', { url });
        for (let n = 0; n < 2 && refused(); n++) await load('Page.reload', { ignoreCache: true });
      },
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
      async screenshot(clip) {
        const { data } = await call('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
        return Buffer.from(data, 'base64');
      },
      async pdf() {
        const pages = await evaluate(`document.querySelectorAll('.pdf-page').length`);
        const { data } = await call('Page.printToPDF', {
          preferCSSPageSize: true,
          printBackground: true,
          displayHeaderFooter: false,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        }, timeout + pages * PRINT_PER_PAGE);
        return Buffer.from(data, 'base64');
      },
      async close() {
        listeners.delete(onEvent);
        closed = true;
        try {
          await send('Target.closeTarget', { targetId });
        } finally {
          failCalls(sessionId, new Error('the call was not answered, since the page is closed'));
        }
      },
    };
  }

  async function close() {
    let timer;
    try {
      send('Browser.close').catch(() => {});
      await Promise.race([exited, new Promise((done) => (timer = setTimeout(done, Math.min(timeout, 5000))))]);
    } finally {
      clearTimeout(timer);
      if (!hasExited) child.kill();
      await exited;
      for (const stream of child.stdio) stream?.destroy();
      await removeProfile(profile).catch((error) => leaveProfile(profile, error));
    }
  }

  return { newPage, close };
}

export const deckSettled = `(async () => {
  if (!window.Reveal?.isReady()) return false;
  await document.fonts.ready;
  await window.MathJax?.startup?.promise;
  await Promise.all((window.Beeson?.backdrops ?? []).map((backdrop) => backdrop.ready));
  await window.Beeson?.figures?.ready;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return true;
})()`;

export async function printView(page, url) {
  await page.goto(url);
  await page.waitFor(`!!document.querySelector('.pdf-page')
    && !document.querySelector('.reveal-viewport.loading-scroll-mode')`, 120000);
  await page.waitFor(deckSettled);
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
