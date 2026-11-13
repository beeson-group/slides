// the selection of the Steps tab through an undo and a redo of R16.6, with trusted input on either
// platform. a delay After Previous is written as data-autoslide on the step before, hence its undo
// changes another element than the selected one. the row of the step is still the one selected
// row after the undo and after the redo, and the Delay field writes its step again

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const SIDE = '.beeson-edit-side';
const REDO = { mac: 'Mod+Shift+Z', other: 'Mod+Y' };
const STEPPER = `${SIDE} .detail .ed-num .stepper button`;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const js = (v) => JSON.stringify(v);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const rendered = (page) => page.evaluate('window.BeesonEditor.render()');

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

// the editor on the demo deck, on the slide of the element matched by at, with the Steps tab shown
async function open(t, platform, at) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/index.html?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  await page.evaluate('localStorage.clear()');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`)).problems, []);
  await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
  await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector(${js(at)}).closest('section')).h)`);
  await sleep(150);
  await frames(page);
  return page;
}

// the texts of the selected rows of the Steps tab, each cut to its first 12 characters
const selectedRows = (page) =>
  page.evaluate(`[...document.querySelectorAll('${SIDE} .rows .row.selected')].map((r) => r.querySelector('.text').textContent.slice(0, 12))`);

// the center of the chip of the first row whose text starts with text
const chipOf = (page, text) =>
  page.evaluate(`(() => {
    const row = [...document.querySelectorAll('${SIDE} .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${js(text)}));
    const r = row.querySelector('.chip').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);

// After Previous chosen from the menu of the chip of the row of text, 300 ms after the press that
// opened the menu
async function afterPrevious(page, text) {
  await click(page, await chipOf(page, text));
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
  const at = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label').textContent === 'After Previous');
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await sleep(300);
  await click(page, at);
  await frames(page);
}

// the step of row, the tag of the step before it, on which its delay is written, and the slide
const CASES = [
  { name: 'an item of a list', at: 'li.fragment', row: 'Two elements', before: '<li class="fragment" data-fragment-index="1">Each step' },
  { name: 'a paragraph after another paragraph', at: 'div.math.fragment[data-keep]', row: 'The Coriolis', before: '<p class="fragment" data-fragment-index="2">where' },
];

for (const platform of PLATFORMS) {
  for (const c of CASES) {
    test(`the row of ${c.name} is the selected row after an undo and a redo of its delay on ${platform}`, async (t) => {
      const page = await open(t, platform, c.at);
      const source = page.source;
      assert.ok(source.includes(c.before));
      const delayed = (ms) => source.replace(c.before, c.before.replace('>', ` data-autoslide="${ms}">`));
      await afterPrevious(page, c.row);
      assert.equal(await rendered(page), delayed(500));
      const one = [c.row.slice(0, 12)];
      assert.deepEqual(await selectedRows(page), one);
      await click(page, `${STEPPER}:first-child`);
      await frames(page);
      assert.equal(await rendered(page), delayed(600));
      // the undo changes the tag of the step before, and the row of the step stays the selection
      await press(page, 'Mod+Z');
      await frames(page);
      assert.equal(await rendered(page), delayed(500));
      assert.deepEqual(await selectedRows(page), one, 'the selected rows after the undo');
      await press(page, REDO[platform]);
      await frames(page);
      assert.equal(await rendered(page), delayed(600));
      assert.deepEqual(await selectedRows(page), one, 'the selected rows after the redo');
      // the lower arrow of the Delay field takes 0.1 s off the delay of the same step
      await click(page, `${STEPPER}:last-child`);
      await frames(page);
      assert.equal(await rendered(page), delayed(500));
      assert.deepEqual(errors(page), []);
    });
  }
}
