// the zoom of the canvas and the pane of the notes: the slide at a zoom past Fit, scrolled by the
// wheel and zoomed by a pinch, the keys of View > Zoom on both platforms, the same slide px written
// by a drag and a resize at every zoom, Zoom to Selection, the frames clipped to the canvas, and
// the notes typed in their pane, with the zoom of their text and the divider of the pane

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const FIG = '.reveal section.present .zone > img';

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

// the editor on the demo deck served over HTTP, so that a save is written into the origin private
// file system, in a window of 1600 by 1000
async function open(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close());
  await page.goto(`${server.origin}/index.html?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  // the storage of an earlier test, e.g. the zoom of the notes, is cleared and the page loaded again
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/index.html?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  return page;
}

const frames = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');
const stage = (page) => page.evaluate(`(() => { const s = window.BeesonEditorShell.stage; return { zoom: s.zoom, scale: s.scale, fit: s.fitScale(), viewport: s.viewport.toJSON(), left: s.el.scrollLeft, top: s.el.scrollTop }; })()`);
const setZoom = async (page, z) => { await page.evaluate(`window.BeesonEditorShell.stage.setZoom(${z})`); await frames(page); };

// the box of the first shown element matched by a selector, in CSS px of the viewport
const rectOf = (page, selector) => page.evaluate(`(() => { const r = [...document.querySelectorAll(${JSON.stringify(selector)})].map((e) => e.getBoundingClientRect()).find((r) => r.width && r.height); return r && r.toJSON(); })()`);

async function figureSlide(page) {
  await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector('.reveal .slides section .zone > img').closest('section')).h)`);
  await frames(page);
}

// the canvas scrolled so that a point of the viewport comes to the center of the cell
async function centerOn(page, at) {
  await page.evaluate(`(() => { const s = window.BeesonEditorShell.stage; const v = s.viewport; s.el.scrollLeft += ${at.x} - (v.left + v.width / 2); s.el.scrollTop += ${at.y} - (v.top + v.height / 2); })()`);
  await frames(page);
}

// a trusted press of a key string with a symbol or a digit typed with Alt, which press() of the
// helpers does not know: the key is the character a keyboard of the United States sends
const SYMBOLS = { '=': ['=', 'Equal', 187], '+': ['+', 'Equal', 187], '-': ['-', 'Minus', 189] };
async function pressKey(page, keys) {
  const names = keys.split('+');
  const name = names.pop() || '+';
  if (!SYMBOLS[name] && !(names.includes('Alt') && /^[0-9]$/.test(name))) return press(page, keys);
  const mac = (await page.evaluate(`new URLSearchParams(location.search).get('edit-platform')`)) === 'mac';
  const bits = names.reduce((b, m) => b | ({ Alt: 1, Ctrl: 2, Meta: 4, Shift: 8, Mod: mac ? 4 : 2 }[m] ?? 0), 0);
  // Option+0 types a masculine ordinal on a Mac, and the command is matched by the code of the key
  const [key, code, keyCode] = SYMBOLS[name] ?? [mac ? 'º' : name, `Digit${name}`, name.charCodeAt(0)];
  const base = { key, code, windowsVirtualKeyCode: keyCode, modifiers: bits };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// whether the last keydown was taken by the editor, i.e. the browser does not act on it
async function watchKeys(page) {
  // a listener in the capture phase of the window runs first, hence it reads the event after the
  // dispatch, since the editor stops its propagation
  await page.evaluate(`window.addEventListener('keydown', (ev) => { window.__taken = undefined; setTimeout(() => { window.__taken = ev.defaultPrevented; }); }, true)`);
}

const wheel = (page, at, { dx = 0, dy = 0, modifiers = 0 } = {}) => page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at.x, y: at.y, deltaX: dx, deltaY: dy, modifiers });

test('at 200 percent the slide is 3840 px wide, and the wheel scrolls it down and sideways', async (t) => {
  const page = await open(t, 'other');
  await figureSlide(page);
  await setZoom(page, 2);
  const slides = await rectOf(page, '.reveal .slides');
  assert.equal(Math.round(slides.width), 3840);
  assert.equal(Math.round(slides.height), 2160);
  const s0 = await stage(page);
  const at = { x: s0.viewport.left + s0.viewport.width / 2, y: s0.viewport.top + s0.viewport.height / 2 };
  await wheel(page, at, { dy: 300 });
  await frames(page);
  const s1 = await stage(page);
  assert.ok(s1.top - s0.top > 100, `the wheel scrolled the canvas from ${s0.top} to ${s1.top}`);
  assert.equal(s1.zoom, 2);
  // Shift and the wheel scroll sideways, as on Windows and Linux
  await wheel(page, at, { dy: 300, modifiers: 8 });
  await frames(page);
  const s2 = await stage(page);
  assert.ok(s2.left - s1.left > 100, `Shift and the wheel scrolled the canvas from ${s1.left} to ${s2.left}`);
  assert.deepEqual(page.errors, []);
});

test('a pinch of the trackpad zooms the canvas about the pointer', async (t) => {
  const page = await open(t, 'mac');
  // the canvas is made as wide as the window without the inspector, so that the zoom past Fit
  // scrolls the canvas in both directions
  await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
  await figureSlide(page);
  const img = await rectOf(page, FIG);
  const at = { x: img.left + img.width / 3, y: img.top + img.height / 3 };
  const under = () => page.evaluate(`window.BeesonEditorShell.stage.toSlide(${JSON.stringify(at)})`);
  const before = await under();
  // Chrome and Firefox send a pinch as a wheel with Ctrl
  for (let i = 0; i < 4; i++) await wheel(page, at, { dy: -40, modifiers: 2 });
  await frames(page);
  const s = await stage(page);
  assert.ok(s.zoom > s.fit * 1.5, `the pinch zoomed to ${s.zoom} from ${s.fit}`);
  const now = await under();
  assert.ok(Math.abs(now.x - before.x) < 1 && Math.abs(now.y - before.y) < 1, `the point under the pointer moved from ${JSON.stringify(before)} to ${JSON.stringify(now)}`);
  assert.deepEqual(page.errors, []);
});

for (const platform of PLATFORMS) {
  test(`the keys of View > Zoom on the platform ${platform}`, async (t) => {
    const page = await open(t, platform);
    await figureSlide(page);
    await watchKeys(page);
    const zoomAfter = async (keys) => { await pressKey(page, keys); await frames(page); return (await stage(page)).zoom; };
    const fit = (await stage(page)).fit;
    const zin = await zoomAfter('Mod+=');
    assert.ok(zin > fit, `Mod+= zoomed to ${zin} from ${fit}`);
    assert.equal(await page.evaluate('window.__taken'), true, 'the browser zoomed the page as well');
    assert.equal(await zoomAfter('Mod+-'), [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3].filter((z) => z < zin).pop());
    assert.equal(await page.evaluate('window.__taken'), true);
    assert.equal(await zoomAfter('Mod+0'), 1);
    assert.equal(await page.evaluate('window.__taken'), true);
    assert.equal(await zoomAfter('Shift+1'), null);
    assert.equal(await zoomAfter('Shift+0'), 1);
    if (platform === 'mac') {
      assert.equal(await zoomAfter('Mod+Alt+0'), null);
      assert.equal(await page.evaluate('window.__taken'), true);
    }
    // Zoom to Selection, by Shift+2 everywhere and by Cmd+Shift+0 on a Mac, wants a selection
    await setZoom(page, null);
    assert.equal(await zoomAfter('Shift+2'), null);
    await click(page, FIG);
    const keys = platform === 'mac' ? ['Shift+2', 'Mod+Shift+0'] : ['Shift+2'];
    for (const k of keys) {
      await setZoom(page, null);
      assert.ok((await zoomAfter(k)) > fit, `${k} did not zoom to the selection`);
    }
    // the zoom keys of the canvas are taken while a text is edited, and not by a field
    await setZoom(page, null);
    await click(page, '.reveal section.present h2');
    assert.equal(await page.evaluate(`document.activeElement.matches('.reveal section.present h2')`), true);
    assert.ok((await zoomAfter('Mod+=')) > fit);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    assert.deepEqual(page.errors, []);
  });
}

test('Zoom to Selection fills the cell with the selected figure and centers it', async (t) => {
  const page = await open(t, 'other');
  await figureSlide(page);
  await click(page, FIG);
  await page.evaluate(`window.BeesonEditor.exec('zoom.selection')`);
  await frames(page);
  const s = await stage(page);
  const img = await rectOf(page, FIG);
  const v = s.viewport;
  // the figure is centered as far as the canvas scrolls: it is at the right edge of the slide, hence
  // the canvas is scrolled to its right end
  const end = await page.evaluate(`(() => { const c = window.BeesonEditorShell.stage.el; return Math.abs(c.scrollLeft - (c.scrollWidth - c.clientWidth)) < 1; })()`);
  assert.ok(end || Math.abs(img.left + img.width / 2 - (v.left + v.width / 2)) < 2, JSON.stringify({ img, v }));
  assert.ok(img.left >= v.left && img.right <= v.right, JSON.stringify({ img, v }));
  assert.ok(Math.abs(img.top + img.height / 2 - (v.top + v.height / 2)) < 2, JSON.stringify({ img, v }));
  // the figure is taller than wide, hence it fills the height of the cell within the margin
  assert.ok(img.height <= v.height && img.height > v.height - 100, `the figure is ${img.height} px high in a cell of ${v.height}`);
  const frame = await rectOf(page, '.beeson-frame.selected');
  assert.ok(Math.abs(frame.left - img.left) < 2 && Math.abs(frame.width - img.width) < 4, 'the frame is not at the box of the figure');
  assert.deepEqual(page.errors, []);
});

test('the frames and handles are clipped to the canvas at a zoom', async (t) => {
  const page = await open(t, 'other');
  await figureSlide(page);
  await setZoom(page, 2);
  await centerOn(page, await (async () => { const r = await rectOf(page, FIG); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })());
  await click(page, FIG);
  await frames(page);
  const look = await page.evaluate(`(() => {
    const v = window.BeesonEditorShell.stage.viewport;
    return { clip: getComputedStyle(document.querySelector('.beeson-overlay')).clipPath, want: 'inset(' + [v.top, innerWidth - v.right, innerHeight - v.bottom, v.left].map((n) => n + 'px').join(' ') + ')' };
  })()`);
  assert.equal(look.clip, look.want);
  // the frame of the figure runs past the cell at 200 percent, and the handle under the cell is
  // not hit, since the point is on the status bar
  const frame = await rectOf(page, '.beeson-frame.selected');
  const s = await stage(page);
  assert.ok(frame.bottom > s.viewport.bottom, 'the figure does not run past the cell');
  assert.deepEqual(page.errors, []);
});

for (const platform of PLATFORMS) {
  test(`a drag and a resize of a figure write the same slide px at 50, 100, and 200 percent as at Fit, on the platform ${platform}`, async (t) => {
    const page = await open(t, platform);
    await figureSlide(page);
    // what the file gets: the text rendered by the editor, cut to the lines that differ from the deck
    const lines = page.source.split('\n');
    const zone = async () => (await page.evaluate('window.BeesonEditor.render()')).split('\n').filter((l, i) => l !== lines[i]).join('\n');
    const undo = async () => { await press(page, 'Mod+Z'); await frames(page); };
    // nothing is selected before each drag, since a click on a selected figure selects its image
    const clear = async () => {
      for (let i = 0; i < 3 && !(await page.evaluate(`document.querySelector('.beeson-frame.selected').hidden`)); i++) await press(page, 'Escape');
      assert.equal(await page.evaluate(`document.querySelector('.beeson-frame.selected').hidden`), true, 'the selection is not cleared');
    };
    // the figure is scrolled to the center of the cell, so that the drag stays in the window
    const ready = async (z) => {
      await setZoom(page, z);
      const r = await rectOf(page, FIG);
      if (z !== null) await centerOn(page, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      await clear();
      return (await stage(page)).scale;
    };
    const free = platform === 'mac' ? 'Meta' : 'Alt';
    const results = {};
    for (const z of [null, 0.5, 1, 2]) {
      // a free move by 60 by 40 slide px, with Cmd on a Mac and Alt elsewhere, hence no snap
      let s = await ready(z);
      await drag(page, FIG, { dx: 60 * s, dy: 40 * s, modifiers: free });
      await frames(page);
      const moved = await zone();
      await undo();
      await byteExact(page);
      // a move that leaves the center of the figure 3 slide px right of the center of the slide,
      // where it snaps at every zoom, since 3 slide px are under 8 screen px up to 200 percent
      await setZoom(page, z);
      const off = await page.evaluate(`(() => { const s = window.BeesonEditorShell.stage; const r = [...document.querySelectorAll(${JSON.stringify(FIG)})].map((e) => e.getBoundingClientRect()).find((r) => r.width); return s.toSlide({ x: r.left + r.width / 2, y: 0 }).x - 960; })()`);
      // the canvas is scrolled to the middle of the way, so that both ends are in the window
      if (z !== null) {
        const r = await rectOf(page, FIG);
        await centerOn(page, { x: r.left + r.width / 2 - ((off - 3) * z) / 2, y: r.top + r.height / 2 });
      }
      await clear();
      s = (await stage(page)).scale;
      await drag(page, FIG, { dx: -(off - 3) * s, dy: 0 });
      await frames(page);
      const snapped = await zone();
      const center = await page.evaluate(`(() => { const s = window.BeesonEditorShell.stage; const r = [...document.querySelectorAll(${JSON.stringify(FIG)})].map((e) => e.getBoundingClientRect()).find((r) => r.width); return s.toSlide({ x: r.left + r.width / 2, y: 0 }).x; })()`);
      assert.ok(Math.abs(center - 960) < 1, `at ${z}: the center of the figure is at ${center}, not snapped to 960`);
      await undo();
      await byteExact(page);
      // a free resize of the lower right corner of the image by 80 by 80 slide px: the first click
      // selects the figure, whose grips are gray, and the second its image
      s = await ready(z);
      await click(page, FIG);
      await click(page, FIG);
      const grip = () => page.evaluate(`(() => { const r = document.querySelector('.beeson-grip[data-handle=se]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      // the corner is off the window at 200 percent until the canvas is scrolled to it
      if (z !== null) await centerOn(page, await grip());
      const se = await grip();
      await drag(page, se, { dx: 80 * s, dy: 80 * s, modifiers: free });
      await frames(page);
      const resized = await zone();
      await undo();
      await byteExact(page);
      results[z] = { moved, snapped, resized };
    }
    assert.match(results.null.moved, /<figure class="zone" style="translate: 60px 40px">/);
    assert.match(results.null.snapped, /<figure class="zone" style="translate: -?\d+px( -?\d+px)?">/);
    assert.match(results.null.resized, /width: \d+px/);
    for (const z of [0.5, 1, 2]) assert.deepEqual(results[z], results.null, `at ${z} the file got ${JSON.stringify(results[z])}, at Fit ${JSON.stringify(results.null)}`);
    assert.deepEqual(page.errors, []);
  });
}

for (const platform of PLATFORMS) {
  test(`text typed into the notes pane is written into the aside, undone, redone, and saved, on the platform ${platform}`, async (t) => {
    const page = await open(t, platform);
    await page.evaluate(`window.BeesonEditor.exec('view.notes')`);
    await frames(page);
    // the notes are laid over the pane, in the font of the chrome
    const look = await page.evaluate(`(() => {
      const a = document.querySelector('.reveal section.present > aside.notes');
      const r = a.getBoundingClientRect(), p = document.querySelector('.beeson-edit-pane').getBoundingClientRect();
      return { focused: document.activeElement === a, over: Math.abs(r.left - p.left) < 1 && Math.abs(r.top - p.top) < 1 && Math.abs(r.width - p.width) < 1 && Math.abs(r.height - p.height) < 1, font: getComputedStyle(a).fontFamily === getComputedStyle(document.querySelector('.beeson-edit-bottom')).fontFamily };
    })()`);
    assert.deepEqual(look, { focused: true, over: true, font: true });
    // the caret at the end of the notes, then trusted typing
    const end = await page.evaluate(`(() => { const a = document.activeElement; const r = document.createRange(); r.selectNodeContents(a); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return a.textContent.slice(-12); })()`);
    await type(page, ' Typed in the pane.');
    await frames(page);
    const edit = [`${end}</aside>`, `${end} Typed in the pane.</aside>`];
    await byteExact(page, [edit]);
    await press(page, 'Mod+Z');
    await frames(page);
    await byteExact(page);
    await press(page, platform === 'mac' ? 'Mod+Shift+Z' : 'Mod+Y');
    await frames(page);
    await byteExact(page, [edit]);
    const { text, status } = await saveAndReopen(page, `notes-${platform}.html`);
    assert.equal(text, page.source.replace(edit[0], edit[1]));
    assert.deepEqual(status.problems, []);
    assert.deepEqual(page.errors, []);
  });
}

for (const platform of PLATFORMS) {
  test(`the text of the notes is zoomed by its keys and buttons, apart from the canvas, on the platform ${platform}`, async (t) => {
    const page = await open(t, platform);
    await page.evaluate(`window.BeesonEditor.exec('view.notes')`);
    await frames(page);
    await watchKeys(page);
    const size = () => page.evaluate(`parseFloat(getComputedStyle(document.querySelector('.reveal section.present > aside.notes')).fontSize) * window.BeesonEditorShell.stage.scale`);
    const value = () => page.evaluate(`document.querySelector('.beeson-edit-notes-zoom .value').textContent`);
    assert.ok(Math.abs((await size()) - 13) < 0.1, `the notes are set at ${await size()} px`);
    await pressKey(page, 'Mod+=');
    await frames(page);
    assert.ok(Math.abs((await size()) - 16.25) < 0.1, `the notes are set at ${await size()} px`);
    assert.equal(await value(), '125%');
    assert.equal(await page.evaluate('window.__taken'), true);
    assert.equal((await stage(page)).zoom, null, 'the canvas was zoomed with the notes');
    assert.equal(await page.evaluate(`document.activeElement.matches('aside.notes')`), true);
    await pressKey(page, 'Mod+=');
    await pressKey(page, 'Mod+-');
    await frames(page);
    assert.equal(await value(), '125%');
    await pressKey(page, 'Mod+0');
    await frames(page);
    assert.equal(await value(), '100%');
    // the buttons keep the caret in the notes
    await click(page, '.beeson-edit-notes-zoom button.big');
    await frames(page);
    assert.equal(await value(), '125%');
    assert.equal(await page.evaluate(`document.activeElement.matches('aside.notes')`), true);
    await click(page, '.beeson-edit-notes-zoom button:not(.big)');
    await click(page, '.beeson-edit-notes-zoom button:not(.big)');
    await frames(page);
    assert.equal(await value(), '75%');
    // the zoom of the text is kept for the next session, and nothing is written into the file
    assert.equal(await page.evaluate(`localStorage.getItem('beeson-notes-zoom')`), '0.75');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    assert.deepEqual(page.errors, []);
  });
}

test('the divider of the notes is dragged to set the height of the pane, and dragged down to hide it', async (t) => {
  const page = await open(t, 'other');
  await page.evaluate(`window.BeesonEditor.exec('view.notes')`);
  await frames(page);
  const pane = () => page.evaluate('window.BeesonEditor.status().pane');
  const shown = () => page.evaluate(`document.documentElement.classList.contains('beeson-notes')`);
  const h0 = await pane();
  await drag(page, '.beeson-edit-resize', { dy: -120 });
  await frames(page);
  assert.equal(await pane(), h0 + 120);
  // the aside follows the pane
  const fits = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present > aside.notes').getBoundingClientRect(), p = document.querySelector('.beeson-edit-pane').getBoundingClientRect(); return Math.abs(r.top - p.top) < 1 && Math.abs(r.height - p.height) < 1; })()`);
  assert.equal(fits, true);
  // the arrow keys move the divider by 20 px
  await page.evaluate(`document.querySelector('.beeson-edit-resize').focus()`);
  await press(page, 'ArrowUp');
  assert.equal(await pane(), h0 + 140);
  await press(page, 'ArrowDown');
  assert.equal(await pane(), h0 + 120);
  // a drag down past the bottom hides the notes and keeps the height of the pane
  await drag(page, '.beeson-edit-resize', { dy: h0 + 120 });
  await frames(page);
  assert.equal(await shown(), false);
  assert.equal(await pane(), h0 + 120);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
  assert.deepEqual(page.errors, []);
});
