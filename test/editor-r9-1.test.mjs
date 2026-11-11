// regression tests of R9.1 on both platforms and in both modes, with trusted input. a resize of a
// figure by each of its grips draws the frame around the picture and its caption at their new size,
// with the grip at the pointer, the side across from it in place, and the caption under the picture
// by the layout. a turned figure with its caption is framed upright around both, a turned group keeps
// its frame turned with its grips on it, and its W and H fields scale it, and a turn of a group turns
// the image of each mode. after each edit the file is checked byte for byte after an undo and the
// edit again after a redo, and a saved text is opened again without problems

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const MODES = ['dark', 'light'];
const DECK = 'test/pages/editor-r8-5.html';
const GROUP_DECK = 'test/pages/editor-r9-1.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
const QR = '.reveal section.present > .qr';
const ZONE_PAIR = 0, ZONE_ONE = 1, PLATE_PAIR = 2, PLATE_ONE = 3;
const FIGURES = [ZONE_PAIR, ZONE_ONE, PLATE_PAIR, PLATE_ONE];
const NAMES = ['a pair in a zone', 'one image in a zone', 'a pair in a plate', 'one image in a plate'];
const PAIRS = [ZONE_PAIR, PLATE_PAIR];
const IMG = '.reveal section.present img';
const FRAME = '.beeson-overlay > .beeson-frame.selected';
const UNION = '.beeson-overlay > .beeson-frame.union';
const PANEL = '#beeson-edit-panel-format';
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
// the side of the frame that each grip moves on each axis, -1 at the left or top
const SIGN = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
// the modifier that turns the snap off, held in every drag so that the pointer alone sets the size
const FREE = { mac: 'Meta', other: 'Alt' };
// the gap of the theme between a picture and its caption in a zone, in slide px
const GAP = 16;
const TOL = 1.5;
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const near = (a, b, by = TOL) => Math.abs(a - b) <= by;
const show = (b) => (b ? `${Math.round(b.left)}, ${Math.round(b.top)}, ${Math.round(b.width)} × ${Math.round(b.height)}` : 'nothing');
const right = (b) => b.left + b.width;
const bottom = (b) => b.top + b.height;
const cx = (b) => b.left + b.width / 2;
const cy = (b) => b.top + b.height / 2;
const sameBox = (a, b, by = TOL) => !!a && !!b && near(a.left, b.left, by) && near(a.top, b.top, by) && near(right(a), right(b), by) && near(bottom(a), bottom(b), by);
const union = (...boxes) => {
  const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
  return { left, top, width: Math.max(...boxes.map(right)) - left, height: Math.max(...boxes.map(bottom)) - top };
};
const reach = (points) => union(...points.map((p) => ({ left: p.x, top: p.y, width: 0, height: 0 })));
// the point x, y turned by deg about the center of box
const turned = (box, deg, x, y) => {
  const a = (deg * Math.PI) / 180, c = { x: cx(box), y: cy(box) };
  return { x: c.x + (x - c.x) * Math.cos(a) - (y - c.y) * Math.sin(a), y: c.y + (x - c.x) * Math.sin(a) + (y - c.y) * Math.cos(a) };
};
// the place of grip h on box turned by deg
const gripOn = (box, deg, h) => {
  const [sx, sy] = SIGN[h];
  return turned(box, deg, sx < 0 ? box.left : sx > 0 ? right(box) : cx(box), sy < 0 ? box.top : sy > 0 ? bottom(box) : cy(box));
};

const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => [el.localName, ...[...el.classList].filter((c) => /^(zone|plate|caption|for-dark|for-light)$/.test(c))].join('.'))`);

// what is drawn, in screen px: the scale of the slide, the corners of the picture of each shown
// image, fitted by object-fit and turned by its rotate, the box of the image without its rotate,
// the caption that a zone holds, the frame of the selection, the frame of a group with its angle,
// and the grips
const LOOK = `(() => {
  const s = document.querySelector('.reveal .slides');
  const k = s.getBoundingClientRect().width / s.offsetWidth;
  const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; };
  const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => !e.hidden && e.getBoundingClientRect().width);
  const angle = (e) => parseFloat(getComputedStyle(e).rotate) || 0;
  const pictures = shown(${js(IMG)}).map((img) => {
    const b = img.getBoundingClientRect(), st = getComputedStyle(img);
    const w0 = img.offsetWidth * k, h0 = img.offsetHeight * k;
    let w = w0, h = h0, dx = 0, dy = 0;
    if (st.objectFit === 'contain') {
      const q = Math.min(w0 / img.naturalWidth, h0 / img.naturalHeight);
      w = img.naturalWidth * q;
      h = img.naturalHeight * q;
      const [px, py] = st.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
      dx = (w0 - w) * px + w / 2 - w0 / 2;
      dy = (h0 - h) * py + h / 2 - h0 / 2;
    }
    const a = angle(img) * Math.PI / 180, c = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const x = dx + sx * w / 2, y = dy + sy * h / 2;
      return { x: c.x + x * Math.cos(a) - y * Math.sin(a), y: c.y + x * Math.sin(a) + y * Math.cos(a) };
    });
    return { corners, deg: angle(img), width: w, height: h, layout: { left: c.x - w0 / 2, top: c.y - h0 / 2, width: w0, height: h0 } };
  });
  const cap = document.querySelector('.reveal section.present .zone > figcaption, .reveal section.present .zone > .caption');
  const frame = shown(${js(FRAME)})[0] ?? null;
  const u = shown(${js(UNION)})[0] ?? null;
  const grips = Object.fromEntries(shown('.beeson-grip').map((g) => { const q = g.getBoundingClientRect(); return [g.dataset.handle, { x: q.left + q.width / 2, y: q.top + q.height / 2 }]; }));
  return {
    k, pictures, cap: rect(cap), capDeg: cap ? angle(cap) : 0,
    frame: rect(frame), frameDeg: frame ? angle(frame) : 0,
    group: u ? { left: parseFloat(u.style.left), top: parseFloat(u.style.top), width: parseFloat(u.style.width), height: parseFloat(u.style.height) } : null,
    groupDeg: u ? angle(u) : 0,
    grips,
  };
})()`;
async function look(page) {
  const out = await page.evaluate(LOOK);
  // the box of the first picture, upright around its corners
  out.pic = out.pictures.length ? reach(out.pictures[0].corners) : null;
  return out;
}

async function load(t, platform, mode, n, deck = DECK) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  if ((await page.evaluate('Beeson.theme.get()')) !== mode) await page.evaluate('Beeson.theme.toggle()');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  page.figure = n === PLATE_PAIR || n === PLATE_ONE ? 'div.plate' : 'figure.zone';
  return page;
}

// the figure selected by a click on its picture, or the picture by a second click
async function pick(page, from) {
  await page.evaluate('document.activeElement instanceof HTMLElement && document.activeElement.blur()');
  for (let i = 0; i < 3 && (await selected(page)).length; i++) await exec(page, 'selection.clear');
  await frames(page);
  await click(page, IMG);
  await frames(page);
  if (from === 'picture') {
    await click(page, IMG);
    await frames(page);
    assert.match((await selected(page)).join(), /^img(\.for-(dark|light))?$/, 'the picture is not selected by a second click on it');
  } else assert.deepEqual(await selected(page), [page.figure], 'the figure is not selected by a click on its picture');
}

// the edit is in the scope rule wherever the text before it is
function inScope(edited, source) {
  const now = textProblems(edited, THEME);
  for (const p of textProblems(source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, [], 'the edit writes outside the scope rule');
}

// the edit, the file byte for byte after an undo, the edit again after a redo, and the file again
// after a second undo, from which the next edit starts
async function roundTrip(page, edited) {
  assert.notEqual(edited, page.source, 'the edit does not change the file');
  inScope(edited, page.source);
  await undo(page);
  await frames(page);
  await byteExact(page);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited, 'a redo does not write the edit again');
  await undo(page);
  await frames(page);
  await byteExact(page);
}

// the last edit made again, saved, and the saved text opened again without problems
async function saved(page, edited, name) {
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

// the lines of the file that an edit changes, trimmed
function changedLines(source, edited) {
  const a = source.split('\n'), b = edited.split('\n');
  assert.equal(b.length, a.length, 'the edit adds or removes a line');
  return b.filter((l, i) => l !== a[i]).map((l) => l.trim());
}

const showTab = async (page, name) => {
  await page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-tabs button')].find((b) => b.textContent === ${js(name)})?.click()`);
  await frames(page);
};
async function fieldValue(page, id) {
  await showTab(page, 'Arrange');
  return Number(await page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value`));
}
const fieldEnabled = async (page, id) => {
  await showTab(page, 'Arrange');
  return page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); return !!i && !i.disabled; })()`);
};
async function typeField(page, id, value) {
  assert.equal(await fieldEnabled(page, id), true, `the field ${id} is not enabled`);
  await page.evaluate(`(() => { const i = document.querySelector('#beeson-edit-num-${id}'); i.focus(); i.select(); })()`);
  await type(page, String(value));
  await press(page, 'Enter');
  await frames(page);
}

const release = (page, at) => page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });

// the side or corner of box b across from grip h, or the center of b on an axis that h does not move
const anchorOf = (b, h) => {
  const [sx, sy] = SIGN[h];
  return { x: sx > 0 ? b.left : sx < 0 ? right(b) : cx(b), y: sy > 0 ? b.top : sy < 0 ? bottom(b) : cy(b) };
};

// grip h at the pointer ptr: on the axis that an edge grip moves, and for a corner grip at the
// corner nearest to the pointer that keeps the aspect a of the picture, i.e. with the offset from
// the grip to the pointer at a right angle to the diagonal of a box of aspect a
function atPointer(g, ptr, h, a, where) {
  const [sx, sy] = SIGN[h];
  assert.ok(g, `${where}: the grip ${h} is not drawn`);
  if (!sy) assert.ok(near(g.x, ptr.x), `${where}: the grip ${h} is at x ${g.x.toFixed(1)}, and the pointer at ${ptr.x.toFixed(1)}`);
  else if (!sx) assert.ok(near(g.y, ptr.y), `${where}: the grip ${h} is at y ${g.y.toFixed(1)}, and the pointer at ${ptr.y.toFixed(1)}`);
  else {
    const u = [sx, sy / a], n = Math.hypot(...u);
    const along = ((ptr.x - g.x) * u[0] + (ptr.y - g.y) * u[1]) / n;
    assert.ok(Math.abs(along) <= TOL, `${where}: the grip ${h} at ${g.x.toFixed(1)}, ${g.y.toFixed(1)} is ${along.toFixed(1)} px along its diagonal from the pointer at ${ptr.x.toFixed(1)}, ${ptr.y.toFixed(1)}`);
  }
}

// the caption of a zone under the box of the shown image, as wide as it, at the gap of the theme
function captionUnder(now, where) {
  if (!now.cap) return;
  const lay = now.pictures[0].layout;
  assert.ok(near(now.cap.top, bottom(lay) + GAP * now.k) && near(now.cap.left, lay.left) && near(now.cap.width, lay.width), `${where}: the caption is at ${show(now.cap)}, not under the picture at ${show(lay)}`);
  assert.equal(now.capDeg, 0, `${where}: the caption is turned`);
}

// in a drag held by grip h, the grip alone is drawn, without the frame and the other grips, as in
// Keynote (K77), at its place on box, the frame that the release draws
function gripAlone(now, h, box, where) {
  assert.equal(now.frame, null, `${where}: the frame is drawn at ${show(now.frame)}`);
  assert.deepEqual(Object.keys(now.grips), [h], `${where}: the grips ${js(Object.keys(now.grips))} are drawn`);
  const want = gripOn(box, 0, h), g = now.grips[h];
  assert.ok(near(g.x, want.x) && near(g.y, want.y), `${where}: the grip ${h} is at ${js(g)}, not on the frame ${show(box)} at ${js(want)}`);
}

// the box of the picture and its caption of a resize by grip h from the figure or from the picture,
// with the grip alone drawn in the drag and the frame drawn after it
function resized(now, rest, h, ptr, from, where, held = false) {
  const box = from === 'figure' && now.cap ? union(now.pic, now.cap) : now.pic;
  if (held) gripAlone(now, h, box, where);
  else assert.ok(sameBox(now.frame, box), `${where}: the frame is at ${show(now.frame)}, not around ${show(box)}`);
  captionUnder(now, where);
  const a = anchorOf(box, h), a0 = anchorOf(rest.frame, h);
  assert.ok(near(a.x, a0.x) && near(a.y, a0.y), `${where}: the side across from the grip ${h} moves from ${show(rest.frame)} to ${show(box)}`);
  atPointer(now.grips[h], ptr, h, now.pic.width / now.pic.height, where);
}

// what the overlay draws: the frames of the selection and of a group, the grips, the rotate handle
// and its stem, and the readout
const OVERLAY = `(() => {
  const v = (e) => !e.closest('[hidden]') && !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  const n = (s) => [...document.querySelectorAll(s)].filter(v).length;
  return { frames: n('.beeson-frame.selected') + n('.beeson-frame.union'), grips: [...document.querySelectorAll('.beeson-grip')].filter(v).map((g) => g.dataset.handle), rotor: n('.beeson-rotor'), stem: n('.beeson-rotor-stem'), readout: [...document.querySelectorAll('.beeson-offset')].filter(v).map((e) => e.textContent) };
})()`;
const overlay = (page) => page.evaluate(OVERLAY);
const centerOf = (page, sel) => page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(sel)})].find((e) => !e.hidden && e.getBoundingClientRect().width).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

// the pointer offset of a drag of grip h inward, in screen px
const inward = (h, by = 40) => ({ dx: -SIGN[h][0] * by, dy: -SIGN[h][1] * by });

// the group of two pairs, selected by a click on a member
async function pickGroup(t, platform, mode) {
  const page = await load(t, platform, mode, 0, GROUP_DECK);
  page.figure = 'figure.zone';
  await click(page, IMG);
  await frames(page);
  assert.deepEqual(await selected(page), ['figure.zone', 'figure.zone'], 'a click on a member does not select the group');
  return page;
}

// a drag of the rotate handle of the group with the frame box that turns it by deg, held at the
// point that it ends at, which is returned
async function turnGroup(page, box, deg) {
  assert.ok(box, 'the frame of the group is not drawn');
  const rotor = await page.evaluate(`(() => { const r = document.querySelector('.beeson-rotor').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const to = turned(box, deg, rotor.x, rotor.y);
  await drag(page, rotor, { dx: to.x - rotor.x, dy: to.y - rotor.y, hold: true });
  return to;
}

for (const platform of PLATFORMS) {
  for (const mode of MODES) {
    for (const n of FIGURES) {
      test(`each grip resizes ${NAMES[n]} from the figure and from the picture, with the frame around the picture and its caption at the pointer, on ${platform} in ${mode} mode`, async (t) => {
        const page = await load(t, platform, mode, n);
        let last = null;
        for (const from of ['figure', 'picture']) {
          for (const h of HANDLES) {
            const where = `the grip ${h} of ${NAMES[n]} from the ${from} on ${platform} in ${mode} mode`;
            await pick(page, from);
            const rest = await look(page);
            assert.ok(rest.frame, `${where}: the frame is not drawn`);
            const g = rest.grips[h];
            assert.ok(g, `${where}: the grip is not drawn`);
            const { dx, dy } = inward(h);
            const ptr = { x: g.x + dx, y: g.y + dy };
            await drag(page, g, { dx, dy, modifiers: FREE[platform], hold: true });
            resized(await look(page), rest, h, ptr, from, `${where}, in the drag`, true);
            await release(page, ptr);
            await frames(page);
            resized(await look(page), rest, h, ptr, from, `${where}, after the drag`);
            const edited = await render(page);
            const lines = changedLines(page.source, edited);
            for (const l of lines) assert.match(l, /^<(figure class="zone"|div class="plate"|img )/, `${where}: the resize writes ${l}`);
            const widths = lines.filter((l) => l.startsWith('<img')).map((l) => / style="width: (\d+)px"/.exec(l)?.[1]);
            assert.equal(widths.length, PAIRS.includes(n) ? 2 : 1, `${where}: the resize writes ${js(lines)}`);
            assert.ok(widths.every((w) => w && w === widths[0]), `${where}: the images are given the widths ${js(widths)}`);
            await roundTrip(page, edited);
            last = edited;
          }
        }
        await saved(page, last, `r9-1-resize-${n}.html`);
      });
    }

    test(`a turned figure is framed upright around its picture and its caption, with its grips at the corners, and resized by them, on ${platform} in ${mode} mode`, async (t) => {
      for (const n of [ZONE_PAIR, ZONE_ONE]) {
        const where = `${NAMES[n]} turned by 30° on ${platform} in ${mode} mode`;
        const page = await load(t, platform, mode, n);
        await pick(page, 'figure');
        const upright = await look(page);
        await exec(page, 'arrange.setRotation', { deg: 30 });
        await frames(page);
        page.source = await render(page);
        const rest = await look(page);
        assert.equal(rest.pictures[0].deg, 30, `${where}: the picture is not turned`);
        // the caption stays upright and in place
        assert.ok(sameBox(rest.cap, upright.cap, 0.5) && rest.capDeg === 0, `${where}: the caption moves from ${show(upright.cap)} to ${show(rest.cap)}`);
        const around = union(reach(rest.pictures[0].corners), rest.cap);
        assert.equal(rest.frameDeg, 0, `${where}: the frame is turned by ${rest.frameDeg}°`);
        assert.ok(sameBox(rest.frame, around), `${where}: the frame is at ${show(rest.frame)}, not around the turned picture and the caption at ${show(around)}`);
        for (const h of HANDLES) {
          const want = gripOn(rest.frame, 0, h), g = rest.grips[h];
          assert.ok(g && near(g.x, want.x) && near(g.y, want.y), `${where}: the grip ${h} is at ${js(g)}, not at ${js(want)}`);
        }
        // a corner grip scales the picture, which stays turned, with the frame kept around it and
        // the caption, and the corner across from the grip in place
        const { dx, dy } = inward('se');
        const g = rest.grips.se, ptr = { x: g.x + dx, y: g.y + dy };
        await drag(page, g, { dx, dy, modifiers: FREE[platform], hold: true });
        for (const stage of ['in the drag', 'after the drag']) {
          if (stage === 'after the drag') {
            await release(page, ptr);
            await frames(page);
          }
          const now = await look(page);
          const at = `${where}, a drag of the grip se ${stage}`;
          assert.equal(now.pictures[0].deg, 30, `${at}: the picture is not turned`);
          assert.ok(now.pictures[0].width < rest.pictures[0].width - 20, `${at}: the picture is not made smaller`);
          const held = union(reach(now.pictures[0].corners), now.cap);
          if (stage === 'in the drag') gripAlone(now, 'se', held, at);
          else {
            assert.equal(now.frameDeg, 0, `${at}: the frame is turned`);
            assert.ok(sameBox(now.frame, held), `${at}: the frame is at ${show(now.frame)}, not around ${show(held)}`);
          }
          captionUnder(now, at);
          assert.ok(near(held.left, rest.frame.left) && near(held.top, rest.frame.top), `${at}: the corner across from the grip moves from ${show(rest.frame)} to ${show(held)}`);
          const turnedPicture = reach(now.pictures[0].corners);
          atPointer(now.grips.se, ptr, 'se', turnedPicture.width / turnedPicture.height, at);
        }
        const edited = await render(page);
        for (const l of changedLines(page.source, edited)) assert.match(l, /^<(figure class="zone"|img )/, `${where}: the resize writes ${l}`);
        await roundTrip(page, edited);
        await saved(page, edited, `r9-1-turned-${n}.html`);
      }
    });

    test(`a turned group keeps its frame turned with its grips on it, and its W and H fields scale it, on ${platform} in ${mode} mode`, async (t) => {
      const where = `a group of two pairs on ${platform} in ${mode} mode`;
      const page = await pickGroup(t, platform, mode);
      const rest = await look(page);

      // W and H are typed fields that scale the group about its upper left corner, as one entry of
      // the history each, and with Constrain Proportions off a typed W stretches the pictures
      assert.equal(await fieldEnabled(page, 'width'), true, `${where}: the field W is dimmed`);
      assert.equal(await fieldEnabled(page, 'height'), true, `${where}: the field H is dimmed`);
      const w0 = await fieldValue(page, 'width'), h0 = await fieldValue(page, 'height');
      const x0 = await fieldValue(page, 'x'), y0 = await fieldValue(page, 'y');
      const typed = async (id, value, want) => {
        await typeField(page, id, value);
        const got = { width: await fieldValue(page, 'width'), height: await fieldValue(page, 'height'), x: await fieldValue(page, 'x'), y: await fieldValue(page, 'y') };
        for (const [k, v] of Object.entries(want)) assert.ok(near(got[k], v, 1), `${where}: a typed ${id} of ${value} gives ${js(got)}, not ${js(want)}`);
        const edited = await render(page);
        for (const l of changedLines(page.source, edited)) assert.match(l, /^<(figure class="zone"|img )/, `${where}: a typed ${id} writes ${l}`);
        await roundTrip(page, edited);
        return edited;
      };
      const w1 = Math.round(w0 * 0.8), h1 = Math.round(h0 * 0.8);
      await typed('width', w1, { width: w1, height: h0 * 0.8, x: x0, y: y0 });
      await typed('height', h1, { width: w0 * 0.8, height: h1, x: x0, y: y0 });
      await exec(page, 'arrange.constrainProportions');
      assert.equal((await state(page, 'arrange.constrainProportions')).checked, false, `${where}: Constrain Proportions is not turned off`);
      const stretched = await typed('width', w1, { width: w1, height: h0, x: x0, y: y0 });
      assert.match(stretched, /style="width: \d+px; height: \d+px"/, `${where}: a typed W with Constrain Proportions off does not stretch the pictures`);
      await exec(page, 'arrange.constrainProportions');

      // after a turn by the rotate handle, the frame of the group stays turned by the angle of its
      // first member, around every member, with the grips on it, and W and H give its size
      const to = await turnGroup(page, rest.group, 30);
      await release(page, to);
      await frames(page);
      const now = await look(page);
      const at = `${where} after a turn by 30°`;
      assert.ok(now.pictures.every((p) => p.deg === 30), `${at}: the pictures are turned by ${js(now.pictures.map((p) => p.deg))}`);
      assert.ok(now.group, `${at}: the frame of the group is not drawn`);
      assert.ok(near(now.groupDeg, 30, 0.5), `${at}: the frame of the group is turned by ${now.groupDeg}°`);
      const tight = reach(now.pictures.flatMap((p) => p.corners).map((c) => turned(now.group, -30, c.x, c.y)));
      assert.ok(sameBox(tight, now.group), `${at}: the frame of the group, at ${show(now.group)} turned, is not around its members at ${show(tight)}`);
      for (const h of HANDLES) {
        const want = gripOn(now.group, 30, h), g = now.grips[h];
        assert.ok(g && near(g.x, want.x) && near(g.y, want.y), `${at}: the grip ${h} is at ${js(g)}, not at ${js(want)}`);
      }
      assert.ok(near(await fieldValue(page, 'width'), now.group.width / now.k, 1) && near(await fieldValue(page, 'height'), now.group.height / now.k, 1), `${at}: W and H are not the size of the turned frame`);
      const turnedText = await render(page);
      const shown = changedLines(page.source, turnedText).filter((l) => l.startsWith(`<img class="for-${mode}"`));
      assert.equal(shown.length, 2, `${where}: the turn writes ${js(shown)}`);
      for (const l of shown) assert.match(l, /rotate: 30deg/, `${where}: the turn writes ${l}`);
      await roundTrip(page, turnedText);
      await redo(page);
      await frames(page);
      page.source = turnedText;

      // a typed W scales the turned group about the upper left corner of its frame
      const before = await look(page);
      const corner = gripOn(before.group, 30, 'nw');
      const w2 = Math.round((before.group.width / before.k) * 0.8);
      await typeField(page, 'width', w2);
      const after = await look(page);
      const moved = gripOn(after.group, 30, 'nw');
      assert.ok(near(after.groupDeg, 30, 0.5), `${where}: a typed W turns the frame of the group to ${after.groupDeg}°`);
      assert.ok(near(moved.x, corner.x) && near(moved.y, corner.y), `${where}: a typed W moves the upper left corner of the turned group from ${js(corner)} to ${js(moved)}`);
      assert.ok(near(await fieldValue(page, 'width'), w2, 1), `${where}: a typed W of ${w2} gives ${await fieldValue(page, 'width')}`);
      const edited = await render(page);
      await roundTrip(page, edited);
      await saved(page, edited, 'r9-1-group.html');
    });

    test(`while a grip or the rotate handle is held, it is drawn alone, without the frame and the other handles, for an element and a group, on ${platform} in ${mode} mode`, async (t) => {
      for (const kind of ['QR code', 'group']) {
        const where = `a ${kind} on ${platform} in ${mode} mode`;
        const page = kind === 'group' ? await pickGroup(t, platform, mode) : await load(t, platform, mode, 0, LAYOUTS);
        if (kind !== 'group') {
          await click(page, QR);
          await frames(page);
          assert.deepEqual(await selected(page), ['div'], `${where}: a click does not select the QR code`);
        }
        const all = await overlay(page);
        assert.ok(all.frames === 1 && all.grips.length === 8 && all.rotor === 1, `${where}: the selection draws ${js(all)}`);
        // a resize by the grip se, held, and a turn by the rotate handle, held, each released and
        // checked in the file
        for (const handle of ['se', 'rotor']) {
          const from = await centerOf(page, handle === 'rotor' ? '.beeson-rotor' : '.beeson-grip[data-handle="se"]');
          const by = handle === 'rotor' ? { dx: 90, dy: 20 } : { dx: -40, dy: -40 };
          await drag(page, from, { ...by, modifiers: handle === 'rotor' ? undefined : FREE[platform], hold: true });
          await frames(page);
          const held = await overlay(page);
          const want = handle === 'rotor' ? { frames: 0, grips: [], rotor: 1, stem: 0 } : { frames: 0, grips: ['se'], rotor: 0, stem: 0 };
          assert.deepEqual({ frames: held.frames, grips: held.grips, rotor: held.rotor, stem: held.stem }, want, `${where}: the held ${handle === 'rotor' ? 'rotate handle' : 'grip se'} draws ${js(held)}`);
          await release(page, { x: from.x + by.dx, y: from.y + by.dy });
          await frames(page);
          const after = await overlay(page);
          assert.ok(after.frames === 1 && after.grips.length === 8 && after.rotor === 1, `${where}: after the release, the selection draws ${js(after)}`);
          const edited = await render(page);
          await roundTrip(page, edited);
          await redo(page);
          await frames(page);
          page.source = edited;
        }
      }
    });

    test(`the readouts of a move, a nudge, a resize, and a turn give labels and units, for an element, a line, and a group, on ${platform} in ${mode} mode`, async (t) => {
      // as Keynote reads 'x: 530 pt  y: 100 pt' and 'w: 744 pt  h: 762 pt' (K63, K77), in slide px
      const XY = /^x: -?\d+ px {2}y: -?\d+ px$/, WH = /^w: \d+ px {2}h: \d+ px$/, DEG = /^\d+°$/;
      const readout = async (page) => (await overlay(page)).readout.join('|');
      // a drag held from the point from by the offset by, read and released, then checked in the file
      const held = async (page, from, by, want, what, modifiers) => {
        await drag(page, from, { ...by, modifiers, hold: true });
        await frames(page);
        assert.match(await readout(page), want, `${what} reads ${js(await readout(page))}`);
        await release(page, { x: from.x + by.dx, y: from.y + by.dy });
        await frames(page);
        const edited = await render(page);
        await roundTrip(page, edited);
        await redo(page);
        await frames(page);
        page.source = edited;
      };
      const where = `on ${platform} in ${mode} mode`;
      let page = await load(t, platform, mode, 0, LAYOUTS);
      await click(page, QR);
      await frames(page);
      await held(page, await centerOf(page, QR), { dx: -60, dy: 40 }, XY, `the move of a QR code ${where}`, FREE[platform]);
      await held(page, await centerOf(page, '.beeson-grip[data-handle="se"]'), { dx: -30, dy: -30 }, WH, `the resize of a QR code ${where}`, FREE[platform]);
      await held(page, await centerOf(page, '.beeson-rotor'), { dx: 90, dy: 20 }, DEG, `the turn of a QR code ${where}`);
      await press(page, 'ArrowRight');
      await frames(page);
      assert.match(await readout(page), XY, `the nudge of a QR code ${where} reads ${js(await readout(page))}`);
      // a line drawn on the slide, selected by a press next to it, and moved
      await exec(page, 'insert.line', { from: { x: 300, y: 700 }, to: { x: 800, y: 700 } });
      await exec(page, 'selection.clear');
      await frames(page);
      page.source = await render(page);
      const on = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'), r = s.getBoundingClientRect(), k = r.width / s.offsetWidth; return { x: r.left + 550 * k, y: r.top + 700 * k + 3 }; })()`);
      await click(page, on);
      await frames(page);
      await held(page, on, { dx: 40, dy: -50 }, XY, `the move of a line ${where}`, FREE[platform]);
      // a group, resized by its grip se
      page = await pickGroup(t, platform, mode);
      await held(page, await centerOf(page, '.beeson-grip[data-group="1"][data-handle="se"]'), { dx: -40, dy: -30 }, WH, `the resize of a group ${where}`, FREE[platform]);
    });

    test(`a turn of a group with a pair turns the image of each mode, in the drag and after it, on ${platform} in ${mode} mode`, async (t) => {
      const where = `a group of two pairs on ${platform} in ${mode} mode`;
      const page = await pickGroup(t, platform, mode);
      const rest = await look(page);
      const to = await turnGroup(page, rest.group, 30);
      const turning = await look(page);
      assert.ok(turning.pictures.every((p) => p.deg === 30), `${where}: the pictures are turned by ${js(turning.pictures.map((p) => p.deg))} in the drag`);
      await page.evaluate('Beeson.theme.toggle()');
      await frames(page);
      const flipped = await look(page);
      assert.ok(flipped.pictures.every((p) => p.deg === 30), `${where}: after a flip of the mode in the drag, the pictures are turned by ${js(flipped.pictures.map((p) => p.deg))}`);
      await release(page, to);
      await frames(page);
      for (const flip of [false, true]) {
        if (flip) {
          await page.evaluate('Beeson.theme.toggle()');
          await frames(page);
        }
        const now = await look(page);
        assert.ok(now.pictures.every((p) => p.deg === 30), `${where} after the turn${flip ? ' and a flip of the mode' : ''}: the pictures are turned by ${js(now.pictures.map((p) => p.deg))}`);
      }
      const edited = await render(page);
      const imgs = changedLines(page.source, edited).filter((l) => l.startsWith('<img'));
      assert.equal(imgs.length, 4, `${where}: the turn writes ${js(imgs)}`);
      for (const l of imgs) assert.match(l, /rotate: 30deg/, `${where}: the turn writes ${l}`);
      await roundTrip(page, edited);
      await saved(page, edited, 'r9-1-group-turn.html');
    });
  }
}
