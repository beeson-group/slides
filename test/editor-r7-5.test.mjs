// the steps, code boxes, and formulas of R7.5 with trusted input on either platform: Play From a
// step of the Steps tab, the line steps of a code box listed as rows of the Steps tab, the stepper
// of the Delay field, the glyphs of the TeX completion list, and the switch Small of the Code pane.
// after each edit an undo gives the file byte for byte, a redo gives the edit, and a save is
// opened again without problems

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const SIDE = '.beeson-edit-side';
const REDO = { mac: 'Mod+Shift+Z', other: 'Mod+Y' };
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const CODE = '<code class="language-python" data-line-numbers="1-3|4|5-7|8-9">def halo_family():';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const js = (v) => JSON.stringify(v);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const rendered = (page) => page.evaluate('window.BeesonEditor.render()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);

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

// the editor on a deck served over HTTP, opened with text, on the slide of the element matched by
// at, with the Format tab or the Steps tab shown
async function open(t, platform, { deck = 'index.html', text = readFileSync(deck, 'utf8'), at = 'pre > code', tab = 'format', width = 1600, height = 1000 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  await page.evaluate('localStorage.clear()');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(text)})`)).problems, []);
  if (tab === 'format' && !(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
  if (tab === 'steps') await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
  await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector(${js(at)}).closest('section')).h)`);
  await sleep(150);
  await frames(page);
  return page;
}

async function undoRedo(page, platform, before, after) {
  await press(page, 'Mod+Z');
  await frames(page);
  assert.equal(await rendered(page), before, 'an undo does not give the file before the edit');
  await press(page, REDO[platform]);
  await frames(page);
  assert.equal(await rendered(page), after, 'a redo does not give the edit again');
}

// the problems of the scope rule in text that the source of the page did not have
const newProblems = (page, text) => {
  const old = textProblems(page.source, THEME);
  return textProblems(text, THEME).filter((p) => !old.includes(p));
};

// saved writes the text into a file, opens it again without problems, and checks it byte for byte
let saves = 0;
async function saved(page, text) {
  const out = await saveAndReopen(page, `r7-5-${++saves}.html`);
  assert.equal(out.text, text);
}

// selectCode selects the code box of the current slide as a block, by a click in its first line
// and Esc
async function selectCode(page) {
  const at = await page.evaluate(`(() => {
    const code = document.querySelector('.reveal section.present pre > code');
    const r = document.createRange();
    r.setStart(code.firstChild, 2);
    r.setEnd(code.firstChild, 3);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
  await click(page, at);
  await press(page, 'Escape');
  await frames(page);
}

const SMALL = `${PANEL} label:has(> input[data-command="code.small"])`;

for (const platform of PLATFORMS) {
  test(`the switch Small of the Code pane sets the code at 18 px, and off restores the tag on ${platform}`, async (t) => {
    const page = await open(t, platform);
    const source = page.source;
    await selectCode(page);
    const box = `${SMALL} input`;
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).checked`), false);
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).disabled`), false);
    const size = () => page.evaluate(`getComputedStyle(document.querySelector('.reveal section.present pre')).fontSize`);
    assert.equal(await size(), '22px');
    await click(page, SMALL);
    await frames(page);
    const small = source.replace('<pre><code class="language-python"', '<pre style="font-size: 18px"><code class="language-python"');
    assert.equal(await rendered(page), small);
    assert.equal(await size(), '18px');
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).checked`), true);
    assert.equal(await undoLabel(page), 'Undo Small Code');
    assert.deepEqual(newProblems(page, small), []);
    await undoRedo(page, platform, source, small);
    // off takes the declaration out, and the tag is as it was, byte for byte
    await click(page, SMALL);
    await frames(page);
    assert.equal(await rendered(page), source);
    assert.equal(await size(), '22px');
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).checked`), false);
    await undoRedo(page, platform, small, source);
    await click(page, SMALL);
    await frames(page);
    await saved(page, small);
    assert.deepEqual(errors(page), []);
  });

  test(`Small keeps the other declarations of the pre, and off gives its tag back byte for byte on ${platform}`, async (t) => {
    const text = readFileSync('index.html', 'utf8').replace('<pre><code class="language-python"', '<pre style="translate: 0px 12px;"><code class="language-python"');
    const page = await open(t, platform, { text });
    await selectCode(page);
    await click(page, SMALL);
    await frames(page);
    const small = await rendered(page);
    assert.match(small, /<pre style="translate: 0px 12px; font-size: 18px;?"><code class="language-python"/);
    assert.deepEqual(newProblems(page, small), []);
    await undoRedo(page, platform, text, small);
    await click(page, SMALL);
    await frames(page);
    assert.equal(await rendered(page), text);
    assert.deepEqual(errors(page), []);
  });
}

const LI1 = '<li class="fragment" data-fragment-index="1">Each step';
const LI2 = '<li class="fragment" data-fragment-index="2">Two elements';

// the rows of the Steps tab in their order: the step written on the row, its text, its chip, and
// its meta line
const rows = (page) =>
  page.evaluate(`[...document.querySelectorAll('${SIDE} .rows .row')].map((r) => ({
    step: r.dataset.step,
    text: r.querySelector('.text').textContent,
    chip: r.querySelector('.chip').textContent,
    meta: r.querySelector('.meta').textContent,
    selected: r.classList.contains('selected'),
  }))`);

// the center of a part of the first row whose text starts with text
const rowPart = (page, text, part = '.text') =>
  page.evaluate(`(() => {
    const row = [...document.querySelectorAll('${SIDE} .rows .row')].find((r) => r.querySelector('.text').textContent.startsWith(${js(text)}));
    const r = row.querySelector(${js(part)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);

// the labels of the open menu, with a mark on a dimmed item
const menuLabels = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => (i.getAttribute('aria-disabled') === 'true' ? '-' : '') + i.querySelector('.label').textContent)`);

// an item of the open menu chosen by a trusted click, 250 ms after the press that opened it
async function choose(page, label) {
  const at = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label').textContent === ${js(label)});
    if (!item || item.getAttribute('aria-disabled') === 'true') return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the open menu does not have an enabled item ${label}`);
  await sleep(300);
  await click(page, at);
  await frames(page);
}

const DELAY = `${SIDE} .detail input.delay`;
const STEPPER = `${SIDE} .detail .ed-num .stepper button`;

for (const platform of PLATFORMS) {
  test(`the Delay field of a step After Previous has a stepper in steps of 0.1 s on ${platform}`, async (t) => {
    const page = await open(t, platform, { at: 'li.fragment', tab: 'steps' });
    const source = page.source;
    await click(page, await rowPart(page, 'Two elements', '.chip'));
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    await choose(page, 'After Previous');
    const half = source.replace(LI1, LI1.replace('>', ' data-autoslide="500">'));
    assert.equal(await rendered(page), half);
    // the field is the number field of the Arrange pane, with its unit and its two arrows
    const field = () => page.evaluate(`(() => {
      const box = document.querySelector('${SIDE} .detail .ed-num');
      return { value: box.querySelector('input').value, unit: box.querySelector('.unit').textContent, arrows: [...box.querySelectorAll('.stepper button')].map((b) => b.getAttribute('aria-label') + (b.disabled ? ' (dimmed)' : '')) };
    })()`);
    assert.deepEqual(await field(), { value: '0.5', unit: 's', arrows: ['Increase Delay', 'Decrease Delay'] });
    // a click on the upper arrow adds 0.1 s
    await click(page, `${STEPPER}:first-child`);
    await frames(page);
    const more = source.replace(LI1, LI1.replace('>', ' data-autoslide="600">'));
    assert.equal(await rendered(page), more);
    assert.equal((await field()).value, '0.6');
    assert.match((await rows(page)).find((r) => r.text.startsWith('Two elements')).meta, /After Previous, 0\.6 s/);
    assert.equal(await undoLabel(page), 'Undo Set Delay of Step');
    await undoRedo(page, platform, half, more);
    // the lower arrow takes 0.1 s off, and the arrow keys of the field step it too, by 1 s with Shift
    await click(page, `${STEPPER}:last-child`);
    await frames(page);
    assert.equal(await rendered(page), half);
    await click(page, DELAY);
    await press(page, 'Shift+ArrowUp');
    await frames(page);
    assert.equal(await rendered(page), source.replace(LI1, LI1.replace('>', ' data-autoslide="1500">')));
    await press(page, 'ArrowDown');
    await frames(page);
    const typed = source.replace(LI1, LI1.replace('>', ' data-autoslide="1400">'));
    assert.equal(await rendered(page), typed);
    assert.equal((await field()).value, '1.4');
    // the shortest delay is 0.1 s, as reveal.js reads 0 as no delay
    await page.evaluate(`document.querySelector(${js(DELAY)}).select()`);
    await type(page, '0');
    await press(page, 'Enter');
    await frames(page);
    const least = source.replace(LI1, LI1.replace('>', ' data-autoslide="100">'));
    assert.equal(await rendered(page), least);
    assert.equal((await field()).value, '0.1');
    await press(page, 'Escape');
    await undoRedo(page, platform, typed, least);
    // a step at a click has the field and its arrows dimmed
    await click(page, await rowPart(page, 'When exporting'));
    await frames(page);
    assert.deepEqual(await field(), { value: '', unit: 's', arrows: ['Increase Delay (dimmed)', 'Decrease Delay (dimmed)'] });
    assert.deepEqual(newProblems(page, least), []);
    await saved(page, least);
    assert.deepEqual(errors(page), []);
  });
}

// the options of the completion list: the text of each, and whether its glyph is drawn
const options = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-complete [role=option]')].map((o) => ({ text: o.querySelector('.name').textContent, glyph: !!o.querySelector('.glyph svg') }))`);

for (const platform of PLATFORMS) {
  test(`the TeX completion list draws the glyph of each command beside its name, typeset once on ${platform}`, async (t) => {
    const page = await open(t, platform, { at: 'div.math[data-keep]' });
    await click(page, 'div.math[data-keep] mjx-container');
    await sleep(200);
    await press(page, 'Escape');
    await sleep(200);
    await click(page, `${PANEL} textarea[name="tex"]`);
    await press(page, 'Mod+ArrowDown');
    await type(page, String.raw` + \L`);
    await page.waitFor(`[...document.querySelectorAll('.beeson-complete [role=option]')].every((o) => o.querySelector('.glyph svg'))`);
    const first = await options(page);
    assert.deepEqual(first.slice(0, 3).map((o) => o.text), [String.raw`\LL`, String.raw`\Lambda`, String.raw`\le`]);
    assert.ok(first.every((o) => o.glyph), js(first));
    // the glyph is a picture beside the name, hidden from a screen reader, and the name is read
    // first in the text of an option
    assert.equal(await page.evaluate(`document.querySelector('.beeson-complete .glyph').getAttribute('aria-hidden')`), 'true');
    assert.ok((await page.evaluate(`document.querySelector('.beeson-complete [role=option]').textContent`)).startsWith(String.raw`\LL`));
    const box = await page.evaluate(`(() => { const g = document.querySelector('.beeson-complete .glyph').getBoundingClientRect(), n = document.querySelector('.beeson-complete .name').getBoundingClientRect(); return { gap: n.left - g.right, w: g.width, h: g.height }; })()`);
    assert.ok(box.gap >= 0 && box.gap < 20 && box.w > 10 && box.h > 10, js(box));
    // the command class does not draw a symbol, and its glyph is left empty. a list opened again
    // takes its glyphs from the cache, without typesetting them again
    await type(page, 'a');
    await page.waitFor(`[...document.querySelectorAll('.beeson-complete [role=option]')].every((o) => o.querySelector('.glyph svg') || o.querySelector('.name').textContent === '\\\\class')`);
    assert.ok((await options(page)).some((o) => o.text === String.raw`\class` && !o.glyph));
    await page.evaluate(`(() => { const mj = window.MathJax, f = mj.tex2svgPromise; window.typeset = 0; mj.tex2svgPromise = (...a) => { window.typeset++; return f.apply(mj, a); }; })()`);
    await press(page, 'Backspace');
    await frames(page);
    assert.deepEqual(await options(page), first);
    assert.equal(await page.evaluate('window.typeset'), 0);
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-complete')`), false);
    assert.deepEqual(errors(page), []);
  });
}

const PARA = '<p>Copy-paste the code';
const LINES = 'data-line-numbers="1-3|4|5-7|8-9"';

// the steps of the line rows, by the text of their meta line
const lineRows = async (page) => (await rows(page)).filter((r) => r.meta.startsWith('Line')).map((r) => `${r.step} ${r.meta.split(' · ')[0]}`);

// the number of lines of the code box dimmed by the highlight of the editor, or 0 without it
const dimmed = (page) => page.evaluate(`CSS.highlights.get('beeson-code-dim')?.size ?? 0`);

for (const platform of PLATFORMS) {
  test(`the line steps of a code box are rows of the Steps tab, kept in sync with its Code pane on ${platform}`, async (t) => {
    const page = await open(t, platform);
    const source = page.source;
    await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
    await frames(page);
    // each group after the first is a row at its step, and the first group is lit with the slide
    assert.deepEqual(await lineRows(page), ['0 Line 4', '1 Lines 5–7', '2 Lines 8–9']);
    const four = (await rows(page)).find((r) => r.meta.startsWith('Line 4'));
    assert.deepEqual([four.chip, four.text, four.meta], ['1', 'for z0 in np.linspace(Z_START, Z_END, STEPS + 1) / DU:', 'Line 4 · On Click · Highlight']);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-badge')].map((b) => b.textContent)`), ['1', '2', '3']);
    // a row pointed at dims the other lines of the box, as a group of the Code pane does
    const at = await rowPart(page, 'if len(members)');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
    await frames(page);
    assert.equal(await dimmed(page), 6);
    // a press selects the box, and marks the line row in place of the row of the box
    await click(page, at);
    await frames(page);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('steps.playFrom').label`), 'Play From Selected Step');
    assert.deepEqual((await rows(page)).filter((r) => r.selected).map((r) => r.meta.split(' · ')[0]), ['Lines 5–7']);
    assert.equal(await page.evaluate(`window.BeesonEditor.state('code.small').enabled`), true);
    // Delete does not take a line step off, since it is set in the Code pane
    await press(page, 'Delete');
    await frames(page);
    assert.equal(await rendered(page), source);
    // the groups typed into the Code pane are the rows, and the pane names their steps of the slide
    await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
    await frames(page);
    const field = `${PANEL} input[name="line-steps"]`;
    await page.evaluate(`document.querySelector(${js(field)}).select()`);
    await click(page, field);
    await page.evaluate(`document.querySelector(${js(field)}).select()`);
    await type(page, '1-3|4|5-9');
    await press(page, 'Enter');
    await frames(page);
    const fewer = source.replace(LINES, 'data-line-numbers="1-3|4|5-9"');
    assert.equal(await rendered(page), fewer);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-groups .at')].map((s) => s.textContent)`), ['With the slide', 'Step 1', 'Step 2']);
    await press(page, 'Escape');
    await undoRedo(page, platform, source, fewer);
    await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
    await frames(page);
    assert.deepEqual(await lineRows(page), ['0 Line 4', '1 Lines 5–9']);
    await press(page, 'Mod+Z');
    await frames(page);
    assert.deepEqual(await lineRows(page), ['0 Line 4', '1 Lines 5–7', '2 Lines 8–9']);
    assert.deepEqual(errors(page), []);
  });

  test(`the line steps of a code box move with the other steps, and are not split on ${platform}`, async (t) => {
    const text = readFileSync('index.html', 'utf8').replace(PARA, '<p class="fragment">Copy-paste the code');
    const page = await open(t, platform, { text, tab: 'steps' });
    assert.deepEqual(await lineRows(page), ['1 Line 4', '2 Lines 5–7', '3 Lines 8–9']);
    assert.equal((await rows(page)).find((r) => r.text.startsWith('Copy-paste')).step, '0');
    // the paragraph dragged under the last card is shown after the lines, and the index of the
    // code puts its line steps before it, as the highlight plugin numbers its copies of the code
    const from = await rowPart(page, 'Copy-paste', '.body');
    const to = await page.evaluate(`(() => { const c = [...document.querySelectorAll('${SIDE} .rows .card.step')].at(-1).getBoundingClientRect(); return c.bottom + 2; })()`);
    await drag(page, from, { dy: to - from.y, steps: 12 });
    await frames(page);
    const moved = await rendered(page);
    assert.equal(moved, text.replace('<p class="fragment">', '<p class="fragment" data-fragment-index="4">').replace(LINES, `${LINES} data-fragment-index="1"`));
    assert.deepEqual(await lineRows(page), ['0 Line 4', '1 Lines 5–7', '2 Lines 8–9']);
    assert.equal((await rows(page)).find((r) => r.text.startsWith('Copy-paste')).step, '3');
    assert.deepEqual(newProblems(page, moved), []);
    await undoRedo(page, platform, text, moved);
    // a step put between two line steps is refused, and the file is kept
    await click(page, await rowPart(page, 'Copy-paste'));
    await press(page, 'Alt+ArrowUp');
    await frames(page);
    assert.equal(await rendered(page), moved);
    assert.match(await page.evaluate('window.BeesonEditor.status().message'), /another step cannot be put between them/);
    // All at Once keeps the line steps, which are set in the Code pane
    await page.evaluate(`window.BeesonEditor.exec('steps.allAtOnce')`);
    await frames(page);
    const once = await rendered(page);
    assert.equal(once, text.replace('<p class="fragment">', '<p>').replace(LINES, `${LINES} data-fragment-index="1"`));
    assert.deepEqual(await lineRows(page), ['0 Line 4', '1 Lines 5–7', '2 Lines 8–9']);
    await undoRedo(page, platform, moved, once);
    await saved(page, once);
    assert.deepEqual(errors(page), []);
  });

  test(`Play From plays the steps of the slide in place from the chosen step on ${platform}`, async (t) => {
    // the deck is served with the paragraph as a fragment, since the preview plays the page
    const text = readFileSync('index.html', 'utf8').replace(PARA, '<p class="fragment">Copy-paste the code');
    const deck = `.play-from-${process.pid}-${platform}.html`;
    writeFileSync(deck, text);
    t.after(() => rmSync(deck, { force: true }));
    const page = await open(t, platform, { deck, tab: 'steps' });
    const play = `${SIDE} .head .play`;
    const label = () => page.evaluate(`document.querySelector(${js(play)}).textContent`);
    assert.equal(await label(), 'Preview');
    // a chosen row turns the button into Play From, as in the Animation Pane of PowerPoint
    await click(page, await rowPart(page, 'if len(members)'));
    await frames(page);
    assert.equal(await label(), 'Play From');
    await click(page, play);
    await frames(page);
    // the slide starts at the step before the chosen one: the paragraph and line 4 are shown
    const state = () => page.evaluate(`({ step: document.documentElement.dataset.previewStep, playing: document.documentElement.classList.contains('beeson-previewing'), para: !document.querySelector('.reveal section.present p.fragment').classList.contains('beeson-pv-off') })`);
    assert.deepEqual(await state(), { step: '2', playing: true, para: true });
    assert.equal(await dimmed(page), 8);
    assert.equal(await label(), 'Stop');
    await page.waitFor(`document.documentElement.dataset.previewStep === '3'`, 3000);
    assert.equal(await dimmed(page), 6);
    await page.waitFor(`document.documentElement.dataset.previewStep === '4'`, 3000);
    assert.equal(await dimmed(page), 7);
    await page.waitFor(`!document.documentElement.classList.contains('beeson-previewing')`, 4000);
    assert.equal(await dimmed(page), 0);
    assert.equal(await label(), 'Play From');
    // the chip menu of a row ends with Play From its step, before the delivery of a list, and a
    // line row has only this item
    await click(page, await rowPart(page, 'Copy-paste', '.chip'));
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    assert.equal((await menuLabels(page)).at(-1), 'Play From Step 1');
    await press(page, 'Escape');
    await click(page, await rowPart(page, 'members.append', '.chip'));
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    assert.deepEqual(await menuLabels(page), ['Play From Step 4']);
    await choose(page, 'Play From Step 4');
    assert.deepEqual(await state(), { step: '3', playing: true, para: true });
    // Esc stops the preview, and the file is not changed
    await press(page, 'Escape');
    await frames(page);
    assert.equal((await state()).playing, false);
    assert.equal(await dimmed(page), 0);
    // a row shown with the slide has Play From dimmed
    await click(page, await rowPart(page, 'Code boxes', '.chip'));
    await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    assert.equal((await menuLabels(page)).at(-1), '-Play From Step');
    await press(page, 'Escape');
    assert.equal(await rendered(page), text);
    assert.deepEqual(errors(page), []);
  });
}
