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

// the frame of a resize by grip h from the figure or from the picture, in a drag and after it
function resized(now, rest, h, ptr, from, where) {
  const held = from === 'figure' && now.cap ? union(now.pic, now.cap) : now.pic;
  assert.ok(sameBox(now.frame, held), `${where}: the frame is at ${show(now.frame)}, not around ${show(held)}`);
  captionUnder(now, where);
  const a = anchorOf(now.frame, h), a0 = anchorOf(rest.frame, h);
  assert.ok(near(a.x, a0.x) && near(a.y, a0.y), `${where}: the frame across from the grip ${h} moves from ${show(rest.frame)} to ${show(now.frame)}`);
  atPointer(now.grips[h], ptr, h, now.pic.width / now.pic.height, where);
}

// the pointer offset of a drag of grip h inward, in screen px
const inward = (h, by = 40) => ({ dx: -SIGN[h][0] * by, dy: -SIGN[h][1] * by });

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
            resized(await look(page), rest, h, ptr, from, `${where}, in the drag`);
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
          assert.equal(now.frameDeg, 0, `${at}: the frame is turned`);
          assert.ok(sameBox(now.frame, held), `${at}: the frame is at ${show(now.frame)}, not around ${show(held)}`);
          captionUnder(now, at);
          assert.ok(near(now.frame.left, rest.frame.left) && near(now.frame.top, rest.frame.top), `${at}: the corner across from the grip moves from ${show(rest.frame)} to ${show(now.frame)}`);
          const turnedPicture = reach(now.pictures[0].corners);
          atPointer(now.grips.se, ptr, 'se', turnedPicture.width / turnedPicture.height, at);
        }
        const edited = await render(page);
        for (const l of changedLines(page.source, edited)) assert.match(l, /^<(figure class="zone"|img )/, `${where}: the resize writes ${l}`);
        await roundTrip(page, edited);
        await saved(page, edited, `r9-1-turned-${n}.html`);
      }
    });

  }
}
