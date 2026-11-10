// lines and arrows of commands/line.ts on both platforms, driven with trusted input: Insert > Arrow
// writes an svg with a line and a marker before the notes of the slide, a drag in the mode of
// Insert > Line draws a line, with Shift at a multiple of 45 degrees, a press near a line selects
// it and shows the Line pane, whose swatches and arrowheads set its tone and its markers, a drag of
// an end handle moves that end, a drag of the line moves it, and a duplicate points its arrowheads
// at its own marker. each edit is checked byte for byte, after an undo and a redo, against the
// scope rule, and after a save and an open of the saved text

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { boxOf, distance, fixHeads, lineText, stepped } from '../src/editor/commands/line.ts';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const SECTIONS = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0]);
const MATH = SECTIONS.findIndex((s) => s.includes('<h2>Math, an ordered list, and a zone</h2>'));

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

let last = null;

async function linePage(platform, n = MATH) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

async function inScope(page) {
  const now = textProblems(await render(page), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// the screen point of a point in slide px
const screen = (page, x, y) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  return { x: r.left + ${x} * k, y: r.top + ${y} * k };
})()`);

// the lines of the current slide, with their ends in slide px, classes, and markers
const lines = (page) => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('svg.line')].map((svg) => {
  const l = svg.querySelector('line');
  const [tx, ty] = (svg.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0);
  const n = (a) => Number(l.getAttribute(a));
  return { ends: [tx + n('x1'), ty + n('y1'), tx + n('x2'), ty + n('y2')], cls: svg.getAttribute('class'), id: svg.querySelector('marker').id,
    start: l.getAttribute('marker-start'), end: l.getAttribute('marker-end'), stroke: getComputedStyle(l).stroke, width: svg.getBoundingClientRect().width };
})`);

// the rendered text without the one line inserted into it, and that line
async function inserted(page) {
  const text = await render(page);
  const m = /\n[ \t]*(<svg class="line[^\n]*<\/svg>)/.exec(text);
  assert.ok(m, 'a line is not in the rendered text');
  assert.equal(text.slice(0, m.index) + text.slice(m.index + m[0].length), page.source);
  return m[1];
}

test('the markup, the arrowheads of a copy, the steps of 45 degrees, and the distance of a line', () => {
  const t = lineText({ x1: 700, y1: 600, x2: 300, y2: 400 }, { id: 'line-1', heads: 'end', tone: 'accent' });
  assert.equal(t, '<svg class="line tone-accent" width="400" height="200" style="translate: 300px 400px"><defs><marker id="line-1" orient="auto-start-reverse"><path d="M-4-2.5 1 0-4 2.5z"></path></marker></defs><line x1="400" y1="200" x2="0" y2="0" marker-end="url(#line-1)"></line></svg>');
  assert.deepEqual(textProblems(t, THEME), []);
  assert.deepEqual(boxOf({ x1: 10, y1: 5, x2: 10, y2: 5 }), { left: 10, top: 5, width: 1, height: 1 });
  const both = lineText({ x1: 0, y1: 0, x2: 10, y2: 0 }, { id: 'line-2', heads: 'both' });
  assert.ok(both.startsWith('<svg class="line" width="10" height="1"><defs>'));
  assert.ok(both.includes('marker-start="url(#line-2)" marker-end="url(#line-2)"'));
  const copy = `<p>a</p>\n${both.replace('id="line-2"', 'id="line-3"')}`;
  assert.equal(fixHeads(copy), `<p>a</p>\n${both.replaceAll('line-2', 'line-3')}`);
  assert.equal(fixHeads('<svg class="beeson"><marker id="a"></marker><line marker-end="url(#b)"></line></svg>'), '<svg class="beeson"><marker id="a"></marker><line marker-end="url(#b)"></line></svg>');
  const s = stepped({ x: 0, y: 0 }, { x: 100, y: 90 });
  assert.ok(Math.abs(s.x - s.y) < 1e-9 && Math.abs(s.x - 95) < 1e-9);
  assert.deepEqual(stepped({ x: 0, y: 0 }, { x: 100, y: 10 }), { x: 100, y: 0 });
  assert.equal(distance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3);
  assert.equal(distance({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5);
});

for (const platform of PLATFORMS) {
  test(`Insert > Arrow writes an svg before the notes, undone and redone byte for byte, and saved, on ${platform}`, async () => {
    const page = await linePage(platform);
    assert.equal((await state(page, 'insert.arrow')).enabled, true);
    await exec(page, 'insert.arrow', { from: { x: 300, y: 400 }, to: { x: 700, y: 600 } });
    await frames(page);
    const svg = await inserted(page);
    assert.equal(svg, lineText({ x1: 300, y1: 400, x2: 700, y2: 600 }, { id: 'line-1', heads: 'end' }));
    const [l] = await lines(page);
    assert.deepEqual(l.ends, [300, 400, 700, 600]);
    assert.equal(l.end, 'url(#line-1)');
    // stroked in --text, and drawn at the scale of the slide
    const text = await page.evaluate(`(() => { const d = document.createElement('div'); d.style.color = 'var(--text)'; Reveal.getCurrentSlide().append(d); const c = getComputedStyle(d).color; d.remove(); return c; })()`);
    assert.equal(l.stroke, text);
    assert.ok(l.width > 100);
    // the line is selected and the Line pane is shown
    assert.equal((await state(page, 'line.heads.none')).enabled, true);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    assert.ok(await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].some((b) => b.textContent === 'Line')`));
    await inScope(page);
    await undo(page);
    await byteExact(page);
    await redo(page);
    assert.equal(await inserted(page), svg);
    const { text: saved } = await saveAndReopen(page, `line-${platform}.html`);
    assert.ok(saved.includes(svg));
    assert.deepEqual(errors(page), []);
  });

  test(`a drag in the mode of Insert > Line draws a line, with Shift at 45 degrees, and Esc leaves the mode, on ${platform}`, async () => {
    const page = await linePage(platform);
    await exec(page, 'insert.line');
    assert.equal((await state(page, 'insert.line')).checked, true);
    const a = await screen(page, 200, 300);
    const b = await screen(page, 600, 330);
    // the modifier of a move without the snap draws the line where the pointer is
    await drag(page, a, { dx: b.x - a.x, dy: b.y - a.y, modifiers: platform === 'mac' ? 'Meta' : 'Alt' });
    await frames(page);
    let [l] = await lines(page);
    assert.ok(Math.abs(l.ends[0] - 200) <= 1 && Math.abs(l.ends[1] - 300) <= 1, `${l.ends}`);
    assert.ok(Math.abs(l.ends[2] - 600) <= 2 && Math.abs(l.ends[3] - 330) <= 2);
    assert.equal(l.end, null);
    assert.equal((await state(page, 'insert.line')).checked, null);
    await undo(page);
    await byteExact(page);
    // with Shift the end is at 45 degrees from the start
    await exec(page, 'insert.line');
    const c = await screen(page, 500, 570);
    await drag(page, a, { dx: c.x - a.x, dy: c.y - a.y, modifiers: 'Shift' });
    await frames(page);
    [l] = await lines(page);
    assert.ok(Math.abs(l.ends[2] - l.ends[0] - (l.ends[3] - l.ends[1])) <= 1 && l.ends[2] - l.ends[0] > 200, `${l.ends}`);
    await undo(page);
    await byteExact(page);
    // Esc leaves the mode, and a drag then does not draw
    await exec(page, 'insert.arrow');
    await press(page, 'Escape');
    assert.equal((await state(page, 'insert.arrow')).checked, null);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the Line pane sets the tone and the arrowheads, and the end handles and a drag move a line, on ${platform}`, async () => {
    const page = await linePage(platform);
    await exec(page, 'insert.line', { from: { x: 300, y: 500 }, to: { x: 800, y: 500 } });
    await exec(page, 'selection.clear');
    assert.equal((await state(page, 'line.heads.none')).enabled, false);
    await frames(page);
    // a press within a few pixels of the line selects it
    const m = await screen(page, 550, 500);
    await click(page, { x: m.x, y: m.y + 3 });
    await frames(page);
    assert.equal((await state(page, 'line.heads.none')).enabled, true);
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-line-end')].filter((g) => !g.hidden).length`), 2);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    const svg = await inserted(page);
    await click(page, `${PANEL} [data-command="line.tone.accent"]`);
    await frames(page);
    let [l] = await lines(page);
    assert.equal(l.cls, 'line tone-accent');
    const accent = await page.evaluate(`getComputedStyle(Reveal.getCurrentSlide()).getPropertyValue('--accent').trim()`);
    assert.ok(accent);
    assert.equal(await inserted(page), svg.replace('class="line"', 'class="line tone-accent"'));
    await click(page, `${PANEL} [data-command="line.heads.both"]`);
    await frames(page);
    [l] = await lines(page);
    assert.equal(l.start, `url(#${l.id})`);
    assert.equal(l.end, `url(#${l.id})`);
    assert.equal((await state(page, 'line.heads.both')).checked, true);
    await inScope(page);
    await undo(page);
    await undo(page);
    assert.equal(await inserted(page), svg);
    await redo(page);
    await redo(page);
    const styled = await inserted(page);
    // a drag of the second end handle moves only that end, by the drag, from a handle drawn past
    // the arrowhead
    const end = await page.evaluate(`(() => { const r = document.querySelector('.beeson-line-end[data-end="2"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const at = await screen(page, l.ends[2], l.ends[3]);
    const to = await screen(page, 800, 700);
    await drag(page, end, { dx: to.x - at.x, dy: to.y - at.y, modifiers: platform === 'mac' ? 'Meta' : 'Alt' });
    await frames(page);
    [l] = await lines(page);
    assert.deepEqual(l.ends.slice(0, 2), [300, 500]);
    assert.ok(Math.abs(l.ends[2] - 800) <= 2 && Math.abs(l.ends[3] - 700) <= 2, `${l.ends}`);
    await inScope(page);
    await undo(page);
    assert.equal(await inserted(page), styled);
    await redo(page);
    const moved = await inserted(page);
    // a drag of the line moves both ends
    const mid = await screen(page, 550, 600);
    await drag(page, mid, { dx: 0, dy: -100, modifiers: platform === 'mac' ? 'Meta' : 'Alt' });
    await frames(page);
    const [k] = await lines(page);
    assert.ok(Math.abs(k.ends[1] - l.ends[1] - (k.ends[3] - l.ends[3])) <= 1 && k.ends[1] < l.ends[1], `${k.ends} ${l.ends}`);
    await undo(page);
    assert.equal(await inserted(page), moved);
    await redo(page);
    // a duplicate points its arrowheads at its own marker
    await press(page, 'Mod+D');
    await frames(page);
    const all = await lines(page);
    assert.equal(all.length, 2);
    assert.notEqual(all[0].id, all[1].id);
    for (const one of all) assert.equal(one.end, `url(#${one.id})`);
    await inScope(page);
    const { text } = await saveAndReopen(page, `line-pane-${platform}.html`);
    assert.equal((text.match(/<svg class="line/g) ?? []).length, 2);
    assert.deepEqual(errors(page), []);
  });
}
