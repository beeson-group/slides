// the fixes of R21.1 on both platforms, driven with trusted input: the Text pane formats the words
// of a selected shape, the alignment of its words reads and sets how they are drawn, an Alt key of
// a command runs it while a shape is selected, Magic Move pairs a shape with its dimmed copy and a
// curve by its arrowheads, an outline weight is drawn on a veil, and a press anywhere on the
// outline of a shape without a fill hits it. each edit is checked byte for byte, after an undo and
// a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r21-1.html';
const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const [WORDS, TRIANGLE, VEILS, FRAME, STEP, CURVE] = [0, 1, 2, 3, 4, 6];
const SHAPE_P = 'translate: 1100px 400px"><p>Goal</p></div>';
const PARAGRAPH = 'A paragraph beside a card.';

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

async function shapePage(platform, n) {
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

// the screen point of a point in slide px
const screen = (page, x, y) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides');
  const r = s.getBoundingClientRect(), k = r.width / s.offsetWidth;
  return { x: r.left + ${x} * k, y: r.top + ${y} * k };
})()`);

const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName + '.' + [...el.classList].filter((c) => !c.startsWith('beeson-')).join('.'))`);
const caretInShape = (page) => page.evaluate(`(() => { const s = getSelection(); return !!(s.rangeCount && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('.shape')); })()`);

// a click at the center of the shape of the current slide that matches selector, which selects it
// as an object
async function clickShape(page, selector = '.shape') {
  const at = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await frames(page);
}

// the tag that the command id writes on the paragraph of the slide WORDS selected as a block, with
// the words of the paragraph replaced by those of the shape
async function blockEdit(page, id) {
  await click(page, await screen(page, 300, 300));
  await press(page, 'Escape');
  await frames(page);
  await exec(page, id);
  const text = await render(page);
  await undo(page);
  await byteExact(page);
  const line = text.split('\n').find((l) => l.includes(PARAGRAPH));
  assert.ok(line && line !== `  <p>${PARAGRAPH}</p>`, `${id} does not change the paragraph selected as a block`);
  return line.trim().replace(PARAGRAPH, 'Goal');
}

// the commands or titles of the buttons of the Text tab of the Format pane that are disabled
async function disabledInText(page) {
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await frames(page);
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Text').click()`);
  await frames(page);
  return page.evaluate(`[...document.querySelectorAll('${PANEL} button')].filter((b) => !b.closest('.ed-tabs') && b.offsetParent && b.disabled).map((b) => b.dataset.command ?? b.title ?? b.textContent)`);
}

// a trusted press of Alt+=, whose key press() of test/helpers/editor.mjs does not know
async function altEquals(page) {
  const base = { key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: '=', unmodifiedText: '=' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

test('the class left of the words of a shape is a class of the theme', () => {
  assert.ok(new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8'))).has('left'));
});

for (const platform of PLATFORMS) {
  test(`V1: the Text pane formats every word of a selected shape, as of a paragraph selected as a block, on ${platform}`, async () => {
    const page = await shapePage(platform, WORDS);
    const ids = ['text.bigger', 'text.tone.accent', 'text.bold'];
    const edits = {};
    for (const id of ids) edits[id] = await blockEdit(page, id);
    const paragraphDisabled = await disabledInText(page);
    await clickShape(page);
    assert.deepEqual(await selected(page), ['div.shape.rounded.tone-accent']);
    assert.equal(await caretInShape(page), false);
    for (const id of [...ids, 'text.italic', 'text.smaller', 'text.tone.violet', 'text.align.left']) assert.equal((await state(page, id)).enabled, true, id);
    assert.deepEqual((await disabledInText(page)).filter((b) => !paragraphDisabled.includes(b)), [], 'the buttons of the Text tab disabled for a selected shape and not for a paragraph');
    for (const id of ids) {
      await clickShape(page);
      await exec(page, id);
      await frames(page);
      await byteExact(page, [[SHAPE_P, `translate: 1100px 400px">${edits[id]}</div>`]]);
      await undo(page);
      await byteExact(page);
      await redo(page);
      await byteExact(page, [[SHAPE_P, `translate: 1100px 400px">${edits[id]}</div>`]]);
      await undo(page);
    }
    // Dashes sets the words as a list, and the shape stays selected
    await clickShape(page);
    await exec(page, 'text.list.ul');
    await frames(page);
    await byteExact(page, [[SHAPE_P, 'translate: 1100px 400px"><ul>\n  <li>Goal</li>\n</ul></div>']]);
    assert.deepEqual(await selected(page), ['div.shape.rounded.tone-accent']);
    await exec(page, 'text.list.none');
    await frames(page);
    await byteExact(page);
    await clickShape(page);
    await exec(page, 'text.tone.accent');
    const { text } = await saveAndReopen(page, `r21-1-v1-${platform}.html`);
    assert.ok(text.includes(`${edits['text.tone.accent']}</div>`));
    assert.deepEqual(errors(page), []);
  });

  test(`V17 and V22: Center is checked for the words of a shape, and Align Left aligns them to the left with the class left, on ${platform}`, async () => {
    const page = await shapePage(platform, WORDS);
    // with the caret in the words
    await clickShape(page);
    await press(page, 'Enter');
    await frames(page);
    assert.equal(await caretInShape(page), true);
    assert.equal((await state(page, 'text.align.center')).checked, true);
    assert.equal((await state(page, 'text.align.left')).checked, false);
    // with the shape selected
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['div.shape.rounded.tone-accent']);
    assert.equal((await state(page, 'text.align.center')).checked, true);
    assert.equal((await state(page, 'text.align.left')).checked, false);
    await exec(page, 'text.align.left');
    await frames(page);
    const left = [[SHAPE_P, 'translate: 1100px 400px"><p class="left">Goal</p></div>']];
    await byteExact(page, left);
    const drawn = () => page.evaluate(`(() => { const s = Reveal.getCurrentSlide().querySelector('.shape'), p = s.querySelector('p'); const r = document.createRange(); r.selectNodeContents(p); const k = s.getBoundingClientRect().width / s.offsetWidth; return { align: getComputedStyle(p).textAlign, inset: Math.round((r.getBoundingClientRect().left - s.getBoundingClientRect().left) / k) }; })()`);
    let d = await drawn();
    assert.equal(d.align, 'left');
    assert.ok(d.inset <= 30, `the words start ${d.inset} px inside the shape`);
    assert.equal((await state(page, 'text.align.left')).checked, true);
    assert.equal((await state(page, 'text.align.center')).checked, false);
    await undo(page);
    await byteExact(page);
    assert.ok((await drawn()).inset > 100, 'the words are not centered after the undo');
    await redo(page);
    await byteExact(page, left);
    // Center takes the class off, with the caret in the words too
    await clickShape(page);
    await press(page, 'Enter');
    await frames(page);
    assert.equal((await state(page, 'text.align.left')).checked, true);
    await exec(page, 'text.align.center');
    await frames(page);
    await byteExact(page);
    d = await drawn();
    assert.equal(d.align, 'center');
    await undo(page);
    await byteExact(page, left);
    const { text } = await saveAndReopen(page, `r21-1-v17-${platform}.html`);
    assert.ok(text.includes('<p class="left">Goal</p></div>'));
    assert.deepEqual(errors(page), []);
  });

  test(`V2: the keys of Rulers and Insert Formula run their commands while a shape is selected, and a letter still starts its words, on ${platform}`, async () => {
    const page = await shapePage(platform, TRIANGLE);
    await clickShape(page);
    assert.deepEqual(await selected(page), ['div.shape.triangle']);
    const rulers = (await state(page, 'view.rulers')).checked;
    await press(page, platform === 'mac' ? 'Mod+R' : 'Alt+Shift+R');
    await frames(page);
    assert.equal((await state(page, 'view.rulers')).checked, !rulers, 'the rulers are not toggled');
    await byteExact(page);
    if (platform === 'mac') await press(page, 'Mod+Alt+E');
    else await altEquals(page);
    await frames(page);
    const text = await render(page);
    assert.match(text, /<div class="math"[^\n]*>\\\[\\\]<\/div>/, 'a formula is not inserted');
    assert.ok(text.includes('<div class="shape triangle" style="width: 200px; height: 160px; translate: 1360px 260px"></div>'), 'the shape is changed');
    await undo(page);
    await byteExact(page);
    await clickShape(page);
    await press(page, 'q');
    await frames(page);
    assert.ok((await render(page)).includes('<div class="shape triangle" style="width: 200px; height: 160px; translate: 1360px 260px"><p>q</p></div>'));
    assert.deepEqual(errors(page), []);
  });

  test(`V16: Magic Move pairs a shape with its copy that has the step effect Dim, on ${platform}`, async () => {
    const page = await shapePage(platform, STEP);
    await exec(page, 'slide.transition.magic');
    const text = await render(page);
    const ids = [...text.matchAll(/<div class="shape[^"]*"[^>]*data-id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, 2, 'the shape and its dimmed copy are not both given a data-id');
    assert.equal(ids[0], ids[1]);
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`V5: Magic Move does not pair a curved arrow with a headless curve, on ${platform}`, async () => {
    const page = await shapePage(platform, CURVE);
    await exec(page, 'slide.transition.magic');
    const text = await render(page);
    assert.doesNotMatch(text, /<svg class="line[^"]*"[^>]*data-id=/, 'a curve is paired with a curve of other heads');
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`V3: an outline of 6 or 8 px set on a veil is drawn, and the Outline control reads the drawn outline of a veil, on ${platform}`, async () => {
    const page = await shapePage(platform, VEILS);
    const border = () => page.evaluate(`getComputedStyle(Reveal.getCurrentSlide().querySelector('.shape.veil:not(.equals)')).borderTopWidth`);
    const stroke = () => page.evaluate(`getComputedStyle(Reveal.getCurrentSlide().querySelector('.shape.equals > svg path')).strokeWidth`);
    assert.equal(await border(), '0px');
    await clickShape(page, '.shape.veil:not(.equals)');
    assert.deepEqual(await selected(page), ['div.shape.veil']);
    await exec(page, 'shape.weight.8');
    await frames(page);
    await byteExact(page, [['<div class="shape veil"', '<div class="shape veil weight-8"']]);
    assert.equal(await border(), '8px');
    assert.equal((await state(page, 'shape.weight.8')).checked, true);
    await undo(page);
    await byteExact(page);
    // a veil without a weight class is drawn without an outline, which the control reads as None
    assert.equal((await state(page, 'shape.weight.none')).checked, true);
    assert.equal((await state(page, 'shape.weight.3')).checked, false);
    assert.equal((await state(page, 'shape.weight.3')).enabled, false);
    await redo(page);
    assert.equal(await border(), '8px');
    await clickShape(page, '.shape.equals');
    await exec(page, 'shape.weight.6');
    await frames(page);
    assert.equal(await stroke(), '6px');
    const { text } = await saveAndReopen(page, `r21-1-v3-${platform}.html`);
    assert.ok(text.includes('<div class="shape equals veil weight-6"'));
    assert.deepEqual(errors(page), []);
  });

  test(`V4: a press anywhere on the drawn outline of a shape without a fill, and within 6 px of it, hits the shape at each weight, on ${platform}`, async () => {
    const page = await shapePage(platform, FRAME);
    for (const [id, w] of [['none', 0], ['3', 3], ['6', 6], ['8', 8]]) {
      await clickShape(page);
      await exec(page, `shape.weight.${id}`);
      await press(page, 'Escape');
      await press(page, 'Escape');
      await frames(page);
      assert.equal(await page.evaluate(`getComputedStyle(Reveal.getCurrentSlide().querySelector('.shape')).borderLeftWidth`), `${w}px`);
      const missed = [];
      for (let d = -5; d <= w + 5; d++) {
        const at = await screen(page, 200 + d + 0.5, 500);
        const hit = await page.evaluate(`document.elementFromPoint(${at.x}, ${at.y})?.closest('.shape') === Reveal.getCurrentSlide().querySelector('.shape')`);
        if (!hit) missed.push(d);
      }
      assert.deepEqual(missed, [], `the presses that pass through the outline of ${w} px`);
      const inside = await screen(page, 200 + w + 20, 500);
      assert.equal(await page.evaluate(`document.elementFromPoint(${inside.x}, ${inside.y})?.closest('.shape') ?? null`), null, `a press 20 px inside the outline of ${w} px hits the shape`);
    }
    assert.deepEqual(errors(page), []);
  });
}
