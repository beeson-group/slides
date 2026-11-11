// the work of R13.2 on both platforms: the box of a figure with a caption in the fields, Align, a
// typed Height, and the snap of a drag, a corner resize of a figure that keeps the corner across
// from its grip, the readout of a drag kept inside the canvas, View > Slide Only in a narrow window,
// the selection after an undo of a list style, and the keys listed in the Slide menu. each edit of
// the file is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const DECK = 'index.html';
// the index of the figures slide in index.html
const FIGURES = 4;
const PLATFORMS = ['mac', 'other'];

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 2) => Math.abs(a - b) <= by;

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
// the boxes in slide pixels of the drawn picture of the figure of the current slide, fitted into
// its image box, of its caption, and of the selection frame drawn on the canvas
const geometry = (page) => page.evaluate(`(() => {
  const s = document.querySelector('.reveal .slides').getBoundingClientRect(), k = s.width / 1920;
  const to = (b) => ({ left: (b.left - s.left) / k, top: (b.top - s.top) / k, width: (b.right - b.left) / k, height: (b.bottom - b.top) / k });
  const img = [...Reveal.getCurrentSlide().querySelectorAll('figure img')].find((i) => i.getBoundingClientRect().width), i = img.getBoundingClientRect();
  const q = Math.min(i.width / img.naturalWidth, i.height / img.naturalHeight), w = img.naturalWidth * q, h = img.naturalHeight * q;
  const picture = to({ left: i.left + (i.width - w) / 2, top: i.top + (i.height - h) / 2, right: i.left + (i.width + w) / 2, bottom: i.top + (i.height + h) / 2 });
  const caption = to(Reveal.getCurrentSlide().querySelector('figcaption').getBoundingClientRect());
  const f = [...document.querySelectorAll('.beeson-frame.selected')].find((f) => f.getClientRects().length && !f.hidden);
  const fr = f && f.getBoundingClientRect();
  return { picture, caption, frame: fr && to(fr), aspect: img.naturalWidth / img.naturalHeight, drawn: w / h, box: i.width / i.height };
})()`);

async function load(t, platform, n, size = { width: 1600, height: 1000 }) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&theme=light&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// an undo gives the text before and a redo the edited text byte for byte, and the saved text is
// opened again without problems
async function checkEdit(page, name, before = page.source) {
  const edited = await render(page);
  assert.notEqual(edited, before);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
}

for (const platform of PLATFORMS) {
  test(`the fields and the frame of a figure give its drawn picture with its caption (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    const g = await geometry(page);
    const top = Math.min(g.picture.top, g.caption.top), bottom = Math.max(g.picture.top + g.picture.height, g.caption.top + g.caption.height);
    for (const [id, v] of [['x', g.picture.left], ['y', top], ['width', g.picture.width], ['height', bottom - top]]) {
      assert.ok(near(await fieldValue(page, id), v, 1), `${id} reads ${await fieldValue(page, id)} against ${v}: ${js(g)}`);
    }
    assert.ok(g.frame.top <= g.picture.top + 1, `the top line of the frame is above the picture: ${js(g)}`);
    assert.deepEqual(errors(page), []);
  });

  test(`Align Top and a typed Y of 0 put the visible top of a figure on the edge of the slide (${platform})`, async (t) => {
    let page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    await exec(page, 'arrange.align.top');
    await frames(page);
    let g = await geometry(page);
    assert.ok(near(g.picture.top, 0, 1), `Align Top puts the picture at ${g.picture.top}`);
    assert.ok(near(await fieldValue(page, 'y'), 0, 1));
    await checkEdit(page, `r13-2-align-top-${platform}.html`);
    page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    await typeField(page, 'y', 0);
    g = await geometry(page);
    assert.ok(near(g.picture.top, 0, 1), `a typed Y of 0 puts the picture at ${g.picture.top}`);
    await checkEdit(page, `r13-2-typed-y-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`a typed Height of a figure keeps the aspect of its picture and its caption on the slide (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    const y = await fieldValue(page, 'y');
    const h = Math.round(1080 - y - 20);
    await typeField(page, 'height', h);
    const g = await geometry(page);
    assert.ok(near(g.box, g.aspect, 0.01), `the image box keeps the aspect of the picture: ${js(g)}`);
    const bottom = g.caption.top + g.caption.height;
    assert.ok(near(bottom - g.picture.top, h, 3), `the figure is ${bottom - g.picture.top} high against ${h}: ${js(g)}`);
    assert.ok(bottom <= 1080 + 1, `the caption ends at ${bottom}`);
    assert.ok(near(await fieldValue(page, 'height'), h, 3) && near(await fieldValue(page, 'y'), y, 1));
    assert.ok(near(await fieldValue(page, 'width'), g.picture.width, 1));
    await checkEdit(page, `r13-2-typed-height-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`a drag of a figure snaps the visible top of its picture to the edge of the slide (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    const g0 = await geometry(page);
    const k = await page.evaluate(`document.querySelector('.reveal .slides').getBoundingClientRect().width / 1920`);
    const at = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector('figure img.for-light').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    // a drag that leaves the picture 4 slide px under the edge, inside the reach of the snap
    const dy = -(g0.picture.top - 4) * k;
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y + (dy * i) / 10, button: 'left', buttons: 1 });
    await frames(page);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y + dy, button: 'left', buttons: 0, clickCount: 1 });
    await frames(page);
    const g = await geometry(page);
    assert.ok(near(g.picture.top, 0, 1), `the drag puts the picture at ${g.picture.top}`);
    assert.ok(near(await fieldValue(page, 'y'), 0, 1));
    await checkEdit(page, `r13-2-snap-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });
}

// the box in slide pixels of the picture with its caption, i.e. the frame of the figure
const outer = (g) => {
  const left = Math.min(g.picture.left, g.caption.left), top = Math.min(g.picture.top, g.caption.top);
  const right = Math.max(g.picture.left + g.picture.width, g.caption.left + g.caption.width), bottom = Math.max(g.picture.top + g.picture.height, g.caption.top + g.caption.height);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};
const grip = (page, handle) => page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="${handle}"]')].find((g) => g.getClientRects().length && !g.hidden); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

for (const scale of [1, 1.25]) {
  for (const handle of ['nw', 'ne', 'sw', 'se']) {
    test(`a corner resize of a figure by its ${handle} grip keeps the corner across from it at a pixel ratio of ${scale}`, async (t) => {
      const page = await load(t, 'other', FIGURES, { width: 1600, height: 1000, scale });
      await click(page, 'section.present figure img.for-light');
      const f0 = outer(await geometry(page));
      const k = await page.evaluate(`document.querySelector('.reveal .slides').getBoundingClientRect().width / 1920`);
      const at = await grip(page, handle);
      const sx = handle.includes('e') ? 1 : -1, sy = handle.includes('s') ? 1 : -1;
      // outward by 180 slide px along each axis, past the height of the slide
      const dx = sx * 180 * k, dy = sy * 180 * k;
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 12; i++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x + (dx * i) / 12, y: at.y + (dy * i) / 12, button: 'left', buttons: 1, modifiers: 0 });
      await frames(page);
      const g = await geometry(page), f = outer(g);
      const readout = await page.evaluate(`document.querySelector('.beeson-offset').textContent`);
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x + dx, y: at.y + dy, button: 'left', buttons: 0, clickCount: 1 });
      await frames(page);
      const info = js({ f0, f, g, readout });
      // the corner across from the grip stays in place
      assert.ok(near(sx > 0 ? f.left : f.right, sx > 0 ? f0.left : f0.right, 2), `x across: ${info}`);
      assert.ok(near(sy > 0 ? f.top : f.bottom, sy > 0 ? f0.top : f0.bottom, 2), `y across: ${info}`);
      assert.ok(near(g.drawn, g.aspect, 0.01) && f.width > f0.width + 40, `the picture grew at its aspect: ${info}`);
      // the readout gives the size drawn
      const [, w, h] = readout.match(/w: (\d+) px\s+h: (\d+) px/) ?? [];
      assert.ok(near(Number(w), f.width, 2) && near(Number(h), f.height, 2), `the readout: ${info}`);
      const g1 = await geometry(page), f1 = outer(g1);
      assert.ok(near(f1.width, f.width, 2) && near(f1.height, f.height, 2) && near(f1.left, f.left, 2) && near(f1.top, f.top, 2), `the release keeps the frame: ${js({ f, f1 })}`);
      for (const [id, v] of [['x', f1.left], ['y', f1.top], ['width', f1.width], ['height', f1.height]]) {
        assert.ok(near(await fieldValue(page, id), v, 1), `${id} reads ${await fieldValue(page, id)} against ${v}`);
      }
      const width = Number((await page.evaluate(`Reveal.getCurrentSlide().querySelector('figure img.for-light').getAttribute('style')`)).match(/width:\s*([\d.]+)px/)[1]);
      assert.ok(near(width, g1.picture.width, 1), `the file holds width ${width} against the drawn ${g1.picture.width}`);
      await checkEdit(page, `r13-2-corner-${handle}-${scale}.html`);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the box on the screen of the visible part of the canvas, without its scroll bars and rulers, and
// the box of the readout of a drag
const canvasBox = (page) => page.evaluate(`(() => {
  const c = document.querySelector('.beeson-edit-canvas'), r = c.getBoundingClientRect();
  let left = r.left + c.clientLeft, top = r.top + c.clientTop;
  const right = left + c.clientWidth, bottom = top + c.clientHeight;
  for (const ruler of document.querySelectorAll('.beeson-ruler')) {
    const b = ruler.getBoundingClientRect();
    if (!ruler.getClientRects().length || !b.width || !b.height) continue;
    if (b.width > b.height) top = Math.max(top, b.bottom); else left = Math.max(left, b.right);
  }
  return { left, top, right, bottom };
})()`);
const readoutBox = (page) => page.evaluate(`(() => { const o = document.querySelector('.beeson-offset'); if (!o || o.hidden) return null; const r = o.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: o.textContent }; })()`);

for (const platform of PLATFORMS) {
  for (const zoom of [false, true]) {
    test(`the readout of a drag stays inside the visible canvas at its edges${zoom ? ' while zoomed in' : ''} (${platform})`, async (t) => {
      const page = await load(t, platform, FIGURES);
      await exec(page, 'view.rulers');
      await click(page, 'section.present figure img.for-light');
      // zoomed in about the figure, whose drag then reaches past the canvas
      if (zoom) await exec(page, 'zoom.selection');
      await frames(page);
      const c = await canvasBox(page);
      const at = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().querySelector('figure img.for-light').getBoundingClientRect(); const x = Math.max(r.left, 0) + 20, y = Math.max(r.top, 0) + 20; return { x, y }; })()`);
      const at2 = { x: Math.min(Math.max(at.x, c.left + 30), c.right - 30), y: Math.min(Math.max(at.y, c.top + 30), c.bottom - 30) };
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at2.x, y: at2.y });
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at2.x, y: at2.y, button: 'left', buttons: 1, clickCount: 1 });
      for (const [x, y] of [[c.right - 3, (c.top + c.bottom) / 2], [(c.left + c.right) / 2, c.bottom - 3], [c.right - 3, c.bottom - 3], [c.left + 3, c.top + 3]]) {
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (x + at2.x) / 2, y: (y + at2.y) / 2, button: 'left', buttons: 1 });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
        await frames(page);
        const r = await readoutBox(page);
        assert.ok(r, 'a readout is shown');
        assert.ok(r.left >= c.left - 0.5 && r.top >= c.top - 0.5 && r.right <= c.right + 0.5 && r.bottom <= c.bottom + 0.5, `the readout ${js(r)} is outside the canvas ${js(c)} at ${x}, ${y}`);
      }
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at2.x, y: at2.y, button: 'left', buttons: 0, clickCount: 1 });
      await frames(page);
      assert.deepEqual(errors(page), []);
    });
  }
}

const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const seen = (page, selector) => page.evaluate(`(() => { const e = document.querySelector(${js(selector)}); return !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0; })()`);
// the item label of the menu bar named bar chosen by trusted clicks
async function choose(page, bar, label) {
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
  const at = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)});
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the menu ${bar} does not have an item ${label}`);
  await click(page, at);
  await frames(page);
}

for (const platform of PLATFORMS) {
  for (const width of [800, 1600]) {
    test(`View > Slide Only agrees with the navigator shown in a window ${width} px wide (${platform})`, async (t) => {
      const page = await load(t, platform, 0, { width, height: 900 });
      if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
      await frames(page);
      const agree = async (why) => {
        const nav = await seen(page, '.beeson-edit-nav');
        assert.equal((await state(page, 'view.slideOnly')).checked, !nav, `Slide Only ${why}`);
        return nav;
      };
      const first = await agree('at the start');
      assert.equal(first, width > 1000, 'the navigator is hidden beside the inspector only in a narrow window');
      await choose(page, 'View', 'Slide Only');
      assert.equal(await agree('after Slide Only'), !first, 'Slide Only changes what is shown');
      await choose(page, 'View', 'Slide Only');
      assert.equal(await agree('after Slide Only twice'), first, 'a second Slide Only gives back what was shown');
      // with the inspector opened again, the narrow window hides the navigator
      if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
      await frames(page);
      await agree('with the inspector open');
      await choose(page, 'View', 'Slide Only');
      await agree('after a third Slide Only');
      assert.deepEqual(errors(page), []);
    });
  }
}

// the client point of the middle of the character at offset k of needle in the first shown
// element of selector whose text holds needle
const pointOf = (page, selector, needle, k = 0) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${js(selector)})].find((el) => el.getBoundingClientRect().width && el.textContent.includes(${js(needle)}));
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(needle)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i + ${k});
    r.setEnd(n, i + ${k} + 1);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
})()`);
// the selected text of the window, the tag of the block that holds it, and whether it is in a text
const selected = (page) => page.evaluate(`(() => {
  const s = getSelection();
  const el = s.focusNode && (s.focusNode.nodeType === 1 ? s.focusNode : s.focusNode.parentElement);
  return { text: s.toString(), block: el?.closest('p, li, h2')?.localName ?? null, editing: !!el?.closest('[contenteditable="true"]') };
})()`);

for (const platform of PLATFORMS) {
  for (const [id, block, back] of [['text.list.ul', 'li', 'p'], ['text.list.ol', 'li', 'p']]) {
    test(`an undo and a redo of ${id} on a word of a paragraph select the word again (${platform})`, async (t) => {
      const page = await load(t, platform, FIGURES);
      await click(page, await pointOf(page, '.reveal section.present > p', 'styles', 2), { count: 2 });
      assert.deepEqual(await selected(page), { text: 'styles', block: back, editing: true });
      await exec(page, id);
      assert.deepEqual(await selected(page), { text: 'styles', block, editing: true }, 'the list style keeps the word');
      await undo(page);
      await frames(page);
      assert.deepEqual(await selected(page), { text: 'styles', block: back, editing: true }, 'the undo selects the word again');
      assert.equal(await render(page), page.source);
      await redo(page);
      await frames(page);
      assert.deepEqual(await selected(page), { text: 'styles', block, editing: true }, 'the redo selects the word again');
      await checkEdit(page, `r13-2-list-${id}-${platform}.html`);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`an undo and a redo of Numbers on the items of a list select the items again (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    const ITEM = '.reveal section.present ul > li';
    await click(page, await pointOf(page, ITEM, 'toggle', 2));
    await press(page, 'Mod+A');
    const all = (await selected(page)).text;
    assert.ok(all.length > 20, `Mod+A selects the list: ${all}`);
    await exec(page, 'text.list.ol');
    await undo(page);
    await frames(page);
    assert.equal((await selected(page)).text, all, 'the undo selects the items again');
    await redo(page);
    await frames(page);
    assert.equal((await selected(page)).text, all, 'the redo selects the items again');
    await checkEdit(page, `r13-2-list-items-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });
}

// the keys printed beside the items of the menu bar named bar, by their labels
async function menuKeys(page, bar) {
  const i = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === ${js(bar)})`);
  await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${i + 1})`);
  const items = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => [i.querySelector('.label')?.textContent, i.querySelector('.keys')?.textContent ?? '']))`);
  await page.evaluate('window.BeesonEditorShell.closeMenus(); true');
  await frames(page);
  return items;
}

for (const platform of PLATFORMS) {
  test(`the Slide menu lists a key at Delete Slide and Duplicate Slide only where the key runs it, with nothing selected on the canvas (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    // a click on the pasteboard leaves nothing selected on the canvas
    const c = await canvasBox(page);
    await click(page, { x: c.left + 8, y: c.bottom - 8 });
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().length'), 0);
    const keys = await menuKeys(page, 'Slide');
    const count = () => page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);
    for (const [label, key] of [['Delete Slide', platform === 'mac' ? 'Backspace' : 'Delete'], ['Duplicate Slide', 'Mod+D']]) {
      const before = await count();
      await press(page, key);
      await frames(page);
      const ran = (await count()) !== before;
      assert.equal(!!keys[label], ran, `${label} lists ${js(keys[label])} and its key ${ran ? 'runs' : 'does not run'} it`);
      if (ran) await undo(page);
    }
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the fields W, H, and Angle of the Arrange pane
const sizeFields = async (page) => ({ w: await fieldValue(page, 'width'), h: await fieldValue(page, 'height'), angle: await fieldValue(page, 'angle') });

for (const platform of PLATFORMS) {
  test(`a turned figure selected as one object keeps W and H of its picture with its caption at every angle (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    const rest = await sizeFields(page);
    assert.deepEqual(rest, { w: 600, h: 875, angle: 0 });
    for (const deg of [30, 60, 90, 0]) {
      await typeField(page, 'angle', deg);
      assert.deepEqual(await sizeFields(page), { ...rest, angle: deg }, `at ${deg} degrees`);
    }
    // the rotate handle dragged to the right
    const rotor = await page.evaluate(`(() => { const r = document.querySelector('.beeson-rotor'); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rotor.x, y: rotor.y });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rotor.x, y: rotor.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rotor.x + 12 * i, y: rotor.y, button: 'left', buttons: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rotor.x + 120, y: rotor.y, button: 'left', buttons: 0, clickCount: 1 });
    await frames(page);
    const turned = await sizeFields(page);
    assert.ok(turned.angle > 5, `the handle turned the figure: ${js(turned)}`);
    assert.deepEqual({ w: turned.w, h: turned.h }, { w: rest.w, h: rest.h }, `after the rotate handle: ${js(turned)}`);
    await checkEdit(page, `r13-2-turned-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  test(`a typed Height of a turned figure comes back as typed and gives the same size at Angle 0 (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    await typeField(page, 'angle', 29);
    const turned = await render(page);
    // the Height that the figure has changes nothing
    await typeField(page, 'height', 875);
    assert.deepEqual(await sizeFields(page), { w: 600, h: 875, angle: 29 });
    assert.equal(await render(page), turned, 'a typed Height of 875 changes the file');
    await typeField(page, 'height', 700);
    const at29 = await sizeFields(page);
    assert.ok(near(at29.h, 700, 2) && at29.angle === 29, `the typed Height reads ${js(at29)}`);
    const typed = await render(page);
    await typeField(page, 'angle', 0);
    const at0 = await sizeFields(page);
    assert.ok(near(at0.h, 700, 2) && near(at0.w, at29.w, 1), `at Angle 0 the size is ${js(at0)} against ${js(at29)}`);
    await checkEdit(page, `r13-2-turned-height-${platform}.html`, typed);
    assert.deepEqual(errors(page), []);
  });

  test(`an undo of a typed Height gives back Width and Height in their fields (${platform})`, async (t) => {
    const page = await load(t, platform, FIGURES);
    await click(page, 'section.present figure img.for-light');
    await typeField(page, 'height', 975);
    assert.notEqual(await fieldValue(page, 'width'), 600);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual({ w: Number(await page.evaluate(`document.querySelector('#beeson-edit-num-width').value`)), h: Number(await page.evaluate(`document.querySelector('#beeson-edit-num-height').value`)) }, { w: 600, h: 875 });
    assert.deepEqual(errors(page), []);
  });
}
