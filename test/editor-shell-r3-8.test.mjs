// the findings of round 1 of the council on the shell, the navigator, and the place of an insert,
// on both platforms: the scroll bars of a zoomed canvas, the inspector at the start, the View and
// Zoom popups of the toolbar, the numbers and the skipped slides of the navigator, the outline
// view, the popover of Add Slide, the place of a new text box and QR code, the keyboard sheet, the
// history after an empty box, Paste Style on a step, and the brand images of the thumbnails. each
// edit is checked byte for byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { History } from '../src/editor/history.ts';
import { center, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
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

const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg !== undefined ? `, ${JSON.stringify(arg)}` : ''})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on a deck served over HTTP, with the storage of the origin emptied first, or with
// keep the storage of the page before, and with slide n shown
async function load(t, platform, { deck = LAYOUTS, n = 0, size = { width: 1600, height: 1000 }, scheme, keep = false } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  if (scheme) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  if (!keep) {
    await page.goto(`${server.origin}/theme/beeson.css`);
    await page.evaluate('localStorage.clear()');
  }
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// an undo gives the text before byte for byte, and a redo gives the edited text again
async function undoRedo(page, before, edited) {
  await undo(page);
  await sleep(100);
  assert.equal(await render(page), before);
  await redo(page);
  await sleep(100);
  assert.equal(await render(page), edited);
}

let saves = 0;
async function savedAs(page, edited) {
  const { text } = await saveAndReopen(page, `shell-r3-8-${++saves}.html`);
  assert.equal(text, edited);
}

for (const platform of PLATFORMS) {
  test(`a light thumbnail of a closing slide on a page under test/pages loads the lockup of brand/ (${platform})`, async (t) => {
    const page = await load(t, platform);
    if ((await page.evaluate('Beeson.theme.get()')) !== 'light') await page.evaluate('Beeson.theme.toggle()');
    const closing = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.classList.contains('closing'))`);
    await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[${closing}].scrollIntoView()`);
    await sleep(1200);
    const url = await page.evaluate(`(() => {
      const pic = document.querySelectorAll('.beeson-edit-nav .row')[${closing}].querySelector('.pic');
      const s = pic.shadowRoot?.querySelector('section.closing');
      return s ? getComputedStyle(s, '::before').backgroundImage : null;
    })()`);
    assert.match(url ?? '', /\/brand\/lockup-light\.png/);
    assert.doesNotMatch(url, /test\/pages\/brand/);
    assert.deepEqual(errors(page), []);
  });
}

// the whole text of the first shown element of the current slide matched by selector with has in
// its text is selected, with the focus in its block
const selectAll = (page, selector, has) =>
  page.evaluate(`(() => {
    const el = [...document.querySelectorAll('.reveal section.present ' + ${JSON.stringify(selector)})].find((e) => e.textContent.includes(${JSON.stringify(has)}));
    el.closest('[contenteditable="true"]')?.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  })()`);

const slideOf = (page, heading) => page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('h2')?.textContent.includes(${JSON.stringify(heading)}))`);

for (const platform of PLATFORMS) {
  test(`Paste Style reads the style of a paragraph that is a step and sets a style on it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await page.evaluate(`Reveal.slide(${await slideOf(page, 'Math, an ordered list')})`);
    await frames(page);
    // from a step: the body style of the paragraph makes a paragraph of a list item
    await selectAll(page, 'p.fragment', 'Coriolis');
    await exec(page, 'text.copyStyle');
    await selectAll(page, 'li', 'A first step');
    await exec(page, 'text.pasteStyle');
    await frames(page);
    const item = await render(page);
    assert.ok(!item.includes('<li class="fragment" data-fragment-index="3">A first step</li>'), 'the list item is not made a paragraph');
    assert.match(item, /<p[^>]*>A first step<\/p>/);
    assert.ok(!/class="[^"]*\b(visible|current-fragment)\b/.test(item), 'a class of reveal.js is written');
    await undoRedo(page, page.source, item);
    await undo(page);
    await sleep(100);
    // onto a step: the small style of a paragraph is set on the paragraph of the step
    await selectAll(page, 'p', 'The lead-in');
    await exec(page, 'text.style.small');
    await frames(page);
    const small = await render(page);
    await exec(page, 'text.copyStyle');
    await selectAll(page, 'p.fragment', 'Coriolis');
    await exec(page, 'text.pasteStyle');
    await frames(page);
    const edited = await render(page);
    assert.match(edited, /<p class="(fragment small|small fragment)" data-fragment-index="2" data-highlight="coriolis">where the/);
    assert.ok(!/class="[^"]*\b(visible|current-fragment)\b/.test(edited), 'a class of reveal.js is written');
    await undoRedo(page, small, edited);
    await savedAs(page, edited);
    assert.deepEqual(errors(page), []);
  });
}

test('discard takes the last entry out of the history without an undo, and keeps the redos empty', () => {
  const log = [];
  let changes = 0;
  const h = new History({ snapshot: () => '', restore: async () => {}, onChange: () => changes++ });
  const entry = (name) => ({ label: name, undo: () => log.push(`undo ${name}`), redo: () => log.push(`redo ${name}`) });
  h.push(entry('a'));
  h.push(entry('b'));
  h.discard();
  assert.equal(h.undoLabel, 'a');
  assert.equal(h.canRedo, false);
  assert.deepEqual(log, []);
  // an entry pushed right after the discard is kept
  h.push(entry('c'));
  assert.equal(h.undoLabel, 'c');
  assert.equal(changes, 4);
  h.discard();
  h.discard();
  h.discard();
  assert.equal(h.canUndo, false);
});

const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const PENDING = `document.querySelector('.reveal section.present .beeson-pending')`;

for (const platform of PLATFORMS) {
  for (const [id, label] of [['insert.text', 'Text Box'], ['insert.code', 'Code Box'], ['insert.footnote', 'Footnote']]) {
    test(`an empty ${label} that is left is taken out of the history, without a Redo (${platform})`, async (t) => {
      // slide 4 does not have a footnote
      const page = await load(t, platform, { n: 4 });
      // an edit before the insert stays the entry of Undo
      await exec(page, 'slide.hide');
      await frames(page);
      const hidden = await render(page);
      const undoBefore = (await state(page, 'edit.undo')).label;
      await exec(page, id);
      await frames(page);
      assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
      await press(page, 'Escape');
      await sleep(150);
      assert.equal(await page.evaluate(`!!${PENDING}`), false, 'the empty box is on the slide');
      assert.equal((await state(page, 'edit.redo')).enabled, false, `the history offers ${(await state(page, 'edit.redo')).label}`);
      assert.equal((await state(page, 'edit.undo')).label, undoBefore);
      assert.equal(await render(page), hidden);
      await undo(page);
      await sleep(100);
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }
}

for (const platform of PLATFORMS) {
  test(`the thumbnail of a slide with a plot paints its marks as the slide does (${platform})`, async (t) => {
    const page = await load(t, platform);
    const n = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => s.querySelector('.plot'))`);
    await page.evaluate(`Reveal.slide(${n})`);
    await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[${n}].scrollIntoView()`);
    await sleep(1200);
    const paints = await page.evaluate(`(() => {
      const pic = document.querySelectorAll('.beeson-edit-nav .row')[${n}].querySelector('.pic');
      const paint = (svg) => [...svg.querySelectorAll('path, circle, line, polyline, text')].map((e) => { const s = getComputedStyle(e); return e.localName + ' ' + s.fill + ' ' + s.stroke; });
      return { thumb: paint(pic.shadowRoot.querySelector('.plot svg')), slide: paint(document.querySelector('.reveal section.present .plot svg')) };
    })()`);
    assert.ok(paints.slide.some((p) => p.startsWith('circle') && !p.includes('rgb(0, 0, 0) none')), 'the slide does not have a colored mark');
    assert.deepEqual(paints.thumb, paints.slide);
    assert.deepEqual(errors(page), []);
  });
}

// the numbers of the rows of the navigator, '' for a row without one, and whether a row is the bar
// of a skipped slide
const navRows = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-nav .row')].map((r) => ({
    no: r.querySelector('.no').textContent,
    skip: r.classList.contains('skip'),
    height: Math.round(r.getBoundingClientRect().height),
    pic: getComputedStyle(r.querySelector('.pic')).display !== 'none',
  }))`);
const count = (page) => page.evaluate(`document.querySelector('.beeson-edit-bottom .count').textContent`);

for (const platform of PLATFORMS) {
  test(`every slide is numbered by its place, as in the status bar, and a hidden slide is a thin bar (${platform})`, async (t) => {
    const page = await load(t, platform);
    const total = await page.evaluate(`document.querySelectorAll('.reveal .slides > section').length`);
    assert.deepEqual((await navRows(page)).map((r) => r.no), Array.from({ length: total }, (_, i) => String(i + 1)));
    for (const n of [0, 1, 4, total - 1]) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      assert.equal(await count(page), `Slide ${n + 1} of ${total}`);
      assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-nav .row[aria-current="true"] .no').textContent`), String(n + 1));
    }
    // a hidden slide is a thin double bar without its picture or number, and it keeps its place
    await page.evaluate('Reveal.slide(3)');
    await frames(page);
    await exec(page, 'slide.hide');
    await sleep(100);
    const hidden = await render(page);
    const list = await navRows(page);
    assert.deepEqual(list[3], { no: '', skip: true, height: list[3].height, pic: false });
    assert.ok(list[3].height <= 14, `the bar of the skipped slide is ${list[3].height} px high`);
    assert.deepEqual(list.map((r) => r.no), Array.from({ length: total }, (_, i) => (i === 3 ? '' : String(i + 1))));
    // the bar is selected by a click, and the slide is shown again from its context menu
    await page.evaluate('Reveal.slide(0)');
    await frames(page);
    const bar = await page.evaluate(`(() => { const r = document.querySelectorAll('.beeson-edit-nav .row')[3]; r.scrollIntoView({ block: 'center' }); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    await click(page, bar);
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[3].getAttribute('aria-selected')`), 'true');
    assert.equal(await count(page), `Slide 4 of ${total}`);
    await click(page, bar, { button: 'right' });
    await frames(page);
    const item = `[...document.querySelectorAll('.beeson-edit-menu [role="menuitem"]')].find((m) => m.textContent.includes('Show Slide'))`;
    assert.equal(await page.evaluate(`!!${item}`), true, 'the context menu does not offer Show Slide');
    await page.evaluate(`${item}.click()`);
    await sleep(150);
    assert.equal(await render(page), page.source);
    assert.equal((await navRows(page))[3].no, '4');
    await undo(page);
    await sleep(100);
    assert.equal(await render(page), hidden);
    assert.deepEqual(errors(page), []);
  });
}

const inspector = (page) =>
  page.evaluate(`(() => {
    const el = document.querySelector('.beeson-edit-inspector');
    return { shown: el.getClientRects().length > 0 && el.getBoundingClientRect().width > 200, tab: el.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null };
  })()`);

for (const platform of PLATFORMS) {
  test(`the editor opens with the inspector on its Format tab, and remembers that it was closed (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    assert.deepEqual(await inspector(page), { shown: true, tab: 'Format' });
    assert.equal((await state(page, 'shell.format')).checked, true);
    // closed with Format, it stays closed when the editor is opened again in the same browser
    await exec(page, 'shell.format');
    await frames(page);
    assert.equal((await inspector(page)).shown, false);
    assert.deepEqual(errors(page), []);
    await page.close();
    const again = await load(t, platform, { n: 3, keep: true });
    assert.equal((await inspector(again)).shown, false);
    await exec(again, 'shell.format');
    await frames(again);
    await again.close();
    const third = await load(t, platform, { n: 3, keep: true });
    assert.deepEqual(await inspector(third), { shown: true, tab: 'Format' });
    assert.equal(await render(third), third.source);
    assert.deepEqual(errors(third), []);
  });
}

const rectOf = (page, selector) =>
  page.evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return b ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom } : null; })()`);

for (const platform of PLATFORMS) {
  test(`the Add Slide chooser opens as a popover under the button that opened it (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    const button = '.beeson-edit-top [data-command="slide.gallery"]';
    await click(page, button);
    await frames(page);
    const b = await rectOf(page, button);
    let g = await rectOf(page, '.beeson-edit-gallery');
    assert.ok(g, 'the chooser is not open');
    assert.ok(g.top >= b.bottom && g.top - b.bottom <= 12, `the chooser is ${g.top - b.bottom} px under the Add Slide button`);
    assert.ok(g.left <= (b.left + b.right) / 2 && g.right >= b.left, 'the chooser is not under the Add Slide button');
    await press(page, 'Escape');
    await frames(page);
    assert.equal(await rectOf(page, '.beeson-edit-gallery'), null);
    // the + button at the foot of the navigator opens the chooser over it, inside the window
    const plus = '.beeson-edit-nav .foot [data-command="slide.gallery"]';
    await click(page, plus);
    await frames(page);
    const p = await rectOf(page, plus);
    g = await rectOf(page, '.beeson-edit-gallery');
    assert.ok(g, 'the + button of the navigator does not open the chooser');
    assert.ok(g.bottom <= p.top && p.top - g.bottom <= 12, `the chooser is ${p.top - g.bottom} px over the + button`);
    assert.ok(g.left <= p.right && g.right >= p.left, 'the chooser is not over the + button');
    // a layout chosen there adds a slide after the current one
    await click(page, '.beeson-edit-gallery .tile[data-layout="content"]');
    await sleep(150);
    assert.equal(await count(page), `Slide 5 of ${(await navRows(page)).length}`);
    await undo(page);
    await sleep(100);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the gap, in slide px, between the new box of a Text Box and the block before it, and the gap of
// the theme between two paragraphs
const gapAbove = (page) =>
  page.evaluate(`(() => {
    const box = document.querySelector('.reveal section.present .beeson-pending');
    const slides = document.querySelector('.reveal .slides');
    const k = slides.getBoundingClientRect().width / slides.offsetWidth;
    const prev = box.previousElementSibling;
    const p = document.querySelector('.reveal section.present > p:not(.beeson-pending)');
    return { gap: (box.getBoundingClientRect().top - prev.getBoundingClientRect().bottom) / k, theme: parseFloat(getComputedStyle(p).marginBottom) };
  })()`);

for (const platform of PLATFORMS) {
  test(`a new text box under a list is put at the spacing of the paragraphs of the theme (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 3 });
    await exec(page, 'insert.text');
    await frames(page);
    const { gap, theme } = await gapAbove(page);
    assert.ok(theme > 0);
    assert.ok(Math.abs(gap - theme) < 1, `the new text box is ${gap} px under the list, and paragraphs are ${theme} px apart`);
    await type(page, 'A new paragraph.');
    await press(page, 'Escape');
    await frames(page);
    const edited = await render(page);
    assert.match(edited, /<\/ol>\n  <p>A new paragraph.<\/p>\n/);
    await undoRedo(page, page.source, edited);
    assert.deepEqual(errors(page), []);
  });
}

// five paragraphs on the clipboard of the editor, which fill the text column of a slide to its foot
const PARAGRAPHS = ['<!--beeson-->', ...Array.from({ length: 5 }, (_, i) => `<p>Paragraph ${i + 1} of a column that is filled to the foot of the slide.</p>`)].join('\n');

const slideBoxOf = (page, selector) =>
  page.evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return null;
    const s = document.querySelector('.reveal .slides');
    const k = s.getBoundingClientRect().width / s.offsetWidth;
    const o = s.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { left: (r.left - o.left) / k, top: (r.top - o.top) / k, right: (r.right - o.left) / k, bottom: (r.bottom - o.top) / k };
  })()`);

// a new slide of layout, with its column filled to the foot
async function fullSlide(page, layout) {
  await exec(page, `slide.new.${layout}`);
  await frames(page);
  await press(page, 'Escape');
  await press(page, 'Escape');
  await exec(page, 'edit.paste', PARAGRAPHS);
  await frames(page);
  return render(page);
}

for (const platform of PLATFORMS) {
  test(`a QR code inserted on a full slide is put in the free area at the right of its column (${platform})`, async (t) => {
    const page = await load(t, platform);
    const full = await fullSlide(page, 'content');
    await exec(page, 'insert.qr');
    await frames(page);
    const qr = await slideBoxOf(page, '.reveal section.present .qr');
    // the zone of a content slide, at the right of its column, in the slide px of theme/beeson.css
    const zone = { left: 1200, top: 120, right: 1800, bottom: 920 };
    assert.ok(qr.left >= zone.left && qr.right <= zone.right && qr.top >= zone.top && qr.bottom <= zone.bottom, `the QR code is not in the zone: ${JSON.stringify(qr)}`);
    assert.ok(Math.abs((qr.left + qr.right) / 2 - 1500) < 2 && Math.abs((qr.top + qr.bottom) / 2 - 520) < 2, `the QR code is not at the center of the zone: ${JSON.stringify(qr)}`);
    const edited = await render(page);
    assert.match(edited, /<p>Paragraph 5 [^\n]*<\/p>\n  <div class="qr" data-qr="https:\/\/example.com" style="translate: \d+px -?\d+px"><\/div>\n/);
    await undoRedo(page, full, edited);
    await savedAs(page, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`a QR code inserted on a full wide slide, without a free area, is centered on the slide (${platform})`, async (t) => {
    const page = await load(t, platform);
    await fullSlide(page, 'wide');
    await exec(page, 'insert.qr');
    await frames(page);
    const qr = await slideBoxOf(page, '.reveal section.present .qr');
    assert.ok(Math.abs((qr.left + qr.right) / 2 - 960) < 2 && Math.abs((qr.top + qr.bottom) / 2 - 540) < 2, `the QR code is not centered: ${JSON.stringify(qr)}`);
    assert.deepEqual(errors(page), []);
  });
}
