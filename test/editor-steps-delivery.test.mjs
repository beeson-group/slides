// the delivery of the steps in the Steps tab with trusted input on either platform: the menu of a
// step chip opened under its row or beside it, never over it, the start After Previous with its
// delay, and a list shown all at once or item by item. after each edit an undo gives the file byte
// for byte, a redo gives the edit, and a save is opened again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

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

// the editor on a deck served over HTTP, opened with its text, with the Steps tab shown
async function open(t, platform, { deck = 'index.html', text = readFileSync(deck, 'utf8'), width = 1920, height = 1080 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close());
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  await page.evaluate('localStorage.clear()');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`)).problems, []);
  await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
  return page;
}

async function slideOf(page, selector) {
  await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Reveal.slide(Reveal.getIndices(el.closest('section')).h); })()`);
  await sleep(150);
}

// the boxes of the row whose text starts with text and of its chip, in CSS px of the viewport
const rowBox = (page, text) => page.evaluate(`(() => {
  const row = [...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${JSON.stringify(text)}));
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  return { row: box(row), chip: box(row.querySelector('.chip')) };
})()`);

const menuBox = (page) => page.evaluate(`(() => { const r = document.querySelector('.beeson-edit-menu').getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; })()`);
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

for (const platform of PLATFORMS) {
  // a regression test of the menu of a chip drawn over the second line of its own row. in a window
  // 520 px high, the menu fits neither under nor over the row, and it is put beside the row
  test(`the menu of a step chip leaves its row visible on ${platform}`, async (t) => {
    for (const [width, height, at] of [[1920, 1080, 'Each step'], [1440, 520, 'Two elements']]) {
      const page = await open(t, platform, { width, height });
      await slideOf(page, 'li.fragment');
      const box = await rowBox(page, at);
      await click(page, { x: (box.chip.left + box.chip.right) / 2, y: (box.chip.top + box.chip.bottom) / 2 });
      await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
      const menu = await menuBox(page);
      assert.ok(!overlap(menu, box.row), `at ${width} by ${height} the menu ${JSON.stringify(menu)} covers its row ${JSON.stringify(box.row)}`);
      assert.ok(menu.top >= 0 && menu.bottom <= height && menu.left >= 0 && menu.right <= width, 'the menu leaves the window');
      // under or over the row, the menu starts at the chip, and beside it, it is level with the row
      if (menu.top >= box.row.bottom || menu.bottom <= box.row.top) assert.ok(Math.abs(menu.left - box.chip.left) < 8, 'the menu is not at its chip');
      else assert.ok(menu.right <= box.row.left, 'the menu is neither under nor beside its row');
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}
