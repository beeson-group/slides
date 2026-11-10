// the document model of the editor in headless Chrome. each structural edit made through
// window.BeesonEditor.doc is written into the text of the file. after an undo, the text is the file
// byte for byte, and after a redo it has the edit again. the text of a save is opened again and
// paired with zero problems

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';

const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';

// the editor on a deck, opened with the text of its file
async function editorPage(browser, file = 'index.html') {
  const text = readFileSync(file, 'utf8');
  const page = await browser.newPage();
  await page.goto(deckUrl(file, 'edit&still'));
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`);
  return { page, text, status };
}

// defect 4 of the save model: reveal.js removed a slide with data-visibility="hidden" from the page
// without showHiddenSlides, and its blocks were then problems
test('a deck with a hidden slide pairs with zero problems, and its hidden slide is edited', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, text, status } = await editorPage(browser, 'test/pages/editor-hidden.html');
  assert.deepEqual(status.problems, []);
  assert.equal(status.sections, 3);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
  await page.evaluate(`[...document.querySelectorAll('.reveal p')].find((p) => p.textContent === 'The hidden slide.').firstChild.data = 'Edited.'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text.replace('The hidden slide.', 'Edited.'));
  assert.deepEqual(page.errors, []);
});

// defect 5 of the save model: the start tag of an element inside a block was copied from the file,
// hence a change of its class on the page, e.g. by a restore of the typing in the block, was lost
test('a changed class of a span inside a block is written, and the classes of the theme are not', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, text, status } = await editorPage(browser);
  assert.deepEqual(status.problems, []);
  const span = `[...document.querySelectorAll('.reveal span')].find((s) => s.textContent === 'Coriolis terms')`;
  // the span is colored at a step, hence hl-target is put on it at run time
  assert.equal(await page.evaluate(`${span}.classList.contains('hl-target')`), true);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
  await page.evaluate(`${span}.classList.add('small')`);
  const before = '<span class="coriolis">Coriolis terms</span>';
  assert.equal(text.split(before).length, 2);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text.replace(before, '<span class="coriolis small">Coriolis terms</span>'));
  // a span made anew, as by a restore of the content of its block, is written with its own class
  await page.evaluate(`${span}.outerHTML = '<span class="potential">Coriolis terms</span>'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text.replace(before, '<span class="potential">Coriolis terms</span>'));
  await page.evaluate(`${span}.className = 'coriolis'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
  assert.deepEqual(page.errors, []);
});

// the units of the content of the element whose start tag is at open in text, as ranges with the
// start of the lead, the element, and the end of the unit
async function unitsAt(text, open) {
  const { tokenize } = await import('../src/editor/tokens.ts');
  const { childrenIn, unitsOf } = await import('../src/editor/model/units.ts');
  const tokens = tokenize(text);
  const i = tokens.findIndex((t) => t.start === open);
  const name = tokens[i].name;
  let depth = 0;
  const close = tokens.slice(i + 1).find((t) => {
    if (t.name !== name) return false;
    if (t.type === 'start') depth++;
    else if (t.type === 'end' && depth-- === 0) return true;
    return false;
  });
  const content = { start: tokens[i].end, end: close.start };
  return unitsOf(text, childrenIn(tokens, content), content);
}

const E = 'window.BeesonEditor';

// a and b equal, with the first difference shown in place of the whole text
function same(a, b, label) {
  if (a === b) return;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  assert.fail(`${label}: the texts differ at ${i}\n  actual: ${JSON.stringify(a.slice(Math.max(0, i - 80), i + 120))}\n  expected: ${JSON.stringify(b.slice(Math.max(0, i - 80), i + 120))}`);
}
const render = (page) => page.evaluate(`${E}.render()`);
// the slide of the page with index n, counted from 0 in the file
const slide = (n) => `document.querySelectorAll('.reveal .slides > section')[${n}]`;

// one edit: the text after it, after an undo and a redo, and after a save, an open of the saved
// text with zero problems, and an undo. the file is then opened again
async function check(page, text, edit, expected, label) {
  await page.evaluate(`(async () => { ${edit} })()`);
  same(await render(page), expected, label);
  await page.evaluate(`${E}.undo()`);
  same(await render(page), text, `${label}, undone`);
  await page.evaluate(`${E}.redo()`);
  same(await render(page), expected, `${label}, redone`);
  const saved = await page.evaluate(`${E}.open(${JSON.stringify(expected)}, false)`);
  assert.deepEqual(saved.problems, [], `${label}, saved`);
  same(await render(page), expected, `${label}, saved and rendered`);
  await page.evaluate(`${E}.undo()`);
  same(await render(page), text, `${label}, saved and undone`);
  const opened = await page.evaluate(`${E}.open(${JSON.stringify(text)})`);
  assert.deepEqual(opened.problems, [], `${label}, opened again`);
}

test('a slide of each layout is inserted, and a slide is duplicated, deleted, moved, and hidden', async (t) => {
  const { layoutText, textStyle, LAYOUTS } = await import('../src/editor/model/templates.ts');
  const browser = await launch();
  t.after(() => browser.close());
  const { page, text, status } = await editorPage(browser);
  assert.deepEqual(status.problems, []);
  const { units } = await unitsAt(text, text.indexOf('<div class="slides">'));
  const unit = (n) => text.slice(units[n].lead.start, units[n].end);
  const last = units.length - 1;
  const before = units[last].lead.start;
  for (const layout of LAYOUTS) {
    const expected = text.slice(0, before) + '\n\n' + layoutText(layout, textStyle(text)) + text.slice(before);
    await check(page, text, `await ${E}.doc.insertSlide(${JSON.stringify(layout)}, ${slide(last)})`, expected, `a ${layout} slide`);
  }
  const body = text.slice(units[2].range.start, units[2].range.end);
  await check(page, text, `await ${E}.doc.duplicate(${slide(2)})`, text.slice(0, units[2].end) + '\n\n' + body + text.slice(units[2].end), 'a duplicated slide');
  await check(page, text, `await ${E}.doc.remove(${slide(2)})`, text.slice(0, units[2].lead.start) + text.slice(units[2].end), 'a deleted slide');
  await check(page, text, `const s = ${slide(2)}; await ${E}.doc.move(s, s.parentElement, ${slide(0)})`, text.slice(0, units[0].lead.start) + unit(2) + text.slice(units[0].lead.start, units[2].lead.start) + text.slice(units[2].end), 'a slide moved first');
  await check(page, text, `const s = ${slide(0)}; await ${E}.doc.move(s, s.parentElement, null)`, text.slice(0, units[0].lead.start) + text.slice(units[1].lead.start, units[last].end) + unit(0) + text.slice(units[last].end), 'a slide moved last');
  const open = units[2].range.start;
  assert.equal(text.slice(open, open + 9), '<section>');
  await check(page, text, `${E}.doc.hide(${slide(2)})`, text.slice(0, open) + '<section data-visibility="hidden">' + text.slice(open + 9), 'a hidden slide');
  assert.deepEqual(page.errors, []);
});

test('an element of each kind is inserted, and an element is removed, moved, and retagged', async (t) => {
  const { elementText, textStyle, ELEMENT_KINDS } = await import('../src/editor/model/templates.ts');
  const browser = await launch();
  t.after(() => browser.close());
  const { page, text } = await editorPage(browser);
  const slides = await unitsAt(text, text.indexOf('<div class="slides">'));
  const three = await unitsAt(text, slides.units[2].range.start);
  const four = await unitsAt(text, slides.units[3].range.start);
  const end = three.units.at(-1).end;
  const options = {
    image: { src: 'demo/figure-dark.png', alt: 'A figure' },
    video: { src: 'demo/clip-dark.mp4', poster: 'demo/clip-dark.png' },
    plot: { id: 'plot-test' },
    formula: { tex: 'a^2' },
  };
  for (const kind of ELEMENT_KINDS) {
    const added = elementText(kind, textStyle(text), '  ', options[kind]).map((u) => '\n  ' + u).join('');
    await check(page, text, `await ${E}.doc.insertElement(${JSON.stringify(kind)}, ${slide(2)}, null, ${JSON.stringify(options[kind] ?? {})})`, text.slice(0, end) + added + text.slice(end), `a new ${kind}`);
  }
  const p = three.units.find((u) => text.startsWith('<p>', u.range.start));
  const pText = text.slice(p.range.start, p.range.end);
  const pLive = `${slide(2)}.querySelector(':scope > p')`;
  await check(page, text, `await ${E}.doc.remove(${pLive})`, text.slice(0, p.lead.start) + text.slice(p.end), 'a removed paragraph');
  const fourEnd = four.units.at(-1).end;
  await check(page, text, `await ${E}.doc.move(${pLive}, ${slide(3)}, null)`, text.slice(0, p.lead.start) + text.slice(p.end, fourEnd) + '\n  ' + pText + text.slice(fourEnd), 'a paragraph moved into the next slide');
  const h3 = '<h3>' + pText.slice(3, -4) + '</h3>';
  await check(page, text, `await ${E}.doc.retag(${pLive}, 'h3')`, text.slice(0, p.range.start) + h3 + text.slice(p.range.end), 'a paragraph made a heading');
  assert.deepEqual(page.errors, []);
});

test('a deleted slide with a block edit, a tag edit, and new notes is written without an overlap', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, text } = await editorPage(browser);
  const slides = await unitsAt(text, text.indexOf('<div class="slides">'));
  const n = slides.units.findIndex((u) => !text.slice(u.range.start, u.range.end).includes('aside class="notes"'));
  await page.evaluate(`(() => {
    const s = ${slide(n)};
    const h = s.querySelector('h2');
    h.firstChild.data = 'Edited heading';
    ${E}.doc.setTag(h, { classes: { small: true } });
    const aside = document.createElement('aside');
    aside.className = 'notes';
    aside.textContent = 'New notes.';
    s.append(aside);
  })()`);
  const edited = await render(page);
  assert.ok(edited.includes('Edited heading') && edited.includes('<aside class="notes">New notes.</aside>'));
  await page.evaluate(`${E}.doc.remove(${slide(n)})`);
  same(await render(page), text.slice(0, slides.units[n].lead.start) + text.slice(slides.units[n].end), 'a deleted slide');
  await page.evaluate(`${E}.undo()`);
  same(await render(page), edited, 'a deleted slide put back');
  assert.deepEqual(page.errors, []);
});

test('a moved section slide fills the running heads again', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await editorPage(browser);
  const heads = () => page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].map((s) => s.querySelector(':scope > div.run')?.textContent ?? '')`);
  const before = await heads();
  const second = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section.section')].indexOf(${slide(6)})`);
  assert.equal(second, 1);
  await page.evaluate(`(async () => { const s = ${slide(6)}; await ${E}.doc.move(s, s.parentElement, ${slide(2)}); })()`);
  const after = await heads();
  assert.notDeepEqual(after, before);
  assert.equal(after[3], await page.evaluate(`${slide(2)}.querySelector('h2').textContent.trim()`));
  await page.evaluate(`${E}.undo()`);
  assert.deepEqual(await heads(), before);
  assert.deepEqual(page.errors, []);
});

// a list is not a block, hence it was kept in its first slide while it was inside a slide taken off
// the page
test('an element moved into a slide that is then deleted is written in neither slide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, text } = await editorPage(browser);
  const slides = await unitsAt(text, text.indexOf('<div class="slides">'));
  const three = await unitsAt(text, slides.units[2].range.start);
  const ul = three.units.find((u) => text.startsWith('<ul>', u.range.start));
  await page.evaluate(`(async () => {
    await ${E}.doc.move(${slide(2)}.querySelector(':scope > ul'), ${slide(3)}, null);
    await ${E}.doc.remove(${slide(3)});
  })()`);
  const four = slides.units[3];
  same(await render(page), text.slice(0, ul.lead.start) + text.slice(ul.end, four.lead.start) + text.slice(four.end), 'a deleted slide with a moved list');
  await page.evaluate(`(async () => { await ${E}.undo(); await ${E}.undo(); })()`);
  same(await render(page), text, 'both undone');
  assert.deepEqual(page.errors, []);
});
