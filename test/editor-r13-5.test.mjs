// regression tests of R13.5 on both platforms with trusted input: a cut or a copy of a range of
// table cells keeps the formulas and the inline elements of the theme of each cell, and a paste of
// such a range writes them back. each edit of the file is checked byte for byte, after an undo and
// a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-tables.html';
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
const settle = (page) => page.evaluate('new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), 100))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const plainTable = (s) => s.match(/<h2>A plain table[\s\S]*?<\/table>/)[0];

// the editor on the tables page with slide 2 shown, and every write of a cut or a copy recorded
async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate('Reveal.slide(1)');
  await settle(page);
  await page.evaluate(`(() => { window.__w = []; const o = DataTransfer.prototype.setData; DataTransfer.prototype.setData = function (t, v) { window.__w.push([t, v]); return o.call(this, t, v); }; })()`);
  page.platform = platform;
  return page;
}

const at = (page, r, c) => page.evaluate(`(() => { const t = Reveal.getCurrentSlide().querySelector('table'); const b = t.rows[${r}].cells[${c}].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);

// the cells from a to b selected as a block, with a click and a Shift-click
async function range(page, a, b) {
  await click(page, await at(page, ...a));
  await settle(page);
  await click(page, await at(page, ...b), { modifiers: 'Shift' });
  await settle(page);
  assert.ok(await page.evaluate(`(() => { const o = document.querySelector('.beeson-table-bars .cell.range'); return !!o && !o.hidden; })()`), 'the range is not selected');
}

// a trusted Mod+X or Mod+C, which the browser turns into a cut or a copy event, and what it wrote
async function clip(page, command) {
  const [key, code, kc] = command === 'cut' ? ['x', 'KeyX', 88] : ['c', 'KeyC', 67];
  const modifiers = page.platform === 'mac' ? 4 : 2;
  await page.evaluate('window.__w = []');
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: kc, modifiers, commands: [command] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: kc, modifiers });
  await settle(page);
  const w = await page.evaluate('window.__w');
  return { plain: w.find((x) => x[0] === 'text/plain')?.[1] ?? '', html: w.find((x) => x[0] === 'text/html')?.[1] ?? '' };
}

// a paste event with the given data at the focus, as the browser sends it
async function paste(page, plain, html) {
  const done = await page.evaluate(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', ${js(plain)}); if (${js(html)}) dt.setData('text/html', ${js(html)}); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); (document.activeElement || document.body).dispatchEvent(ev); return ev.defaultPrevented; })()`);
  assert.ok(done, 'the paste is not taken by the editor');
  await settle(page);
}

for (const platform of PLATFORMS) {
  test(`a cut of a range with a formula pasted back leaves the table as in the file (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, [1, 0], [2, 1]);
    const { plain, html } = await clip(page, 'cut');
    assert.equal(plain, 'Moon\t\\(0.01215\\)\nEuropa\t2.53e-5');
    assert.match(html, /^<table data-beeson[^>]*>/);
    assert.ok(html.includes('<td>\\(0.01215\\)</td>'), html);
    const cut = await render(page);
    assert.ok(plainTable(cut).includes('<tr><td></td><td></td><td>Earth and Moon</td></tr>'));
    await range(page, [1, 0], [2, 1]);
    await paste(page, plain, html);
    assert.equal(await render(page), page.source);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector('table').rows[1].cells[1].querySelectorAll('mjx-container').length`), 1);
    await undo(page);
    assert.equal(await render(page), cut);
    await redo(page);
    assert.equal(await render(page), page.source);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a copy of a bold row pasted onto another row keeps the bold (${platform})`, async (t) => {
    const page = await load(t, platform);
    const europa = await at(page, 2, 0);
    await click(page, europa);
    await settle(page);
    await click(page, europa, { count: 2 });
    await settle(page);
    await press(page, 'Mod+B');
    await settle(page);
    await press(page, 'Escape');
    await settle(page);
    const bold = await render(page);
    assert.ok(bold.includes('<tr><td><strong>Europa</strong></td><td>2.53e-5</td><td>Jupiter</td></tr>'));
    await range(page, [2, 0], [2, 2]);
    const { plain, html } = await clip(page, 'copy');
    assert.equal(plain, 'Europa\t2.53e-5\tJupiter');
    assert.ok(html.includes('<td><strong>Europa</strong></td>'), html);
    await range(page, [3, 0], [3, 2]);
    await paste(page, plain, html);
    const pasted = bold.replace('<tr><td>Titan</td><td>2.37e-4</td><td>Saturn</td></tr>', '<tr><td><strong>Europa</strong></td><td>2.53e-5</td><td>Jupiter</td></tr>');
    assert.notEqual(pasted, bold);
    assert.equal(await render(page), pasted);
    await undo(page);
    assert.equal(await render(page), bold);
    await redo(page);
    assert.equal(await render(page), pasted);
    const { text } = await saveAndReopen(page);
    assert.equal(text, pasted);
    assert.deepEqual(errors(page), []);
  });

  test(`a pasted table of the editor keeps only the inline elements of the theme (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, [3, 0], [3, 1]);
    const html = '<table data-beeson="cells"><tr><td><span class="tone-accent" style="color: red">Io</span><script>alert(1)</script></td><td><a href="https://example.com"><em>4.7e-5</em></a></td></tr></table>';
    await paste(page, 'Io\t4.7e-5', html);
    const row = '<tr><td><span class="tone-accent">Io</span></td><td><em>4.7e-5</em></td><td>Saturn</td></tr>';
    assert.equal(await render(page), page.source.replace('<tr><td>Titan</td><td>2.37e-4</td><td>Saturn</td></tr>', row));
    await undo(page);
    assert.equal(await render(page), page.source);
  });

  test(`a pasted table of another app is plain text, with a formula drawn again (${platform})`, async (t) => {
    const page = await load(t, platform);
    await range(page, [3, 0], [3, 1]);
    await paste(page, 'Io\t\\(4.7\\)', '<table><tr><td><strong>Io</strong></td><td>\\(4.7\\)</td></tr></table>');
    const row = '<tr><td>Io</td><td>\\(4.7\\)</td><td>Saturn</td></tr>';
    const pasted = page.source.replace('<tr><td>Titan</td><td>2.37e-4</td><td>Saturn</td></tr>', row);
    assert.equal(await render(page), pasted);
    assert.equal(await page.evaluate(`Reveal.getCurrentSlide().querySelector('table').rows[3].cells[1].querySelectorAll('mjx-container').length`), 1);
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), pasted);
    await saveAndReopen(page);
  });
}

// the Light Table on the demo deck, with the tiles, the focused tile, and the selected tiles
async function lightTable(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/test-deck.html?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('test-deck.html', 'utf8');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`)).problems, []);
  await page.evaluate(`window.BeesonEditor.exec('view.lightTable')`);
  await settle(page);
  return page;
}
const tiles = (page) => page.evaluate(`(() => {
  const all = [...document.querySelectorAll('.beeson-edit-sorter .tile')];
  return { shown: !document.querySelector('.beeson-edit-sorter').hidden, n: all.length, focus: all.indexOf(document.activeElement), selected: all.flatMap((t, i) => (t.getAttribute('aria-selected') === 'true' ? [i] : [])) };
})()`);
const tileAt = (page, i) => page.evaluate(`(() => { const r = document.querySelectorAll('.beeson-edit-sorter .tile .pic')[${i}].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const itemAt = (page, label) => page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const every = (n) => [...Array(n).keys()];

for (const platform of PLATFORMS) {
  test(`Mod+A on a tile of the Light Table selects every slide and keeps the focus on the tile (${platform})`, async (t) => {
    const page = await lightTable(t, platform);
    await click(page, await tileAt(page, 3));
    await settle(page);
    await press(page, 'Mod+A');
    await settle(page);
    const { n, focus, selected } = await tiles(page);
    assert.deepEqual(selected, every(n));
    assert.equal(focus, 3);
    await press(page, 'ArrowRight');
    await settle(page);
    assert.deepEqual(await tiles(page), { shown: true, n, focus: 4, selected: [4] });
    await press(page, 'Escape');
    await settle(page);
    assert.equal((await tiles(page)).shown, false);
    assert.equal(await render(page), page.source);
  });

  test(`Select All Slides in the menu of a tile keeps the focus on the tiles (${platform})`, async (t) => {
    const page = await lightTable(t, platform);
    await click(page, await tileAt(page, 3));
    await settle(page);
    await click(page, await tileAt(page, 4), { button: 'right' });
    await settle(page);
    await click(page, await itemAt(page, 'Select All Slides'));
    await settle(page);
    const { n, focus, selected } = await tiles(page);
    assert.deepEqual(selected, every(n));
    assert.equal(focus, 4);
    await press(page, 'ArrowRight');
    await settle(page);
    assert.deepEqual(await tiles(page), { shown: true, n, focus: 5, selected: [5] });
    await press(page, 'Escape');
    await settle(page);
    assert.equal((await tiles(page)).shown, false);
  });

  test(`Mod+D on a tile of the Light Table moves the focus to the tile of the duplicate (${platform})`, async (t) => {
    const page = await lightTable(t, platform);
    await click(page, await tileAt(page, 3));
    await settle(page);
    const n = (await tiles(page)).n;
    await press(page, 'Mod+D');
    await settle(page);
    assert.deepEqual(await tiles(page), { shown: true, n: n + 1, focus: 4, selected: [4] });
    await press(page, 'ArrowRight');
    await settle(page);
    assert.deepEqual(await tiles(page), { shown: true, n: n + 1, focus: 5, selected: [5] });
    await undo(page);
    await settle(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
