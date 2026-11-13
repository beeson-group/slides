// regression tests of R21.3 on both platforms with trusted input. a group that holds a line is
// turned as one entry, and the tab keeps answering (V11, V19). Regroup of an inner group gives back
// the lists that Ungroup took (V12). a layer command does not put an element under a backdrop
// (V20). a copy of a selection inside an entered group is one group (V13), and a change of the
// kind of a turned line keeps its ends on the slide (V6)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, type } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-r21-3.html';
const SOURCE = readFileSync(DECK, 'utf8');
const [LINED, LEVELS, BACKDROP, ENTERED] = [0, 1, 2, 3];
const PLATFORMS = ['mac', 'other'];
const GROUP = { mac: 'Mod+Alt+G', other: 'Mod+G' };
const REGROUP = { mac: 'Mod+Alt+J', other: 'Mod+Shift+J' };
const S = '.reveal section.present';

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
const sel = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName + '[' + (e.getAttribute('data-group') ?? '') + ']')`);
// the classes of the selected elements in the file, without those of the editor
const classes = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => [...e.classList].filter((c) => !c.startsWith('beeson-')).join(' ')).join()`);

// the promise p, or a failure once ms pass, so that a frozen tab fails its test and does not hang
// the run
function bounded(p, what, ms = 8000) {
  let timer;
  const late = new Promise((_, fail) => (timer = setTimeout(() => fail(new Error(`${what} did not answer within ${ms} ms`)), ms)));
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

// the deck opened with the editor at slide n
async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = SOURCE;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(SOURCE)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the point at the fractions u and v of the box of the element of selector on the current slide
const at = (page, selector, u = 0.5, v = 0.5) =>
  page.evaluate(`(() => { const r = document.querySelector(${js(`${S} ${selector}`)}).getBoundingClientRect(); return { x: r.left + ${u} * r.width, y: r.top + ${v} * r.height }; })()`);

// the turn of run, each step bounded, after which the tab answers, the line is turned, and one undo
// gives the text before
async function turnsOnce(page, what, run) {
  const before = await render(page);
  await bounded(run(), what);
  await bounded(frames(page), `a frame after ${what}`);
  assert.equal(await bounded(page.evaluate('1 + 1'), `the page after ${what}`), 2);
  const edited = await render(page);
  assert.notEqual(edited, before, `${what} did not change the text`);
  assert.match(edited, /<svg class="line"[^>]*style="[^"]*rotate: /, `${what} did not turn the line`);
  await bounded(undo(page), `the undo of ${what}`);
  assert.equal(await render(page), before, `one undo does not give the text before ${what}`);
  await bounded(redo(page), `the redo of ${what}`);
  assert.equal(await render(page), edited);
  await bounded(undo(page), `the undo of ${what}`);
  await bounded(frames(page), `a frame after the undo of ${what}`);
}

// a drag of the shown rotate handle by deg degrees about the center of the frame of the selection
async function dragRotor(page, deg) {
  const o = await page.evaluate(`(() => {
    const mid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const shown = (el) => !el.hidden && el.getClientRects().length > 0;
    return { c: mid([...document.querySelectorAll('.beeson-frame.union, .beeson-frame.selected')].find(shown)), r: mid([...document.querySelectorAll('.beeson-rotor')].find(shown)) };
  })()`);
  const radius = Math.hypot(o.r.x - o.c.x, o.r.y - o.c.y), from = Math.atan2(o.r.y - o.c.y, o.r.x - o.c.x);
  await mouse(page, 'mouseMoved', o.r.x, o.r.y);
  await mouse(page, 'mousePressed', o.r.x, o.r.y, { button: 'left', buttons: 1, clickCount: 1 });
  let to = o.r;
  for (let i = 1; i <= 10; i++) {
    const a = from + ((deg * Math.PI) / 180) * (i / 10);
    to = { x: o.c.x + radius * Math.cos(a), y: o.c.y + radius * Math.sin(a) };
    await mouse(page, 'mouseMoved', to.x, to.y, { button: 'left', buttons: 1 });
  }
  await frames(page);
  await mouse(page, 'mouseReleased', to.x, to.y, { button: 'left', buttons: 0, clickCount: 1 });
}

// value typed into the field id of the Arrange pane
async function typeField(page, id, value) {
  await page.evaluate(`[...document.querySelectorAll('#beeson-edit-panel-format .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
}

for (const platform of PLATFORMS) {
  test(`V11: a group of a figure and a line is turned by Rotate Right, Rotate Left, the field, and the handle as one entry (${platform})`, async (t) => {
    const page = await load(t, platform, LINED);
    await click(page, `${S} figure img`);
    assert.deepEqual(await sel(page), ['figure[g6]', 'svg[g6]']);
    await turnsOnce(page, 'Rotate Right 90°', () => exec(page, 'arrange.rotateRight'));
    await turnsOnce(page, 'Rotate Left 90°', () => exec(page, 'arrange.rotateLeft'));
    await turnsOnce(page, 'the field Rotation', () => typeField(page, 'angle', 90));
    await turnsOnce(page, 'the rotate handle', () => dragRotor(page, 45));
    assert.deepEqual(errors(page), []);
  });

  test(`V19: Select All, Group, and Rotate Right 90° turn a slide with a line as one entry (${platform})`, async (t) => {
    const page = await load(t, platform, LINED);
    await click(page, `${S} figure img`);
    await press(page, 'Mod+A');
    await press(page, GROUP[platform]);
    await frames(page);
    const listed = await sel(page);
    assert.equal(listed.length, 4);
    assert.equal(new Set(listed.map((s) => s.replace(/^\w+\[(\w+).*$/, '$1'))).size, 1, 'Group did not make one group');
    await turnsOnce(page, 'Rotate Right 90°', () => exec(page, 'arrange.rotateRight'));
    assert.deepEqual(errors(page), []);
  });

  // the lists of the four shapes of the slide of three levels
  const lists = (page) => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll('.shape')].map((e) => e.getAttribute('data-group'))`);
  for (const [clicks, way] of [[2, 'exec'], [2, 'key'], [3, 'exec']]) {
    test(`V12: Regroup by ${way} after Ungroup of the group selected by ${clicks} clicks gives back the lists byte for byte (${platform})`, async (t) => {
      const page = await load(t, platform, LEVELS);
      const P = await at(page, '.shape.tone-accent');
      for (let i = 0; i < clicks; i++) {
        await click(page, P);
        await frames(page);
      }
      assert.equal((await sel(page)).length, clicks === 2 ? 3 : 2);
      await exec(page, 'arrange.ungroup');
      assert.deepEqual(await lists(page), clicks === 2 ? ['g5 g3', 'g5 g3', 'g5', 'g5'] : ['g5 g4', 'g5 g4', 'g5 g4', 'g5']);
      const ungrouped = await render(page);
      if (way === 'key') await press(page, REGROUP[platform]);
      else await exec(page, 'arrange.regroup');
      await frames(page);
      assert.deepEqual(await lists(page), ['g5 g4 g3', 'g5 g4 g3', 'g5 g4', 'g5']);
      assert.equal(await render(page), SOURCE);
      await undo(page);
      assert.equal(await render(page), ungrouped);
      await redo(page);
      assert.equal(await render(page), SOURCE);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`V20: Send to Back puts a shape just over the backdrop, where a click selects it (${platform})`, async (t) => {
    const page = await load(t, platform, BACKDROP);
    const late = '.shape.rounded';
    // the right of the shape, which the blue shape does not cover
    const alone = await at(page, late, 0.85, 0.5);
    await click(page, alone);
    assert.equal(await classes(page), 'shape rounded tone-accent');
    assert.equal((await state(page, 'arrange.order.back')).enabled, true);
    await exec(page, 'arrange.order.back');
    await frames(page);
    const edited = await render(page);
    assert.doesNotMatch(edited, /z-index: -/);
    // the shape is drawn under the blue shape and over the backdrop
    const hit = (p) => page.evaluate(`document.elementFromPoint(${p.x}, ${p.y})?.closest('.shape, .backdrop')?.classList.value.replace(/ beeson-[\\w-]+/g, '') ?? null`);
    assert.equal(await hit(alone), 'shape rounded tone-accent');
    assert.equal(await hit(await at(page, late, 0.1, 0.5)), 'shape tone-blue');
    assert.equal((await state(page, 'arrange.order.back')).enabled, false);
    assert.equal((await state(page, 'arrange.order.backward')).enabled, false);
    await click(page, `${S} h2`);
    await click(page, alone);
    assert.equal(await classes(page), 'shape rounded tone-accent');
    await drag(page, alone, { dx: -50, dy: 0 });
    await frames(page);
    assert.match(await render(page), /data-cx="0\.97"/);
    await undo(page);
    await undo(page);
    assert.equal(await render(page), SOURCE);
    assert.deepEqual(errors(page), []);
  });

  test(`V20: Send Backward and Send to Back do not pass the backdrop (${platform})`, async (t) => {
    const page = await load(t, platform, BACKDROP);
    await click(page, await at(page, '.shape.tone-blue', 0.2, 0.5));
    assert.equal(await classes(page), 'shape tone-blue');
    assert.equal((await state(page, 'arrange.order.backward')).enabled, false);
    assert.equal((await state(page, 'arrange.order.back')).enabled, false);
    await exec(page, 'arrange.order.backward');
    await exec(page, 'arrange.order.back');
    assert.equal(await render(page), SOURCE);
  });

  // the lists of the shapes of the slide of the entered group, each copy after its original
  const copied = (page) => page.evaluate(`[...Reveal.getCurrentSlide().querySelectorAll(':scope > .shape')].map((e) => e.getAttribute('data-group'))`);
  for (const how of ['Duplicate', 'Copy and Paste', 'a copy by a drag']) {
    test(`V13: ${how} of an inner group inside an entered group is one group that one Ungroup takes apart (${platform})`, async (t) => {
      const page = await load(t, platform, ENTERED);
      const A = await at(page, '.shape.tone-accent');
      await click(page, A);
      await click(page, A);
      await frames(page);
      assert.deepEqual(await sel(page), ['div[g2 g1]', 'div[g2 g1]']);
      if (how === 'Duplicate') await exec(page, 'edit.duplicate');
      else if (how === 'Copy and Paste') {
        await exec(page, 'edit.copy');
        await exec(page, 'edit.paste');
      } else await drag(page, A, { dx: -40, dy: 200, modifiers: platform === 'mac' ? 'Alt' : 'Ctrl' });
      await frames(page);
      const copies = (await copied(page)).filter((g) => g !== 'g2 g1');
      assert.equal(copies.length, 2, `${how} did not make two copies`);
      assert.match(copies[0] ?? '', /^g\d+$/, `the copies of ${how} are not one group of one level`);
      assert.equal(copies[0], copies[1]);
      assert.ok(!['g1', 'g2'].includes(copies[0]));
      await exec(page, 'arrange.ungroup');
      assert.deepEqual((await copied(page)).filter((g) => g !== 'g2 g1'), [null, null]);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`V13: Duplicate of a member selected by itself inside its groups gives a copy outside every group (${platform})`, async (t) => {
    const page = await load(t, platform, ENTERED);
    const A = await at(page, '.shape.tone-accent');
    for (let i = 0; i < 3; i++) {
      await click(page, A);
      await frames(page);
    }
    assert.deepEqual(await sel(page), ['div[g2 g1]']);
    await exec(page, 'edit.duplicate');
    assert.deepEqual(await copied(page), ['g2 g1', null, 'g2 g1']);
  });

  test(`V6: a change of kind of a turned line keeps its ends on the slide (${platform})`, async (t) => {
    const page = await load(t, platform, LINED);
    await exec(page, 'insert.arrow', { from: { x: 300, y: 600 }, to: { x: 1100, y: 600 } });
    await frames(page);
    assert.deepEqual(await sel(page), ['svg[]']);
    await exec(page, 'arrange.setRotation', { deg: 30 });
    await frames(page);
    // the ends of the stroke of the selected line on the screen
    const ends = () => page.evaluate(`(() => {
      const s = window.BeesonEditor.selection()[0].querySelector(':scope > line, :scope > path'), m = s.getScreenCTM();
      return [s.getPointAtLength(0), s.getPointAtLength(s.getTotalLength())].map((p) => new DOMPoint(p.x, p.y).matrixTransform(m)).map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
    })()`);
    const was = await ends();
    const turned = await render(page);
    for (const kind of ['curve', 'elbow', 'straight', 'elbow', 'curve']) {
      await exec(page, `line.kind.${kind}`);
      await frames(page);
      for (const [i, p] of (await ends()).entries()) {
        assert.ok(Math.hypot(p[0] - was[i][0], p[1] - was[i][1]) < 1.5, `the end ${i} of the ${kind} is at ${p}, not at ${was[i]}`);
      }
    }
    for (let i = 0; i < 5; i++) await undo(page);
    assert.equal(await render(page), turned);
    assert.deepEqual(errors(page), []);
  });
}
