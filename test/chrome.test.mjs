import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { findChrome, launch, removeProfile } from '../scripts/chrome.mjs';

function standIn(t, path) {
  const root = mkdtempSync(join(tmpdir(), 'slides-chrome-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), '');
  return root;
}

test('CHROME_PATH is used first', (t) => {
  const root = standIn(t, 'chrome');
  assert.equal(findChrome({ env: { CHROME_PATH: join(root, 'chrome') }, platform: 'linux' }), join(root, 'chrome'));
});

test('a missing CHROME_PATH is an error, and the lookup is not continued', (t) => {
  const root = standIn(t, 'google-chrome');
  assert.throws(() => findChrome({ env: { CHROME_PATH: join(root, 'missing'), PATH: root }, platform: 'linux' }), /CHROME_PATH/);
});

test('Chrome is found on the PATH on Linux', (t) => {
  const root = standIn(t, 'chromium');
  assert.equal(findChrome({ env: { PATH: root }, platform: 'linux' }), join(root, 'chromium'));
});

test('Chrome is found in Program Files on Windows', (t) => {
  const path = join('Google', 'Chrome', 'Application', 'chrome.exe');
  const root = standIn(t, path);
  assert.equal(findChrome({ env: { PROGRAMFILES: root }, platform: 'win32' }), join(root, path));
});

test('Chrome is found in the local application data on Windows', (t) => {
  const path = join('Google', 'Chrome', 'Application', 'chrome.exe');
  const root = standIn(t, path);
  assert.equal(findChrome({ env: { LOCALAPPDATA: root }, platform: 'win32' }), join(root, path));
});

test('Edge is used on Windows when Chrome is missing', (t) => {
  const path = join('Microsoft', 'Edge', 'Application', 'msedge.exe');
  const root = standIn(t, path);
  assert.equal(findChrome({ env: { 'PROGRAMFILES(X86)': root }, platform: 'win32' }), join(root, path));
});

test('CHROME_PATH is named in the error when a browser is not found', () => {
  assert.throws(() => findChrome({ env: {}, platform: 'linux' }), /Set CHROME_PATH/);
});

test('a profile is removed while a helper process of Chrome still writes to it', async (t) => {
  const profile = mkdtempSync(join(tmpdir(), 'slides-profile-'));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  const writer = spawn(process.execPath, [
    '-e',
    `const { writeFileSync } = require('node:fs');
     const end = Date.now() + 300;
     for (let i = 0; Date.now() < end; i++) {
       try { writeFileSync(${JSON.stringify(profile)} + '/' + i, ''); } catch {}
     }`,
  ]);
  const exited = new Promise((done) => writer.once('exit', done));
  while (readdirSync(profile).length === 0) await sleep(5);

  await removeProfile(profile);
  await exited;
  assert.ok(!existsSync(profile));
});

test('Chrome does not download a component or a model into its profile', { timeout: 90000 }, async (t) => {
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto('chrome://version');
  await page.waitFor(`!!document.getElementById('profile_path')?.textContent.trim()`);
  const profile = dirname(await page.evaluate(`document.getElementById('profile_path').textContent.trim()`));
  const deadline = Date.now() + 20000;
  while (!existsSync(join(profile, 'Local State')) && Date.now() < deadline) await sleep(100);
  assert.ok(existsSync(join(profile, 'Local State')), `${profile} is not the profile of the browser`);
  await sleep(25000);
  const written = ['component_crx_cache/metadata.json', 'WidevineCdm/latest-component-updated-widevine-cdm'];
  const downloaded = ['optimization_guide_model_store', 'component_crx_cache', 'WidevineCdm'].flatMap((name) => (existsSync(join(profile, name)) ? readdirSync(join(profile, name)).map((file) => `${name}/${file}`) : []));
  assert.deepEqual(downloaded.filter((file) => !written.includes(file)), []);
});

test('an early exit of Chrome is reported', (t) => {
  const out = mkdtempSync(join(tmpdir(), 'slides-check-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));

  const { status, stderr } = spawnSync(process.execPath, ['scripts/check.mjs', '--out', out], {
    env: { ...process.env, CHROME_PATH: process.execPath },
    encoding: 'utf8',
  });

  assert.match(stderr, /Chrome exited/);
  assert.equal(status, 1);
});

test('a Chrome that does not answer is reported', { skip: process.platform === 'win32', timeout: 5000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'slides-silent-'));
  t.after(() => {
    delete process.env.CHROME_PATH;
    rmSync(root, { recursive: true, force: true });
  });
  process.env.CHROME_PATH = join(root, 'chrome');
  writeFileSync(process.env.CHROME_PATH, '#!/bin/sh\nexec sleep 30\n', { mode: 0o755 });

  await assert.rejects(launch({ timeout: 200 }), /did not answer/);
});

test('a page opened with motion is shown without reduced motion', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });

  assert.equal(await page.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`), false);
  assert.equal(await page.evaluate(`matchMedia('(prefers-reduced-motion: no-preference)').matches`), true);
});

test('a call to a closed page fails at once, and a call in flight at the close fails with it', { timeout: 60000 }, async (t) => {
  const browser = await launch({ timeout: 10000 });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const inFlight = page.evaluate('new Promise(() => {})');
  inFlight.catch(() => {});
  await page.close();

  await assert.rejects(inFlight, /the page is closed/);
  await assert.rejects(page.evaluate('1'), /the page is closed/);
  await assert.rejects(page.send('Page.reload'), /the page is closed/);
});

test('a page does not keep the unsaved edits of the editor in the storage, unless it is opened with drafts', { timeout: 60000 }, async (t) => {
  const { serve } = await import('../scripts/webdriver.mjs');
  const root = mkdtempSync(join(tmpdir(), 'slides-drafts-'));
  writeFileSync(join(root, 'page.html'), '<!doctype html><link rel="icon" href="data:,">');
  const browser = await launch({ offline: false });
  const server = await serve(root);
  t.after(async () => {
    await browser.close();
    server.close();
    rmSync(root, { recursive: true, force: true });
  });
  const keep = `(localStorage.setItem('beeson-draft:' + location.href, 'edits'), localStorage.setItem('mode', 'dark'), true)`;
  const kept = `[localStorage.getItem('beeson-draft:' + location.href), localStorage.getItem('mode')]`;
  const page = await browser.newPage();
  await page.goto(`${server.origin}/page.html`);
  await page.evaluate(keep);
  assert.deepEqual(await page.evaluate(kept), [null, 'dark']);
  const withDrafts = await browser.newPage({ drafts: true });
  await withDrafts.goto(`${server.origin}/page.html`);
  await withDrafts.evaluate(keep);
  assert.deepEqual(await withDrafts.evaluate(kept), ['edits', 'dark']);
});

test('a page that is refused a file with net::ERR_NO_BUFFER_SPACE is loaded again', { timeout: 60000 }, async (t) => {
  const { serve } = await import('../scripts/webdriver.mjs');
  const root = mkdtempSync(join(tmpdir(), 'slides-refused-'));
  writeFileSync(join(root, 'page.html'), `<!doctype html><link rel="icon" href="data:,"><script>
    const loads = Number(localStorage.getItem('loads') ?? 0) + 1;
    localStorage.setItem('loads', loads);
    if (loads === 1) console.error('Failed to load resource: net::ERR_NO_BUFFER_SPACE ' + location.origin + '/tex.js');
    if (new URLSearchParams(location.search).has('other')) console.error('another error');
  </script>`);
  const browser = await launch({ offline: false });
  const server = await serve(root);
  t.after(async () => {
    await browser.close();
    server.close();
    rmSync(root, { recursive: true, force: true });
  });
  const page = await browser.newPage();
  await page.goto(`${server.origin}/page.html`);
  assert.equal(await page.evaluate(`localStorage.getItem('loads')`), '2', 'the page is not loaded again');
  assert.deepEqual(page.errors, []);
  await page.goto(`${server.origin}/page.html?other`);
  assert.equal(await page.evaluate(`localStorage.getItem('loads')`), '3');
  assert.deepEqual(page.errors, ['console.error: another error']);
});

function networkService() {
  const rows = spawnSync('ps', ['-A', '-o', 'pid=,ppid=,command='], { encoding: 'utf8' }).stdout.split('\n');
  const procs = rows.map((row) => row.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map(([, pid, ppid, command]) => ({ pid: Number(pid), ppid: Number(ppid), command }));
  const browsers = new Set(procs.filter((p) => p.ppid === process.pid).map((p) => p.pid));
  return procs.find((p) => browsers.has(p.ppid) && p.command.includes('network.mojom.NetworkService'))?.pid;
}

test('a load in flight when the network service of Chrome crashes is made again', { skip: process.platform === 'win32', timeout: 60000 }, async (t) => {
  const { createServer } = await import('node:http');
  const server = createServer((request, response) => setTimeout(() => response.end('<!doctype html><link rel="icon" href="data:,"><p>loaded</p>'), 1000)).listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const browser = await launch({ offline: false, timeout: 20000 });
  t.after(async () => {
    await browser.close();
    server.close();
  });
  const page = await browser.newPage();
  const loading = page.goto(`http://127.0.0.1:${server.address().port}/`);
  let pid;
  for (let n = 0; n < 100 && !pid; n++) {
    pid = networkService();
    if (!pid) await sleep(20);
  }
  assert.ok(pid, 'the network service of Chrome is not found');
  process.kill(pid, 'SIGKILL');
  await loading;
  assert.equal(await page.evaluate('document.body.textContent'), 'loaded');
});

test('the errors of a load that is refused a file are dropped with the load', { timeout: 60000 }, async (t) => {
  const { serve } = await import('../scripts/webdriver.mjs');
  const root = mkdtempSync(join(tmpdir(), 'slides-refused-'));
  writeFileSync(join(root, 'page.html'), `<!doctype html><link rel="icon" href="data:,"><script>
    const loads = Number(localStorage.getItem('loads') ?? 0) + 1;
    localStorage.setItem('loads', loads);
    if (new URLSearchParams(location.search).has('before')) console.error('an error of the page before');
    else if (loads === 2) {
      console.error('Failed to load resource: net::ERR_NO_BUFFER_SPACE ' + location.origin + '/theme/mathjax-config.js');
      console.error('Failed to load resource: net::ERR_NAME_NOT_RESOLVED https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font/svg.js');
    }
  </script>`);
  const browser = await launch({ offline: false });
  const server = await serve(root);
  t.after(async () => {
    await browser.close();
    server.close();
    rmSync(root, { recursive: true, force: true });
  });
  const page = await browser.newPage();
  await page.goto(`${server.origin}/page.html?before`);
  await page.goto(`${server.origin}/page.html`);
  assert.equal(await page.evaluate(`localStorage.getItem('loads')`), '3', 'the page is not loaded again');
  assert.deepEqual(page.errors, ['console.error: an error of the page before']);
});

test('close() leaves neither a pipe to Chrome nor a timer', { timeout: 60000 }, async () => {
  const { serve } = await import('../scripts/webdriver.mjs');
  const kinds = () => Object.fromEntries(['PipeWrap', 'ProcessWrap', 'Timeout'].map((k) => [k, process.getActiveResourcesInfo().filter((r) => r === k).length]));
  const before = kinds();
  const server = await serve('.');
  const browser = await launch({ offline: false });
  const page = await browser.newPage();
  await page.goto(`${server.origin}/test/pages/editor-layouts.html?edit&still`);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  await browser.close();
  server.close();
  await sleep(200);
  const now = kinds();
  for (const k of Object.keys(now)) assert.ok(now[k] <= before[k], `close() leaves ${JSON.stringify(now)}, against ${JSON.stringify(before)} before launch()`);
});

test('chromeArgs disables MacAppCodeSignClone on macOS only, in the one --disable-features of a platform', async () => {
  const { chromeArgs } = await import('../scripts/chrome.mjs');
  const features = (platform) => chromeArgs({ profile: 'p', platform }).filter((arg) => arg.startsWith('--disable-features='));
  assert.deepEqual(features('darwin'), ['--disable-features=MacAppCodeSignClone']);
  for (const platform of ['win32', 'linux']) {
    assert.ok(features(platform).length <= 1, `Chrome reads only the last of ${features(platform)}`);
    assert.ok(!features(platform).join().includes('MacAppCodeSignClone'));
  }
});

function codeSignClones() {
  const folder = join(dirname(execFileSync('getconf', ['DARWIN_USER_TEMP_DIR'], { encoding: 'utf8' }).trim()), 'X');
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.endsWith('.code_sign_clone'))
    .flatMap((name) => readdirSync(join(folder, name)).map((clone) => join(name, clone)));
}

test('Chrome does not copy its app into a temp folder of macOS', { skip: process.platform !== 'darwin', timeout: 60000 }, async () => {
  for (let attempt = 1; ; attempt++) {
    const before = new Set(codeSignClones());
    const browser = await launch();
    await browser.newPage();
    const copies = codeSignClones().filter((clone) => !before.has(clone));
    await browser.close();
    if (copies.length === 0) return;
    assert.ok(attempt < 3, `a copy of the app was made at each of 3 starts of Chrome, the last one at ${copies}`);
  }
});

test('close() leaves Chrome to exit after Browser.close, and does not end it with a signal', { skip: process.platform === 'win32', timeout: 10000 }, async (t) => {
  pipeChrome(t, 'slowClose');
  const signaled = join(dirname(process.env.CHROME_PATH), 'signaled');
  const browser = await launch({ timeout: 5000 });
  await browser.close();
  assert.ok(!existsSync(signaled));
});

test('close() ends a Chrome that does not exit after Browser.close', { skip: process.platform === 'win32', timeout: 10000 }, async (t) => {
  pipeChrome(t, 'hangClose');
  const signaled = join(dirname(process.env.CHROME_PATH), 'signaled');
  const browser = await launch({ timeout: 500 });
  await browser.close();
  assert.ok(existsSync(signaled));
});

test('chromeArgs disables TcpPortRandomizationWin on Windows only', async () => {
  const { chromeArgs } = await import('../scripts/chrome.mjs');
  assert.equal(typeof chromeArgs, 'function');
  assert.ok(chromeArgs({ profile: 'p', platform: 'win32' }).includes('--disable-features=TcpPortRandomizationWin'));
  assert.ok(!chromeArgs({ profile: 'p', platform: 'linux' }).includes('--disable-features=TcpPortRandomizationWin'));
});

test('on the Windows runners, chromeArgs draws WebGL in WARP and composites the page in software', async () => {
  const { chromeArgs } = await import('../scripts/chrome.mjs');
  const flags = ['--use-angle=d3d11-warp', '--disable-gpu-compositing'];
  for (const flag of flags) {
    assert.ok(chromeArgs({ profile: 'p', platform: 'win32', ci: true }).includes(flag), flag);
    assert.ok(!chromeArgs({ profile: 'p', platform: 'win32', ci: false }).includes(flag), flag);
    assert.ok(!chromeArgs({ profile: 'p', platform: 'linux', ci: true }).includes(flag), flag);
    assert.ok(!chromeArgs({ profile: 'p', platform: 'darwin', ci: true }).includes(flag), flag);
  }
});

test('an earlier net::ERR_NO_BUFFER_SPACE does not reload a later goto', { timeout: 60000 }, async (t) => {
  const { serve } = await import('../scripts/webdriver.mjs');
  const root = mkdtempSync(join(tmpdir(), 'slides-refused-'));
  writeFileSync(join(root, 'page.html'), `<!doctype html><link rel="icon" href="data:,"><script>
    const loads = Number(localStorage.getItem('loads') ?? 0) + 1;
    localStorage.setItem('loads', loads);
  </script>`);
  const browser = await launch({ offline: false });
  const server = await serve(root);
  t.after(async () => {
    await browser.close();
    server.close();
    rmSync(root, { recursive: true, force: true });
  });
  const page = await browser.newPage();
  await page.goto(`${server.origin}/page.html?first`);
  await page.evaluate(`console.error('Failed to load resource: net::ERR_NO_BUFFER_SPACE ' + location.origin + '/theme/macros.js')`);
  await page.goto(`${server.origin}/page.html?second`);
  assert.equal(await page.evaluate(`localStorage.getItem('loads')`), '2');
  assert.deepEqual(page.errors, [
    `console.error: Failed to load resource: net::ERR_NO_BUFFER_SPACE ${server.origin}/theme/macros.js`,
  ]);
});

const startHold = 700;

function pipeChrome(t, mode, { hold = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'slides-pipe-chrome-'));
  const previous = process.env.CHROME_PATH;
  t.after(() => {
    if (previous === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = previous;
    rmSync(root, { recursive: true, force: true });
  });
  const exe = join(root, 'chrome');
  writeFileSync(
    exe,
    `#!/usr/bin/env node
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${hold});
const fs = require('node:fs');
const mode = ${JSON.stringify(mode)};
const input = fs.createReadStream(null, { fd: 3 });
const output = fs.createWriteStream(null, { fd: 4 });
const send = (msg) => output.write(JSON.stringify(msg) + '\\0');
fs.writeFileSync(__dirname + '/ready', '');
fs.appendFileSync(__dirname + '/log', 'launch ');
const exitWithoutWaitingForPipeRead = () => process.kill(process.pid, 'SIGKILL');
process.on('SIGTERM', () => {
  fs.writeFileSync(__dirname + '/signaled', '');
  exitWithoutWaitingForPipeRead();
});
let buf = '';
let creates = 0;
let targets = 0;
const closed = [];
const ready = Date.now() + (mode === 'slowStart' ? 1500 : 0);
input.setEncoding('utf8');
input.on('data', function read(chunk) {
  buf += chunk;
  if (Date.now() < ready) {
    setTimeout(() => read(''), ready - Date.now());
    return;
  }
  for (let end; (end = buf.indexOf('\\0')) >= 0;) {
    const msg = JSON.parse(buf.slice(0, end));
    buf = buf.slice(end + 1);
    if (msg.method === 'Target.createTarget') {
      creates++;
      if (mode === 'hangCreateFirst' && creates === 1) continue;
      targets++;
      send({ id: msg.id, result: { targetId: 't' + targets } });
    } else if (msg.method === 'Target.attachToTarget') {
      send({ id: msg.id, result: { sessionId: 's' + msg.params.targetId } });
    } else if (msg.method === 'Target.closeTarget') {
      closed.push(msg.params.targetId);
      fs.appendFileSync(__dirname + '/log', 'closeTarget ');
      if (mode === 'hangCloseFirst' && msg.params.targetId === 't1') continue;
      send({ id: msg.id, result: { success: true } });
    } else if (msg.method === 'Page.enable') {
      if (mode === 'hangAll' || ((mode === 'hangFirst' || mode === 'hangCloseFirst') && msg.sessionId === 'st1')) continue;
      if (mode === 'detachFirst' && msg.sessionId === 'st1') {
        send({ method: 'Target.detachedFromTarget', params: { sessionId: 'st1', targetId: 't1' } });
        continue;
      }
      send({ id: msg.id, result: {} });
    } else if (msg.method === 'Runtime.evaluate' && msg.params.expression.includes('.pdf-page')) {
      send({ id: msg.id, result: { result: { value: mode === 'hangPrint' ? 1 : 40 } } });
    } else if (msg.method === 'Runtime.evaluate') {
      send({ id: msg.id, result: { result: { value: { creates, targets, closed } } } });
    } else if (msg.method === 'Page.printToPDF') {
      if (mode === 'slowPrint') setTimeout(() => send({ id: msg.id, result: { data: Buffer.from('%PDF-'.repeat(200000)).toString('base64') } }), 1000);
    } else if (msg.method === 'Page.captureScreenshot') {
      if (mode === 'hangShotOnce' && !fs.existsSync(__dirname + '/hung')) {
        fs.writeFileSync(__dirname + '/hung', '');
        continue;
      }
      send({ id: msg.id, result: { data: '' } });
    } else if (msg.method === 'Browser.close') {
      fs.appendFileSync(__dirname + '/log', 'close ');
      send({ id: msg.id, result: {} });
      if (mode === 'slowClose') setTimeout(exitWithoutWaitingForPipeRead, 300);
      else if (mode !== 'hangClose') process.exit(0);
    } else {
      send({ id: msg.id, result: {} });
    }
  }
});
`,
    { mode: 0o755 },
  );
  process.env.CHROME_PATH = exe;
  return Object.assign(async () => {
    while (!existsSync(join(root, 'ready'))) await sleep(10);
  }, { log: () => readFileSync(join(root, 'log'), 'utf8') });
}

test('a Chrome whose first screenshot is not answered is closed and launched again, and the page of the probe is left open', { skip: process.platform === 'win32', timeout: 8000 }, async (t) => {
  const chrome = pipeChrome(t, 'hangShotOnce');
  const browser = await launch({ probe: 500 });
  await browser.close();

  assert.equal(chrome.log(), 'launch close launch close ');
});

test('newPage recovers when a fresh target does not answer Page.enable', { skip: process.platform === 'win32', timeout: 5000 }, async (t) => {
  const ready = pipeChrome(t, 'hangFirst', { hold: startHold });
  const browser = await launch({ timeout: 400, probe: 0 });
  await ready();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const state = await page.evaluate('state');
  assert.deepEqual(state, { creates: 2, targets: 2, closed: ['t1'] });
});

test('the first page of a Chrome that starts slower than the setup of a page is opened within the timeout', { skip: process.platform === 'win32', timeout: 8000 }, async (t) => {
  pipeChrome(t, 'slowStart');
  const browser = await launch({ timeout: 4000, setup: 300, probe: 0 });
  t.after(() => browser.close());
  const page = await browser.newPage();
  assert.deepEqual(await page.evaluate('state'), { creates: 1, targets: 1, closed: [] });
});

test('newPage recovers when Target.createTarget hangs or Target.closeTarget hangs during cleanup', { skip: process.platform === 'win32', timeout: 8000 }, async (t) => {
  const readyA = pipeChrome(t, 'hangCreateFirst', { hold: startHold });
  const browserA = await launch({ timeout: 400, probe: 0 });
  await readyA();
  t.after(() => browserA.close());
  const pageA = await browserA.newPage();
  assert.deepEqual(await pageA.evaluate('state'), { creates: 2, targets: 1, closed: [] });

  const readyB = pipeChrome(t, 'hangCloseFirst', { hold: startHold });
  const browserB = await launch({ timeout: 400, probe: 0 });
  await readyB();
  t.after(() => browserB.close());
  const pageB = await browserB.newPage();
  assert.deepEqual(await pageB.evaluate('state'), { creates: 2, targets: 2, closed: ['t1'] });
});

test('newPage recovers immediately when a fresh target detaches during setup', { skip: process.platform === 'win32', timeout: 5000 }, async (t) => {
  const ready = pipeChrome(t, 'detachFirst', { hold: startHold });
  const browser = await launch({ timeout: 3000, probe: 0 });
  await ready();
  t.after(() => browser.close());
  const started = Date.now();
  const page = await browser.newPage();
  assert.ok(Date.now() - started < 1000, 'newPage waited for the command timeout instead of Target.detachedFromTarget');
  assert.deepEqual(await page.evaluate('state'), { creates: 2, targets: 2, closed: ['t1'] });
});

test('a print of many pages is waited for longer than the limit of a call, in proportion to its pages', { skip: process.platform === 'win32', timeout: 30000 }, async (t) => {
  pipeChrome(t, 'slowPrint');
  const browser = await launch({ timeout: 300, probe: 0 });
  t.after(() => browser.close());
  const page = await browser.newPage();

  assert.equal((await page.pdf()).toString(), '%PDF-'.repeat(200000));
});

test('a print that Chrome does not answer still fails, and names Page.printToPDF', { skip: process.platform === 'win32', timeout: 30000 }, async (t) => {
  pipeChrome(t, 'hangPrint');
  const browser = await launch({ timeout: 300, probe: 0 });
  t.after(() => browser.close());
  const page = await browser.newPage();

  await assert.rejects(page.pdf(), /did not answer Page\.printToPDF/);
});

test('newPage still fails when every target hangs on Page.enable', { skip: process.platform === 'win32', timeout: 8000 }, async (t) => {
  const ready = pipeChrome(t, 'hangAll', { hold: startHold });
  const browser = await launch({ timeout: 500, probe: 0 });
  await ready();
  t.after(() => browser.close());
  await assert.rejects(browser.newPage(), /did not answer Page\.enable/);
});

test('close() ends without an error when the profile cannot be removed, and names the profile on stderr', { skip: process.platform === 'win32' || process.getuid?.() === 0, timeout: 15000 }, async (t) => {
  pipeChrome(t, 'answerAll');
  const parent = mkdtempSync(join(tmpdir(), 'slides-locked-'));
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = parent;
  t.after(() => {
    chmodSync(parent, 0o755);
    rmSync(parent, { recursive: true, force: true });
  });
  let browser;
  try {
    browser = await launch({ timeout: 5000, probe: 0 });
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
  }
  const [profile] = readdirSync(parent);
  chmodSync(parent, 0o555);
  const written = [];
  const write = process.stderr.write;
  t.mock.method(process.stderr, 'write', function (chunk, ...rest) {
    written.push(String(chunk));
    return write.call(this, chunk, ...rest);
  });

  await browser.close();

  assert.ok(existsSync(join(parent, profile)));
  assert.equal(written.filter((text) => text.includes(join(parent, profile))).length, 1, written.join(''));
});
