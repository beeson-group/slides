// regression tests of R15.3 on both platforms: the end of the show played by Present at a click
// past its last step, a new text box kept in its place at its first input, and Distribute with a
// group in the selection

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const FIGURES = 4;
const LAST = 11;

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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)})`).then(() => frames(page));
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

// the editor on slide n of the demo deck, served over HTTP
async function load(t, platform, n = 0) {
  const text = readFileSync('index.html', 'utf8');
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the frame of the show played by Present
const SHOW = `document.querySelector('.beeson-edit-show iframe')?.contentWindow`;
const showReady = `(() => { try { const w = ${SHOW}; return !!w?.Reveal?.isReady() && (!w.MathJax || (w.MathJax.startup?.promise?.then(() => true) ?? false)); } catch { return false; } })()`;
const showing = (page) => page.evaluate(`!!document.querySelector('.beeson-edit-show')`);
async function present(t, platform, n) {
  const page = await load(t, platform, n);
  await press(page, 'Mod+Enter');
  await page.waitFor(showReady, 20000);
  await sleep(300);
  return page;
}

// a point of the slide shown by the show, on the heading of slide 11 and away from its video
const slidePoint = { x: 400, y: 180 };

// finding opus 3 of round 6: a click past the last step of the last slide left the show up, while a
// key forward ended it. a click plays the steps of slide 11 first, and a deck opened by itself
// stays at its last slide at a click
for (const platform of PLATFORMS) {
  test(`the show played by Present returns to the editor at a click past its last step (${platform})`, async (t) => {
    const page = await present(t, platform, LAST - 1);
    const at = () => page.evaluate(`${SHOW}.Reveal.getIndices().h`);
    assert.equal(await page.evaluate(`${SHOW}.Reveal.availableFragments().next`), true, 'slide 11 does not have steps');
    await click(page, slidePoint);
    await sleep(300);
    assert.equal(await at(), LAST - 1, 'a step of slide 11 is skipped');
    for (let i = 0; i < 10 && (await at()) < LAST; i++) {
      await click(page, slidePoint);
      await sleep(300);
    }
    assert.equal(await at(), LAST);
    assert.equal(await showing(page), true, 'the show ends at the arrival on its last slide');
    for (let i = 0; i < 4 && (await showing(page)); i++) {
      await click(page, slidePoint);
      await sleep(300);
    }
    assert.equal(await showing(page), false, 'four clicks at the last slide do not end the show');
    assert.equal(await page.evaluate('Reveal.getIndices().h'), LAST);
    await byteExact(page);
    assert.deepEqual(errors(page), []);

    const deck = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => deck.close().catch(() => {}));
    await deck.goto(`${server.origin}/index.html?still#/${LAST}`);
    await deck.waitFor(deckSettled);
    for (let i = 0; i < 3; i++) {
      await click(deck, slidePoint);
      await sleep(200);
    }
    assert.equal(await deck.evaluate('Reveal.getIndices().h'), LAST);
    assert.equal(await deck.evaluate('location.search'), '?still');
    assert.deepEqual(errors(deck), []);
  });
}

// the box on the screen of the new text box of the current slide, empty or written
const BOX = `(() => {
  const s = Reveal.getCurrentSlide();
  const p = s.querySelector('p.beeson-pending') ?? [...s.querySelectorAll('p')].find((e) => e.textContent.startsWith('H'));
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return { left: r.left, top: r.top, pending: p.classList.contains('beeson-pending') };
})()`;
const boxOf = (page) => page.evaluate(BOX);
const undo = (page) => press(page, 'Mod+Z').then(() => sleep(200));
const redo = (page) => press(page, 'Mod+Shift+Z').then(() => sleep(200));

// a trusted Mod+key with the editing command of the browser, e.g. paste
async function command(page, platform, key, name) {
  const base = { key, code: `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), modifiers: platform === 'mac' ? 4 : 2 };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, commands: [name] });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

const kept = (a, b, what) => assert.ok(a && b && near(a.left, b.left, 0.6) && near(a.top, b.top, 0.6), `${what} moves the text box from ${js(a)} to ${js(b)}`);

// finding opus 4 of round 6: the empty box was drawn with a margin of 24 px above it, and the text
// box written at its first key with the margin of the theme, which moved it up
for (const platform of PLATFORMS) {
  test(`a new text box stays in its place at its first key and after an undo of its typing (${platform})`, async (t) => {
    for (const n of [FIGURES, 1, 9]) {
      const page = await load(t, platform, n);
      await click(page, '.beeson-edit-top [data-command="insert.text"]');
      await sleep(200);
      const empty = await boxOf(page);
      assert.equal(empty?.pending, true, `Text does not add an empty text box on slide ${n + 1}`);
      await type(page, 'H');
      await sleep(300);
      const first = await boxOf(page);
      kept(empty, first, `the first key on slide ${n + 1}`);
      const written = await render(page);
      await sleep(1200);
      await type(page, 'ello');
      await sleep(300);
      kept(empty, await boxOf(page), `typing on slide ${n + 1}`);
      await undo(page);
      assert.equal(await render(page), written);
      kept(empty, await boxOf(page), `an undo of the typing on slide ${n + 1}`);
      await undo(page);
      await byteExact(page);
      await redo(page);
      assert.equal(await render(page), written);
      kept(empty, await boxOf(page), `a redo of the text box on slide ${n + 1}`);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  test(`a new text box stays in its place at a paste (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
    await page.evaluate(`navigator.clipboard.writeText('Hello')`);
    await click(page, '.beeson-edit-top [data-command="insert.text"]');
    await sleep(200);
    const empty = await boxOf(page);
    assert.equal(empty?.pending, true);
    await command(page, platform, 'v', 'paste');
    await sleep(300);
    const pasted = await boxOf(page);
    assert.equal(pasted?.pending, false, 'the paste is not written');
    kept(empty, pasted, 'the paste');
    assert.match(await render(page), /<p[^>]*>Hello<\/p>/);
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });
}

// the boxes of the heading, the group of the paragraph and the figure, and the list of slide 5, in
// slide px. the box of the figure is its frame, i.e. the picture as it is fitted into the image and
// the caption under it
const OBJECTS = `(() => {
  const s = document.querySelector('.reveal .slides');
  const S = s.getBoundingClientRect(), k = S.width / s.offsetWidth;
  const rect = (e) => {
    if (e.localName !== 'figure') return e.getBoundingClientRect();
    const img = [...e.querySelectorAll('img')].find((i) => i.getBoundingClientRect().width);
    const r = img.getBoundingClientRect(), c = e.querySelector('figcaption')?.getBoundingClientRect();
    const f = getComputedStyle(img).objectFit === 'contain' ? Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight) : 0;
    const w = f ? img.naturalWidth * f : r.width, h = f ? img.naturalHeight * f : r.height;
    const left = r.left + (r.width - w) / 2, top = r.top + (r.height - h) / 2;
    return { left, top, right: Math.max(left + w, c?.right ?? 0), bottom: Math.max(top + h, c?.bottom ?? 0) };
  };
  const box = (...els) => {
    const rs = els.map(rect);
    const left = Math.min(...rs.map((r) => r.left)), top = Math.min(...rs.map((r) => r.top));
    const right = Math.max(...rs.map((r) => r.right)), bottom = Math.max(...rs.map((r) => r.bottom));
    return { left: (left - S.left) / k, top: (top - S.top) / k, right: (right - S.left) / k, bottom: (bottom - S.top) / k };
  };
  const c = Reveal.getCurrentSlide();
  const p = c.querySelector(':scope > p'), f = c.querySelector(':scope > figure');
  return { h2: box(c.querySelector(':scope > h2')), group: box(p, f), p: box(p), f: box(f), ul: box(c.querySelector(':scope > ul')) };
})()`;

// the paragraph and the figure of slide 5 grouped, and the heading and the list added to the
// selection
async function groupAndSelect(page, platform) {
  await click(page, 'section.present figure img.for-light');
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  await press(page, platform === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  assert.equal(await page.evaluate('Reveal.getCurrentSlide().querySelectorAll("[data-group]").length'), 2);
  await click(page, 'section.present h2', { modifiers: 'Shift' });
  await click(page, 'section.present > ul > li', { modifiers: 'Shift' });
  await frames(page);
}

// D23 of round 6: Distribute Vertically with a group moved the group above the slide and outside the
// span of the selection
for (const platform of PLATFORMS) {
  test(`Distribute with a group keeps every object in the span of the selection and the outer two in place (${platform})`, async (t) => {
    for (const [axis, start, end] of [['vertical', 'top', 'bottom'], ['horizontal', 'left', 'right']]) {
      const page = await load(t, platform, FIGURES);
      await groupAndSelect(page, platform);
      const grouped = await render(page);
      const b0 = await page.evaluate(OBJECTS);
      const all = [b0.h2, b0.group, b0.ul];
      const span = [Math.min(...all.map((b) => b[start])), Math.max(...all.map((b) => b[end]))];
      // the outer two are the first and the last in the order of their start
      const order = ['h2', 'group', 'ul'].sort((a, b) => b0[a][start] - b0[b][start] || (b0[a][end] - b0[a][start]) - (b0[b][end] - b0[b][start]));
      await exec(page, `arrange.distribute.${axis}`);
      const b = await page.evaluate(OBJECTS);
      for (const name of ['h2', 'group', 'ul']) {
        assert.ok(b[name][start] >= span[0] - 1 && b[name][end] <= span[1] + 1, `Distribute ${axis} puts the ${name} at ${js(b[name])}, outside ${js(span)}`);
        assert.ok(b[name].top >= -1 && b[name].left >= -1, `Distribute ${axis} puts the ${name} off the slide at ${js(b[name])}`);
      }
      for (const name of [order[0], order[2]]) assert.ok(near(b[name][start], b0[name][start]), `Distribute ${axis} moves the outer ${name} from ${js(b0[name])} to ${js(b[name])}`);
      // the members of the group keep their places in it
      assert.ok(near(b.f.left - b.p.left, b0.f.left - b0.p.left) && near(b.f.top - b.p.top, b0.f.top - b0.p.top), `the members of the group are moved apart: ${js({ b0, b })}`);
      const edited = await render(page);
      await undo(page);
      assert.equal(await render(page), grouped);
      await redo(page);
      assert.equal(await render(page), edited);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

const DISTRIBUTE = ['horizontal', 'vertical', 'evenly'].map((k) => `arrange.distribute.${k}`);
const PANEL = '#beeson-edit-panel-format';
// whether each Distribute command is enabled, and whether its button of the Arrange pane is
const distributeOn = async (page) => {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  return page.evaluate(`${js(DISTRIBUTE)}.map((id) => [window.BeesonEditor.state(id).enabled, !document.querySelector('${PANEL} [data-command="' + id + '"]')?.disabled])`);
};

// finding qwen3 73 of round 6: with one selected object, the three Distribute commands were enabled
// and moved it, where Keynote dims Distribute for fewer than three objects
for (const platform of PLATFORMS) {
  test(`Distribute is dimmed for one selected object, a group among them, and acts on three (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    const off = DISTRIBUTE.map(() => [false, false]);
    await click(page, 'section.present figure img.for-light');
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 1);
    assert.deepEqual(await distributeOn(page), off, 'Distribute is enabled for one figure');
    for (const id of DISTRIBUTE) await exec(page, id);
    await byteExact(page);
    await groupAndSelect(page, platform);
    // the group alone is one object
    await click(page, 'section.present > ul > li');
    await click(page, 'section.present figure img.for-light');
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 2);
    assert.deepEqual(await distributeOn(page), off, 'Distribute is enabled for one group');
    await click(page, 'section.present h2', { modifiers: 'Shift' });
    await click(page, 'section.present > ul > li', { modifiers: 'Shift' });
    await frames(page);
    assert.deepEqual(await distributeOn(page), DISTRIBUTE.map(() => [true, true]), 'Distribute is dimmed for three objects');
    assert.deepEqual(errors(page), []);
  });
}
