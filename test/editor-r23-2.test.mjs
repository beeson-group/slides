// regression tests of R23.2 on both platforms, for the findings of three slides built by hand: a
// copy of a group does not move the elements beside it, the arrowheads of copied lines keep ids of
// their own, a drag on the words of a selected shape moves or copies it, a new slide may hold its
// title only, the formula key writes into the empty words of a shape, and the empty placeholders of
// a new content slide take the same room in the show as in the editor. after each edit an undo
// gives the file back byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r23-2.html';
const SOURCE = readFileSync(DECK, 'utf8');
const SLIDE = '.reveal .slides > section.present';
const [CARDS, ARROWS, WORDS, HOLLOW, PROMPTS] = [0, 1, 2, 3, 4];

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}, ${js(arg ?? null)} ?? undefined)).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undoLabel = async (page) => (await state(page, 'edit.undo')).label;
const copyKey = (platform) => (platform === 'mac' ? 'Alt' : 'Ctrl');

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

// the screen box in px of each element in window.kept
const keptBoxes = (page) => page.evaluate(`window.kept.map((el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })`);

// H3. the card is a group of a shape, a display, and a label, the last two placed with translate
// from their places in the flow. a copy of the group by each route leaves the three where they are
for (const platform of PLATFORMS) {
  for (const route of ['a drag with the copy key', 'Edit > Duplicate', 'Copy and Paste']) {
    test(`H3: ${route} of a group does not move the elements of the slide (${platform})`, async (t) => {
      const page = await load(t, platform, CARDS);
      await page.evaluate(`window.kept = [...document.querySelector(${js(SLIDE)}).querySelectorAll(':scope > .shape, :scope > .math, :scope > p')]`);
      const was = await keptBoxes(page);
      assert.equal(was.length, 3);
      const at = await page.evaluate(`(() => { const r = document.querySelector(${js(`${SLIDE} > .shape`)}).getBoundingClientRect(); return { x: r.left + 24, y: r.bottom - 24 }; })()`);
      await click(page, at);
      await frames(page);
      assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 3, 'the group is not selected');
      if (route === 'Edit > Duplicate') await exec(page, 'edit.duplicate');
      else if (route === 'Copy and Paste') {
        await exec(page, 'edit.copy');
        await exec(page, 'edit.paste');
      } else await drag(page, at, { dx: 700, dy: 0, modifiers: copyKey(platform) });
      await sleep(300);
      assert.equal(await page.evaluate(`document.querySelectorAll(${js(`${SLIDE} > :is(.shape, .math, p)`)}).length`), 6, 'the group is not copied');
      assert.deepEqual(await keptBoxes(page), was, 'an element of the slide is moved by the copy');
      assert.equal(await undoLabel(page), route === 'Copy and Paste' ? 'Undo Paste' : 'Undo Duplicate');
      await undo(page);
      assert.equal(await render(page), SOURCE, 'one undo does not give the file back');
      assert.deepEqual(errors(page), []);
    });
  }
}

// the ids of the markers of the deck, and for each line whether its arrowhead names the marker of
// its own svg, with the fill of the head and the stroke of the line
const heads = `(() => {
  const ids = [...document.querySelectorAll('.reveal .slides marker')].map((m) => m.id);
  const lines = [...document.querySelectorAll('.reveal .slides svg.line')].map((svg) => {
    const line = svg.querySelector('line');
    const id = /url\\(#([^)]+)\\)/.exec(line.getAttribute('marker-end'))[1];
    const marker = document.getElementById(id);
    return { own: marker?.closest('svg') === svg, fill: getComputedStyle(marker.querySelector('path')).fill, stroke: getComputedStyle(line).stroke };
  });
  return { ids, lines };
})()`;

const unique = (ids) => new Set(ids).size === ids.length;

// H5. the slide of arrows has an orange and a blue arrow, line-1 and line-2. each copy of the slide
// gives every marker of the deck an id of its own, and each arrowhead the tone of its line
for (const platform of PLATFORMS) {
  for (const route of ['Duplicate Slide', 'Magic Move to Copy of Slide', 'Copy and Paste of the slide']) {
    test(`H5: ${route} gives each marker an id of its own and each arrowhead the tone of its line (${platform})`, async (t) => {
      const page = await load(t, platform, ARROWS);
      if (route === 'Duplicate Slide') await exec(page, 'slide.duplicate');
      else if (route === 'Magic Move to Copy of Slide') await exec(page, 'slide.magicMove');
      else {
        await exec(page, 'slide.copy');
        await exec(page, 'slide.paste');
      }
      await sleep(300);
      const { ids, lines } = await page.evaluate(heads);
      assert.equal(lines.length, 4, 'the slide is not copied');
      assert.ok(unique(ids), `a marker id is given twice: ${ids}`);
      const file = [...(await render(page)).matchAll(/<marker id="([^"]+)"/g)].map((m) => m[1]);
      assert.ok(file.length === 4 && unique(file), `a marker id is written twice: ${file}`);
      for (const l of lines) {
        assert.ok(l.own, 'an arrowhead names the marker of another line');
        assert.equal(l.fill, l.stroke, 'an arrowhead is not drawn in the tone of its line');
      }
      await undo(page);
      assert.equal(await render(page), SOURCE, 'one undo does not give the file back');
      // the two arrows copied and pasted together onto the same slide
      const lined = await load(t, platform, ARROWS);
      await exec(lined, 'selection.all');
      await exec(lined, 'edit.copy');
      await exec(lined, 'edit.paste');
      await sleep(200);
      const pasted = await lined.evaluate(heads);
      assert.ok(pasted.lines.length === 4 && unique(pasted.ids) && pasted.lines.every((l) => l.own && l.fill === l.stroke), `the pasted lines share a marker: ${js(pasted)}`);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the screen point at the boundary after the character i of the words of the shape of the slide
const wordPoint = (page, i) => page.evaluate(`(() => {
  const n = document.querySelector(${js(`${SLIDE} .shape p`)}).firstChild;
  const r = document.createRange();
  r.setStart(n, ${i});
  r.setEnd(n, ${i});
  const b = r.getBoundingClientRect();
  return { x: b.left, y: b.top + b.height / 2 };
})()`);

const shapes = (page) => page.evaluate(`[...document.querySelectorAll(${js(`${SLIDE} > .shape`)})].map((s) => s.style.translate)`);
const editing = (page) => page.evaluate(`!!document.activeElement?.closest(${js(`${SLIDE} .shape p`)})`);

// H2. the shape of the slide of words holds the word Build. once the shape is selected, a press on
// its words is a press on the shape until its words are edited
for (const platform of PLATFORMS) {
  test(`H2: a drag on the words of a selected shape moves it or copies it, and a click puts the caret there (${platform})`, async (t) => {
    const page = await load(t, platform, WORDS);
    const k = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);
    const word = await wordPoint(page, 2);
    await click(page, word);
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 1, 'the shape is not selected');
    assert.equal(await editing(page), false);
    // a plain drag moves the shape
    await drag(page, word, { dx: 200 * k, dy: 100 * k });
    await sleep(200);
    assert.deepEqual(await shapes(page), ['800px 500px'], 'a drag on the words of the selected shape does not move it');
    assert.equal(await undoLabel(page), 'Undo Move');
    assert.equal(await editing(page), false);
    // a drag with the copy key copies the shape that is still selected
    const moved = await wordPoint(page, 2);
    await drag(page, moved, { dx: -200 * k, dy: 200 * k, modifiers: copyKey(platform) });
    await sleep(300);
    assert.deepEqual(await shapes(page), ['800px 500px', '600px 700px'], 'a drag with the copy key on the words of the selected shape does not copy it');
    assert.equal(await undoLabel(page), 'Undo Duplicate');
    await undo(page);
    await undo(page);
    assert.equal(await render(page), SOURCE, 'two undos do not give the file back');
    // a click without a move puts the caret into the words at the point of the click
    await click(page, await page.evaluate(`(() => { const r = document.querySelector(${js(SLIDE)}).getBoundingClientRect(); return { x: r.left + 40, y: r.bottom - 40 }; })()`));
    await frames(page);
    await click(page, word);
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 1);
    await click(page, word);
    await frames(page);
    assert.equal(await editing(page), true, 'a click on the words of the selected shape does not put the caret there');
    const caret = await page.evaluate(`(() => { const s = getSelection(); return [s.isCollapsed, s.anchorNode.textContent, s.anchorOffset]; })()`);
    assert.deepEqual(caret, [true, 'Build', 2]);
    // a drag inside the words that are edited selects text, and the shape stays
    const from = await wordPoint(page, 0), to = await wordPoint(page, 5);
    await drag(page, { x: from.x + 2, y: from.y }, { dx: to.x - from.x - 2 });
    await frames(page);
    assert.equal(await page.evaluate('getSelection().toString()'), 'Build', 'a drag in the edited words does not select them');
    assert.deepEqual(await shapes(page), ['600px 400px']);
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(errors(page), []);
  });
}

// the slide of Title Only after the slide of words, as the file holds it
const TITLE_ONLY = SOURCE.replace('<section>\n  <h2>Hollow</h2>', '<section>\n  <h2></h2>\n</section>\n\n<section>\n  <h2>Hollow</h2>');

// a new slide of the layout Title Only is a content slide with its h2 and nothing else, added from
// Insert > New Slide and from the tile of the Add Slide button. Change Layout reads it as Content
for (const platform of PLATFORMS) {
  for (const route of ['Insert > New Slide', 'the Add Slide button']) {
    test(`Title Only from ${route} writes a content slide with its title only (${platform})`, async (t) => {
      const page = await load(t, platform, WORDS);
      if (route === 'Insert > New Slide') {
        assert.equal((await state(page, 'slide.new.titleOnly')).label, 'Title Only');
        await exec(page, 'slide.new.titleOnly');
      } else {
        await click(page, '.beeson-edit-top [data-command="slide.gallery"]');
        await page.waitFor(`!!document.querySelector('.beeson-edit-gallery .tile')`);
        // each tile with its name and the blocks of its small picture
        const tiles = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-gallery .tile')].map((t) => [t.dataset.layout, t.textContent, [...(t.querySelector('.pic').shadowRoot?.querySelector('section')?.children ?? [])].map((c) => c.localName + ':' + c.textContent)])`);
        assert.deepEqual(tiles.find((x) => x[0] === 'titleOnly'), ['titleOnly', 'Title Only', ['h2:Title of the slide']], `the gallery does not have the tile Title Only with its picture: ${js(tiles)}`);
        assert.equal(tiles.length, 9);
        await click(page, `.beeson-edit-gallery .tile[data-layout="titleOnly"]`);
      }
      await sleep(300);
      assert.equal(await render(page), TITLE_ONLY);
      assert.equal(await page.evaluate('Reveal.getIndices().h'), WORDS + 1);
      assert.equal((await state(page, 'slide.layout.content')).checked, true, 'Change Layout does not read the slide as Content');
      assert.equal(await undoLabel(page), 'Undo Title Only');
      await undo(page);
      assert.equal(await render(page), SOURCE, 'one undo does not give the file back');
      assert.deepEqual(errors(page), []);
    });
  }
}

// the key of an inline formula: Cmd+Option+E on a Mac, and Alt+= elsewhere, sent as the browser
// sends it
async function formulaKey(page, platform) {
  if (platform === 'mac') return press(page, 'Mod+Alt+E');
  const base = { key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '=', unmodifiedText: '=' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

const HOLLOW_SHAPE = '<div class="shape rounded" style="width: 400px; height: 240px; translate: 600px 400px"></div>';

// H1. the shape of the slide Hollow is empty. Return puts the caret into its empty words, and the
// formula key or Insert > Inline Formula there writes the formula as the words of the shape
for (const platform of PLATFORMS) {
  for (const route of ['key', 'menu']) {
    test(`H1: the formula ${route === 'key' ? 'key' : 'of Insert > Inline Formula'} in the empty words of a shape writes the formula into the shape (${platform})`, async (t) => {
      const page = await load(t, platform, HOLLOW);
      await click(page, `${SLIDE} > .shape`);
      await frames(page);
      await press(page, 'Enter');
      await frames(page);
      assert.equal(await page.evaluate(`!!document.activeElement?.matches(${js(`${SLIDE} > .shape > p`)})`), true, 'the caret is not in the words of the shape');
      if (route === 'key') await formulaKey(page, platform);
      else await exec(page, 'math.inline');
      await page.waitFor(`!!document.querySelector('.beeson-math textarea')`);
      await type(page, 'z^2');
      await sleep(300);
      await press(page, 'Mod+Enter');
      await sleep(500);
      const expected = SOURCE.replace(HOLLOW_SHAPE, HOLLOW_SHAPE.replace('></div>', '><p>\\(z^2\\)</p></div>'));
      assert.equal(await render(page), expected, 'the formula is not written into the shape');
      assert.equal(await page.evaluate(`document.querySelectorAll(${js(`${SLIDE} > .shape p mjx-container`)}).length`), 1, 'the formula is not typeset');
      await undo(page);
      assert.equal(await render(page), SOURCE, 'one undo does not give the file back');
      await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
      assert.equal(await render(page), expected, 'the redo does not give the formula back');
      const saved = await saveAndReopen(page, `r23-2-h1-${route}-${platform}.html`);
      assert.equal(saved.text, expected);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the box in slide px of the text box under the empty placeholders of the slide Prompts, and the
// heights of the two placeholders
const underBox = (page) => page.evaluate(`(() => {
  const s = document.querySelector(${js(SLIDE)});
  const k = s.getBoundingClientRect().width / s.offsetWidth;
  const of = (el) => { const r = el.getBoundingClientRect(), o = s.getBoundingClientRect(); return [(r.left - o.left) / k, (r.top - o.top) / k, r.height / k].map((v) => Math.round(v)); };
  return { under: of(s.querySelector('p[style]')), p: of(s.querySelector(':scope > p:not([style])'))[2], li: of(s.querySelector('li'))[2] };
})()`);

// the empty paragraph and the empty item of a new content slide take the height of a line in the
// editor, where their prompts are drawn, and in the show, hence a text box under them placed with
// translate is drawn at the same place in both
for (const platform of PLATFORMS) {
  test(`the empty placeholders of a content slide take the same room in the show as in the editor (${platform})`, async (t) => {
    const editor = await load(t, platform, PROMPTS);
    const edited = await underBox(editor);
    const page = await browser.newPage({ width: 1600, height: 900 });
    t.after(() => page.close().catch(() => {}));
    await page.goto(`${server.origin}/${DECK}#/${PROMPTS}`);
    await page.waitFor(deckSettled);
    await sleep(200);
    const shown = await underBox(page);
    assert.ok(edited.p > 0 && edited.li > 0, `a placeholder is drawn without a height in the editor: ${js(edited)}`);
    assert.deepEqual(shown, edited, 'the text box under the placeholders is drawn at another place in the show');
    assert.deepEqual(errors(page), []);
    assert.deepEqual(errors(editor), []);
  });
}
