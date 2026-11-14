// the order of the attributes, the classes, and the declarations of a start tag through edits, undos,
// and redos. the state that stateOf of tags.ts gives for an edit is the tag that renderTag writes
// for it, read back in its order, and a seeded run of tag edits gives each tag byte for byte after
// each undo

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inverseEdit, normalizeEdit } from '../src/editor/model/doc.ts';
import { mergeEdit, renderTag, stateOf } from '../src/editor/tags.ts';
import { tokenize } from '../src/editor/tokens.ts';

const SEED = 20261110;
const EDITS = 200;

const tagOf = (html) => tokenize(html).find((t) => t.type === 'start');
const render = (html, edit) => {
  const tag = tagOf(html);
  const open = renderTag(html, tag, tag.attrs, edit);
  return open === null ? html : html.slice(0, tag.start) + open + html.slice(tag.end);
};
// a state with the order of its keys, which deepEqual does not compare
const ordered = (s) => ({ attrs: Object.entries(s.attrs), classes: s.classes, style: Object.entries(s.style) });
const readBack = (html) => ordered(stateOf(tagOf(html).attrs));

test('the state of a tag without a class lists the class of a new step before its index', () => {
  const html = '<p>a</p>';
  const edit = { fragment: true, index: 4 };
  assert.equal(render(html, edit), '<p class="fragment" data-fragment-index="4">a</p>');
  assert.deepEqual(Object.keys(stateOf(tagOf(html).attrs, edit).attrs), ['class', 'data-fragment-index']);
});

// a class set again keeps its place, and a translation without an order is put last
test('the state lists the classes and the declarations in the order of the tag that is written', () => {
  const html = '<p class="fragment small" style="translate: 10px 0px; width: 2px">a</p>';
  const edit = { fragment: true, translate: { x: 20, y: 0 } };
  assert.equal(render(html, edit), '<p class="fragment small" style="width: 2px; translate: 20px 0px">a</p>');
  assert.deepEqual(ordered(stateOf(tagOf(html).attrs, edit)), readBack(render(html, edit)));
});

// the run of the seed found an undo of a whole class value that kept the class fragment of a
// change before it
test('a whole class value replaces an earlier change of one class, in an edit and in its undo', () => {
  const m = model('<p class="small fragment">a</p>');
  m.set({ fragment: false });
  m.set({ fragment: true });
  const entry = m.set({ attrs: { class: 'math' } });
  assert.equal(m.text(), '<p class="math">a</p>');
  entry.undo();
  assert.equal(m.text(), '<p class="small fragment">a</p>');
  m.set({ fragment: false });
  m.set({ attrs: { class: 'math' } }).undo();
  assert.equal(m.text(), '<p class="small">a</p>');
});

test('an undo gives back a translation and an index that the fields do not write as the file has them', () => {
  for (const html of ['<p style="translate: 1.4px 0px">a</p>', '<p style="translate: 0 20px">a</p>', '<p style="translate: 10px">a</p>']) {
    const m = model(html);
    m.set({ translate: { x: 30, y: 5 } }).undo();
    assert.equal(m.text(), html);
  }
  for (const html of ['<p class="fragment" data-fragment-index="x">a</p>', '<p class="fragment" data-fragment-index="02">a</p>']) {
    const m = model(html);
    m.set({ index: 3 }).undo();
    assert.equal(m.text(), html);
  }
});

test('an undo across a save writes the attributes and the classes of the file in their order before the edit', () => {
  const m = model('<p class="a b" id="x">a</p>');
  const entry = m.set({ attrs: { class: null } });
  m.save();
  m.set({ attrs: { class: 'b a' } });
  m.save();
  m.set({ attrs: { class: null } }).undo();
  assert.equal(m.text(), '<p id="x" class="b a">a</p>');
  m.set({ attrs: { class: 'b a' } }).undo();
  entry.undo();
  assert.equal(m.text(), '<p class="a b" id="x">a</p>');
});

// start tags of a file, with values in each kind of quote, character references, odd white space,
// and attributes without a value
const TAGS = [
  '<p>a</p>',
  '<p id="a">a</p>',
  '<li class="small">a</li>',
  '<p class="small fragment" data-fragment-index="3">a</p>',
  `<div data-x='q"r' style="width: 2px; translate: 10px 0px">a</div>`,
  '<p data-fragment-index=x class=fragment>a</p>',
  '<li title="a &amp; b" class=" a  b ">a</li>',
  '<img src="a.png" alt="A" style="translate: 1.4px 0px">',
  '<div class="" style="">a</div>',
  '<p\n  class="math"\n  data-keep>a</p>',
];

// mulberry32 from the seed
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a random edit of the classes, the attributes, and the declarations that the editor writes
function editOf(next) {
  const pick = (list) => list[Math.floor(next() * list.length)];
  const n = (k) => Math.floor(next() * k);
  return pick([
    () => ({ fragment: next() < 0.5, index: pick([null, 1, 2, 3, 4]) }),
    () => ({ fragment: next() < 0.5 }),
    () => ({ index: pick([null, 1, 4]) }),
    () => ({ classes: { [pick(['fragment', 'small', 'math', 'tone-violet'])]: next() < 0.6 } }),
    () => ({ classes: { small: next() < 0.5, fade: next() < 0.5 } }),
    () => ({ attrs: { [pick(['id', 'data-tone', 'data-autoslide', 'title', 'data-keep'])]: pick([null, 'violet', '700', '', 'a "b"']) } }),
    () => ({ attrs: { 'data-autoslide': pick([null, '500']), 'data-tone': pick([null, 'blue']) } }),
    () => ({ attrs: { class: pick([null, 'small', 'fragment math']) } }),
    () => ({ attrs: { style: pick([null, 'width: 3px', 'margin-top: 0; width: 4px']) } }),
    () => ({ style: { [pick(['width', 'margin-top', 'font-size', 'translate'])]: pick([null, `${n(9)}px`, `${n(9)}px ${n(9)}px`]) } }),
    () => ({ translate: next() < 0.2 ? null : { x: n(80) - 40, y: n(80) - 40 } }),
    () => ({ classes: { fragment: true }, attrs: { 'data-fragment-index': pick(['1', '2', null]) } }),
  ])();
}

// one tag in the document model of model/doc.ts, i.e. the edits since the last save merged over
// the file. set records an edit with its inverse as Doc.setTag does, and save makes the text the file
function model(html) {
  const m = { file: html, tags: {} };
  const attrs = () => tagOf(m.file).attrs;
  m.text = () => render(m.file, m.tags);
  m.state = () => ordered(stateOf(attrs(), m.tags));
  m.apply = (edit) => { m.tags = mergeEdit(m.tags, edit); };
  m.set = (edit) => {
    const e = normalizeEdit(edit);
    const back = inverseEdit(stateOf(attrs(), m.tags), e);
    e.order ??= back.order;
    m.apply(e);
    return { undo: () => m.apply(back), redo: () => m.apply(e) };
  };
  m.save = () => { m.file = m.text(); m.tags = {}; };
  return m;
}

// an undo across a save gives the attributes, the classes, and the declarations of the tag in
// their order with their values, but not the white space of a file that the save replaced
test('a seeded run of tag edits gives each tag byte for byte after each undo, and the edit after each redo', () => {
  const next = random(SEED);
  let done = 0;
  for (let chain = 0; done < EDITS; chain++) {
    const m = model(TAGS[chain % TAGS.length]);
    const history = [];
    let saves = 0;
    for (let i = 0; i < 10 && done < EDITS; i++, done++) {
      const before = m.text();
      const edit = editOf(next);
      const entry = m.set(edit);
      const after = m.text();
      const what = `edit ${done} ${JSON.stringify(edit)} of ${JSON.stringify(before)}`;
      assert.deepEqual(m.state(), readBack(after), `the state after ${what}`);
      entry.undo();
      assert.equal(m.text(), before, `the undo of ${what}`);
      assert.deepEqual(m.state(), readBack(before), `the state after the undo of ${what}`);
      entry.redo();
      assert.equal(m.text(), after, `the redo of ${what}`);
      history.push({ entry, before, saves, what });
      if (next() < 0.15) {
        m.save();
        saves++;
      }
    }
    for (const { entry, before, saves: at, what } of history.reverse()) {
      entry.undo();
      if (at === saves) assert.equal(m.text(), before, `the undo back to the file of ${what}`);
      else assert.deepEqual(readBack(m.text()), readBack(before), `the undo across a save of ${what}`);
    }
  }
});

// the same run through the document model on the demo deck in headless Chrome, with a save about
// every 25 edits. each edit is undone and redone, and the file is compared byte for byte
const browserRun = (seed, edits) => `(async () => {
  const E = window.BeesonEditor;
  const doc = E.doc;
  let s = ${seed} >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const editOf = ${editOf.toString()};
  const inFile = (el) => { try { doc.tagState(el); return true; } catch { return false; } };
  const elements = [...document.querySelectorAll('.reveal .slides > section > *:not([data-generated]), .reveal .slides > section li')].filter(inFile);
  const failures = [];
  for (let i = 0; i < ${edits}; i++) {
    const el = elements[Math.floor(next() * elements.length)];
    const edit = editOf(next);
    const before = E.render();
    doc.setTag(el, edit);
    const after = E.render();
    await E.undo();
    if (E.render() !== before) failures.push({ i, what: 'undo', edit, tag: el.localName });
    await E.redo();
    if (E.render() !== after) failures.push({ i, what: 'redo', edit, tag: el.localName });
    if (i % 25 === 24) {
      const status = E.open(after, false);
      if (status.problems.length) failures.push({ i, what: 'save', problems: status.problems });
    }
  }
  return { failures, elements: elements.length };
})()`;

test('a seeded run of tag edits on the demo deck gives the file byte for byte after each undo', async (t) => {
  const { deckSettled, deckUrl, launch } = await import('../scripts/chrome.mjs');
  const { readFileSync } = await import('node:fs');
  const browser = await launch();
  t.after(() => browser.close());
  const text = readFileSync('test-deck.html', 'utf8');
  const page = await browser.newPage();
  await page.goto(deckUrl('test-deck.html', 'edit&still'));
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`)).problems, []);
  const result = await page.evaluate(browserRun(SEED, EDITS));
  assert.ok(result.elements > 50, `${result.elements} elements`);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(page.errors, []);
});
