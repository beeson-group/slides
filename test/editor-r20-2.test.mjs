// the shapes of commands/shape.ts on both platforms, driven with trusted input: Insert > Shape
// writes a div.shape before the notes of the slide, a drag in its drawing mode draws the box, the
// grips resize it with a free aspect, the Shape pane sets its tone, fill, outline, corners, and
// geometry, a typed key starts its words, and it is moved, copied, grouped, locked, ordered, kept
// by Change Layout and the resets, and named in the Object List. each edit is checked byte for
// byte, after an undo and a redo, against the scope rule, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { declarationProblem, textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { ELEMENT_KINDS, elementText } from '../src/editor/model/templates.ts';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r20-2.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const [EMPTY, EVERY, FRAME, CARD] = [0, 1, 2, 3];

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

async function shapePage(platform, n = EMPTY) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
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
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const free = (platform) => (platform === 'mac' ? 'Meta' : 'Alt');

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

// the shapes of the current slide: classes, the place and the size of the style, the words, and
// the path of the svg child
const shapes = (page) => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('.shape')].map((el) => ({
  cls: [...el.classList].filter((c) => !c.startsWith('beeson-')).join(' '), translate: el.style.translate, width: el.style.width, height: el.style.height, rotate: el.style.rotate,
  words: [...el.querySelectorAll('p')].map((p) => p.textContent).join('|'), d: el.querySelector(':scope > svg path')?.getAttribute('d') ?? null,
}))`);

// the rendered text without the one shape inserted into it, and that shape
async function inserted(page, source = page.source) {
  const text = await render(page);
  const m = /\n[ \t]*(<div class="shape[^\n]*<\/div>)/.exec(text);
  assert.ok(m, 'a shape is not in the rendered text');
  assert.equal(text.slice(0, m.index) + text.slice(m.index + m[0].length), source);
  return { shape: m[1], text, at: m.index };
}

// the caret put back at the end of the words of the shape of the current slide
const caretBack = (page) => page.evaluate(`(() => { const p = Reveal.getCurrentSlide().querySelector('.shape p'); p.focus(); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);

const objectNames = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].map((r) => r.textContent.trim())`);

test('the scope rule takes the width and the height of a shape in px, and the template of a shape is in it', () => {
  assert.equal(declarationProblem('div', ['shape', 'rounded'], 'height', '127px'), null);
  assert.equal(declarationProblem('div', ['shape'], 'width', '525px'), null);
  assert.notEqual(declarationProblem('div', ['zone'], 'height', '127px'), null);
  assert.notEqual(declarationProblem('div', ['shape'], 'width', '40%'), null);
  assert.ok(ELEMENT_KINDS.includes('shape'));
  const [t] = elementText('shape', { eol: '\n', step: '  ' }, '');
  assert.equal(t, '<div class="shape rounded" style="width: 240px; height: 240px"></div>');
  assert.deepEqual(textProblems(t, THEME), []);
  for (const c of ['shape', 'rounded', 'ellipse', 'triangle', 'arrow', 'arrow-both', 'brace', 'plus', 'equals', 'round-s', 'round-l', 'fill-none', 'fill-ground', 'veil', 'weight-6', 'weight-8', 'no-outline', 'flip-x', 'flip-y']) assert.ok(THEME.has(c), c);
});

for (const platform of PLATFORMS) {
  test(`Insert Shape with a box writes a rounded rectangle before the notes, undone and redone byte for byte, and saved, on ${platform}`, async () => {
    const page = await shapePage(platform);
    assert.equal((await state(page, 'insert.shape.rounded')).enabled, true);
    await exec(page, 'insert.shape.rounded', { box: { left: 300, top: 400, width: 500, height: 200 } });
    await frames(page);
    const { shape, text } = await inserted(page);
    assert.equal(shape, '<div class="shape rounded" style="width: 500px; height: 200px; translate: 300px 400px"></div>');
    // in front of every element of the slide, before its notes
    assert.ok(/<div class="shape[^\n]*<\/div>\n\s*<aside class="notes">Notes of the empty slide/.test(text));
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Insert Shape');
    // the shapes are in the submenu Shape of the Insert menu, before Line
    const sub = await page.evaluate(`window.BeesonEditorShell.menuItems('Insert', 'Shape').filter((i) => i.command).map((i) => i.command)`);
    assert.deepEqual(sub, ['rounded', 'rectangle', 'ellipse', 'triangle', 'arrow', 'arrow-both', 'brace', 'plus', 'equals'].map((k) => `insert.shape.${k}`));
    const top = await page.evaluate(`window.BeesonEditorShell.menuItems('Insert').map((i) => i.command ?? i.label ?? '|')`);
    assert.equal(top[top.indexOf('insert.line') - 1], 'Shape', top.join(' '));
    const rect = await page.evaluate(`(() => { const el = Reveal.getCurrentSlide().querySelector('.shape'); const s = document.querySelector('.reveal .slides'); const k = s.getBoundingClientRect().width / s.offsetWidth; const r = el.getBoundingClientRect(), o = s.getBoundingClientRect(); return [Math.round((r.left - o.left) / k), Math.round((r.top - o.top) / k), Math.round(r.width / k), Math.round(r.height / k)]; })()`);
    assert.deepEqual(rect, [300, 400, 500, 200]);
    // the shape is selected, and the Shape pane is shown with Arrange
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].map((b) => b.textContent)`), ['Shape', 'Arrange']);
    await inScope(page);
    await undo(page);
    await byteExact(page);
    await redo(page);
    assert.equal((await inserted(page)).shape, shape);
    const { text: saved } = await saveAndReopen(page, `r20-2-insert-${platform}.html`);
    assert.ok(saved.includes(shape));
    assert.deepEqual(errors(page), []);
  });

  test(`a drag in the mode of Insert Shape draws the box, with Shift a square, a click a shape of 240 px, and Esc leaves the mode, on ${platform}`, async () => {
    const page = await shapePage(platform);
    await exec(page, 'insert.shape.ellipse');
    assert.equal((await state(page, 'insert.shape.ellipse')).checked, true);
    const a = await screen(page, 300, 300);
    const b = await screen(page, 700, 500);
    await drag(page, a, { dx: b.x - a.x, dy: b.y - a.y, modifiers: free(platform) });
    await frames(page);
    let [s] = await shapes(page);
    assert.equal(s.cls, 'shape ellipse');
    assert.equal(s.translate, '300px 300px');
    assert.ok(Math.abs(parseFloat(s.width) - 400) <= 2 && Math.abs(parseFloat(s.height) - 200) <= 2, `${s.width} ${s.height}`);
    assert.equal((await state(page, 'insert.shape.ellipse')).checked, null);
    await undo(page);
    await byteExact(page);
    // with Shift the box is a square of the longer side
    await exec(page, 'insert.shape.rectangle');
    await drag(page, a, { dx: b.x - a.x, dy: b.y - a.y, modifiers: `Shift+${free(platform)}` });
    await frames(page);
    [s] = await shapes(page);
    assert.equal(s.cls, 'shape');
    assert.equal(s.width, s.height);
    assert.ok(Math.abs(parseFloat(s.width) - 400) <= 2, s.width);
    await undo(page);
    // a click places a shape of 240 by 240 px with its upper left corner at the click
    await exec(page, 'insert.shape.triangle');
    await click(page, a, { modifiers: free(platform) });
    await frames(page);
    [s] = await shapes(page);
    assert.deepEqual([s.cls, s.translate, s.width, s.height], ['shape triangle', '300px 300px', '240px', '240px']);
    assert.ok(s.d?.startsWith('M120 1.5L'), s.d);
    await undo(page);
    await byteExact(page);
    // Esc leaves the mode, and a drag then draws a marquee
    await exec(page, 'insert.shape.rounded');
    await press(page, 'Escape');
    assert.equal((await state(page, 'insert.shape.rounded')).checked, null);
    await drag(page, a, { dx: 100, dy: 100 });
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the grips resize a shape with a free aspect, Shift on a corner keeps it, the fields W and H write each side, and a flip turns a drawn geometry, on ${platform}`, async () => {
    const page = await shapePage(platform);
    await exec(page, 'insert.shape.rounded', { box: { left: 400, top: 300, width: 400, height: 200 } });
    await frames(page);
    const source = await render(page);
    const grip = (h) => page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="${h}"]')].find((g) => !g.hidden && g.getBoundingClientRect().width); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const k = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);
    // the side grip at the right stretches the width alone
    await drag(page, await grip('e'), { dx: 100 * k, modifiers: free(platform) });
    await frames(page);
    let [s] = await shapes(page);
    assert.deepEqual([s.translate, s.width, s.height], ['400px 300px', '500px', '200px']);
    await undo(page);
    assert.equal(await render(page), source);
    // the side grip at the bottom stretches the height alone
    await drag(page, await grip('s'), { dy: 100 * k, modifiers: free(platform) });
    await frames(page);
    [s] = await shapes(page);
    assert.deepEqual([s.width, s.height], ['400px', '300px']);
    await undo(page);
    // a corner grip with Shift keeps the aspect of 2 to 1
    await drag(page, await grip('se'), { dx: 200 * k, dy: 20 * k, modifiers: `Shift+${free(platform)}` });
    await frames(page);
    [s] = await shapes(page);
    assert.ok(Math.abs(parseFloat(s.width) / parseFloat(s.height) - 2) < 0.02, `${s.width} ${s.height}`);
    await undo(page);
    assert.equal(await render(page), source);
    // the fields W and H each write their side alone, since a shape does not keep its aspect
    await exec(page, 'arrange.setSize', { w: 300 });
    await frames(page);
    [s] = await shapes(page);
    assert.deepEqual([s.width, s.height], ['300px', '200px']);
    await exec(page, 'arrange.setSize', { h: 300 });
    await frames(page);
    [s] = await shapes(page);
    assert.deepEqual([s.width, s.height], ['300px', '300px']);
    await inScope(page);
    await undo(page);
    await undo(page);
    assert.equal(await render(page), source);
    // a flip is dimmed on a rectangle, and toggles flip-x on a triangle, also at an undo and a redo
    assert.equal((await state(page, 'arrange.flipHorizontal')).enabled, false);
    await exec(page, 'shape.kind.triangle');
    await exec(page, 'arrange.flipHorizontal');
    await frames(page);
    [s] = await shapes(page);
    assert.equal(s.cls, 'shape triangle flip-x');
    assert.equal(await page.evaluate(`getComputedStyle(Reveal.getCurrentSlide().querySelector('.shape > svg')).scale`), '-1 1');
    await exec(page, 'arrange.flipVertical');
    await frames(page);
    [s] = await shapes(page);
    assert.equal(s.cls, 'shape triangle flip-x flip-y');
    await inScope(page);
    await undo(page);
    await undo(page);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), source);
    [s] = await shapes(page);
    assert.equal(s.d, null, 'the svg of the triangle is kept after the undo of Change Shape');
    await redo(page);
    await frames(page);
    [s] = await shapes(page);
    assert.ok(s.d?.startsWith('M200 1.5L'), `the svg is not drawn again at the redo: ${s.d}`);
    // an outline of 8 px insets the path by 4 px, also after an undo and a redo of the width
    await exec(page, 'shape.weight.8');
    await frames(page);
    assert.ok((await shapes(page))[0].d.startsWith('M200 4L'));
    await undo(page);
    await frames(page);
    assert.ok((await shapes(page))[0].d.startsWith('M200 1.5L'), 'the undo of the outline does not draw the svg again');
    await redo(page);
    await frames(page);
    assert.ok((await shapes(page))[0].d.startsWith('M200 4L'), 'the redo of the outline does not draw the svg again');
    assert.deepEqual(errors(page), []);
  });

  test(`the Shape pane sets the tone, the fill, the outline, the corners, and the geometry of every selected shape, on ${platform}`, async () => {
    const page = await shapePage(platform);
    await exec(page, 'insert.shape.rounded', { box: { left: 200, top: 300, width: 400, height: 200 } });
    await exec(page, 'insert.shape.rounded', { box: { left: 800, top: 300, width: 400, height: 200 } });
    await click(page, await screen(page, 230, 330), { modifiers: 'Shift' });
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 2);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].map((b) => b.textContent)`), ['Shape', 'Arrange']);
    const source = await render(page);
    const steps = [
      ['shape.tone.accent', 'shape rounded tone-accent'],
      ['shape.fill.none', 'shape rounded tone-accent fill-none'],
      ['shape.fill.ground', 'shape rounded tone-accent fill-ground'],
      ['shape.fill.veil', 'shape rounded tone-accent veil'],
      ['shape.fill.tint', 'shape rounded tone-accent'],
      ['shape.weight.6', 'shape rounded tone-accent weight-6'],
      ['shape.weight.8', 'shape rounded tone-accent weight-8'],
      ['shape.weight.none', 'shape rounded tone-accent no-outline'],
      ['shape.weight.3', 'shape rounded tone-accent'],
      ['shape.corner.small', 'shape rounded tone-accent round-s'],
      ['shape.corner.large', 'shape rounded tone-accent round-l'],
      ['shape.corner.medium', 'shape rounded tone-accent'],
      ['shape.tone.text', 'shape rounded'],
    ];
    for (const [id, cls] of steps) {
      await click(page, `${PANEL} [data-command="${id}"]`);
      await frames(page);
      assert.deepEqual((await shapes(page)).map((s) => s.cls), [cls, cls], id);
      assert.equal((await state(page, id)).checked, true, id);
    }
    await inScope(page);
    // the geometry keeps the words, the box, and the other classes, and the corners are dimmed
    await exec(page, 'shape.tone.blue');
    await exec(page, 'shape.kind.arrow');
    await frames(page);
    let all = await shapes(page);
    assert.deepEqual(all.map((s) => [s.cls, s.width, s.height]), [['shape tone-blue arrow', '400px', '200px'], ['shape tone-blue arrow', '400px', '200px']]);
    assert.ok(all.every((s) => s.d?.startsWith('M1.5 ')), all[0].d);
    assert.equal((await state(page, 'shape.corner.small')).enabled, false);
    await exec(page, 'shape.kind.ellipse');
    await frames(page);
    all = await shapes(page);
    assert.deepEqual(all.map((s) => [s.cls, s.d]), [['shape tone-blue ellipse', null], ['shape tone-blue ellipse', null]]);
    // the pop-up Shape lists the geometries, and a choice in it changes the geometry
    await click(page, `${PANEL} .ed-shape-kind`);
    await frames(page);
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => i.textContent.trim())`);
    for (const label of ['Rectangle', 'Rounded Rectangle', 'Ellipse', 'Triangle', 'Block Arrow', 'Double Block Arrow', 'Brace', 'Plus', 'Equals']) assert.ok(items.some((t) => t.startsWith(label)), `${label} in ${items}`);
    await click(page, await page.evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.textContent.trim().startsWith('Triangle')); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    await frames(page);
    all = await shapes(page);
    assert.deepEqual(all.map((s) => s.cls), ['shape tone-blue triangle', 'shape tone-blue triangle']);
    await inScope(page);
    for (let i = 0; i < steps.length + 4; i++) await undo(page);
    await frames(page);
    assert.equal(await render(page), source);
    assert.deepEqual((await shapes(page)).map((s) => s.d), [null, null]);
    const { text } = await saveAndReopen(page, `r20-2-pane-${platform}.html`);
    assert.equal(text, source);
    assert.deepEqual(errors(page), []);
  });

  test(`a typed key starts the words of a selected shape, Return and a double click put the caret at their end, on ${platform}`, async () => {
    const page = await shapePage(platform);
    await exec(page, 'insert.shape.rounded', { box: { left: 400, top: 300, width: 600, height: 300 } });
    await frames(page);
    const { shape, text: source } = await inserted(page);
    await press(page, 'Shift+G');
    await frames(page);
    await page.send('Input.insertText', { text: 'oal' });
    await sleep(50);
    await frames(page);
    let [s] = await shapes(page);
    assert.equal(s.words, 'Goal');
    assert.equal((await inserted(page, page.source)).shape, shape.replace('></div>', '><p>Goal</p></div>'));
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Typing');
    // the caret is in the words, and the shape keeps its frame
    assert.equal(await page.evaluate(`!!document.activeElement.closest('.shape')`), true);
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-frame.selected')].filter((f) => !f.hidden && f.getBoundingClientRect().width > 300).length > 0`), true);
    // the Text pane formats the words of the shape
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].map((b) => b.textContent)`), ['Shape', 'Text', 'Arrange']);
    await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Shape').click()`);
    await caretBack(page);
    // the words are centered in the shape at the body size
    const words = await page.evaluate(`(() => { const el = Reveal.getCurrentSlide().querySelector('.shape'), p = el.querySelector('p'); const a = el.getBoundingClientRect(), b = p.getBoundingClientRect(); return { dx: Math.round(b.left + b.width / 2 - a.left - a.width / 2), dy: Math.round(b.top + b.height / 2 - a.top - a.height / 2), size: getComputedStyle(p).fontSize }; })()`);
    assert.deepEqual(words, { dx: 0, dy: 0, size: '48px' });
    // the first key is one entry, and the typing after it another
    await undo(page);
    await frames(page);
    assert.equal((await shapes(page))[0].words, 'G');
    await undo(page);
    await frames(page);
    assert.equal(await render(page), source);
    await redo(page);
    await redo(page);
    await frames(page);
    assert.equal((await shapes(page))[0].words, 'Goal');
    await inScope(page);
    // Return with the shape selected puts the caret at the end of its words
    await press(page, 'Escape');
    await press(page, 'Escape');
    await click(page, await screen(page, 430, 330));
    assert.equal(await page.evaluate(`window.BeesonEditor.selection()[0]?.matches('.shape') ?? false`), true);
    await press(page, 'Enter');
    await page.send('Input.insertText', { text: 's' });
    await sleep(50);
    [s] = await shapes(page);
    assert.equal(s.words, 'Goals');
    // a double click on an empty shape puts the caret into it, and an empty p is not written
    await exec(page, 'insert.shape.ellipse', { box: { left: 1100, top: 300, width: 300, height: 300 } });
    await frames(page);
    const empty = await render(page);
    await exec(page, 'selection.clear');
    await click(page, await screen(page, 1250, 450), { count: 2 });
    await frames(page);
    assert.equal(await page.evaluate(`!!document.activeElement.closest('.shape.ellipse')`), true, 'the caret is not in the empty shape');
    assert.equal(await render(page), empty);
    await page.send('Input.insertText', { text: 'x' });
    await sleep(50);
    await frames(page);
    assert.ok((await render(page)).includes('<div class="shape ellipse" style="width: 300px; height: 300px; translate: 1100px 300px"><p>x</p></div>'));
    await exec(page, 'selection.clear');
    await frames(page);
    // a first click on the words of a shape that is not selected selects the shape
    await click(page, await screen(page, 700, 450));
    await frames(page);
    assert.equal(await page.evaluate(`window.BeesonEditor.selection().length === 1 && window.BeesonEditor.selection()[0].matches('.shape.rounded')`), true);
    assert.equal(await page.evaluate(`!!document.activeElement.closest('.shape')`), false);
    await click(page, await screen(page, 700, 450));
    await frames(page);
    assert.equal(await page.evaluate(`!!document.activeElement.closest('.shape.rounded')`), true);
    await inScope(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a shape is named in the Object List, moved, copied, grouped, locked, and ordered byte for byte, on ${platform}`, async () => {
    const page = await shapePage(platform, EVERY);
    if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
    await frames(page);
    const names = await objectNames(page);
    for (const n of ['Rounded Rectangle: Goal', 'Rectangle', 'Ellipse', 'Triangle', 'Block Arrow', 'Double Block Arrow', 'Brace', 'Plus', 'Equals']) assert.ok(names.includes(n), `${n} in ${names}`);
    // a click on the empty rectangle selects it, and a drag moves it
    const r = await screen(page, 750, 340);
    await click(page, r);
    await frames(page);
    assert.equal(await page.evaluate(`[...window.BeesonEditor.selection()[0]?.classList ?? []].filter((c) => !c.startsWith('beeson-')).join(' ')`), 'shape');
    const up = await screen(page, 750, 300);
    await drag(page, r, { dx: 0, dy: up.y - r.y, modifiers: free(platform) });
    await frames(page);
    const moved = await render(page);
    assert.ok(moved.includes('<div class="shape" style="width: 300px; height: 160px; translate: 600px 220px"></div>'), moved.split('\n').filter((l) => l.includes('class="shape"')).join('\n'));
    await undo(page);
    await byteExact(page);
    // a duplicate, a copy and a paste, and Select All
    await click(page, r);
    await press(page, 'Mod+D');
    await frames(page);
    assert.equal((await shapes(page)).filter((s) => s.cls === 'shape').length, 2);
    await inScope(page);
    await undo(page);
    await byteExact(page);
    await exec(page, 'selection.all');
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 10);
    // a group of two shapes, a lock, and the layer order
    await click(page, r);
    await click(page, await screen(page, 982, 340), { modifiers: 'Shift' });
    // Align Left moves the ellipse to the left edge of the rectangle
    await exec(page, 'arrange.align.left');
    await frames(page);
    assert.ok((await render(page)).includes('<div class="shape ellipse tone-red fill-none" style="width: 300px; height: 160px; translate: 600px 260px"></div>'));
    await undo(page);
    await byteExact(page);
    await exec(page, 'arrange.group');
    await frames(page);
    assert.equal((await render(page)).match(/data-group=/g)?.length, 2);
    await inScope(page);
    await undo(page);
    await byteExact(page);
    await click(page, await screen(page, 1460, 400));
    await exec(page, 'arrange.lock');
    await frames(page);
    assert.ok((await render(page)).includes('<div class="shape triangle" style="width: 200px; height: 160px; translate: 1360px 260px" data-locked>'));
    await undo(page);
    await byteExact(page);
    await click(page, await screen(page, 160, 300));
    assert.equal(await page.evaluate(`window.BeesonEditor.selection()[0]?.matches('.shape.rounded') ?? false`), true);
    await exec(page, 'arrange.order.front');
    await frames(page);
    const front = await render(page);
    assert.notEqual(front, page.source);
    assert.ok(await page.evaluate(`(() => { const all = [...Reveal.getCurrentSlide().querySelectorAll('.shape')]; return getComputedStyle(all[0]).zIndex !== 'auto' || all.at(-1).matches('.rounded'); })()`));
    await undo(page);
    await byteExact(page);
    // a deck with every kind of shape is saved byte for byte and drawn the same after an open
    const before = await shapes(page);
    const { text } = await saveAndReopen(page, `r20-2-every-${platform}.html`);
    assert.equal(text, page.source);
    await frames(page);
    assert.deepEqual(await shapes(page), before);
    assert.deepEqual(errors(page), []);
  });

  test(`Change Layout keeps a shape at its place, and Reset Slide, Reset Position, and Reset Size leave its place and its size, on ${platform}`, async () => {
    const page = await shapePage(platform, CARD);
    const tag = '<div class="shape rounded" style="width: 500px; height: 300px; translate: 1100px 400px; rotate: 30deg">';
    const box = () => page.evaluate(`(() => { const el = Reveal.getCurrentSlide().querySelector('.shape'); const s = document.querySelector('.reveal .slides'); const k = s.getBoundingClientRect().width / s.offsetWidth; const r = el.getBoundingClientRect(), o = s.getBoundingClientRect(); return [Math.round((r.left - o.left) / k), Math.round((r.top - o.top) / k)]; })()`);
    const at = await box();
    await exec(page, 'slide.layout.narrow');
    await frames(page);
    let text = await render(page);
    assert.ok(text.includes(`${tag}<p>Card</p></div>`), 'Change Layout moved or changed the shape');
    assert.ok(!/<div class="col">[\s\S]*class="shape/.test(text), 'the shape is in the text column');
    assert.deepEqual(await box(), at);
    await undo(page);
    await frames(page);
    await byteExact(page);
    // Reset Slide takes the rotation off and leaves the place and the size
    await exec(page, 'slide.reset');
    await frames(page);
    text = await render(page);
    assert.ok(text.includes('<div class="shape rounded" style="width: 500px; height: 300px; translate: 1100px 400px"><p>Card</p></div>'), 'Reset Slide took the place or the size off the shape');
    await undo(page);
    await frames(page);
    await byteExact(page);
    await click(page, await screen(page, 1350, 650));
    assert.equal(await page.evaluate(`window.BeesonEditor.selection()[0]?.matches('.shape') ?? false`), true);
    assert.equal((await state(page, 'arrange.resetPosition')).enabled, false);
    assert.equal((await state(page, 'arrange.resetSize')).enabled, false);
    assert.equal((await state(page, 'arrange.resetRotation')).enabled, true);
    await exec(page, 'arrange.resetPosition');
    await exec(page, 'arrange.resetSize');
    await byteExact(page);
    await exec(page, 'arrange.resetRotation');
    await frames(page);
    assert.ok((await render(page)).includes('<div class="shape rounded" style="width: 500px; height: 300px; translate: 1100px 400px"><p>Card</p></div>'));
    assert.deepEqual(errors(page), []);
  });

  test(`a press inside a shape without a fill goes through it, and a press on its outline or its words selects it, on ${platform}`, async () => {
    const page = await shapePage(platform, FRAME);
    // inside the frame, away from its words, a click selects nothing and a drag does not move it
    await click(page, await screen(page, 300, 400));
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 0);
    await drag(page, await screen(page, 300, 400), { dx: 40, dy: 40 });
    await frames(page);
    await byteExact(page);
    await exec(page, 'selection.clear');
    // on the outline, at the left edge
    await click(page, await screen(page, 202, 550));
    await frames(page);
    assert.equal(await page.evaluate(`window.BeesonEditor.selection()[0]?.matches('.shape') ?? false`), true);
    await exec(page, 'selection.clear');
    // on its words
    await click(page, await screen(page, 800, 550));
    await frames(page);
    assert.equal(await page.evaluate(`window.BeesonEditor.selection()[0]?.matches('.shape') ?? false`), true);
    assert.deepEqual(errors(page), []);
  });
}
