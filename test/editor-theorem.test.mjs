// the theorems of test/pages/tex/index.html in the editor: a shape drawn behind a theorem and
// grouped with it, Insert > Theorem with one item per kind and its key, and the section Theorem of
// the Text pane, whose Kind and Name write data-kind and data-name

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { kindsOf } from '../src/kinds.ts';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'test/pages/tex/index.html';
const SOURCE = readFileSync(DECK, 'utf8');
const PANEL = '#beeson-edit-panel-format';
// an attribute or an element written by the theme at run time
const RUNTIME = /\sdata-(?:head|style|missing|n)(?=[\s=>])|class="refs"|--refs/;
const NAMED = '<p class="theorem" data-kind="theorem" data-name="stable manifold">';
const KEY = { mac: 'Ctrl+Mod+T', other: 'Alt+Shift+T' };

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
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const settle = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

async function open(platform = 'mac') {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = SOURCE;
  const status = await page.evaluate(`window.BeesonEditor.open(${js(SOURCE)})`);
  assert.deepEqual(status.problems, []);
  return page;
}

const slideOf = (title) => `[...document.querySelectorAll('.reveal .slides > section')].find((s) => s.querySelector('h2')?.textContent === ${js(title)})`;
async function show(page, title) {
  await page.evaluate(`Reveal.slide(Reveal.getIndices(${slideOf(title)}).h)`);
  await sleep(150);
}

// the box of the element of selector on the current slide in slide px
const slideBox = (page, selector) => page.evaluate(`(() => {
  const sl = document.querySelector('.reveal .slides'), S = sl.getBoundingClientRect(), k = S.width / sl.offsetWidth;
  const q = document.querySelector('.reveal section.present ${selector}').getBoundingClientRect();
  return { left: Math.round((q.left - S.left) / k), top: Math.round((q.top - S.top) / k), width: Math.round(q.width / k), height: Math.round(q.height / k) };
})()`);

// the center of a row of the open menus whose label starts with text
const rowAt = (page, text) => page.evaluate(`(() => {
  const i = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.textContent.trim().startsWith(${js(text)}));
  if (!i) return null;
  const r = i.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
const rows = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].at(-1) ? [...[...document.querySelectorAll('.beeson-edit-menu')].at(-1).querySelectorAll('.item .label')].map((l) => l.textContent.trim()) : []`);

async function barMenu(page, title) {
  await page.evaluate('window.BeesonEditorShell.closeMenus()');
  await sleep(30);
  const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-menubar button')].find((x) => x.textContent === ${js(title)}); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(80);
}

function assertClean(text, what) {
  const line = text.split('\n').find((l) => RUNTIME.test(l));
  assert.equal(line, undefined, `${what} writes a run-time attribute into the file`);
}

// the section of the rendered text from the slide with the heading title to its end
const sectionOf = (text, title) => {
  const at = text.indexOf(`<h2>${title}</h2>`);
  return text.slice(text.lastIndexOf('<section', at), text.indexOf('</section>', at));
};
// whether the words of the named theorem are drawn over every shape
const onTop = (page) => page.evaluate(`(() => {
  const p = document.querySelector('.reveal section.present p.theorem[data-name]');
  const r = document.createRange();
  r.selectNodeContents(p);
  const q = r.getBoundingClientRect();
  return !!document.elementFromPoint(q.left + 30, q.top + q.height / 2)?.closest('p.theorem');
})()`);
const heads = (page, title) => page.evaluate(`[...${slideOf(title)}.querySelectorAll('p.theorem')].map((p) => p.dataset.head)`);

test('a shape drawn over a theorem, sent behind it, grouped with it, and dragged is saved with the theorem over it', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await show(page, 'Theorems');
  const b = await slideBox(page, 'p.theorem[data-name]');
  await exec(page, 'insert.shape.rectangle', { box: { left: b.left - 20, top: b.top - 20, width: b.width + 40, height: b.height + 40 } });
  await sleep(300);
  const inserted = await render(page);
  assert.notEqual(inserted, SOURCE, 'the shape is not inserted');
  await exec(page, 'arrange.order.back');
  await settle(page);
  const layered = await render(page);
  // the shape, absolute after the theorems, is sent behind them with a z-index
  assert.match(sectionOf(layered, 'Theorems'), /<\/p>\n {6}<div class="shape" style="width: \d+px; height: \d+px; translate: \d+px \d+px; z-index: -1"><\/div>\n {4}$/);
  assert.equal(await onTop(page), true, 'the theorem is not drawn over the shape');

  // the shape is selected by its margin, the theorem added with Shift, and the two grouped
  await press(page, 'Escape');
  await click(page, { ...(await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present > .shape').getBoundingClientRect(); return { x: r.left + 6, y: r.top + r.height / 2 }; })()`)) });
  await click(page, '.reveal section.present p.theorem[data-name]', { modifiers: 'Shift' });
  await settle(page);
  assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 2, 'the shape and the theorem are not selected');
  await exec(page, 'arrange.group');
  await settle(page);
  const grouped = await render(page);
  assert.equal(sectionOf(grouped, 'Theorems').split('data-group="g1"').length - 1, 2, 'the shape and the theorem are not one group');
  assert.match(grouped, /<p class="theorem" data-kind="theorem" data-name="stable manifold" data-group="g1">/);

  // a drag of the shape moves the group
  const scale = await page.evaluate('Reveal.getScale()');
  const from = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present > .shape').getBoundingClientRect(); return { x: r.left + 6, y: r.top + r.height / 2 }; })()`);
  await drag(page, from, { dx: 100 * scale, dy: 60 * scale });
  await sleep(300);
  await settle(page);
  const dragged = await render(page);
  assert.equal(await undoLabel(page), 'Undo Move');
  assert.match(dragged, /<p class="theorem" data-kind="theorem" data-name="stable manifold" style="translate: (9\d|1\d\d)px [56]\dpx" data-group="g1">/, 'the theorem is not moved with the group');
  assertClean(dragged, 'the workflow');
  assert.match(sectionOf(dragged, 'Theorems'), /<div class="shape" style="width: \d+px; height: \d+px; translate: \d+px \d+px; z-index: -1" data-group="g1"><\/div>\n {4}$/, 'the drag changes the layer of the shape');
  assert.equal(await onTop(page), true, 'the drag puts the shape over the theorem');

  // each undo gives the state before its step, and the redos give the drag again
  for (const state of [grouped, layered, inserted, SOURCE]) {
    await undo(page);
    await settle(page);
    assert.equal(await render(page), state);
  }
  for (const state of [inserted, layered, grouped, dragged]) {
    await redo(page);
    await settle(page);
    assert.equal(await render(page), state);
  }
  const { text } = await saveAndReopen(page, 'theorem-shape.html');
  assert.equal(text, dragged);
  await show(page, 'Theorems');
  assert.deepEqual(await heads(page, 'Theorems'), ['Definition 1.', 'Theorem 1 (stable manifold).', 'Proof.']);
  assert.equal(await onTop(page), true);
  assert.deepEqual(errors(page), []);
});

test('the submenu Theorem of the Insert menu lists the kinds of the deck, read when it is opened', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  const kinds = Object.entries(kindsOf(await page.evaluate('window.beesonTex.theorems')));
  assert.equal(kinds.at(-1)[0], 'note', 'the kinds of the preamble are not after the usual ones');
  const items = await page.evaluate(`window.BeesonEditorShell.menuItems('Insert', 'Theorem').map((i) => [i.command, i.arg, i.label])`);
  assert.deepEqual(items, kinds.map(([kind, k]) => ['insert.theorem', kind, k.title]));
  assert.ok((await page.evaluate(`window.BeesonEditorShell.menuItems('Insert').map((i) => i.label ?? i.command)`)).includes('Theorem'), 'Theorem is not a submenu of the Insert menu');
  // a kind defined after the start of the deck is listed at the next opening
  await page.evaluate(`window.beesonTex.theorems.conjecture = { title: 'Conjecture', style: 'plain', counter: null }`);
  const later = await page.evaluate(`window.BeesonEditorShell.menuItems('Insert', 'Theorem').map((i) => i.label)`);
  assert.equal(later.at(-1), 'Conjecture');
  await page.evaluate('delete window.beesonTex.theorems.conjecture');

  // the menu of the menu bar shows the same items
  await show(page, 'Theorems');
  await barMenu(page, 'Insert');
  await click(page, await rowAt(page, 'Theorem'));
  await sleep(150);
  assert.deepEqual(await rows(page), kinds.map(([, k]) => k.title));
  await click(page, await rowAt(page, 'Lemma'));
  await sleep(300);
  await settle(page);
  // a lemma with the caret is drawn after the proof with its head, and the file is not changed
  const fresh = await page.evaluate(`(() => {
    const s = document.querySelector('.reveal section.present');
    const p = s.querySelector('p.theorem[data-kind="lemma"]');
    const a = getSelection().anchorNode;
    return { after: p?.previousElementSibling?.dataset.kind, head: p?.dataset.head, caret: !!a && p.contains(a), focus: document.activeElement === p };
  })()`);
  assert.deepEqual(fresh, { after: 'proof', head: 'Lemma 2.', caret: true, focus: true });
  await byteExact(page);
  await type(page, 'Every orbit is periodic.');
  await sleep(300);
  await settle(page);
  const typed = await render(page);
  assert.ok(typed.includes('<p class="theorem" data-kind="proof">Apply the theorem for maps to the return map of a section through \\(\\gamma\\).</p>\n      <p class="theorem" data-kind="lemma"'), 'the lemma is not written after the proof');
  assert.match(typed, /<p class="theorem" data-kind="lemma"( style="[^"]*")?>Every orbit is periodic\.<\/p>/);
  assertClean(typed, 'Insert > Theorem');
  assert.deepEqual(await heads(page, 'Theorems'), ['Definition 1.', 'Theorem 1 (stable manifold).', 'Proof.', 'Lemma 2.']);
  assert.deepEqual((await heads(page, 'More theorems')).slice(0, 2), ['Lemma 3.', 'Theorem 4.']);
  await undo(page);
  await undo(page);
  await settle(page);
  await byteExact(page);
  assert.deepEqual((await heads(page, 'More theorems')).slice(0, 2), ['Lemma 2.', 'Theorem 3.']);
  assert.deepEqual(errors(page), []);
});

for (const platform of ['mac', 'other']) {
  test(`${KEY[platform]} inserts a theorem, which the sheet of keys lists without a clash (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, 'Theorems');
    await press(page, KEY[platform]);
    await sleep(300);
    await settle(page);
    const p = await page.evaluate(`(() => {
      const p = document.querySelector('.reveal section.present p.theorem.beeson-pending');
      const a = getSelection().anchorNode;
      return { kind: p?.dataset.kind, head: p?.dataset.head, caret: !!a && !!p?.contains(a) };
    })()`);
    assert.deepEqual(p, { kind: 'theorem', head: 'Theorem 2.', caret: true });
    await type(page, 'x');
    await sleep(300);
    assert.match(await render(page), /<p class="theorem" data-kind="theorem"( style="[^"]*")?>x<\/p>/);
    assert.equal(await undoLabel(page), 'Undo Typing');
    await undo(page);
    await undo(page);
    await byteExact(page);
    // the key is listed at Theorem of the Insert menu
    const shown = platform === 'mac' ? '⌃⌘T' : 'Alt+Shift+T';
    await press(page, 'Escape');
    await exec(page, 'help.keys');
    await sleep(150);
    const listed = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-keys section')].filter((s) => s.querySelector('h3').textContent.startsWith('Insert')).flatMap((s) => [...s.querySelectorAll('.row')].map((r) => [r.querySelector('span').textContent, r.querySelector('kbd').textContent]))`);
    assert.deepEqual(listed.filter(([label]) => label === 'Theorem'), [['Theorem', shown]]);
    await press(page, 'Escape');
    assert.deepEqual(await page.evaluate('window.BeesonEditorShell.keyClashes()'), []);
    assert.deepEqual(await page.evaluate('window.BeesonEditorShell.keyClashes(true)'), []);
    assert.deepEqual(await page.evaluate('window.BeesonEditorShell.sheetClashes()'), []);
    assert.deepEqual(errors(page), []);
  });
}

// the Text pane of the selected theorem shown
async function pane(page, selector) {
  await click(page, `.reveal section.present ${selector}`);
  await press(page, 'Escape');
  await settle(page);
  if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
  await sleep(150);
  const tabs = await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].map((b) => b.textContent)`);
  if (tabs.length) await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Text').click()`);
  await sleep(100);
}
const theoremSection = (page) => page.evaluate(`(() => {
  const s = [...document.querySelectorAll('${PANEL} .ed-sec')].find((x) => x.querySelector(':scope > h5')?.textContent === 'Theorem');
  if (!s) return null;
  const note = s.querySelector('.ed-note:not([hidden])');
  return { kind: s.querySelector('.ed-theorem-kind')?.textContent.trim(), name: s.querySelector('input[name="theorem-name"]')?.value, note: note ? note.textContent : null };
})()`);

async function setName(page, value) {
  await page.evaluate(`(() => { const i = document.querySelector('${PANEL} input[name="theorem-name"]'); i.focus(); i.select(); })()`);
  await press(page, 'Backspace');
  if (value) await type(page, value);
  await press(page, 'Enter');
  // the field is left, as by a click on the slide
  await page.evaluate('document.activeElement.blur()');
  await sleep(150);
  await settle(page);
}

test('the section Theorem of the Text pane sets the kind and the name of a theorem, each undone, with the heads drawn again', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await show(page, 'Theorems');
  await pane(page, 'p.theorem[data-name]');
  assert.deepEqual(await theoremSection(page), { kind: 'Theorem', name: 'stable manifold', note: null });

  // Kind lists the kinds of the deck and writes the one chosen
  const at = await page.evaluate(`(() => { const r = document.querySelector('${PANEL} .ed-theorem-kind').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(100);
  assert.deepEqual(await rows(page), ['Theorem', 'Lemma', 'Proposition', 'Corollary', 'Definition', 'Example', 'Remark', 'Proof', 'Note']);
  await click(page, await rowAt(page, 'Lemma'));
  await sleep(150);
  await settle(page);
  const lemma = await render(page);
  assert.equal(lemma, SOURCE.replace(NAMED, NAMED.replace('"theorem" data-name', '"lemma" data-name')));
  assert.equal(await undoLabel(page), 'Undo Theorem Kind');
  assert.deepEqual(await heads(page, 'Theorems'), ['Definition 1.', 'Lemma 1 (stable manifold).', 'Proof.']);
  assert.equal((await theoremSection(page)).kind, 'Lemma');
  await undo(page);
  await settle(page);
  await byteExact(page);
  assert.deepEqual(await heads(page, 'Theorems'), ['Definition 1.', 'Theorem 1 (stable manifold).', 'Proof.']);
  assert.equal((await theoremSection(page)).kind, 'Theorem');
  await redo(page);
  assert.equal(await render(page), lemma);
  await undo(page);

  // Name writes data-name, and an empty Name takes it off
  await setName(page, 'unstable manifold');
  const renamed = await render(page);
  assert.equal(renamed, SOURCE.replace(NAMED, NAMED.replace('stable manifold', 'unstable manifold')));
  assert.equal(await undoLabel(page), 'Undo Theorem Name');
  assert.equal((await heads(page, 'Theorems'))[1], 'Theorem 1 (unstable manifold).');
  await setName(page, '');
  const unnamed = await render(page);
  assert.equal(unnamed, SOURCE.replace(NAMED, '<p class="theorem" data-kind="theorem">'));
  assert.equal((await heads(page, 'Theorems'))[1], 'Theorem 1.');
  // the field shows the name of each state of the history
  await undo(page);
  await settle(page);
  assert.equal(await render(page), renamed);
  assert.equal((await theoremSection(page)).name, 'unstable manifold');
  await undo(page);
  await settle(page);
  await byteExact(page);
  assert.equal((await theoremSection(page)).name, 'stable manifold');
  await setName(page, 'unstable manifold');
  await saveAndReopen(page, 'theorem-name.html');

  // a theorem of a kind that is not defined is named in a note
  await show(page, 'More theorems');
  await pane(page, 'p.theorem[data-kind="conjecture"]');
  assert.deepEqual(await theoremSection(page), { kind: 'conjecture', name: '', note: 'The kind conjecture is not defined in the preamble.' });
  assert.deepEqual(errors(page), []);
});
