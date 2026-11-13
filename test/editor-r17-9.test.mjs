// regression tests of R17.9 on both platforms, after the entries N2 and N3 of the checks of round 7
// and a note of R16.1: a typed Width or Height of a turned figure keeps its X and Y, a group turned
// and reset gives back the file before the turns, and Esc during a drag of the rotate handle puts
// both images of the other mode and of the shown mode back

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, type } from './helpers/editor.mjs';

const DECK = 'test-deck.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const IMG = 'section.present figure img.for-light';
const PLATFORMS = ['mac', 'other'];
const STOCK = readFileSync(DECK, 'utf8');
// the demo deck in the form that the editor saved before round 7, with both images of the figure
// turned by 20 degrees
const LEGACY = STOCK.replace('light version">', 'light version" style="rotate: 20deg">').replace('dark version">', 'dark version" style="rotate: 20deg">');

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
const near = (a, b, d) => Math.abs(a - b) <= d;
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const enabled = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)}).enabled`);

const PANEL = '#beeson-edit-panel-format';
async function fieldValue(page, id) {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === 'Arrange')?.click()`);
  await frames(page);
  return Number(await page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value`));
}
async function typeField(page, id, value) {
  await fieldValue(page, id);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}
const fields = async (page) => ({ x: await fieldValue(page, 'x'), y: await fieldValue(page, 'y'), w: await fieldValue(page, 'width'), h: await fieldValue(page, 'height') });

// the editor on the demo deck at the figures slide, opened from text, with the script prep run on
// the page before the open
async function load(t, platform, text = STOCK, prep = '') {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  if (prep) await page.evaluate(prep);
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await frames(page);
  return page;
}

// one undo gives the text before, and one redo the edited text, byte for byte
async function undoes(page, before, what) {
  const edited = await render(page);
  assert.notEqual(edited, before, `${what} did not change the text`);
  await undo(page);
  assert.equal(await render(page), before, `an undo of ${what}`);
  await redo(page);
  assert.equal(await render(page), edited, `a redo of ${what}`);
  return edited;
}

// the start tags of the figure and of its two images in the text, and the computed angles of the three
async function figureState(page) {
  const text = await render(page);
  const start = text.indexOf('<figure class="zone"');
  const tags = text.slice(start, text.indexOf('</figure>', start)).match(/<(figure|img)\b[^>]*>/g);
  const turned = await page.evaluate(`(() => { const f = document.querySelector('section.present figure'); return [f, ...f.querySelectorAll('img')].map((el) => getComputedStyle(el).rotate); })()`);
  return { tags, turned };
}

// the paragraph and the figure of the figures slide made one group with the key of Group
async function groupOnFigures(page, platform) {
  await click(page, IMG);
  const p = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector(':scope > p').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
  await click(page, p, { modifiers: 'Shift' });
  await press(page, platform === 'mac' ? 'Alt+Mod+G' : 'Mod+G');
  await frames(page);
}

// a drag of the shown rotate handle by deg degrees about the center of the frame of the
// selection, with the button held at the end where hold is set
async function dragRotor(page, deg, hold = false) {
  const o = await page.evaluate(`(() => {
    const mid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const shown = (el) => !el.hidden && el.getClientRects().length > 0;
    return { c: mid([...document.querySelectorAll('.beeson-frame.union, .beeson-frame.selected')].find(shown)), r: mid([...document.querySelectorAll('.beeson-rotor')].find(shown)) };
  })()`);
  const mouse = (type, x, y, extra) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const radius = Math.hypot(o.r.x - o.c.x, o.r.y - o.c.y), from = Math.atan2(o.r.y - o.c.y, o.r.x - o.c.x);
  await mouse('mouseMoved', o.r.x, o.r.y, {});
  await mouse('mousePressed', o.r.x, o.r.y, { button: 'left', buttons: 1, clickCount: 1 });
  let at = o.r;
  for (let i = 1; i <= 10; i++) {
    const a = from + ((deg * Math.PI) / 180) * (i / 10);
    at = { x: o.c.x + radius * Math.cos(a), y: o.c.y + radius * Math.sin(a) };
    await mouse('mouseMoved', at.x, at.y, { button: 'left', buttons: 1 });
  }
  await frames(page);
  if (!hold) await mouse('mouseReleased', at.x, at.y, { button: 'left', buttons: 0, clickCount: 1 });
  await frames(page);
  return at;
}

for (const platform of PLATFORMS) {
  // N2: at 90 degrees, a typed Width of 500 moved the figure from X 1200 and Y 160 to 1195 and 155,
  // and a typed Height of 800 to 1220 and 180
  test(`a typed Width or Height of a turned figure keeps its X and Y (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    for (const deg of [30, 90, 200]) {
      await typeField(page, 'angle', deg);
      const rest = await fields(page);
      for (const [id, v] of [['width', 500], ['height', 800]]) {
        const before = await render(page);
        await typeField(page, id, v);
        const f = await fields(page);
        assert.ok(near(f.x, rest.x, 1) && near(f.y, rest.y, 1), `a typed ${id} at ${deg} degrees moved the figure from ${js(rest)} to ${js(f)}`);
        assert.ok(near(f[id === 'width' ? 'w' : 'h'], v, 1), `a typed ${id} of ${v} at ${deg} degrees reads ${js(f)}`);
        assert.equal(await fieldValue(page, 'angle'), deg);
        await undoes(page, before, `a typed ${id} at ${deg} degrees`);
        await undo(page);
      }
    }
    assert.deepEqual(errors(page), []);
  });

  // N3: a group turned to 30, then to 75, and reset kept translate: 1px 0px on the figure
  test(`a group turned by the field Angle or by its rotate handle and then reset gives back the file before the turns (${platform})`, async (t) => {
    const page = await load(t, platform);
    await groupOnFigures(page, platform);
    const grouped = await render(page);
    assert.notEqual(grouped, STOCK);
    await typeField(page, 'angle', 30);
    await typeField(page, 'angle', 75);
    const turned = await render(page);
    await exec(page, 'arrange.resetRotation');
    await frames(page);
    assert.equal(await render(page), grouped, 'Reset Rotation after the turns to 30 and to 75');
    await undoes(page, turned, 'Reset Rotation');

    await exec(page, 'arrange.resetRotation');
    for (const deg of [25, 40, -50]) await dragRotor(page, deg);
    assert.notEqual(await fieldValue(page, 'angle'), 0);
    await typeField(page, 'angle', 0);
    assert.equal(await render(page), grouped, 'a typed 0 after three turns by the rotate handle');
    assert.deepEqual(errors(page), []);
  });

  // the note of R16.1: a cancelled drag of the rotate handle put the shown image back and left the
  // image of the other mode turned
  for (const route of ['figure of a deck with turned images', 'picture selected alone']) {
    test(`Esc during a drag of the rotate handle of a ${route} puts the page and the file back (${platform})`, async (t) => {
      const legacy = route.startsWith('figure');
      const page = legacy
        ? await load(t, platform, LEGACY, `document.querySelectorAll('figure.zone > img').forEach((i) => i.setAttribute('style', 'rotate: 20deg'))`)
        : await load(t, platform);
      await click(page, IMG);
      if (!legacy) await click(page, IMG);
      const was = await figureState(page);
      const at = await dragRotor(page, 40, true);
      const during = await figureState(page);
      assert.notDeepEqual(during.turned, was.turned, 'the drag did not turn the figure');
      await press(page, 'Escape');
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', buttons: 0, clickCount: 1 });
      await frames(page);
      const now = await figureState(page);
      assert.deepEqual(now.turned, was.turned, `after Esc the figure and its images are drawn at ${js(now.turned)}, not ${js(was.turned)}`);
      assert.equal(await render(page), page.source, 'the text after Esc');
      assert.equal(await fieldValue(page, 'angle'), legacy ? 20 : 0);
      assert.deepEqual(errors(page), []);
    });
  }
}
