// regression tests of R13.1 on both platforms with trusted input: the four layer commands of
// commands/order.ts for an element in the flow, e.g. a paragraph moved onto a figure, as Bring to
// Front of Keynote (K70). each edit of the file is checked byte for byte, after an undo and a redo,
// and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
// the slide of the demo deck with a paragraph, a list, and a figure in a zone
const FIGURES = [...readFileSync(DECK, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => m[0].includes('Figures are first class citizens'));
const PLATFORMS = ['mac', 'other'];
const KEYS = {
  mac: { front: 'Mod+Shift+F', forward: 'Mod+Alt+Shift+F', backward: 'Mod+Alt+Shift+B', back: 'Mod+Shift+B' },
  other: { front: 'Mod+Shift+ArrowUp', forward: 'Mod+ArrowUp', backward: 'Mod+ArrowDown', back: 'Mod+Shift+ArrowDown' },
};
const P = '.reveal section.present > p';
const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATE = [...readFileSync(LAYOUTS, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => m[0].includes('A figure slide with a paper image'));
const ROW = '.beeson-edit-objects .row';
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };

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
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const orders = async (page) => Object.fromEntries(await Promise.all(['front', 'forward', 'backward', 'back'].map(async (o) => [o, (await state(page, `arrange.order.${o}`)).enabled])));
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
// the start tags of a text that differ from those of base
const changedTags = (base, text) => {
  const a = base.match(/<[a-z][^>]*>/g), b = text.match(/<[a-z][^>]*>/g);
  return b.filter((t, i) => t !== a[i]);
};
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName)`);

// the editor on the demo deck served over HTTP, with the storage of the origin emptied first, and
// with slide n shown
async function load(t, platform, n = FIGURES, deck = DECK) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the boxes of the children of the current slide, to compare their places before and after a command
const boxes = (page) => page.evaluate(`[...document.querySelector('.reveal section.present').children].map((e) => { const r = e.getBoundingClientRect(); return e.localName + ' ' + [r.left, r.top, r.width, r.height].map(Math.round).join(' '); })`);

// a point of the text of the paragraph over the shown picture of the figure, in CSS px
const textOverPicture = (page) => page.evaluate(`(() => {
  const p = document.querySelector(${js(P)});
  const img = [...document.querySelectorAll('.reveal section.present figure img')].find((i) => i.getClientRects().length);
  const b = img.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(p);
  for (const r of range.getClientRects()) {
    const x = Math.max(r.left, b.left + 20), y = r.top + r.height / 2;
    if (x + 10 < Math.min(r.right, b.right) && y > b.top && y < b.bottom) return { x: x + 10, y };
  }
  return null;
})()`);

// the element of the slide drawn at a point, past the frames and the chrome of the editor
const drawnAt = (page, at) => page.evaluate(`(() => {
  const hit = document.elementsFromPoint(${at.x}, ${at.y}).find((e) => e.closest('.reveal section.present'));
  return hit ? (hit.closest(${js(P)}) ? 'p' : hit.localName) : null;
})()`);

// the rows of the object list, from front to back
const rows = (page) => page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.querySelector('.name').textContent)`);

// the element of the slide with the figures drawn at a point of the text of its paragraph over the
// picture, in the show or in the print view of a deck, on the page of its last step
const drawnInDeck = (page) => page.evaluate(`(() => {
  const slides = [...document.querySelectorAll('.reveal .slides section')].filter((x) => x.textContent.includes('Figures are first'));
  const s = slides.at(-1);
  s.scrollIntoView();
  const p = s.querySelector(':scope > p');
  const img = [...s.querySelectorAll('figure img')].find((i) => i.getClientRects().length);
  const b = img.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(p);
  for (const r of range.getClientRects()) {
    const x = Math.max(r.left, b.left + 20) + 10, y = r.top + r.height / 2;
    if (x < Math.min(r.right, b.right) && y > b.top && y < b.bottom) {
      const hit = document.elementsFromPoint(x, y).find((e) => s.contains(e));
      return hit ? (p.contains(hit) ? 'p' : hit.localName) : null;
    }
  }
  return 'no text over the picture';
})()`);

async function checkEdit(page, edited, base) {
  assert.notEqual(edited, base);
  await undo(page);
  await frames(page);
  assert.equal(await render(page), base);
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited);
  await saveAndReopen(page, `r13-1-${Math.random().toString(36).slice(2)}.html`);
  assert.deepEqual(errors(page), []);
}

for (const platform of PLATFORMS) {
  test(`${platform}: a paragraph dragged onto the figure is brought in front of its picture`, async (t) => {
    const page = await load(t, platform);
    const scale = await page.evaluate(`document.querySelector('.reveal section.present').getBoundingClientRect().width / 1920`);
    await click(page, P);
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['p']);
    // the paragraph is moved by its handle by 700 by 100 slide px onto the picture
    const from = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-handle')].find((d) => !d.hidden && d.getClientRects().length).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, from, { dx: 700 * scale, dy: 100 * scale, steps: 12 });
    await frames(page);
    const dragged = await render(page);
    assert.notEqual(dragged, page.source);
    const at = await textOverPicture(page);
    assert.ok(at, 'the text of the paragraph is not over the picture');
    assert.equal(await drawnAt(page, at), 'img', 'the paragraph is not under the picture before Bring to Front');
    const placed = await boxes(page);

    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false }, 'the layer commands of the moved paragraph');
    await press(page, KEYS[platform].front);
    await frames(page);
    assert.equal(await drawnAt(page, at), 'p', 'the paragraph is not drawn over the picture after Bring to Front');
    assert.deepEqual(await boxes(page), placed, 'an element is moved on the slide by Bring to Front');
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: true, back: true });
    assert.equal(await undoLabel(page), 'Undo Bring to Front');
    const front = await render(page);
    const tags = changedTags(dragged, front);
    assert.equal(tags.length, 1, `Bring to Front changes the tags ${js(tags)}`);
    assert.deepEqual(tags[0].match(/^<p style="([^"]*)">$/)[1].split('; ').sort(), ['position: relative', 'translate: 700px 111px', 'z-index: 1']);
    await checkEdit(page, front, dragged);
    await frames(page);
    assert.equal(await drawnAt(page, at), 'p');
    await press(page, LIST_KEY[platform]);
    await frames(page);
    assert.equal((await rows(page))[0], 'Text: Export your matplotlib figure with…', 'the object list does not show the paragraph in front');

    // the show and the print view of the saved deck draw the paragraph over the picture
    const file = `.r13-1-${platform}.html`;
    writeFileSync(file, front);
    t.after(() => rmSync(file, { force: true }));
    const offline = await launch();
    t.after(() => offline.close());
    const show = await offline.newPage({ width: 1600, height: 1000 });
    await show.goto(deckUrl(file, 'still', `/${FIGURES}`));
    await show.waitFor(deckSettled);
    assert.equal(await drawnInDeck(show), 'p', 'the show does not draw the paragraph over the picture');
    await printView(show, deckUrl(file, 'print-pdf&still'));
    assert.equal(await drawnInDeck(show), 'p', 'the print view does not draw the paragraph over the picture');

    // Send to Back puts it under the picture again, without a move on the slide
    if ((await selected(page))[0] !== 'p') {
      await click(page, at);
      await press(page, 'Escape');
      await frames(page);
    }
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.equal(await drawnAt(page, at), 'img', 'the paragraph is not drawn under the picture after Send to Back');
    assert.deepEqual(await boxes(page), placed, 'an element is moved on the slide by Send to Back');
    assert.equal(await render(page), dragged, 'Send to Back does not take the order of Bring to Front off the paragraph');
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  test(`${platform}: the figure is brought in front of a paragraph raised by Bring to Front with a z-index, and moved in the file otherwise`, async (t) => {
    const page = await load(t, platform);
    const scale = await page.evaluate(`document.querySelector('.reveal section.present').getBoundingClientRect().width / 1920`);
    await click(page, P);
    await press(page, 'Escape');
    const from = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-handle')].find((d) => !d.hidden && d.getClientRects().length).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, from, { dx: 700 * scale, dy: 100 * scale, steps: 12 });
    await press(page, KEYS[platform].front);
    await frames(page);
    const at = await textOverPicture(page);
    const raised = await render(page);
    // a click on the picture selects the figure, which is then brought in front of the paragraph
    const img = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.reveal section.present figure img')].find((i) => i.getClientRects().length).getBoundingClientRect(); return { x: r.left + 20, y: r.bottom - 20 }; })()`);
    await click(page, img);
    await frames(page);
    assert.deepEqual(await selected(page), ['figure']);
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: true, back: true });
    await press(page, KEYS[platform].front);
    await frames(page);
    assert.equal(await drawnAt(page, at), 'img');
    const front = await render(page);
    assert.deepEqual(changedTags(raised, front), ['<figure class="zone" style="z-index: 1">']);
    await checkEdit(page, front, raised);
    // Send to Back moves the figure before the list in the file and takes its z-index off, as for a
    // figure without one
    await click(page, img);
    await frames(page);
    assert.deepEqual(await selected(page), ['figure']);
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.equal(await drawnAt(page, at), 'p');
    const back = await render(page);
    assert.ok(back.includes('<figure class="zone">') && back.indexOf('<figure class="zone">') < back.indexOf('<ul style'), 'Send to Back does not move the figure before the list');
    await checkEdit(page, back, front);
  });

  test(`${platform}: a plate does not have layer commands, and a heading moved over it is put after it in the file`, async (t) => {
    const page = await load(t, platform, PLATE, LAYOUTS);
    await click(page, '.reveal section.present .plate img');
    await frames(page);
    assert.deepEqual(await selected(page), ['div']);
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: false, back: false });
    // the heading is moved by its handle onto the plate, under which it is drawn
    await click(page, '.reveal section.present > h2');
    await press(page, 'Escape');
    const from = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-handle')].find((d) => !d.hidden && d.getClientRects().length).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const scale = await page.evaluate(`document.querySelector('.reveal section.present').getBoundingClientRect().width / 1920`);
    await drag(page, from, { dx: 0, dy: 400 * scale, steps: 10 });
    await frames(page);
    const moved = await render(page);
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    await press(page, KEYS[platform].forward);
    await frames(page);
    const front = await render(page);
    // the heading of a figure slide is out of the flow, hence it is moved after the plate in the file
    assert.ok(front.indexOf('<h2 style="translate: 0px') > front.indexOf('<div class="plate">'), 'the heading is not put after the plate');
    assert.doesNotMatch(front, /z-index/);
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: true, back: true });
    await checkEdit(page, front, moved);
    await click(page, '.reveal section.present .plate img');
    await frames(page);
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: false, back: false });
  });
}

// the list of the slide with the figures, sent behind the paragraph before it, which takes a
// negative z-index since the list is in the flow after it
for (const platform of PLATFORMS) {
  test(`${platform}: a list sent behind the paragraph before it is drawn in the show and in the print view`, async (t) => {
    const page = await load(t, platform);
    await click(page, P);
    await press(page, 'Escape');
    await press(page, 'ArrowDown');
    await frames(page);
    const nudged = await render(page);
    await click(page, '.reveal section.present > ul li');
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['ul']);
    await press(page, KEYS[platform].back);
    await frames(page);
    const back = await render(page);
    assert.deepEqual(changedTags(nudged, back), ['<ul style="translate: 0px 20px; position: relative; z-index: -1">']);
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    await checkEdit(page, back, nudged);
    // Bring Forward puts the list over the paragraph again, as in the file, and takes the
    // declarations off
    await click(page, '.reveal section.present > ul li');
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['ul']);
    await press(page, KEYS[platform].forward);
    await frames(page);
    assert.equal(await render(page), nudged, 'Bring Forward leaves declarations on the list back in the order of the file');
    const file = `.r13-1-back-${platform}.html`;
    writeFileSync(file, back);
    t.after(() => rmSync(file, { force: true }));
    const offline = await launch();
    t.after(() => offline.close());
    const view = await offline.newPage({ width: 1600, height: 1000 });
    // the first element at a point of the text of the list, on the page of the last step
    const hit = () => view.evaluate(`(() => {
      const s = [...document.querySelectorAll('.reveal .slides section')].filter((x) => x.textContent.includes('Figures are first')).at(-1);
      s.scrollIntoView();
      const r = s.querySelector(':scope > ul li').getBoundingClientRect();
      const e = document.elementsFromPoint(r.left + r.width / 2, r.top + 10)[0];
      return e?.closest('ul') ? 'ul' : e?.className ?? null;
    })()`);
    await view.goto(deckUrl(file, 'still', `/${FIGURES}`));
    await view.waitFor(deckSettled);
    assert.equal(await hit(), 'ul', 'the show does not draw the list');
    await printView(view, deckUrl(file, 'print-pdf&still'));
    assert.equal(await hit(), 'ul', 'the print view draws the list under the background of its page');
  });
}

// a paragraph that is not moved, ordered by the commands or by its row and brought back to the
// order of the file, keeps the style of the file, and Reset Slide takes the order off
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
async function selectP(page) {
  await click(page, P);
  await press(page, 'Escape');
  await frames(page);
  assert.deepEqual(await selected(page), ['p']);
}
const rowOf = (page, name) => page.evaluate(`(() => { const rs = [...document.querySelectorAll(${js(ROW)})]; const r = rs.find((x) => x.querySelector('.name').textContent.startsWith(${js(name)})).getBoundingClientRect(); const all = rs.map((x) => x.getBoundingClientRect()); return { x: r.left + 60, y: r.top + r.height / 2, top: all[0].top, bottom: all.at(-1).bottom }; })()`);

for (const platform of PLATFORMS) {
  test(`${platform}: a paragraph that is not moved is put back to the style of the file by Send Backward and Send to Back`, async (t) => {
    const page = await load(t, platform);
    await selectP(page);
    await press(page, KEYS[platform].forward);
    await frames(page);
    assert.deepEqual(changedTags(page.source, await render(page)), ['<p style="position: relative">']);
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: true, back: true }, 'the commands that put the paragraph back are dimmed');
    await press(page, KEYS[platform].backward);
    await frames(page);
    assert.equal(await render(page), page.source, 'Send Backward leaves a declaration on the paragraph');
    await press(page, KEYS[platform].front);
    await frames(page);
    assert.notEqual(await render(page), page.source);
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.equal(await render(page), page.source, 'Send to Back leaves a declaration on the paragraph');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    const { text } = await saveAndReopen(page, `r13-1-home-${platform}.html`);
    assert.equal(text, page.source);
  });

  test(`${platform}: a paragraph dragged in the object list to the front and back to the bottom keeps the style of the file`, async (t) => {
    const page = await load(t, platform);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const NAME = 'Text: Export your matplotlib';
    let at = await rowOf(page, NAME);
    await drag(page, { x: at.x, y: at.y }, { dy: at.top + 2 - at.y, steps: 8 });
    await frames(page);
    assert.ok((await rows(page))[0].startsWith(NAME), `the row of the paragraph is not in front: ${js(await rows(page))}`);
    assert.match(await render(page), /<p style="position: relative; z-index: 1">Export/);
    at = await rowOf(page, NAME);
    await drag(page, { x: at.x, y: at.y }, { dy: at.bottom - 2 - at.y, steps: 8 });
    await frames(page);
    assert.equal(await render(page), page.source, 'a drag back to the order of the file leaves a declaration on the paragraph');
  });

  test(`${platform}: Reset Slide takes off the z-index and the position written by a layer command`, async (t) => {
    const page = await load(t, platform);
    await selectP(page);
    await press(page, KEYS[platform].front);
    await frames(page);
    const front = await render(page);
    assert.match(front, /<p style="position: relative; z-index: 1">Export/);
    await exec(page, 'slide.reset');
    await frames(page);
    const reset = await render(page);
    const slide = reset.match(/<section>\s*<h2>Figures are first[\s\S]*?<\/section>/)[0];
    assert.doesNotMatch(slide, /z-index|position/, 'Reset Slide keeps the order of a layer command');
    await checkEdit(page, reset, front);
  });
}
