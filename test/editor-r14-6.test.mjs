// the work of R14.6 on both platforms and in both appearances: the contrast of the last small texts
// of the chrome, View > Slide Only chosen twice in a narrow window, and a typed slide number that
// jumps back in the show played by Present

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { contrast, GROUND, INK, press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const SCHEMES = ['light', 'dark'];

let browser;
let server;
before(async () => {
  browser = await launch({ offline: false });
  server = await serve('.');
});
after(async () => {
  await browser?.close();
  server?.close();
});

const js = (v) => JSON.stringify(v);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on index.html in the appearance scheme, with the local storage cleared
async function load(t, platform, scheme, { width = 1600, height = 1000 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await page.send('Storage.clearDataForOrigin', { origin: server.origin, storageTypes: 'local_storage' });
  await page.goto(`${server.origin}/index.html?edit&still&theme=${scheme}&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await frames(page);
  return page;
}

const below = (rows, min) => rows.filter((r) => contrast(r.fg, r.bg) < min).map((r) => `${r.what}: ${r.fg} on ${r.bg} is ${contrast(r.fg, r.bg).toFixed(2)}:1`);
const measure = (page, selector) => page.evaluate(`(() => {
  const e = document.querySelector(${js(selector)});
  return e && e.getClientRects().length ? { what: e.textContent.trim().slice(0, 30), fg: ${INK}(e), bg: ${GROUND}(e) } : { what: ${js(selector)} + ' is not shown', fg: 'rgb(0, 0, 0)', bg: 'rgb(0, 0, 0)' };
})()`);

// D6 to D9: the prompt and the key hint of the Insert Formula dialog, the zoom readout of the notes
// pane at the opacity of its group, the key hint of the presenter display, and the number badges of
// the Steps pane measured under 4.5:1
for (const platform of PLATFORMS) {
  for (const scheme of SCHEMES) {
    test(`the last small texts of the chrome have a contrast of 4.5:1 on their ground (${platform}, ${scheme})`, async (t) => {
      const page = await load(t, platform, scheme);
      const seen = [];
      const n = await page.evaluate(`Reveal.getSlides().findIndex((s) => s.querySelector('.fragment'))`);
      assert.ok(n >= 0);
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      await exec(page, 'insert.formula');
      await page.waitFor(`!!document.querySelector('.beeson-tex .preview .empty')`);
      seen.push(await measure(page, '.beeson-tex .preview .empty'), await measure(page, '.beeson-math .hint'));
      await press(page, 'Escape');
      await frames(page);
      await exec(page, 'view.notes');
      await frames(page);
      seen.push(await measure(page, '.beeson-edit-notes-zoom .value'));
      await exec(page, 'view.notes');
      if (!(await page.evaluate(`!!document.querySelector('.beeson-badge')`))) await exec(page, 'view.steps');
      await page.waitFor(`!!document.querySelector('.beeson-badge')`);
      seen.push(await measure(page, '.beeson-badge'));
      await page.evaluate(`(() => { window.open = () => null; return true; })()`);
      await exec(page, 'play.customizePresenter');
      await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open] .hint')`);
      seen.push(await measure(page, 'dialog.beeson-edit-presenter .hint'));
      assert.equal(seen.length, 5);
      assert.deepEqual(below(seen, 4.5), []);
      assert.deepEqual(errors(page), []);
    });
  }
}
