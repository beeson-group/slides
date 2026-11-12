// regression tests of R15.2 on both platforms with trusted input. the layer commands of
// commands/order.ts and a drag of a row of the object list follow the order that the object list
// shows, also past a text in the flow that was never moved (D25, D26). the declarations that they
// write are taken off every element once the slide is drawn in the same order without them (juror
// item 3b). a text sent to the back is still drawn and clicked, and the declarations of the author
// are kept

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
const slideOf = (deck, has) => [...readFileSync(deck, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => has(m[0]));
// the slide of the demo deck with a heading, a paragraph, a list, and a figure in a zone
const FIGURES = slideOf(DECK, (s) => s.includes('Figures are first class citizens'));
const TITLE = slideOf(DECK, (s) => s.startsWith('<section class="title"'));
const SPLIT = slideOf(LAYOUTS, (s) => s.startsWith('<section class="split"'));
const PLATFORMS = ['mac', 'other'];
const KEYS = {
  mac: { front: 'Mod+Shift+F', forward: 'Mod+Alt+Shift+F', backward: 'Mod+Alt+Shift+B', back: 'Mod+Shift+B' },
  other: { front: 'Mod+Shift+ArrowUp', forward: 'Mod+ArrowUp', backward: 'Mod+ArrowDown', back: 'Mod+Shift+ArrowDown' },
};
const S = '.reveal section.present';
const EL = { h2: `${S} > h2`, p: `${S} > p`, ul: `${S} > ul`, figure: `${S} > figure` };
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
const ROW = '.beeson-edit-objects .row';
const ROWS = { h2: 'Text: Figures are first', p: 'Text: Export your matplotlib', ul: 'Text: Dark and light mode', figure: 'Figure: Zero-velocity' };

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
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName)`);
// the rows of the object list from front to back, and the same rows by their key in ROWS
const rows = (page) => page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.querySelector('.name').textContent)`);
const named = async (page) => (await rows(page)).map((r) => Object.keys(ROWS).find((k) => r.startsWith(ROWS[k])) ?? r);

async function load(t, platform, { n = FIGURES, deck = DECK } = {}) {
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

// the element of selector selected as an object, by a click and Esc out of its text
async function pick(page, selector, name) {
  await click(page, selector);
  await frames(page);
  if (js(await selected(page)) !== js([name])) await press(page, 'Escape');
  await frames(page);
  assert.deepEqual(await selected(page), [name]);
}

async function layer(page, platform, name, order) {
  await pick(page, EL[name], name);
  await press(page, KEYS[platform][order]);
  await frames(page);
}

async function checkEdit(page, edited, base) {
  assert.notEqual(edited, base);
  await undo(page);
  await frames(page);
  assert.equal(await render(page), base, 'the undo does not give the file back byte for byte');
  await redo(page);
  await frames(page);
  assert.equal(await render(page), edited);
  await saveAndReopen(page, `r15-2-${Math.random().toString(36).slice(2)}.html`);
  assert.deepEqual(errors(page), []);
}

// a point of the text of the first element of selector inside the box of the shown picture of the
// figure of its slide, in CSS px, or null
const textOverPicture = (selector) => `(() => {
  const el = document.querySelector(${js(selector)});
  const img = [...el.closest('section').querySelectorAll('figure img')].find((i) => i.getClientRects().length);
  const b = img.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  for (const r of range.getClientRects()) {
    const x = Math.min(r.right, b.right) - 12, y = r.top + r.height / 2;
    if (x > Math.max(r.left, b.left) + 4 && y > b.top && y < b.bottom) return { x, y };
  }
  return null;
})()`;
// the child of the slide drawn at a point, or null
const childAt = (page, at, slide = S) => page.evaluate(`(() => {
  const hit = document.elementsFromPoint(${at.x}, ${at.y}).find((e) => e.closest(${js(slide)}));
  const child = hit?.closest(${js(slide + ' > *')});
  return child ? child.localName : null;
})()`);

for (const platform of PLATFORMS) {
  test(`${platform}: a figure dragged over the heading and the paragraph is sent behind both by Send to Back`, async (t) => {
    const page = await load(t, platform);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const scale = await page.evaluate(`document.querySelector(${js(S)}).getBoundingClientRect().width / 1920`);
    const img = await page.evaluate(`(() => { const r = [...document.querySelectorAll(${js(S + ' figure img')})].find((i) => i.getClientRects().length).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, img);
    await frames(page);
    assert.deepEqual(await selected(page), ['figure']);
    // the drag of finding 2 of the judge opus in round 6, in slide px
    await drag(page, img, { dx: -556 * scale, dy: -226 * scale, steps: 12 });
    await frames(page);
    const dragged = await render(page);
    assert.notEqual(dragged, page.source);
    const overH2 = await page.evaluate(textOverPicture(EL.h2));
    const overP = await page.evaluate(textOverPicture(EL.p));
    assert.ok(overH2 && overP, 'the figure is not dragged over the heading and the paragraph');
    assert.equal(await childAt(page, overH2), 'figure');
    assert.equal(await childAt(page, overP), 'figure');
    assert.deepEqual(await orders(page), { front: false, forward: false, backward: true, back: true });

    await press(page, KEYS[platform].back);
    await frames(page);
    assert.equal(await childAt(page, overH2), 'h2', 'Send to Back leaves the figure over the heading');
    assert.equal(await childAt(page, overP), 'p', 'Send to Back leaves the figure over the paragraph');
    assert.equal((await named(page)).at(-1), 'figure', 'the figure is not at the back of the object list');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    const back = await render(page);
    await checkEdit(page, back, dragged);

    // the show and the print view of the saved deck draw the heading over the figure
    const file = `.r15-2-back-${platform}.html`;
    writeFileSync(file, back);
    t.after(() => rmSync(file, { force: true }));
    const offline = await launch();
    t.after(() => offline.close());
    const show = await offline.newPage({ width: 1600, height: 1000 });
    const inDeck = async () => {
      await show.evaluate(`(() => { const s = [...document.querySelectorAll('.reveal .slides section')].filter((x) => x.textContent.includes('Figures are first')).at(-1); s.scrollIntoView(); s.id = 'r15-2'; return true; })()`);
      const at = await show.evaluate(textOverPicture('#r15-2 > h2'));
      assert.ok(at, 'the figure is not over the heading in the deck');
      return childAt(show, at, '#r15-2');
    };
    await show.goto(deckUrl(file, 'still', `/${FIGURES}`));
    await show.waitFor(deckSettled);
    assert.equal(await inDeck(), 'h2', 'the show draws the figure over the heading');
    await printView(show, deckUrl(file, 'print-pdf&still'));
    assert.equal(await inDeck(), 'h2', 'the print view draws the figure over the heading');
  });

  test(`${platform}: Send to Back and Send Backward pass the texts in the flow, one layer of the object list at a time`, async (t) => {
    const page = await load(t, platform);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    assert.deepEqual(await named(page), ['figure', 'ul', 'p', 'h2']);
    await pick(page, EL.ul, 'ul');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: true, back: true }, 'a command that passes a text in the flow is dimmed');
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.deepEqual(await named(page), ['figure', 'p', 'h2', 'ul'], 'Send to Back does not put the list behind the texts');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source, 'the undo does not give the file back byte for byte');

    // Send Backward passes the paragraph only, and two steps of Bring Forward put the list back in
    // the order of the file
    await layer(page, platform, 'ul', 'backward');
    assert.deepEqual(await named(page), ['figure', 'p', 'ul', 'h2'], 'Send Backward does not pass one layer');
    await layer(page, platform, 'ul', 'backward');
    assert.deepEqual(await named(page), ['figure', 'p', 'h2', 'ul']);
    await layer(page, platform, 'ul', 'forward');
    assert.deepEqual(await named(page), ['figure', 'p', 'ul', 'h2'], 'Bring Forward does not pass one layer');
    await layer(page, platform, 'ul', 'forward');
    assert.deepEqual(await named(page), ['figure', 'ul', 'p', 'h2']);
    assert.equal(await render(page), page.source, 'a declaration is left once the list is back in the order of the file');
    // Bring Forward of the paragraph passes the list and leaves the paragraph under the figure
    await layer(page, platform, 'p', 'forward');
    assert.deepEqual(await named(page), ['figure', 'p', 'ul', 'h2']);
    await layer(page, platform, 'p', 'backward');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: the declarations of the layer commands are taken off every element once the slide is in the order of the file, and those of the author are kept`, async (t) => {
    // a copy of the demo deck in which the author wrote a position on the list and a z-index on the
    // figure
    const file = `.r15-2-author-${platform}.html`;
    const authored = readFileSync(DECK, 'utf8').replace('<ul style="translate: 0px 20px">', '<ul style="translate: 0px 20px; position: relative">').replace('<figure class="zone">\n    <img class="for-dark" src="demo/figure-dark.png"', '<figure class="zone" style="z-index: 2">\n    <img class="for-dark" src="demo/figure-dark.png"');
    assert.ok(authored.includes('position: relative">') && authored.includes('style="z-index: 2"'));
    writeFileSync(file, authored);
    t.after(() => rmSync(file, { force: true }));
    const page = await load(t, platform, { deck: file });
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const opened = await named(page);
    assert.deepEqual(opened, ['figure', 'ul', 'p', 'h2']);
    await layer(page, platform, 'p', 'front');
    await layer(page, platform, 'figure', 'front');
    assert.deepEqual(await named(page), ['figure', 'p', 'ul', 'h2']);
    await layer(page, platform, 'p', 'backward');
    assert.deepEqual(await named(page), opened);
    assert.equal(await render(page), page.source, 'a declaration is left on an element that the last command did not move, or one of the author is changed');
    await layer(page, platform, 'h2', 'front');
    await layer(page, platform, 'ul', 'back');
    await layer(page, platform, 'h2', 'back');
    assert.deepEqual(await named(page), ['figure', 'p', 'ul', 'h2']);
    await layer(page, platform, 'ul', 'forward');
    assert.deepEqual(await named(page), opened);
    assert.equal(await render(page), page.source, 'a declaration is left on the heading or the list, or one of the author is taken off');
    const { text } = await saveAndReopen(page, `.r15-2-clean-${platform}.html`);
    assert.equal(text, page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: a text of the panel of a split slide sent to the back is drawn over the panel`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS, n: SPLIT });
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const P = `${S} .panel > p`;
    await pick(page, P, 'p');
    assert.equal((await orders(page)).back, true, 'Send to Back is dimmed for the paragraph over the heading');
    await press(page, KEYS[platform].back);
    await frames(page);
    const first = await page.evaluate(`document.querySelector(${js(P)}).textContent.trim().split(' ')[0]`);
    assert.ok((await rows(page)).at(-1).startsWith(`Text: ${first}`), 'the paragraph is not at the back of the object list');
    for (const sel of [P, `${S} .panel > h2`]) {
      const top = await page.evaluate(`(() => {
        const el = document.querySelector(${js(sel)});
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getClientRects()[0];
        return el.contains(document.elementsFromPoint(r.left + 8, r.top + r.height / 2)[0]);
      })()`);
      assert.ok(top, `${sel} is drawn under the panel`);
    }
    await checkEdit(page, await render(page), page.source);
  });

  test(`${platform}: a subtitle of the title slide sent to the back is drawn and clicked`, async (t) => {
    const page = await load(t, platform, { n: TITLE });
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const SUB = `${S} .block > p.sub`;
    await pick(page, SUB, 'p');
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.ok((await rows(page)).at(-1).startsWith('Text: Template for the Beeson'), 'the subtitle is not at the back of the object list');
    const back = await render(page);
    assert.notEqual(back, page.source);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await frames(page);
    const at = await page.evaluate(`(() => { const range = document.createRange(); range.selectNodeContents(document.querySelector(${js(SUB)})); const r = range.getClientRects()[0]; return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
    assert.ok(await page.evaluate(`document.querySelector(${js(SUB)}).contains(document.elementsFromPoint(${at.x}, ${at.y})[0])`), 'the subtitle is drawn under another element');
    await click(page, at);
    await frames(page);
    assert.ok(await page.evaluate(`document.querySelector(${js(SUB)}).contains(document.activeElement)`), 'a click on the subtitle does not put the caret in it');
    await press(page, 'Escape');
    await frames(page);
    assert.deepEqual(await selected(page), ['p']);
    await checkEdit(page, back, page.source);
  });

  test(`${platform}: a row of the list dragged to the bottom of the object list and back passes the texts in the flow`, async (t) => {
    const page = await load(t, platform);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const box = (name) => page.evaluate(`(() => { const rs = [...document.querySelectorAll(${js(ROW)})]; const r = rs.find((x) => x.querySelector('.name').textContent.startsWith(${js(ROWS[name])})).getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }; })()`);
    let from = await box('ul');
    const bottom = await box('h2');
    await drag(page, { x: from.x, y: from.y }, { dy: bottom.bottom - 2 - from.y, steps: 8 });
    await frames(page);
    assert.deepEqual(await named(page), ['figure', 'p', 'h2', 'ul'], 'the row of the list is not dragged behind the texts');
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Reorder');
    const dragged = await render(page);
    assert.notEqual(dragged, page.source);
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source, 'the undo does not give the file back byte for byte');
    await redo(page);
    await frames(page);
    assert.equal(await render(page), dragged);
    from = await box('ul');
    const p = await box('p');
    await drag(page, { x: from.x, y: from.y }, { dy: p.top + 2 - from.y, steps: 8 });
    await frames(page);
    assert.deepEqual(await named(page), ['figure', 'ul', 'p', 'h2']);
    assert.equal(await render(page), page.source, 'a drag back to the order of the file leaves a declaration');
    // a drag by one row is one step of Send Backward
    from = await box('ul');
    const below = await box('p');
    await drag(page, { x: from.x, y: from.y }, { dy: below.bottom - 2 - from.y, steps: 8 });
    await frames(page);
    assert.deepEqual(await named(page), ['figure', 'p', 'ul', 'h2']);
    assert.deepEqual(errors(page), []);
  });
}
