// checks of the Chrome lookup in scripts/chrome.mjs, with a stand-in executable for each OS

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findChrome } from '../scripts/chrome.mjs';

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
