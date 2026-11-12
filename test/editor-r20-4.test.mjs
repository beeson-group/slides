// tests of R20.4 on both platforms with trusted input: the bullet kinds of a list, i.e. the dash of
// a ul, the dot of a ul.dots, and the arrowhead of a ul.arrows, drawn by the theme in the show and
// in the print view, and written by Dots and Arrows of Format > Text and of the Text pane. after
// each edit of the file the text is checked byte for byte after an undo, the edit again after a
// redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { editProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r20-4.html';
const PLATFORMS = ['mac', 'other'];
const KINDS = 0;
const NESTED = 1;
const APART = 2;
const ARROWS = 3;

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const settle = async (page) => {
  await page.evaluate('new Promise((d) => setTimeout(() => d(true), 120))');
  await frames(page);
};
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
let saves = 0;

// the editor on slide n of the deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  page.platform = platform;
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the edit checked against base after an undo, again after a redo, and after a save and an open,
// whose text becomes page.source
async function roundTrip(page, base = page.source) {
  const edited = await render(page);
  assert.notEqual(edited, base, 'the action does not change the file');
  await undo(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), edited, 'the redo does not write the edit again');
  const { text } = await saveAndReopen(page, `r20-4-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the shown element of selector with a text node of its own that holds needle, as an expression
const find = (selector, needle) => `[...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.includes(${js(needle)})))`;
const TEXT = '.reveal section.present li, .reveal section.present p';

// the caret put after needle in the item or paragraph that holds it
async function caretIn(page, needle) {
  await page.evaluate(`(() => {
    const el = ${find(TEXT, needle)};
    const n = [...el.childNodes].find((n) => n.nodeType === 3 && n.data.includes(${js(needle)}));
    el.closest('[contenteditable="true"]').focus();
    getSelection().collapse(n, n.data.indexOf(${js(needle)}) + ${js(needle)}.length);
  })()`);
  await settle(page);
}

// the client point of the middle of the text needle
const pointOf = (page, needle) => page.evaluate(`(() => {
  const el = ${find(TEXT, needle)};
  const n = [...el.childNodes].find((n) => n.nodeType === 3 && n.data.includes(${js(needle)}));
  const r = document.createRange();
  r.setStart(n, n.data.indexOf(${js(needle)}));
  r.setEnd(n, n.data.indexOf(${js(needle)}) + ${js(needle)}.length);
  const b = r.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
})()`);

// the box and the look of the ::before of each item of selector, in px, and whether its
// background is the color of --accent, read from a probe in the first slide
const marks = (page, selector) => page.evaluate(`(() => {
  const probe = document.createElement('div');
  probe.style.background = 'var(--accent)';
  document.querySelector('.reveal .slides section').append(probe);
  const accent = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return [...document.querySelectorAll(${js(selector)})].map((li) => {
    const s = getComputedStyle(li, '::before');
    const px = (v) => Math.round(parseFloat(v) * 100) / 100;
    return {
      text: [...li.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join('').trim(),
      width: px(s.width), height: px(s.height), left: px(s.left), middle: px(parseFloat(s.top) + parseFloat(s.height) / 2),
      round: s.borderRadius, clip: s.clipPath, mask: s.maskImage || s.webkitMaskImage || 'none', content: s.content,
      accent: s.backgroundColor === accent, pad: getComputedStyle(li).paddingLeft,
    };
  });
})()`);

// checkMarks tests the marks of the items Alpha, Dot one, Arrow one, and Inner dash of the first
// slide: a dash, a round dot, a triangle, and a dash, each in --accent and centered on the middle
// of the dash, with the text of each item at 54 px
function checkMarks(all) {
  const by = Object.fromEntries(all.map((m) => [m.text, m]));
  const dash = by.Alpha;
  assert.deepEqual([dash.width, dash.height, dash.clip, dash.round], [28, 2, 'none', '0px'], `the dash changed: ${js(dash)}`);
  const dot = by['Dot one'];
  assert.ok(dot.width === dot.height && dot.width >= 8 && dot.width <= 16 && dot.round === '50%' && dot.clip === 'none', `the dot is not round: ${js(dot)}`);
  const arrow = by['Arrow one'];
  assert.match(arrow.clip, /^polygon\(/, `the arrowhead is not a polygon: ${js(arrow)}`);
  assert.ok(arrow.width > 0 && arrow.height > 0 && arrow.left + arrow.width <= 28, `the arrowhead is not inside the place of the dash: ${js(arrow)}`);
  const inner = by['Inner dash'];
  assert.deepEqual([inner.width, inner.height, inner.clip], [28, 2, 'none'], `a dash list in an arrow list does not keep the dash: ${js(inner)}`);
  for (const m of [dash, dot, arrow, inner]) {
    assert.equal(m.content, '""', `the mark of ${m.text} is a glyph`);
    assert.equal(m.mask, 'none', `the mark of ${m.text} has a mask`);
    assert.ok(m.accent, `the mark of ${m.text} is not in --accent`);
    assert.equal(m.pad, '54px', `the text of ${m.text} moved`);
  }
  for (const m of [dot, arrow]) assert.ok(Math.abs(m.middle - dash.middle) < 0.75, `the mark of ${m.text} is not centered on the dash: ${m.middle} and ${dash.middle}`);
}

test('the theme draws a dash, a dot, and an arrowhead in --accent in both modes, in the show and in the print view', async (t) => {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  for (const [query, items] of [['still', '.reveal .slides section li'], ['print-pdf&still', '.pdf-page li']]) {
    if (query === 'still') {
      await page.goto(deckUrl(DECK, query));
      await page.waitFor(deckSettled);
    } else await printView(page, deckUrl(DECK, query));
    for (const mode of ['dark', 'light']) {
      await page.evaluate(`document.documentElement.dataset.theme = ${js(mode)}; true`);
      await frames(page);
      checkMarks((await marks(page, items)).slice(0, 6));
    }
  }
});

test('dots and arrows are classes of the theme in the scope rule', () => {
  const theme = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
  for (const c of ['dots', 'arrows']) assert.ok(theme.has(c), c);
  assert.deepEqual(editProblems('ul', [], { classes: { dots: true } }, theme), []);
  assert.deepEqual(editProblems('ul', [], { classes: { arrows: true } }, theme), []);
});

const LIST_IDS = ['text.list.none', 'text.list.ul', 'text.list.dots', 'text.list.arrows', 'text.list.ol'];
const checked = async (page) => {
  const out = [];
  for (const id of LIST_IDS) if ((await state(page, id)).checked) out.push(id.slice(10));
  return out;
};

for (const platform of PLATFORMS) {
  test(`Arrows and Dots set the kind of the list of the caret on its start tag alone, as one entry List Style (${platform})`, async (t) => {
    const page = await load(t, platform, KINDS);
    await caretIn(page, 'Bravo');
    assert.deepEqual(await checked(page), ['ul']);
    await exec(page, 'text.list.arrows');
    await settle(page);
    assert.equal(await render(page), page.source.replace('<ul>\n    <li>Alpha', '<ul class="arrows">\n    <li>Alpha'));
    assert.equal(await undoLabel(page), 'Undo List Style');
    assert.deepEqual(await checked(page), ['arrows'], 'Dashes is checked on an arrow list');
    assert.equal(await page.evaluate('getSelection().anchorNode.parentElement.textContent'), 'Bravo', 'the caret left the item');
    await roundTrip(page);
    await caretIn(page, 'Bravo');
    await exec(page, 'text.list.dots');
    await settle(page);
    assert.ok((await render(page)).includes('<ul class="dots">\n    <li>Alpha'));
    assert.deepEqual(await checked(page), ['dots']);
    await roundTrip(page);
  });

  test(`Dots makes a paragraph a dot list of one item, and Arrows retags a numbered list without its start (${platform})`, async (t) => {
    const page = await load(t, platform, KINDS);
    await caretIn(page, 'A lone paragraph');
    assert.deepEqual(await checked(page), ['none']);
    await exec(page, 'text.list.dots');
    await settle(page);
    assert.equal(await render(page), page.source.replace('<p>A lone paragraph</p>', '<ul class="dots">\n    <li>A lone paragraph</li>\n  </ul>'));
    assert.equal(await undoLabel(page), 'Undo List Style');
    await roundTrip(page);
    await caretIn(page, 'Four');
    await exec(page, 'text.list.arrows');
    await settle(page);
    assert.equal(await render(page), page.source.replace('<ol start="4">\n    <li>Four</li>\n  </ol>', '<ul class="arrows">\n    <li>Four</li>\n  </ul>'));
    await roundTrip(page);
  });

  test(`Numbers on an arrow list takes the class off, and Dashes takes the class attribute off (${platform})`, async (t) => {
    const page = await load(t, platform, KINDS);
    const list = '<ul class="arrows">\n    <li>Arrow one\n      <ul>\n        <li>Inner dash</li>\n      </ul>\n    </li>\n    <li>Arrow two</li>\n  </ul>';
    assert.ok(page.source.includes(list));
    await caretIn(page, 'Arrow two');
    assert.deepEqual(await checked(page), ['arrows']);
    await exec(page, 'text.list.ol');
    await settle(page);
    assert.equal(await render(page), page.source.replace(list, list.replace('<ul class="arrows">', '<ol>').replace(/<\/ul>$/, '</ol>')));
    await roundTrip(page);
    await undo(page);
    await caretIn(page, 'Arrow two');
    await exec(page, 'text.list.ul');
    await settle(page);
    assert.equal(await render(page), readFileSync(DECK, 'utf8').replace(list, list.replace('<ul class="arrows">', '<ul>')));
    assert.deepEqual(await checked(page), ['ul']);
  });

  test(`Dots with the caret at the second level changes only the nested list (${platform})`, async (t) => {
    const page = await load(t, platform, KINDS);
    await caretIn(page, 'Inner dash');
    assert.deepEqual(await checked(page), ['ul']);
    await exec(page, 'text.list.dots');
    await settle(page);
    assert.equal(await render(page), page.source.replace('<ul>\n        <li>Inner dash', '<ul class="dots">\n        <li>Inner dash'));
    assert.deepEqual(await checked(page), ['dots']);
    await roundTrip(page);
  });

  test(`Tab in an arrow list writes a nested arrow list, and Shift+Tab with followers keeps the class on their list (${platform})`, async (t) => {
    const page = await load(t, platform, ARROWS);
    const part = (text) => text.slice(text.indexOf('<li>One'), text.indexOf('</section>', text.indexOf('<li>One')));
    await caretIn(page, 'Two');
    await press(page, 'Tab');
    await settle(page);
    const one = await render(page);
    assert.match(part(one), /^<li>One\s*<ul class="arrows">\s*<li>Two<\/li>\s*<\/ul>\s*<\/li>/, `Tab does not write a nested arrow list: ${part(one)}`);
    await roundTrip(page);
    await caretIn(page, 'Three');
    await press(page, 'Tab');
    await settle(page);
    const both = await render(page);
    assert.match(part(both), /^<li>One\s*<ul class="arrows">\s*<li>Two<\/li>\s*<li>Three<\/li>\s*<\/ul>\s*<\/li>/, `Tab does not join the nested list: ${part(both)}`);
    await roundTrip(page);
    // Shift+Tab on Two, whose follower Three goes into a list at the end of Two
    await caretIn(page, 'Two');
    await press(page, 'Shift+Tab');
    await settle(page);
    const out = await render(page);
    assert.match(part(out), /<\/li>\s*<li>Two\s*<ul class="arrows">\s*<li>Three<\/li>\s*<\/ul>\s*<\/li>/, `the followers lost the kind: ${part(out)}`);
    await roundTrip(page);
  });

  test(`Arrows on a list selected as an object sets its nested dash lists and keeps a nested numbered list (${platform})`, async (t) => {
    const page = await load(t, platform, NESTED);
    await click(page, await pointOf(page, 'Top two'));
    await press(page, 'Escape');
    await settle(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), ['ul']);
    await exec(page, 'text.list.arrows');
    await settle(page);
    const want = page.source
      .replace('<ul>\n    <li>Top one', '<ul class="arrows">\n    <li>Top one')
      .replace('<ul>\n        <li>Sub dash', '<ul class="arrows">\n        <li>Sub dash');
    assert.equal(await render(page), want);
    assert.equal(await undoLabel(page), 'Undo List Style');
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName + "." + el.className)'), ['ul.arrows'], 'the list is not selected again');
    assert.equal((await state(page, 'text.list.arrows')).checked, true);
    await roundTrip(page);
    // Dashes takes the class off at both levels
    await click(page, await pointOf(page, 'Top two'));
    await press(page, 'Escape');
    await settle(page);
    await exec(page, 'text.list.ul');
    await settle(page);
    assert.equal(await render(page), readFileSync(DECK, 'utf8'));
  });

  test(`a dash list and an arrow list are not joined after the paragraph between them is deleted (${platform})`, async (t) => {
    const page = await load(t, platform, APART);
    await caretIn(page, 'Arrow item');
    await exec(page, 'text.list.arrows');
    await settle(page);
    assert.equal(await render(page), page.source.replace('<ul>\n    <li>Arrow item', '<ul class="arrows">\n    <li>Arrow item'));
    await roundTrip(page);
    await caretIn(page, 'Between');
    await press(page, 'Escape');
    await settle(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), ['p']);
    await press(page, 'Delete');
    await settle(page);
    assert.equal(await render(page), page.source.replace('  <p>Between</p>\n', ''));
    await roundTrip(page);
  });

  test(`the Text pane has a segment for each kind with a drawn mark, and a click on one sets it (${platform})`, async (t) => {
    const page = await load(t, platform, KINDS);
    await caretIn(page, 'Bravo');
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    const tab = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].find((b) => b.textContent.trim() === 'Text'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, tab);
    await settle(page);
    const segments = () => page.evaluate(`[...document.querySelectorAll('.beeson-edit-inspector .ed-seg button[data-command^="text.list."]')].map((b) => {
      const r = b.getBoundingClientRect();
      return { id: b.dataset.command, title: b.title || b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), marks: b.querySelectorAll('svg path, svg circle').length, width: r.width, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })`);
    const now = await segments();
    assert.deepEqual(now.map((s) => s.id), LIST_IDS, 'the segments are not None, Dashes, Dots, Arrows, and Numbers');
    assert.deepEqual(now.map((s) => s.title), ['Paragraphs', 'Dashes', 'Dots', 'Arrows', 'Numbers']);
    assert.ok(now.every((s) => s.marks > 0 && s.width >= 20), `a segment does not have a drawn mark: ${js(now)}`);
    assert.deepEqual(now.map((s) => s.pressed), ['false', 'true', 'false', 'false', 'false']);
    await click(page, now[3]);
    await settle(page);
    assert.equal(await render(page), page.source.replace('<ul>\n    <li>Alpha', '<ul class="arrows">\n    <li>Alpha'));
    assert.equal(await undoLabel(page), 'Undo List Style');
    assert.deepEqual((await segments()).map((s) => s.pressed), ['false', 'false', 'false', 'true', 'false']);
    assert.ok(await page.evaluate(`!!getSelection().anchorNode?.parentElement?.closest('li')`), 'the caret left the text');
    await roundTrip(page);
  });

  test(`Format > Text lists Dots and Arrows between Dashes and Numbers, disabled in the notes, and Arrows in a new text box is written once its text is typed (${platform})`, async (t) => {
    const page = await load(t, platform, KINDS);
    await caretIn(page, 'Bravo');
    const text = await page.evaluate(`(() => {
      const E = window.BeesonEditor;
      const walk = (items) => items.flatMap((i) => i.rule ? [] : i.command ? [E.state(i.command).label] : walk(typeof i.items === 'function' ? i.items() : i.items));
      const format = window.BeesonEditorShell.menuItems('Format');
      const items = format.find((i) => i.label === 'Text').items;
      return walk(typeof items === 'function' ? items() : items);
    })()`);
    const at = text.indexOf('Dashes');
    assert.deepEqual(text.slice(at - 1, at + 4), ['Paragraphs', 'Dashes', 'Dots', 'Arrows', 'Numbers']);
    for (const id of ['text.list.dots', 'text.list.arrows']) assert.equal((await state(page, id)).enabled, true, `${id} is dimmed in a list`);
    // the notes take only dashes
    if (!(await state(page, 'view.notes')).checked) await exec(page, 'view.notes');
    await frames(page);
    await click(page, '.reveal section.present > aside.notes');
    await settle(page);
    assert.equal((await state(page, 'text.list.ul')).enabled, true, 'the caret is not in the notes');
    for (const id of ['text.list.dots', 'text.list.arrows']) assert.equal((await state(page, id)).enabled, false, `${id} is enabled in the notes`);
    await exec(page, 'view.notes');
    await frames(page);
    // a new text box on the last slide
    await page.evaluate(`Reveal.slide(${ARROWS})`);
    await frames(page);
    await exec(page, 'insert.text');
    await frames(page);
    await exec(page, 'text.list.arrows');
    assert.equal((await state(page, 'text.list.arrows')).checked, true);
    assert.equal((await state(page, 'text.list.ul')).checked, false);
    await type(page, 'Item');
    await settle(page);
    assert.match(await render(page), /<ul class="arrows">\s*<li[^>]*>Item<\/li>\s*<\/ul>/, `the new text is not an arrow list: ${(await render(page)).match(/[^\n]*\n[^\n]*Item[^\n]*\n?[^\n]*/)?.[0]}`);
  });

  test(`Shift+Tab in the outline promotes an item of an arrow list with its followers in an arrow list (${platform})`, async (t) => {
    const page = await load(t, platform, ARROWS);
    if (!(await state(page, 'view.outline')).checked) await exec(page, 'view.outline');
    await frames(page);
    const at = await page.evaluate(`(() => {
      const t = [...document.querySelectorAll('.beeson-edit-outline .text')].find((e) => e.textContent === 'Two');
      t.scrollIntoView({ block: 'center' });
      const r = t.getBoundingClientRect();
      return { x: r.left + 10, y: r.top + r.height / 2 };
    })()`);
    await click(page, at);
    await settle(page);
    await press(page, 'Shift+Tab');
    await settle(page);
    const out = await render(page);
    const made = out.slice(out.indexOf('<h2>Two</h2>'));
    assert.ok(out.includes('<h2>Two</h2>'), `the item is not promoted: ${out.slice(out.indexOf('<h2>Indented'), out.indexOf('</section>', out.indexOf('<h2>Indented')))}`);
    assert.match(made, /^<h2>Two<\/h2>\s*<ul class="arrows">\s*<li>Three<\/li>\s*<\/ul>/, `the promoted list lost its kind: ${made.slice(0, 160)}`);
    await roundTrip(page);
  });
}
