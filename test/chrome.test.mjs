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
