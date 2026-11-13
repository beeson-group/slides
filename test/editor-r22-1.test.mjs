// the cuts and the View button of R22.1 on both platforms. the accessibility checker and the
// outline view are cut with their commands, buttons, and menu entries. the View button at the left
// of the toolbar is a split button whose main part shows and hides the navigator. Light Table is
// named Chapters Table, Show Guides is cut, and the guides of a slide follow the rulers. the title
// bar does not draw a dash between the name of the file and its state

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, selectFigure, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));
const ZONE = '.reveal .slides section.present figure.zone';
const MATH_TAG = '<section>\n  <h2>Math, an ordered list, and a zone</h2>';
const VIEW = '.beeson-edit-top [data-command="toolbar.view"]';

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
// whether the registry has a command of the given id
const has = (page, id) => page.evaluate(`(() => { try { window.BeesonEditor.state(${js(id)}); return true; } catch { return false; } })()`);
const menuItems = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu [role^="menuitem"]')].map((m) => ({ label: m.querySelector('.label')?.textContent ?? m.textContent.trim(), checked: m.getAttribute('aria-checked') === 'true' }))`);
const pick = (page, label) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu [role^="menuitem"]')].find((m) => (m.querySelector('.label')?.textContent ?? '') === ${js(label)}).click()`);
const box = (page, selector) => page.evaluate(`(() => { const e = document.querySelector(${js(selector)}); const r = e?.getBoundingClientRect(); return r && !e.hidden && r.width ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null; })()`);
const guides = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-hand-guide')].filter((g) => !g.hidden && !g.classList.contains('off')).map((g) => [g.dataset.axis, Number(g.dataset.at)])`);

// the editor on slide n of the deck of layouts, with the storage of the origin emptied and then
// given the entries of storage
async function load(t, platform, { n = 0, storage = {}, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate(`(() => { localStorage.clear(); for (const [k, v] of Object.entries(${js(storage)})) localStorage.setItem(k, v); return true; })()`);
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the labels of the menu of the menu bar named title, opened by a click on its title
async function barMenu(page, title) {
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((x) => x.textContent === ${js(title)}); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await frames(page);
  const labels = (await menuItems(page)).map((i) => i.label);
  await press(page, 'Escape');
  await frames(page);
  return labels;
}

// the texts of the editor outside the slides that a user or assistive technology reads, i.e. the
// rendered text and the labels, titles, alternative texts, and placeholders
const chromeText = (page) => page.evaluate(`(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.reveal .slides')) continue;
    for (const a of ['aria-label', 'title', 'alt', 'placeholder']) if (el.getAttribute(a)) out.push(el.getAttribute(a));
  }
  out.push(document.body.innerText);
  return out.join('\\n');
})()`);

for (const platform of PLATFORMS) {
  test(`the accessibility checker is gone: its command, its pane, its button in the status bar, and its toolbar item (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    for (const id of ['view.accessibility', 'review.altText', 'review.tableHeader']) assert.equal(await has(page, id), false, `${id} is still a command`);
    assert.ok(!(await barMenu(page, 'View')).includes('Check Accessibility'));
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-a11y, .beeson-edit-bottom .a11y').length`), 0);
    assert.equal(await page.evaluate(`getComputedStyle(document.body).gridTemplateAreas.includes('a11y')`), false, 'the grid keeps a column for the pane');
    await exec(page, 'view.customizeToolbar');
    await frames(page);
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-customize .item')].map((i) => i.dataset.item)`);
    assert.ok(items.includes('file.open') && !items.includes('view.accessibility'), js(items));
    await click(page, '.beeson-edit-customize .done');
    // F6 does not reach a pane of the checker
    const visited = [];
    for (let i = 0; i < 8; i++) {
      await press(page, 'F6');
      visited.push(await page.evaluate(`(() => { const a = document.activeElement; return a && a !== document.body ? (a.closest('[class*="beeson-edit-"]')?.className.match(/beeson-edit-[a-z0-9]+/)?.[0] ?? a.localName) : 'canvas'; })()`));
    }
    assert.ok(!visited.some((v) => v.includes('a11y')), js(visited));
    assert.deepEqual(errors(page), []);
  });

  test(`a toolbar customized with the Accessibility button is drawn without it (${platform})`, async (t) => {
    const key = `beeson-edit-toolbar:/${LAYOUTS}`;
    const page = await load(t, platform, { storage: { [key]: js({ items: ['toolbar.view', 'view.accessibility', 'separator', 'edit.undo', 'file.open'], show: 'both' }) } });
    const ids = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top .tb')].filter((b) => b.getClientRects().length).map((b) => b.dataset.command)`);
    assert.deepEqual(ids, ['toolbar.view', 'edit.undo', 'file.open']);
    assert.deepEqual(errors(page), []);
  });

  test(`an edit, a zoom, and a change of slide do not run a check of the deck (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    // the checker wrote its summary into the status bar after each of the three
    await click(page, '.reveal .slides section.present h2');
    await press(page, 'End');
    await type(page, ' more');
    await press(page, 'Escape');
    await exec(page, 'zoom.actual');
    await exec(page, 'navigate.next');
    await page.evaluate('new Promise((d) => setTimeout(d, 600))');
    const bar = await page.evaluate(`document.querySelector('.beeson-edit-bottom').innerText`);
    assert.doesNotMatch(bar, /Good to go|Investigate|Accessibility/);
    assert.equal(await page.evaluate(`[...document.querySelectorAll('style')].some((s) => s.textContent.includes('.beeson-edit-a11y'))`), false);
    assert.deepEqual(errors(page), []);
  });

  test(`the outline view is gone, and the thumbnails, the object list, and the Chapters Table stay (${platform})`, async (t) => {
    // the outline view kept in the storage by an earlier editor does not hide the thumbnails
    const page = await load(t, platform, { n: MATH, storage: { 'beeson-outline': '1' } });
    assert.equal(await has(page, 'view.outline'), false);
    assert.ok(!(await barMenu(page, 'View')).includes('Outline'));
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-outline, .beeson-edit-nav.outlined').length`), 0);
    assert.ok(await box(page, '.beeson-edit-nav [aria-current="true"]'), 'the thumbnails are not shown');
    assert.equal(await has(page, 'view.lightTable'), true);
    await exec(page, 'view.objects');
    await frames(page);
    assert.ok(await box(page, '.beeson-edit-objects'), 'the object list is not shown');
    // Duplicate of the Edit menu with a row of the navigator focused copies the slide
    await page.evaluate(`document.querySelector('.beeson-edit-nav [aria-current="true"]').focus()`);
    await exec(page, 'edit.duplicate');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`), SECTIONS.length + 1);
    assert.deepEqual(errors(page), []);
  });

  test(`a click on the View button shows and hides the navigator, and it is pressed while the navigator is shown (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    const split = await page.evaluate(`(() => { const b = document.querySelector(${js(VIEW)}); const s = b.closest('.beeson-edit-split'); return s ? { arrow: !!s.querySelector('.more'), first: s.closest('.beeson-edit-top').querySelector('.tb') === b, popup: b.getAttribute('aria-haspopup') } : null; })()`);
    assert.deepEqual(split, { arrow: true, first: true, popup: null });
    const pressed = () => page.evaluate(`document.querySelector(${js(VIEW)}).getAttribute('aria-pressed')`);
    assert.equal(await pressed(), 'true');
    assert.equal((await state(page, 'view.navigator')).checked, true);
    await click(page, VIEW);
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-menu').length`), 0, 'a menu was opened');
    assert.equal((await state(page, 'view.navigator')).checked, false);
    assert.equal(await box(page, '.beeson-edit-nav'), null);
    assert.equal(await pressed(), 'false');
    await click(page, VIEW);
    await frames(page);
    assert.equal((await state(page, 'view.navigator')).checked, true);
    assert.ok(await box(page, '.beeson-edit-nav'));
    assert.equal(await pressed(), 'true');
    // Space on the focused button runs the main part too
    await page.evaluate(`document.querySelector(${js(VIEW)}).focus()`);
    await press(page, 'Space');
    await frames(page);
    assert.equal((await state(page, 'view.navigator')).checked, false);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`the arrow of the View button lists Chapters Table, Rulers, and Gridlines with their checks (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    const arrow = '.beeson-edit-split:has(> [data-command="toolbar.view"]) .more';
    await click(page, arrow);
    await frames(page);
    assert.deepEqual(await menuItems(page), [
      { label: 'Chapters Table', checked: false },
      { label: 'Rulers', checked: false },
      { label: 'Gridlines', checked: false },
    ]);
    await pick(page, 'Rulers');
    await frames(page);
    assert.equal((await state(page, 'view.rulers')).checked, true);
    assert.equal((await state(page, 'view.navigator')).checked, true, 'the arrow toggled the navigator');
    await click(page, arrow);
    await frames(page);
    assert.deepEqual((await menuItems(page)).map((i) => i.checked), [false, true, false]);
    await pick(page, 'Chapters Table');
    await frames(page);
    assert.equal((await state(page, 'view.lightTable')).checked, true);
    assert.ok(await box(page, '.beeson-edit-sorter'));
    // the View menu of the menu bar keeps its entries, apart from the cut ones
    const view = await barMenu(page, 'View');
    for (const label of ['Navigator', 'Chapters Table', 'Steps', 'Notes', 'Rulers', 'Gridlines']) assert.ok(view.includes(label), `the View menu has no ${label}: ${js(view)}`);
    for (const label of ['Outline', 'Light Table', 'Check Accessibility', 'Show Guides']) assert.ok(!view.includes(label), `the View menu has ${label}`);
    assert.deepEqual(errors(page), []);
  });

  test(`Light Table is named Chapters Table in its command, its table, the keys sheet, and the messages (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    assert.equal((await state(page, 'view.lightTable')).label, 'Chapters Table');
    await exec(page, 'view.lightTable');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-sorter').getAttribute('aria-label')`), 'Chapters Table');
    assert.doesNotMatch(await chromeText(page), /light table/i);
    await exec(page, 'view.lightTable');
    await exec(page, 'help.keys');
    await frames(page);
    assert.doesNotMatch(await chromeText(page), /light table|Show Guides|Check Accessibility/i);
    assert.deepEqual(errors(page), []);
  });

  test(`Show Guides is cut, and the guides are shown and snapped to while the rulers are shown (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    assert.equal(await has(page, 'view.guides'), false);
    // the left edge of the zone, at 1200 slide px, is dragged by 183 slide px toward the guide,
    // and the translate of the drag is read before an undo
    const move = async () => {
      const k = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);
      await selectFigure(page, `${ZONE} > img`);
      const zone = await box(page, ZONE);
      await drag(page, { x: zone.left + zone.width / 2, y: zone.top + zone.height / 2 }, { dx: -183 * k, dy: 0, modifiers: 'Shift' });
      await frames(page);
      const moved = await page.evaluate(`document.querySelector(${js(ZONE)}).style.translate`);
      await page.evaluate('window.BeesonEditor.undo()');
      await frames(page);
      return moved;
    };
    // the move without a guide, to which the move with a hidden guide is compared
    const free = await move();
    assert.notEqual(free, '-187px');
    for (const id of ['view.guides.add', 'view.guides.clear', 'slide.guides.copy', 'slide.guides.paste']) assert.equal((await state(page, id)).enabled, false, `${id} without the rulers`);
    await exec(page, 'view.rulers');
    await frames(page);
    await exec(page, 'view.guides.add', { x: [1013], y: [] });
    await frames(page);
    assert.deepEqual(await guides(page), [['x', 1013]]);
    for (const id of ['view.guides.clear', 'slide.guides.copy']) assert.equal((await state(page, id)).enabled, true, `${id} with the rulers`);
    await byteExact(page, [[MATH_TAG, MATH_TAG.replace('<section>', '<section data-guides="x1013">')]]);
    assert.equal(await move(), '-187px', 'the zone does not snap to the shown guide');
    // the key of Show Guides does nothing, and hidden rulers hide the guides
    await press(page, platform === 'mac' ? 'Mod+Ctrl+Alt+G' : 'Alt+F9');
    await frames(page);
    assert.deepEqual(await guides(page), [['x', 1013]]);
    await exec(page, 'view.rulers');
    await frames(page);
    assert.deepEqual(await guides(page), []);
    assert.equal((await state(page, 'view.guides.clear')).enabled, false);
    assert.equal(await move(), free, 'the zone snaps to a hidden guide');
    // a drag that starts on the hidden guide does not move it
    const x = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); return r.left + 1013 * r.width / s.offsetWidth; })()`);
    const slide = await box(page, '.reveal .slides');
    await drag(page, { x, y: slide.top + 8 }, { dx: 60, dy: 0 });
    await frames(page);
    await exec(page, 'view.rulers');
    await frames(page);
    assert.deepEqual(await guides(page), [['x', 1013]]);
    await byteExact(page, [[MATH_TAG, MATH_TAG.replace('<section>', '<section data-guides="x1013">')]]);
    assert.deepEqual(errors(page), []);
  });

  test(`the title bar sets the state of the file apart from its name by a gap and a muted color, without a dash (${platform})`, async (t) => {
    const page = await load(t, platform, { n: MATH });
    await exec(page, 'view.rulers');
    await exec(page, 'view.guides.add', { x: [500], y: [] });
    await frames(page);
    const doc = await page.evaluate(`(() => {
      const d = document.querySelector('.beeson-edit-titlebar .doc');
      const file = d.querySelector('.file'), state = d.querySelector('.state');
      const f = file.getBoundingClientRect(), s = state.getBoundingClientRect();
      return { text: d.textContent, kids: [...d.children].map((c) => c.className), gap: s.left - f.right, state: state.textContent, colors: [getComputedStyle(file).color, getComputedStyle(state).color] };
    })()`);
    assert.doesNotMatch(doc.text, /—/);
    assert.deepEqual(doc.kids, ['file', 'state']);
    assert.ok(doc.state.length > 0, 'the state is empty after an edit');
    assert.ok(doc.gap >= 8, `the gap is ${doc.gap} px`);
    assert.notEqual(doc.colors[0], doc.colors[1]);
    assert.deepEqual(errors(page), []);
  });
}
