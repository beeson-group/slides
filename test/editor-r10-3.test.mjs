// the work of R10.3 on both platforms: the parts of the presenter display

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press } from './helpers/editor.mjs';

const OUTLINE = 'test/pages/editor-outline.html';
const PLATFORMS = ['mac', 'other'];

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

const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg !== undefined ? `, ${JSON.stringify(arg)}` : ''})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on a deck served over HTTP, with the storage of the origin emptied first, and with
// slide n shown
async function load(t, platform, { deck = OUTLINE, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// states 172 and 276: the parts of the presenter display could not be chosen, and the Play menu
// did not have Customize Presenter Display… of Keynote (K52). PARTS reads the open display: the
// parts seen, whether the popover of the parts is open, and its checkboxes
const PARTS = `(() => {
  const d = document.querySelector('dialog.beeson-edit-presenter[open]');
  if (!d) return null;
  const seen = (sel) => { const e = d.querySelector(sel); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const pop = d.querySelector('.parts');
  return {
    shown: ['.shot.current', '.shot:not(.current)', '.notes', '.clock', '.elapsed'].filter(seen).length,
    hidden: { current: !seen('.shot.current'), next: !seen('.shot:not(.current)'), notes: !seen('.notes'), clock: !seen('.clock'), timer: !seen('.elapsed') },
    open: !!pop && !pop.hidden,
    boxes: pop ? [...pop.querySelectorAll('input[type=checkbox]')].map((b) => b.closest('label').textContent.trim() + (b.checked ? ' on' : ' off')) : [],
  };
})()`;
const KEY = `localStorage.getItem('beeson-presenter-parts:' + location.pathname)`;
const box = (label) => `.beeson-edit-presenter .parts label:nth-child(${['Current Slide', 'Next Slide', 'Presenter Notes', 'Clock', 'Timer'].indexOf(label) + 1})`;
const count = (page) => page.evaluate(`document.querySelector('.beeson-edit-presenter .count').textContent`);

for (const platform of PLATFORMS) {
  test(`Customize Presenter Display… of the Play menu opens the display with a popover of its parts, and each part unchecked is hidden and kept for the deck (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 1 });
    await page.evaluate(`(() => { window.__opened = 0; window.open = () => { window.__opened++; return null; }; return true; })()`);
    const play = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === 'Play')`);
    assert.ok(play >= 0, 'the menu bar does not have the Play menu');
    await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${play + 1})`);
    const item = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].findIndex((i) => i.querySelector('.label')?.textContent === 'Customize Presenter Display…')`);
    assert.ok(item >= 0, 'the Play menu does not have Customize Presenter Display…');
    await click(page, `.beeson-edit-menu .item:nth-of-type(${item + 1})`);
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    let parts = await page.evaluate(PARTS);
    assert.equal(parts.open, true, 'the popover of the parts is not open');
    assert.deepEqual(parts.boxes, ['Current Slide on', 'Next Slide on', 'Presenter Notes on', 'Clock on', 'Timer on']);
    assert.equal(parts.shown, 5);
    assert.equal(await page.evaluate('window.__opened'), 0, 'Customize Presenter Display… opened the show');
    await click(page, box('Next Slide'));
    await click(page, box('Clock'));
    parts = await page.evaluate(PARTS);
    assert.deepEqual(parts.hidden, { current: false, next: true, notes: false, clock: true, timer: false });
    assert.deepEqual(JSON.parse(await page.evaluate(KEY)), ['next', 'clock']);
    // the keys of the show stay live while the popover is open, and Esc closes the popover first
    assert.equal(await count(page), '2 / 3');
    await press(page, 'ArrowRight');
    assert.equal(await count(page), '3 / 3');
    await press(page, 'Escape');
    parts = await page.evaluate(PARTS);
    assert.equal(parts?.open, false, 'Esc did not close the popover, or it ended the display');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    // the display is opened again with the parts chosen, and the file is not changed
    await exec(page, 'play.customizePresenter');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    parts = await page.evaluate(PARTS);
    assert.deepEqual(parts.boxes, ['Current Slide on', 'Next Slide off', 'Presenter Notes on', 'Clock off', 'Timer on']);
    assert.deepEqual(parts.hidden, { current: false, next: true, notes: false, clock: true, timer: false });
    await click(page, box('Next Slide'));
    await click(page, box('Clock'));
    assert.equal((await page.evaluate(PARTS)).shown, 5);
    assert.equal(await page.evaluate(KEY), null);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`the button Display Options of the presenter display opens and closes the popover of its parts, which a click outside closes (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 1 });
    await exec(page, 'play.rehearse');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter.rehearse[open]')`);
    assert.equal((await page.evaluate(PARTS)).open, false);
    const button = `.beeson-edit-presenter .bar.top button[aria-label="Display Options"]`;
    await click(page, button);
    assert.equal((await page.evaluate(PARTS)).open, true, 'the button does not open the popover');
    assert.equal(await page.evaluate(`document.querySelector('${button}').getAttribute('aria-expanded')`), 'true');
    for (const label of ['Current Slide', 'Presenter Notes', 'Timer']) await click(page, box(label));
    const parts = await page.evaluate(PARTS);
    assert.deepEqual(parts.hidden, { current: true, next: false, notes: true, clock: false, timer: true });
    // the next slide is drawn into the room left by the current slide
    assert.ok(await page.evaluate(`document.querySelector('.beeson-edit-presenter .shot:not(.current)').getBoundingClientRect().width > innerWidth * 0.8`), 'the next slide does not take the width of the stage');
    assert.ok(await page.evaluate(`!!document.querySelector('.beeson-edit-presenter .shot:not(.current) .pic').shadowRoot?.querySelector('section')`));
    await click(page, '.beeson-edit-presenter .bar.foot .count');
    assert.equal((await page.evaluate(PARTS)).open, false, 'a click outside does not close the popover');
    assert.equal(await count(page), '2 / 3', 'a click outside moved the display');
    await click(page, button);
    await click(page, button);
    assert.equal((await page.evaluate(PARTS)).open, false, 'a second click on the button does not close the popover');
    assert.deepEqual(JSON.parse(await page.evaluate(KEY)), ['current', 'notes', 'timer']);
    // the rehearsal asks at its end, and Esc leaves the timings as they were
    await press(page, 'Escape');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
