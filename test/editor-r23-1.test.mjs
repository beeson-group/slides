// regression tests of R23.1 on both platforms, for six gaps of the acceptance audit of round 8: a
// moved or turned element glides in a Magic Move of the show, the formula key writes into a new
// empty text box, a paragraph style keeps a trailing space, the effect of a step is set on an
// element shown with the slide, an empty list item is drawn without its mark outside the editor,
// Oval gives the ellipse of a letterboxed picture, and Text Color > Text gives a small paragraph
// the text color. after each edit an undo gives the file byte for byte, a redo gives the edit, and
// a save is opened again without problems

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { themeClasses } from '../src/editor/model/scope.ts';
import { click, press, saveAndReopen, selectPicture, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r23-1.html';
const SOURCE = readFileSync(DECK, 'utf8');
const SLIDE = '.reveal .slides > section.present';

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
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}, ${js(arg ?? null)} ?? undefined)).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undoLabel = async (page) => (await state(page, 'edit.undo')).label;

function edited(edits) {
  let text = SOURCE;
  for (const [a, b] of edits) {
    assert.equal(text.split(a).length, 2, `${a} does not occur once in the deck`);
    text = text.replace(a, () => b);
  }
  return text;
}

// the editor on the deck at slide
async function load(t, platform, slide = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(SOURCE)})`)).problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await sleep(150);
  return page;
}

// the deck without the editor at slide, as the show draws it
async function show(t, slide = 0, query = '') {
  const page = await browser.newPage({ width: 1600, height: 900 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${DECK}${query}#/${slide}`);
  await page.waitFor(deckSettled);
  await sleep(200);
  return page;
}

// the edit is one entry of the history with label: an undo gives the file back byte for byte, a
// redo gives the edit, and a save is opened again as it is
async function roundTrip(page, expected, label) {
  assert.equal(await render(page), expected);
  if (label) assert.equal(await undoLabel(page), label);
  await undo(page);
  assert.equal(await render(page), SOURCE, 'the undo does not give the file back byte for byte');
  await redo(page);
  assert.equal(await render(page), expected, 'the redo does not give the edit back');
  const { text } = await saveAndReopen(page, `r23-1-${Math.random().toString(36).slice(2)}.html`);
  assert.equal(text, expected);
}

// the caret put into the block of selector by a click on its first characters
async function caretIn(page, selector) {
  const at = await page.evaluate(`(() => {
    const el = document.querySelector(${js(`${SLIDE} ${selector}`)});
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n = w.nextNode();
    while (n && !n.data.trim()) n = w.nextNode();
    const i = n.data.search(/\\S/);
    const r = document.createRange();
    r.setStart(n, i + 1);
    r.setEnd(n, i + 2);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
  await click(page, at);
  await frames(page);
}

// the block of selector selected as an object, by a click into its text and Esc
async function selectBlock(page, selector) {
  await caretIn(page, selector);
  await press(page, 'Escape');
  await frames(page);
}

// G10. the shape moved between the two slides of the Magic Move is between its two places during
// the move, and the turned one is between its two angles. the shape left in place stays there at
// full opacity. the shapes are read in the page at each frame of the move, since on a slow runner
// one read sent 160 ms after the move was started was answered after its end
test('a moved and a turned element glide in a Magic Move of the show, and an element left in place stays', async (t) => {
  const page = await show(t, 0);
  const read = `(() => {
    const s = document.querySelector(${js(SLIDE)});
    const at = (id) => s.querySelector('[data-id="' + id + '"]');
    const box = (id) => { const r = at(id).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; };
    return { moved: box('moved'), still: box('still'), opacity: getComputedStyle(at('still')).opacity, turn: parseFloat(getComputedStyle(at('turned')).rotate) || 0 };
  })()`;
  const from = await page.evaluate(read);
  const moving = await page.evaluate(`new Promise((done) => {
    const read = () => ${read};
    const seen = [];
    Reveal.next();
    const start = performance.now();
    const frame = () => {
      seen.push(read());
      if (performance.now() - start < 1060) requestAnimationFrame(frame);
      else done(seen);
    };
    requestAnimationFrame(frame);
  })`);
  const to = await page.evaluate(read);
  assert.ok(to.moved[0] - from.moved[0] > 100, `the shape is not moved by the slides: ${js([from, to])}`);
  // the frame in which the moved shape is nearest to the middle of its way
  const half = (from.moved[0] + to.moved[0]) / 2;
  const mid = moving.reduce((a, b) => (Math.abs(b.moved[0] - half) < Math.abs(a.moved[0] - half) ? b : a));
  const between = (a, b, v) => v > Math.min(a, b) + 5 && v < Math.max(a, b) - 5;
  assert.ok(between(from.moved[0], to.moved[0], mid.moved[0]) && between(from.moved[1], to.moved[1], mid.moved[1]), `the moved shape is not between its places: ${js([from.moved, mid.moved, to.moved])}`);
  assert.ok(mid.turn > 5 && mid.turn < 85, `the turned shape is not between its angles: ${mid.turn}`);
  assert.equal(to.turn, 90);
  for (const f of moving) assert.deepEqual([f.still, f.opacity], [from.still, '1'], 'the shape left in place moves or fades');
  assert.deepEqual(to.still, from.still);
  assert.deepEqual(errors(page), []);
});

// the key of an inline formula: Cmd+Option+E on a Mac, and Alt+= elsewhere, sent as the browser
// sends it
async function formulaKey(page, platform) {
  if (platform === 'mac') return press(page, 'Mod+Alt+E');
  const base = { key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '=', unmodifiedText: '=' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// a new text box on the empty slide, with the caret in it
async function newBox(page) {
  await click(page, '.beeson-edit-top [data-command="insert.text"]');
  await sleep(300);
  assert.equal(await page.evaluate(`!!document.querySelector(${js(`${SLIDE} .beeson-pending`)})`), true, 'the box is not drawn');
}

// the TeX typed into the open sheet of a formula and applied with Mod+Enter
async function applyTex(page, tex) {
  await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
  await type(page, tex);
  await sleep(300);
  await press(page, 'Mod+Enter');
  await sleep(500);
}

// a trusted click on the title of a menu of the menu bar, then on each item of path in turn
async function choose(page, bar, ...path) {
  const i = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === ${js(bar)})`);
  assert.ok(i >= 0, `the menu bar does not have ${bar}`);
  await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${i + 1})`);
  await frames(page);
  for (const label of path) {
    const at = await page.evaluate(`(() => {
      const items = [...document.querySelectorAll('.beeson-edit-menu .item')].filter((i) => i.querySelector('.label')?.textContent === ${js(label)} && i.getBoundingClientRect().width);
      const r = items.at(-1)?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    })()`);
    assert.ok(at, `the ${bar} menu does not have ${label}`);
    await click(page, at);
    await frames(page);
  }
}

// the text of the empty slide in the file, with the paragraph written there
const emptySlide = (text) => text.match(/<section>\n  <h2>Empty<\/h2>[\s\S]*?<\/section>/)[0];

for (const platform of PLATFORMS) {
  for (const route of ['key', 'menu']) {
    test(`G2: the formula ${route === 'key' ? 'key' : 'of Insert > Inline Formula'} in a new empty text box writes the formula into the box (${platform})`, async (t) => {
      const page = await load(t, platform, 2);
      await newBox(page);
      if (route === 'key') await formulaKey(page, platform);
      else await exec(page, 'math.inline');
      await applyTex(page, String.raw`\theta_1`);
      const text = await render(page);
      assert.match(emptySlide(text), /\n  <p( style="[^"]*")?>\\\(\\theta_1\\\)<\/p>\n<\/section>$/, `the formula is not written: ${emptySlide(text)}`);
      assert.equal(await page.evaluate(`document.querySelectorAll(${js(`${SLIDE} p mjx-container`)}).length`), 1, 'the formula is not typeset');
      // one entry, whose undo gives the file back
      await undo(page);
      assert.equal(await render(page), SOURCE, 'one undo does not give the file back');
      await redo(page);
      assert.equal(await render(page), text, 'the redo does not give the formula back');
      const saved = await saveAndReopen(page, `r23-1-g2-${route}-${platform}.html`);
      assert.equal(saved.text, text);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`G2: a paragraph style chosen behind a trailing space keeps the space (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await newBox(page);
    await type(page, 'The swing ');
    await sleep(100);
    await choose(page, 'Format', 'Text', 'Small');
    await press(page, 'End');
    await type(page, 'slows.');
    await sleep(1300);
    const text = await render(page);
    assert.match(emptySlide(text), /<p( style="[^"]*")? class="small">The swing slows\.<\/p>/, `the space is lost: ${emptySlide(text)}`);
    assert.deepEqual(errors(page), []);
  });
}

// the center of the chip of the row of the Steps pane whose text starts with text
const chipOf = (page, text) => page.evaluate(`(() => {
  const row = [...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${js(text)}));
  const r = row.querySelector('.chip').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// the item label of the open menu taken with a trusted click, once it is enabled
async function pickItem(page, label) {
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
  const item = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)});
    if (!item || item.getAttribute('aria-disabled') === 'true') return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(item, `the menu does not have an enabled item ${label}`);
  // an item is taken at a release 250 ms after the press that opened its menu
  await sleep(300);
  await click(page, item);
  await frames(page);
}

const ALPHA = '<p>Alpha stays with the slide.</p>';
const EFFECT = '.beeson-edit-side [aria-label="Effect of the step"]';

// G12. the paragraph Alpha is shown with the slide, and Beta is step 1
for (const platform of PLATFORMS) {
  test(`G12: the Effect control of the Steps pane makes an element shown with the slide the last step with the effect (${platform})`, async (t) => {
    const page = await load(t, platform, 3);
    await exec(page, 'view.steps');
    await frames(page);
    await selectBlock(page, 'p');
    const control = await page.evaluate(`(() => { const b = document.querySelector(${js(EFFECT)}); return b && { disabled: b.disabled, text: b.textContent }; })()`);
    assert.deepEqual(control, { disabled: false, text: '—' }, 'the Effect control is not enabled for an element shown with the slide');
    await click(page, EFFECT);
    await pickItem(page, 'Dim');
    await roundTrip(page, edited([[ALPHA, '<p class="semi-fade-out fragment" data-fragment-index="2">Alpha stays with the slide.</p>']]), 'Undo Set Effect of Step');
    assert.deepEqual(errors(page), []);
  });

  test(`G12: the effect entries of the menu of a row make an element shown with the slide the last step with the effect (${platform})`, async (t) => {
    const page = await load(t, platform, 3);
    await exec(page, 'view.steps');
    await frames(page);
    await click(page, await chipOf(page, 'Alpha'));
    await pickItem(page, 'Fade Out');
    await roundTrip(page, edited([[ALPHA, '<p class="fade-out fragment" data-fragment-index="2">Alpha stays with the slide.</p>']]), 'Undo Set Effect of Step');
    assert.deepEqual(errors(page), []);
  });
}

// the content of the mark of each item of the slide of lists in root, which is none for an item
// drawn without its mark
const marks = (root = 'document') => `[...${root}.querySelectorAll('li')].map((li) => [li.closest('ul, ol').localName + (li.closest('ul, ol').className ? '.' + li.closest('ul, ol').className : ''), li.textContent, getComputedStyle(li, '::before').content])`;
const LISTS = [['ul', 'A dash', '""'], ['ul', '', 'none'], ['ul.dots', '', 'none'], ['ul.arrows', '', 'none'], ['ol', '', 'none']];

// G7. the slide of lists has an empty item in a list of dashes, of dots, of arrows, and of numbers,
// whose marks the editor draws, since an empty item is the placeholder of a new slide
for (const platform of PLATFORMS) {
  test(`G7: an empty list item is drawn without its mark in the show and in the print view, and with it in the editor (${platform})`, async (t) => {
    const page = await show(t, 4);
    assert.deepEqual(await page.evaluate(marks(`document.querySelector(${js(SLIDE)})`)), LISTS);
    assert.deepEqual(errors(page), []);
    const print = await browser.newPage({ width: 1600, height: 900 });
    t.after(() => print.close().catch(() => {}));
    await printView(print, `${server.origin}/${DECK}?print-pdf`);
    const pages = await print.evaluate(`[...document.querySelectorAll('.pdf-page section')].filter((s) => s.querySelector('h2')?.textContent === 'Lists').map((s) => ${marks('s')})`);
    assert.ok(pages.length >= 1, 'the print view does not have the slide of lists');
    for (const p of pages) assert.deepEqual(p, LISTS);
    const editor = await load(t, platform, 4);
    const drawn = await editor.evaluate(marks(`document.querySelector(${js(SLIDE)})`));
    assert.deepEqual(drawn.map((m) => m[2] !== 'none'), [true, true, true, true, true], `a mark is not drawn in the editor: ${js(drawn)}`);
    assert.deepEqual(errors(editor), []);
  });
}

// the picture of the shown image of the slide of pictures as drawn, in screen px: its box, and the
// part of the box that the picture fills under object-fit contain
const drawn = (page) => page.evaluate(`(() => {
  const img = [...document.querySelectorAll(${js(`${SLIDE} figure img`)})].find((i) => i.getBoundingClientRect().width);
  const r = img.getBoundingClientRect();
  const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  const round = (v) => Math.round(v * 10) / 10;
  return { box: [r.width, r.height].map(round), picture: [r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h].map(round) };
})()`);

// G8. the picture of 1200 by 1440 px is drawn letterboxed at 600 by 720 px in the zone of 600 by
// 800 px, hence Oval writes its width, and the figure is moved by the 40 px that the picture rises
for (const platform of PLATFORMS) {
  test(`G8: Oval on a picture drawn smaller than its box gives the ellipse of the picture, for both pictures of a pair (${platform})`, async (t) => {
    const page = await load(t, platform, 5);
    const before = await drawn(page);
    assert.notDeepEqual(before.box, before.picture.slice(2), 'the picture is not letterboxed');
    await selectPicture(page, `${SLIDE} figure img.for-dark`);
    await exec(page, 'figure.oval');
    await frames(page);
    const now = await drawn(page);
    assert.deepEqual(now.box, now.picture.slice(2), 'the box of the oval picture is not the picture');
    assert.deepEqual(now.picture, before.picture, 'the picture is moved');
    const expected = edited([
      ['<figure class="zone">\n    <img class="for-dark" src="../../demo/figure-dark.png" alt="A pair">\n    <img class="for-light" src="../../demo/figure-light.png" alt="A pair">',
        '<figure class="zone" style="translate: 0px 40px">\n    <img class="for-dark oval" src="../../demo/figure-dark.png" alt="A pair" style="width: 600px">\n    <img class="for-light oval" src="../../demo/figure-light.png" alt="A pair" style="width: 600px">'],
    ]);
    await roundTrip(page, expected, 'Undo Oval');
    assert.deepEqual(errors(page), []);
  });
}

// the color of the words of selector, and of a paragraph of body text, which is the text color
const colors = (page, selector) => page.evaluate(`(() => {
  const s = document.querySelector(${js(SLIDE)});
  const el = s.querySelector(${js(selector)});
  return [getComputedStyle(el.querySelector('span') ?? el).color, getComputedStyle(s.querySelector('p')).color];
})()`);

test('G1: the class tone-text is a class of the theme, which the scope rule allows', () => {
  assert.ok(new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8'))).has('tone-text'));
});

// G1. on the slide of colors, the small paragraph, the caption, and the footnote are drawn in a
// color of their own, and the paragraph of body text holds words in orange
for (const platform of PLATFORMS) {
  test(`G1: Text Color > Text draws the words of a small paragraph, a caption, and a footnote in the text color (${platform})`, async (t) => {
    let page;
    for (const [selector, tag] of [['p.small', '<p class="small">Small words here.</p>'], ['p.caption', '<p class="caption">Caption words here.</p>'], ['div.foot', '<div class="foot">Footnote words here.</div>']]) {
      page = await load(t, platform, 6);
      const [own, text] = await colors(page, selector);
      assert.notEqual(own, text, `${selector} is drawn in the text color`);
      await selectBlock(page, selector);
      assert.equal((await state(page, 'text.tone.text')).checked, false, `Text is checked on ${selector}`);
      await exec(page, 'text.tone.text');
      await frames(page);
      assert.equal((await state(page, 'text.tone.text')).checked, true, `Text is not checked on ${selector}`);
      const words = tag.replace(/^(<[^>]+>)(.*)(<\/\w+>)$/, '$1<span class="tone-text">$2</span>$3');
      await roundTrip(page, edited([[tag, words]]), 'Undo Text Color');
      const [now, body] = await colors(page, selector);
      assert.equal(now, body, `the words of ${selector} are not drawn in the text color`);
    }
    page = await load(t, platform, 6);
    // on a block in the text color, Text takes the tone of its words off
    await selectBlock(page, 'p');
    await exec(page, 'text.tone.text');
    await roundTrip(page, edited([['<p>Body words <span class="tone-accent">in orange</span> here.</p>', '<p>Body words in orange here.</p>']]), 'Undo Text Color');
    assert.deepEqual(errors(page), []);
  });
}
