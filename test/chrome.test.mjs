// checks of the Chrome lookup in scripts/chrome.mjs, with a stand-in executable for each OS

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

// with the network allowed, Chrome downloads components and models into its profile in the
// background, about 13 s after its start. On Windows, such a file is still locked at close(), and
// the removal of the profile fails
test('Chrome does not download a component or a model into its profile', { timeout: 90000 }, async (t) => {
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto('chrome://version');
  // the path is filled in after the load of the page
  await page.waitFor(`!!document.getElementById('profile_path')?.textContent.trim()`);
  const profile = dirname(await page.evaluate(`document.getElementById('profile_path').textContent.trim()`));
  assert.ok(existsSync(join(profile, 'Local State')), `${profile} is not the profile of the browser`);
  await sleep(25000);
  // the folders of the models, of the components, and of one component. Without a download, Chrome
  // writes only the index of the components and, on Linux, the path of the Widevine module that is
  // installed with it. A downloaded module is in a folder of its version
  const written = ['component_crx_cache/metadata.json', 'WidevineCdm/latest-component-updated-widevine-cdm'];
  const downloaded = ['optimization_guide_model_store', 'component_crx_cache', 'WidevineCdm'].flatMap((name) => (existsSync(join(profile, name)) ? readdirSync(join(profile, name)).map((file) => `${name}/${file}`) : []));
  assert.deepEqual(downloaded.filter((file) => !written.includes(file)), []);
});

test('an early exit of Chrome is reported', (t) => {
  const out = mkdtempSync(join(tmpdir(), 'slides-check-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));

  // node is used as the executable, since it exits at once on the flags of Chrome
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

  const browser = await launch({ timeout: 200 });

  await assert.rejects(browser.newPage(), /did not answer/);
  await browser.close();
});

test('a page opened with motion is shown without reduced motion', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });

  assert.equal(await page.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`), false);
  assert.equal(await page.evaluate(`matchMedia('(prefers-reduced-motion: no-preference)').matches`), true);
});

// within 1 s of its last change, the editor keeps the unsaved edits of a page in the storage of the
// browser under a key that starts with beeson-draft:, and offers them on a card over the slide of
// the next page of the deck. on a slow runner, the next page of a test file was offered the edits
// of the page before
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

// on a Windows runner of GitHub, about one page in a few thousand is refused one of its files with
// net::ERR_NO_BUFFER_SPACE, while ports and memory are free. the page of this test reports the
// error at its first load only
test('a page that is refused a file with net::ERR_NO_BUFFER_SPACE is loaded again', { timeout: 60000 }, async (t) => {
  const { serve } = await import('../scripts/webdriver.mjs');
  const root = mkdtempSync(join(tmpdir(), 'slides-refused-'));
  // with an icon in the page, Chrome does not ask the server for a favicon, which it does not have
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
  // another error is kept, and its page is not loaded again
  await page.goto(`${server.origin}/page.html?other`);
  assert.equal(await page.evaluate(`localStorage.getItem('loads')`), '3');
  assert.deepEqual(page.errors, ['console.error: another error']);
});

// in R7.1, the process of a test file of the editor stayed alive for 20 s to 50 s after its last test,
// since the stderr pipe of Chrome was held open by chrome_crashpad_handler and GoogleUpdater, which
// inherit it and outlive Chrome, and close() left a timer of 2 s. the timer is found in every run,
// and the pipe when a helper is still running 200 ms after close()
test('close() leaves neither a pipe to Chrome nor a timer', { timeout: 60000 }, async () => {
  const { serve } = await import('../scripts/webdriver.mjs');
  // the count of each kind of resource, of which an earlier test may still hold some
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
