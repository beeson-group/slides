// the work of R12.2 on both platforms with trusted input: the inspector and the shell around it.
// the Distribute row of the Arrange pane fits the inspector, the toolbar and the default set fit
// the window while Customize Toolbar is open, Slide Only hides the navigator alone, as in Keynote,
// the Language popup of the Code pane is drawn as a control of the inspector, the resize cursor is
// kept while the notes are resized past their limits, the keyboard sheet is drawn under the menu
// bar, and the insert buttons stay live while the Add Slide gallery is open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, press } from './helpers/editor.mjs';

const DECK = 'index.html';
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

const js = (v) => JSON.stringify(v);
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const mouse = (page, type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const rectOf = (page, selector) => page.evaluate(`(() => { const e = document.querySelector(${js(selector)}); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; })()`);

// the editor on slide n of the demo deck served over HTTP, with the storage of the origin emptied
async function load(t, platform, { n = 0, width = 1600, height = 1000, clear = true } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  if (clear) await page.send('Storage.clearDataForOrigin', { origin: server.origin, storageTypes: 'local_storage' });
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

async function resize(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(150);
  await frames(page);
}

// a trusted click on the title bar of the menu bar, then on the item labeled label of its menu
async function choose(page, bar, label) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
  const at = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)});
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the menu ${bar} does not have an item ${label}`);
  await click(page, at);
  await frames(page);
}

// the controls of the Format tab past the right edge of the inspector, or past the right edge of
// the window, and the width of the panel that is scrolled sideways
const cutControls = (page) => page.evaluate(`(() => {
  const inspector = document.querySelector('.beeson-edit-inspector').getBoundingClientRect();
  const panel = document.querySelector('.beeson-edit-inspector .panel.format');
  const edge = Math.min(inspector.right, innerWidth);
  const cut = [...panel.querySelectorAll('button, input')].filter((b) => b.getClientRects().length && b.getBoundingClientRect().right > edge + 0.5).map((b) => b.textContent.trim() || b.getAttribute('aria-label'));
  return { cut, scroll: panel.scrollWidth - panel.clientWidth };
})()`);

async function arrangeTab(page) {
  const tab = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === 'Arrange'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  assert.ok(tab, 'the inspector does not have an Arrange tab');
  await click(page, tab);
  await frames(page);
}

for (const platform of PLATFORMS) {
  // shell-2 and media-arrange-3
  test(`every button of the Arrange pane lies inside the inspector at 1920, 1024, and 760 px, for a figure and a picture (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 4, width: 1920, height: 1080 });
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    for (const [width, height] of [[1920, 1080], [1024, 768], [760, 700]]) {
      await resize(page, width, height);
      for (const clicks of [1, 2]) {
        await press(page, 'Escape');
        await press(page, 'Escape');
        for (let i = 0; i < clicks; i++) await click(page, 'section.present img');
        await frames(page);
        await arrangeTab(page);
        const labels = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-inspector .panel.format .ed-btn')].map((b) => b.textContent.trim())`);
        assert.ok(labels.includes('Evenly'), `the Arrange pane does not show Evenly at ${width} px`);
        if (clicks === 2) assert.ok(labels.includes('Flip Horizontal'), `the picture is not selected at ${width} px`);
        const { cut, scroll } = await cutControls(page);
        assert.deepEqual(cut, [], `controls are cut at the right edge of the inspector at ${width} px after ${clicks} clicks`);
        assert.ok(scroll <= 0, `the Format tab scrolls ${scroll} px sideways at ${width} px after ${clicks} clicks`);
      }
    }
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // shell-3
  test(`while Customize Toolbar is open in a narrow window, every toolbar item and the whole default set are inside the window (${platform})`, async (t) => {
    for (const width of [760, 900]) {
      const page = await load(t, platform, { width, height: 700 });
      await choose(page, 'View', 'Customize Toolbar…');
      assert.ok(await page.evaluate(`!document.querySelector('.beeson-edit-customize').hidden`), 'the sheet is not open');
      const out = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top [data-at]')].filter((el) => { const r = el.getBoundingClientRect(); return r.left < -0.5 || r.right > innerWidth + 0.5 || !r.width; }).map((el) => el.dataset.command ?? el.className)`);
      assert.deepEqual(out, [], `toolbar items lie past the window at ${width} px`);
      const row = await page.evaluate(`(() => {
        const row = document.querySelector('.beeson-edit-customize .default');
        const box = row.getBoundingClientRect();
        const cut = [...row.querySelectorAll('.mini:not(.sep):not(.space)')].filter((m) => { const r = m.getBoundingClientRect(); return r.right > box.right - 0.5 || r.left < box.left; }).map((m) => m.textContent);
        return { cut, over: row.scrollWidth - row.clientWidth };
      })()`);
      assert.deepEqual(row.cut, [], `items of the default set are clipped at ${width} px`);
      assert.ok(row.over <= 0, `the default set is ${row.over} px wider than its row at ${width} px`);
      // the item at the right end is dragged off the toolbar, and Done closes the sheet
      const last = await page.evaluate(`(() => { const el = [...document.querySelectorAll('.beeson-edit-top [data-command]')].at(-1); const r = el.getBoundingClientRect(); return { id: el.dataset.command, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await mouse(page, 'mouseMoved', last.x, last.y);
      await mouse(page, 'mousePressed', last.x, last.y);
      for (let i = 1; i <= 10; i++) await mouse(page, 'mouseMoved', last.x - 20 * i, last.y + 30 * i);
      await mouse(page, 'mouseReleased', last.x - 200, last.y + 300);
      await frames(page);
      const ids = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top [data-command]')].map((b) => b.dataset.command)`);
      assert.ok(!ids.includes(last.id), `${last.id} is not dragged off the toolbar at ${width} px`);
      await click(page, '.beeson-edit-customize .done');
      await frames(page);
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    }
  });

  // shell-5
  test(`View > Slide Only hides the navigator and leaves the inspector open, and View > Navigator shows the navigator again (${platform})`, async (t) => {
    const page = await load(t, platform, { width: 1440, height: 900 });
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    const panes = async () => ({
      navigator: (await state(page, 'view.navigator')).checked,
      format: (await state(page, 'shell.format')).checked,
      slideOnly: (await state(page, 'view.slideOnly')).checked,
      inspector: !!(await rectOf(page, '.beeson-edit-inspector .panel.format')),
    });
    assert.deepEqual(await panes(), { navigator: true, format: true, slideOnly: false, inspector: true });
    const canvas = await rectOf(page, '.beeson-edit-canvas');
    await choose(page, 'View', 'Slide Only');
    assert.deepEqual(await panes(), { navigator: false, format: true, slideOnly: true, inspector: true });
    assert.ok((await rectOf(page, '.beeson-edit-canvas')).width > canvas.width + 100, 'the canvas does not take the place of the navigator');
    await choose(page, 'View', 'Navigator');
    assert.deepEqual(await panes(), { navigator: true, format: true, slideOnly: false, inspector: true });
    // Slide Only chosen twice shows the navigator again, and the inspector is kept for the next page
    await choose(page, 'View', 'Slide Only');
    await choose(page, 'View', 'Slide Only');
    assert.deepEqual(await panes(), { navigator: true, format: true, slideOnly: false, inspector: true });
    assert.notEqual(await page.evaluate(`localStorage.getItem('beeson-inspector')`), '0');
    // a closed inspector stays closed through Slide Only
    await exec(page, 'shell.format');
    await choose(page, 'View', 'Slide Only');
    assert.deepEqual(await panes(), { navigator: false, format: false, slideOnly: true, inspector: false });
    await choose(page, 'View', 'Slide Only');
    assert.deepEqual(await panes(), { navigator: true, format: false, slideOnly: false, inspector: false });
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // shell-6
  test(`the Language popup of the Code pane is drawn in the control tokens of the inspector, in light and dark mode (${platform})`, async (t) => {
    for (const scheme of ['light', 'dark']) {
      const page = await load(t, platform, { n: 5, width: 1440, height: 900 });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
      if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
      await click(page, 'section.present pre code');
      await press(page, 'Escape');
      await frames(page);
      const look = await page.evaluate(`(() => {
        const b = document.querySelector('.beeson-edit-inspector .ed-lang');
        if (!b) return null;
        const probe = document.createElement('div');
        probe.style.cssText = 'background: var(--ed-control); color: var(--ed-text); font-family: var(--ed-font)';
        b.parentElement.append(probe);
        const want = getComputedStyle(probe);
        const s = getComputedStyle(b);
        const out = { background: s.backgroundColor === want.backgroundColor, color: s.color === want.color, font: s.fontFamily === want.fontFamily, round: parseFloat(s.borderTopLeftRadius) >= 4, height: Math.round(b.getBoundingClientRect().height) };
        probe.remove();
        return out;
      })()`);
      assert.ok(look, `the Code pane does not show the Language popup (${scheme})`);
      assert.deepEqual(look, { background: true, color: true, font: true, round: true, height: 24 }, `the Language popup is not drawn in the control tokens (${scheme})`);
      assert.deepEqual(errors(page), []);
    }
  });

  // shell-8
  test(`the resize cursor is kept while the notes divider is dragged past its limits (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2, width: 1440, height: 900 });
    await exec(page, 'view.notes');
    await frames(page);
    for (const to of [60, 880]) {
      const from = await center(page, '.beeson-edit-resize');
      await mouse(page, 'mouseMoved', from.x, from.y);
      await mouse(page, 'mousePressed', from.x, from.y);
      for (let i = 1; i <= 10; i++) await mouse(page, 'mouseMoved', from.x, from.y + ((to - from.y) * i) / 10);
      await frames(page);
      const cursor = await page.evaluate(`getComputedStyle(document.elementFromPoint(${from.x}, ${to})).cursor`);
      assert.equal(cursor, 'row-resize', `the cursor under the pointer at y ${to} is ${cursor}`);
      await mouse(page, 'mouseReleased', from.x, to);
      await frames(page);
      const after = await page.evaluate(`getComputedStyle(document.elementFromPoint(${from.x}, ${to})).cursor`);
      assert.notEqual(after, 'row-resize', 'the resize cursor is kept after the drag');
      if (!(await state(page, 'view.notes')).checked) await exec(page, 'view.notes');
      await frames(page);
    }
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // menus-keys-7
  test(`the keyboard sheet is drawn under the menu bar and inside the window at every size (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 2, width: 1600, height: 1000 });
    for (const [width, height] of [[1600, 1000], [1280, 800], [1366, 768], [1920, 1200], [1440, 900], [1024, 768]]) {
      await resize(page, width, height);
      await exec(page, 'help.keys');
      await frames(page);
      const sheet = await rectOf(page, 'dialog.beeson-edit-keys[open]');
      assert.ok(sheet, `the sheet is not open at ${width}x${height}`);
      const bar = await page.evaluate(`Math.max(...[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].map((b) => b.getBoundingClientRect().bottom))`);
      assert.ok(sheet.top >= bar + 4, `the sheet starts at y ${sheet.top} over the menu bar, which ends at ${bar}, at ${width}x${height}`);
      assert.ok(sheet.bottom <= height, `the sheet ends at ${sheet.bottom} past the window at ${width}x${height}`);
      if (width === 1280 || width === 1366 || width === 1600) {
        const body = await page.evaluate(`(() => { const b = document.querySelector('.beeson-edit-keys .body'); return b.scrollHeight - b.clientHeight; })()`);
        assert.ok(body <= 0, `the body of the sheet scrolls ${body} px at ${width}x${height}`);
      }
      await press(page, 'Escape');
      await frames(page);
    }
    assert.deepEqual(errors(page), []);
  });

  // feel-7
  test(`while the Add Slide gallery is open the insert buttons stay live, and one click on Table opens the table grid (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 0 });
    await click(page, '.beeson-edit-nav .row:nth-of-type(3)');
    await frames(page);
    await click(page, '.beeson-edit-top [data-command="slide.gallery"]');
    await frames(page);
    assert.ok(await page.evaluate(`!!document.querySelector('.beeson-edit-gallery[open]')`), 'the gallery is not open');
    const off = await page.evaluate(`['insert.table', 'insert.text', 'insert.formula', 'insert.shape', 'insert.media'].filter((id) => document.querySelector('.beeson-edit-top [data-command="' + id + '"]')?.disabled)`);
    assert.deepEqual(off, [], 'insert buttons are dimmed while the gallery is open');
    await click(page, '.beeson-edit-top [data-command="insert.table"]');
    await frames(page);
    assert.ok(await page.evaluate(`!document.querySelector('.beeson-edit-gallery[open]')`), 'the gallery is not closed');
    assert.ok(await page.evaluate(`!!document.querySelector('.beeson-table-picker[open]')`), 'one click on Table does not open the table grid');
    await press(page, 'Escape');
    await frames(page);
    // Escape in the gallery closes it, and the keys of the slide are not run
    await click(page, '.beeson-edit-top [data-command="slide.gallery"]');
    await frames(page);
    await press(page, 'Escape');
    await frames(page);
    assert.ok(await page.evaluate(`!document.querySelector('.beeson-edit-gallery[open]')`), 'Escape does not close the gallery');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
