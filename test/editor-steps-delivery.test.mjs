// the delivery of the steps in the Steps tab with trusted input on either platform: the menu of a
// step chip opened under its row or beside it, never over it, the start After Previous with its
// delay, and a list shown all at once or item by item. after each edit an undo gives the file byte
// for byte, a redo gives the edit, and a save is opened again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
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

// the boxes of the row whose text starts with text and of its chip, in CSS px of the viewport, with
// the row scrolled into the list of rows
const rowBox = (page, text) => page.evaluate(`(() => {
  const row = [...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${JSON.stringify(text)}));
  row.scrollIntoView({ block: 'nearest' });
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  return { row: box(row), chip: box(row.querySelector('.chip')) };
})()`);

const rowChip = async (page, text) => {
  const { chip } = await rowBox(page, text);
  return { x: (chip.left + chip.right) / 2, y: (chip.top + chip.bottom) / 2 };
};

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
    }
  });
}

const LI1 = '<li class="fragment" data-fragment-index="1">Each step';
const LI2 = '<li class="fragment" data-fragment-index="2">Two elements';
const LI3 = '<li class="fragment" data-fragment-index="3">When exporting';
const REDO = { mac: 'Mod+Shift+Z', other: 'Mod+Y' };
const rendered = (page) => page.evaluate('window.BeesonEditor.render()');

// the rows of the Steps tab in their order, with the start written into each chip
const rows = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-side .rows .row')].map((r) => ({
  step: r.dataset.step,
  text: r.querySelector('.text').textContent.slice(0, 12),
  start: r.querySelector('.chip').dataset.start,
  marked: r.querySelector('.chip svg.start')?.classList[1] ?? '',
  meta: r.querySelector('.meta').textContent,
}))`);

// an item of the menu of the chip of the row with text, chosen with two trusted clicks
async function pick(page, text, label) {
  const box = await rowBox(page, text);
  await click(page, { x: (box.chip.left + box.chip.right) / 2, y: (box.chip.top + box.chip.bottom) / 2 });
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
  const item = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label').textContent === ${JSON.stringify(label)});
    if (!item || item.getAttribute('aria-disabled') === 'true') return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(item, `the menu of the chip does not have an enabled item ${label}`);
  await sleep(300);
  await click(page, item);
  await page.evaluate('window.BeesonEditor.status()');
}

async function undoRedo(page, platform, before, after) {
  await press(page, 'Mod+Z');
  assert.equal(await rendered(page), before, 'an undo does not give the file before the edit');
  await press(page, REDO[platform]);
  assert.equal(await rendered(page), after, 'a redo does not give the edit again');
}

// the problems of the scope rule in text that the source of page does not have
const newProblems = (page, text) => {
  const before = new Set(textProblems(page.source, THEME));
  return textProblems(text, THEME).filter((p) => !before.has(p));
};

for (const platform of PLATFORMS) {
  test(`After Previous writes its delay as data-autoslide on the step before, and the chip shows each start on ${platform}`, async (t) => {
    const page = await open(t, platform);
    await slideOf(page, 'li.fragment');
    const source = page.source;
    // the first step starts at a click, hence After Previous is offered from the second on
    await click(page, await rowChip(page, 'Each step'));
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.textContent.includes('After Previous')).getAttribute('aria-disabled')`), 'true');
    await press(page, 'Escape');

    await pick(page, 'Two elements', 'After Previous');
    const after = source.replace(LI1, '<li class="fragment" data-fragment-index="1" data-autoslide="500">Each step');
    assert.equal(await rendered(page), after);
    let r = await rows(page);
    assert.deepEqual(r.slice(0, 3).map((x) => [x.step, x.start, x.marked]), [['0', 'click', ''], ['1', 'after', 'after'], ['2', 'click', '']]);
    assert.match(r[1].meta, /After Previous, 0\.5 s/);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Set Start Of Step');
    await undoRedo(page, platform, source, after);

    // the delay is typed in seconds into the field under the rows
    const field = '.beeson-edit-side .detail input.delay';
    assert.equal(await page.evaluate(`document.querySelector(${JSON.stringify(field)}).disabled`), false);
    await click(page, field, { count: 3 });
    await type(page, '1.5');
    await press(page, 'Enter');
    // the focus stays in the field after Enter, as in the other number fields, and Esc leaves it
    await press(page, 'Escape');
    await page.evaluate('window.BeesonEditor.status()');
    const slow = source.replace(LI1, '<li class="fragment" data-fragment-index="1" data-autoslide="1500">Each step');
    assert.equal(await rendered(page), slow);
    assert.match((await rows(page))[1].meta, /After Previous, 1\.5 s/);
    await undoRedo(page, platform, after, slow);

    // the delay follows its step when the last step is dragged first, and With Previous on the
    // first step shows a plus in its chip
    await page.evaluate(`window.BeesonEditor.exec('steps.move', { el: [...document.querySelectorAll('.reveal section.present li')][2], gap: 0 })`);
    const moved = source
      .replace(LI1, '<li class="fragment" data-fragment-index="2" data-autoslide="1500">Each step')
      .replace(LI2, '<li class="fragment" data-fragment-index="3">Two elements')
      .replace(LI3, '<li class="fragment" data-fragment-index="1">When exporting');
    assert.equal(await rendered(page), moved);
    r = await rows(page);
    assert.deepEqual(r.slice(0, 3).map((x) => [x.text, x.step, x.start]), [['When exporti', '0', 'click'], ['Each step is', '1', 'click'], ['Two elements', '2', 'after']]);
    await pick(page, 'Each step', 'With Previous');
    r = await rows(page);
    assert.deepEqual(r.slice(0, 3).map((x) => [x.step, x.start, x.marked]), [['0', 'click', ''], ['0', 'with', 'with'], ['1', 'after', 'after']]);
    // On Click takes the delay off
    await pick(page, 'Two elements', 'On Click');
    assert.doesNotMatch(await rendered(page), /data-autoslide/);
    await press(page, 'Mod+Z');
    const text = await rendered(page);
    assert.match(text, /data-autoslide="1500"/);
    assert.deepEqual(newProblems(page, text), []);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });
}

// the delay is played by reveal.js in a deck without the editor: the step after a step with
// data-autoslide is shown by itself after the delay, and the step after it waits for a key. reveal.js
// cues the delay after a key, hence the key Right in place of Reveal.next()
test('a step After Previous is shown by itself after its delay in the deck', async (t) => {
  const text = readFileSync('index.html', 'utf8').replace(LI1, '<li class="fragment" data-fragment-index="1" data-autoslide="600">Each step');
  const file = `.after-previous-${process.pid}.html`;
  writeFileSync(file, text);
  t.after(() => rmSync(file, { force: true }));
  const page = await browser.newPage({ width: 1280, height: 720 });
  t.after(() => page.close());
  await page.goto(`${server.origin}/${file}?still`);
  await page.waitFor(deckSettled);
  await slideOf(page, 'li.fragment');
  const shown = () => page.evaluate(`[...document.querySelectorAll('.reveal section.present li.fragment')].map((li) => li.classList.contains('visible'))`);
  assert.deepEqual(await shown(), [false, false, false]);
  await press(page, 'ArrowRight');
  await sleep(150);
  assert.deepEqual(await shown(), [true, false, false]);
  await sleep(900);
  assert.deepEqual(await shown(), [true, true, false]);
  await sleep(900);
  assert.deepEqual(await shown(), [true, true, false], 'the step after the delayed step is shown without a click');
  assert.deepEqual(errors(page), []);
});
