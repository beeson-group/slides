// the theorems and the citations of test/pages/tex/index.html in the editor. the heads and the
// styles that src/theorems.ts writes on a theorem, the numbers that src/citations.ts writes on a
// citation, and the generated div.refs and --refs of a slide are never written into the file: not
// by a copy of an element or of a slide, Return, typing, a change of the tag of a slide, Reset
// Slide, or a copy of text. the div.refs is not an object of the editor, the attributes of a
// theorem and of a citation are in the scope rule, and after each change of the deck the heads,
// the numbers, and the references are those of a fresh load of the text that the editor writes

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { attributeProblem, textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'test/pages/tex/index.html';
const SOURCE = readFileSync(DECK, 'utf8');
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
// an attribute or an element written by the theme at run time
const RUNTIME = /\sdata-(?:head|style|missing|n)(?=[\s=>])|class="refs"|--refs/;

const NAMED = '<p class="theorem" data-kind="theorem" data-name="stable manifold">Let \\(\\gamma\\) be <em>hyperbolic</em>. Then \\(W^s(\\gamma)\\) is an immersed manifold.</p>';
const CITED = '<p>The numbers start at 1 on each slide<cite data-key="gomez2004"></cite>.</p>';
const FIRST = '<li>A heteroclinic connection joins two orbits<cite data-key="koon2000"></cite></li>';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${arg}`})`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

async function open(platform = 'mac') {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = SOURCE;
  const status = await page.evaluate(`window.BeesonEditor.open(${js(SOURCE)})`);
  assert.deepEqual(status.problems, []);
  page.platform = platform;
  return page;
}

// the slide with the heading title shown
const slideOf = (title) => `[...document.querySelectorAll('.reveal .slides > section')].find((s) => s.querySelector('h2')?.textContent === ${js(title)})`;
async function show(page, title) {
  await page.evaluate(`Reveal.slide(Reveal.getIndices(${slideOf(title)}).h)`);
  await sleep(150);
}

// the element of selector on the current slide selected as an object by a click and Esc, or the
// element of block around it, e.g. the list of an item
async function select(page, selector, block = selector) {
  await click(page, `.reveal section.present ${selector}`);
  await press(page, 'Escape');
  await settle(page);
  assert.equal(await page.evaluate(`window.BeesonEditor.selection().length === 1 && window.BeesonEditor.selection()[0] === document.querySelector('.reveal section.present ${block}')`), true, `${block} is not selected`);
}

// a point in the band over the top edge of the element of selector on the current slide, where a
// press takes a selected text block as a box, away from the grips of its width at its sides
const edge = (page, selector) => page.evaluate(`(() => {
  const r = document.querySelector('.reveal section.present ${selector}').getBoundingClientRect();
  return { x: r.left + 40, y: r.top - 3 };
})()`);

// the caret at offset into the first text node of the element of selector on the current slide
async function caret(page, selector, offset) {
  await click(page, `.reveal section.present ${selector}`);
  await page.evaluate(`(() => {
    const el = document.querySelector('.reveal section.present ${selector}');
    const r = document.createRange();
    r.setStart(el.firstChild, ${offset});
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  })()`);
  await settle(page);
}

function assertClean(text, what) {
  const line = text.split('\n').find((l) => RUNTIME.test(l));
  assert.equal(line, undefined, `${what} writes a run-time attribute into the file`);
  const before = textProblems(SOURCE, THEME);
  assert.deepEqual(textProblems(text, THEME).filter((p) => !before.includes(p)), [], `${what} is out of the scope rule`);
}

// a copy or a cut event with a clipboard of the page, whose text and HTML are returned
const clipEvent = (page, kind) =>
  page.evaluate(`(() => {
    const data = new DataTransfer();
    (document.activeElement ?? document.body).dispatchEvent(new ClipboardEvent(${js(kind)}, { clipboardData: data, bubbles: true, cancelable: true }));
    return { plain: data.getData('text/plain'), html: data.getData('text/html') };
  })()`);

const pasteText = (page, text) =>
  page.evaluate(`(() => {
    const data = new DataTransfer();
    data.setData('text/plain', ${js(text)});
    (document.activeElement ?? document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  })()`);

// the edited text is clean, an undo of count entries gives the file, and a redo gives the edit
// again. with save, the edit is saved and opened again, else it is undone for the next edit
let saves = 0;
async function roundTrip(page, what, { count = 1, save = false } = {}) {
  const edited = await render(page);
  assertClean(edited, what);
  for (let i = 0; i < count; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < count; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited, `a redo of ${what} does not write it again`);
  if (save) {
    const { text } = await saveAndReopen(page, `tex-runtime-${++saves}.html`);
    assert.equal(text, edited);
  } else {
    for (let i = 0; i < count; i++) await page.evaluate('window.BeesonEditor.undo()');
    await byteExact(page);
  }
  assert.deepEqual(errors(page), []);
}

for (const platform of ['mac', 'other']) {
  test(`a theorem copied by Duplicate, Copy and Paste, and a drag with the copy modifier is written with its kind and name only (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, 'Theorems');
    const theorem = 'p.theorem[data-name]';
    await select(page, theorem);
    await press(page, 'Mod+D');
    await settle(page);
    const dy = /translate: 20px (-?\d+)px/.exec(await render(page))?.[1];
    // the copy is drawn 20 px off the theorem, over the theorem after it, which keeps its place
    assert.ok((await render(page)).includes(`${NAMED}\n      ${NAMED.replace('">', `" style="translate: 20px ${dy}px">`)}`), 'the duplicate is not after the theorem');
    await roundTrip(page, 'Duplicate');

    await select(page, theorem);
    const clip = await clipEvent(page, 'copy');
    assert.ok(clip.plain.includes(NAMED), 'the copy of the theorem is not its tag in the file');
    assertClean(clip.plain, 'Copy');
    await pasteText(page, clip.plain);
    await settle(page);
    const pasted = await render(page);
    assert.equal(pasted.split('data-name="stable manifold"').length, 3, 'the theorem is not pasted');
    await roundTrip(page, 'Paste');

    await select(page, theorem);
    const scale = await page.evaluate('Reveal.getScale()');
    const copyKey = platform === 'mac' ? 'Alt' : 'Ctrl';
    await drag(page, await edge(page, theorem), { dx: 0, dy: 200 * scale, modifiers: copyKey });
    await sleep(300);
    await settle(page);
    const dropped = await render(page);
    assert.match(dropped, /<p class="theorem" data-kind="theorem" data-name="stable manifold" style="translate: -?\d+px -?\d+px">/, 'the drag does not write a moved copy');
    assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Duplicate');
    await roundTrip(page, 'a drag with the copy modifier', { save: true });
  });

  test(`a paragraph with a citation copied by Duplicate, Copy and Paste, and a drag with the copy modifier keeps a citation with its key only (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await show(page, 'Under a footnote');
    await select(page, '> p');
    await press(page, 'Mod+D');
    await settle(page);
    const dy = /translate: 20px (-?\d+)px/.exec(await render(page))?.[1];
    assert.ok((await render(page)).includes(`${CITED}\n      ${CITED.replace('<p>', `<p style="translate: 20px ${dy}px">`)}`), 'the duplicate is not after the paragraph');
    await roundTrip(page, 'Duplicate');

    await select(page, '> p');
    const clip = await clipEvent(page, 'copy');
    assert.ok(clip.plain.includes(CITED), 'the copy of the paragraph is not its tag in the file');
    await pasteText(page, clip.plain);
    await settle(page);
    assert.equal((await render(page)).split('<cite data-key="gomez2004"></cite>.</p>').length, 3, 'the paragraph is not pasted');
    await roundTrip(page, 'Paste');

    await select(page, '> p');
    const scale = await page.evaluate('Reveal.getScale()');
    await drag(page, await edge(page, '> p'), { dx: 0, dy: 200 * scale, modifiers: platform === 'mac' ? 'Alt' : 'Ctrl' });
    await sleep(300);
    await settle(page);
    assert.match(await render(page), /<p style="translate: -?\d+px -?\d+px">The numbers start at 1 on each slide<cite data-key="gomez2004"><\/cite>\.<\/p>/);
    await roundTrip(page, 'a drag with the copy modifier', { save: true });
  });
}

test('a slide with citations duplicated, and copied and pasted, is written without its references', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await show(page, 'Citations');
  const section = SOURCE.slice(SOURCE.indexOf('<section>\n      <h2>Citations'), SOURCE.indexOf('</section>', SOURCE.indexOf('<h2>Citations')) + '</section>'.length);
  await exec(page, 'slide.duplicate');
  await settle(page);
  await byteExact(page, [[section, `${section}\n    ${section}`]]);
  // the copy is drawn with the references of its citations
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present > div.refs[data-generated]')?.children.length`), 3);
  await roundTrip(page, 'Duplicate Slide');

  const copied = await page.evaluate(`(async () => {
    const data = new DataTransfer();
    await window.BeesonEditor.exec('slide.copy', data);
    return data.getData('text/plain');
  })()`);
  assertClean(copied, 'Copy of a slide');
  assert.ok(copied.includes(section), 'the copy of the slide is not its text in the file');
  await exec(page, 'slide.paste', js(copied));
  await settle(page);
  await byteExact(page, [[section, `${section}\n    ${section}`]]);
  await roundTrip(page, 'Paste of a slide', { save: true });
});

test('Return inside a paragraph and an item with a citation, and typing after it, keep the citation with its key only', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await show(page, 'Under a footnote');
  await caret(page, '> p', 4);
  await press(page, 'Enter');
  await settle(page);
  await type(page, 'So ');
  await settle(page);
  await byteExact(page, [[CITED, '<p>The </p>\n      <p>So numbers start at 1 on each slide<cite data-key="gomez2004"></cite>.</p>']]);
  assert.equal(await page.evaluate(`[...document.querySelectorAll('.reveal section.present cite')].map((c) => c.dataset.n).join()`), '1');
  await roundTrip(page, 'Return and typing', { count: 2 });

  await show(page, 'Citations');
  await caret(page, 'li', 2);
  await press(page, 'Enter');
  await settle(page);
  await byteExact(page, [[FIRST, '<li>A </li>\n        <li>heteroclinic connection joins two orbits<cite data-key="koon2000"></cite></li>']]);
  await roundTrip(page, 'Return in an item', { save: true });
});

test('Return inside a theorem leaves the theorem and the file as they were', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await show(page, 'Theorems');
  await caret(page, 'p.theorem[data-kind="definition"]', 2);
  const before = await page.evaluate(`document.querySelector('.reveal section.present p.theorem').innerHTML`);
  await press(page, 'Enter');
  await settle(page);
  assert.equal(await page.evaluate(`document.querySelector('.reveal section.present p.theorem').innerHTML`), before);
  assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present p.theorem').length`), 3);
  await byteExact(page);
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).undo, false);
  // the caret is kept in the theorem, where typing goes on
  await type(page, 'x');
  await settle(page);
  await byteExact(page, [['<p class="theorem" data-kind="definition">A periodic', '<p class="theorem" data-kind="definition">A xperiodic']]);
});

test('a change of the tag of a slide with citations, and Reset Slide, write the tag without --refs', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await show(page, 'Citations');
  const open_ = '<section>\n      <h2>Citations';
  const changes = [
    ['slide.hide', '<section data-visibility="hidden">'],
    ['slide.width.wide', '<section class="wide">'],
  ];
  for (const [id, tag] of changes) {
    await exec(page, id);
    await settle(page);
    await byteExact(page, [[open_, open_.replace('<section>', tag)]]);
    await roundTrip(page, id);
  }
  // the transition out of a slide is written on the slide after it
  const next = '<section>\n      <h2>Under a footnote';
  await exec(page, 'slide.transition.none');
  await settle(page);
  await byteExact(page, [[next, next.replace('<section>', '<section data-transition="none">')]]);
  await roundTrip(page, 'a transition');
  await page.evaluate(`document.documentElement.classList.contains('beeson-rulers') || window.BeesonEditor.exec('view.rulers')`);
  await exec(page, 'view.guides.add', js({ x: [480], y: [] }));
  await settle(page);
  await byteExact(page, [[open_, open_.replace('<section>', '<section data-guides="x480">')]]);
  await roundTrip(page, 'a guide');

  // the paragraph of the slide with a footnote moved, and the slide reset
  await show(page, 'Under a footnote');
  await select(page, '> p');
  const scale = await page.evaluate('Reveal.getScale()');
  await drag(page, await edge(page, '> p'), { dx: 0, dy: 120 * scale });
  await settle(page);
  assert.match(await render(page), /<p style="translate: 0px \d+px">The numbers/);
  await exec(page, 'slide.reset');
  await settle(page);
  await byteExact(page);
  assertClean(await render(page), 'Reset Slide');
  assert.deepEqual(errors(page), []);
});

test('a copy of text with a citation puts the citation with its key only on the clipboard', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await show(page, 'Under a footnote');
  await click(page, '.reveal section.present > p');
  await page.evaluate(`(() => {
    const p = document.querySelector('.reveal section.present > p');
    const r = document.createRange();
    r.setStart(p.firstChild, 'The numbers start at 1 '.length);
    r.setEnd(p.lastChild, 1);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  })()`);
  const clip = await clipEvent(page, 'copy');
  assert.deepEqual(clip, { plain: 'on each slide.', html: 'on each slide<cite data-key="gomez2004"></cite>.' });
  await byteExact(page);
  // a cut takes the text off as one entry of the history
  const cut = await clipEvent(page, 'cut');
  assert.deepEqual(cut, clip);
  await settle(page);
  await byteExact(page, [[CITED, '<p>The numbers start at 1 </p>']]);
  await roundTrip(page, 'Cut', { save: true });
});

test('the references of a slide are not an object of the editor', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await show(page, 'Citations');
  const refs = '.reveal section.present > div.refs[data-generated]';
  assert.equal(await page.evaluate(`document.querySelector(${js(refs)}).isContentEditable`), false, 'the references are a block');
  await click(page, refs);
  await settle(page);
  assert.deepEqual(await page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName + '.' + el.className)`), [], 'a click on the references selects them');
  // a drag on the references moves nothing
  const scale = await page.evaluate('Reveal.getScale()');
  await drag(page, refs, { dx: 100 * scale, dy: -100 * scale });
  await settle(page);
  await byteExact(page);
  assert.equal(await page.evaluate(`window.BeesonEditor.selection().some((el) => el.closest('.refs'))`), false, 'a drag on the references selects them');
  // a marquee from the pasteboard below the slide over the references
  const at = await page.evaluate(`(() => {
    const r = document.querySelector(${js(refs)}).getBoundingClientRect();
    const slide = document.querySelector('.reveal').getBoundingClientRect();
    return { x: r.left + 4, y: slide.bottom + 12, to: { x: r.right - 4, y: r.top + 4 } };
  })()`);
  await drag(page, at, { dx: at.to.x - at.x, dy: at.to.y - at.y });
  await settle(page);
  assert.equal(await page.evaluate(`window.BeesonEditor.selection().some((el) => el.closest('.refs'))`), false, 'a marquee selects the references');
  // the object list of the slide
  await exec(page, 'view.objects');
  await settle(page);
  const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row .name')].map((r) => r.textContent)`);
  assert.ok(rows.length > 0, 'the object list is not shown');
  assert.equal(rows.some((r) => /Koon|Gómez|Szebehely/.test(r)), false, `the object list names the references: ${rows.join(' | ')}`);
  assert.deepEqual((await page.evaluate('window.BeesonEditor.status()')).problems, []);
  await byteExact(page);
  assert.deepEqual(errors(page), []);
});

test('data-kind, data-name, and data-key are in the scope rule', () => {
  for (const name of ['data-kind', 'data-name', 'data-key']) assert.equal(attributeProblem(name), null, name);
  assert.deepEqual(textProblems('<p class="theorem" data-kind="lemma" data-name="a">x<cite data-key="a,b"></cite></p>', THEME), []);
});

// the heads of the theorems and the numbers and the references of the citations of the slides that
// are shown, i.e. not hidden, of a document
const DRAWN = (doc) => `(() => {
  const d = ${doc};
  return [...d.querySelectorAll('.reveal .slides > section')].filter((s) => s.getAttribute('data-visibility') !== 'hidden').map((s) => ({
    heads: [...s.querySelectorAll('p.theorem')].map((p) => [p.dataset.head, p.dataset.style, p.hasAttribute('data-missing')]),
    cites: [...s.querySelectorAll('cite[data-key]')].map((c) => [c.dataset.n ?? null, c.hasAttribute('data-missing')]),
    refs: s.querySelector(':scope > div.refs[data-generated]')?.textContent ?? '',
  }));
})()`;

// the text of the editor loaded as a deck in a frame of the page, at the address of the deck. the
// address of a frame of srcdoc cannot be written, so reveal.js is kept from writing it
async function fresh(page) {
  const text = await render(page);
  await page.evaluate(`(() => {
    document.querySelector('iframe.fresh')?.remove();
    const frame = document.createElement('iframe');
    frame.className = 'fresh';
    frame.style.cssText = 'position: fixed; left: 0; top: 0; width: 960px; height: 540px; visibility: hidden';
    frame.srcdoc = ${js(text)}.replace('<head>', '<head><base href="' + new URL('.', location.href).href + '"><script>history.replaceState = history.pushState = () => {};<\\/script>');
    document.body.append(frame);
  })()`);
  await page.waitFor(`(() => { const w = document.querySelector('iframe.fresh')?.contentWindow; return !!w?.Reveal?.isReady?.() && !!w.MathJax?.startup?.document; })()`);
  return page.evaluate(DRAWN(`document.querySelector('iframe.fresh').contentDocument`));
}

async function sameAsFresh(page, what) {
  await settle(page);
  assert.deepEqual(await page.evaluate(DRAWN('document')), await fresh(page), `after ${what}, the heads or the numbers are not those of a fresh load`);
}

test('after each change of the deck, the heads, the numbers, and the references are those of a fresh load of the file', async (t) => {
  const page = await open();
  t.after(() => page.close?.());
  await sameAsFresh(page, 'the start');
  await show(page, 'Theorems');
  await select(page, 'p.theorem[data-name]');
  await press(page, 'Mod+D');
  await sameAsFresh(page, 'a theorem duplicated');
  await page.evaluate('window.BeesonEditor.undo()');
  await sameAsFresh(page, 'an undo of the duplicate');
  await page.evaluate('window.BeesonEditor.redo()');
  await sameAsFresh(page, 'a redo of the duplicate');
  await select(page, 'p.theorem[data-kind="definition"]');
  await exec(page, 'element.delete');
  await sameAsFresh(page, 'a theorem deleted');
  await page.evaluate('window.BeesonEditor.undo()');
  await sameAsFresh(page, 'an undo of the delete');
  // a theorem brought to the front is moved after the others in the file
  await select(page, 'p.theorem[data-kind="definition"]');
  await exec(page, 'arrange.order.front');
  await sameAsFresh(page, 'a theorem brought to the front');
  await show(page, 'More theorems');
  await exec(page, 'slide.moveUp');
  await sameAsFresh(page, 'a slide moved up');
  await exec(page, 'slide.moveUp');
  await sameAsFresh(page, 'a slide moved over the theorems');
  await page.evaluate('window.BeesonEditor.undo()');
  await sameAsFresh(page, 'an undo of the move');
  await show(page, 'Left out of the show');
  await exec(page, 'slide.hide');
  await sameAsFresh(page, 'a hidden slide shown');
  await page.evaluate('window.BeesonEditor.undo()');
  await sameAsFresh(page, 'an undo of the show');

  await show(page, 'Citations');
  await select(page, 'li', 'ul');
  await exec(page, 'element.delete');
  await sameAsFresh(page, 'the citations of a slide deleted');
  await page.evaluate('window.BeesonEditor.undo()');
  await sameAsFresh(page, 'an undo of the delete of a citation');
  await caret(page, 'li', 2);
  await press(page, 'Enter');
  await sameAsFresh(page, 'Return before a citation');
  await page.evaluate('window.BeesonEditor.undo()');
  await sameAsFresh(page, 'an undo of Return');
  await page.evaluate('window.BeesonEditor.redo()');
  await sameAsFresh(page, 'a redo of Return');
  await show(page, 'Under a footnote');
  await select(page, '> p');
  await clipEvent(page, 'cut');
  await sameAsFresh(page, 'a paragraph with a citation cut');
  await page.evaluate('window.BeesonEditor.undo()');
  await sameAsFresh(page, 'an undo of the cut');
  assert.deepEqual(errors(page), []);
});
