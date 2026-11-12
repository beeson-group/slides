// regression tests of R41.1 on both platforms: a QR code on the merged theme, which places the code
// of a closing slide 200 px wide at the lower right and every other code in the flow at 320 px. a
// change of layout between Closing and another layout keeps the drawn place and size of a code that
// the editor placed, in one entry of the history, and a code without a place takes the place of the
// new layout. each edit of the file is checked byte for byte after an undo and a redo

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag } from './helpers/editor.mjs';

const DECK = 'index.html';
const PLATFORMS = ['mac', 'other'];
// the indexes of the title slide and of the closing slide in index.html
const TITLE = 0;
const CLOSING = 12;
// the deck of layouts, with the indexes of its title slide and of its content slide with math
const LAYOUTS = 'test/pages/editor-layouts.html';
const LAYOUT_TITLE = 0;
const LAYOUT_MATH = 3;
// the handles of a selected element, each with the direction in which a drag of it grows the box
const HANDLES = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1] };
// the modifier that turns the snapping of a drag off
const FREE = { mac: 'Meta', other: 'Alt' };
// the start tag of a QR code made by insert.qr, whose text is not in the deck
const NEW = /<div class="qr"[^>]*data-qr="https:\/\/example\.com"[^>]*>/g;

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
const settle = async (page) => {
  await frames(page);
  await frames(page);
};
const exec = async (page, id, arg) => {
  await page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
  await settle(page);
};
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = async (page) => {
  await page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  await settle(page);
};
const redo = async (page) => {
  await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  await settle(page);
};
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const near = (a, b, by = 1) => Math.abs(a - b) <= by;

async function load(t, platform, n, deck = DECK) {
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
  await settle(page);
  return page;
}

// the QR codes of the current slide in their order: the center of the drawn box in slide px, the
// width without the rotation, the computed position, and the style attribute
const codes = (page) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect(), k = s.width / slide.offsetWidth;
  return [...slide.querySelectorAll('.qr')].map((q) => {
    const r = q.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k, width: q.offsetWidth, position: getComputedStyle(q).position, style: q.getAttribute('style') };
  });
})()`);
// the box in slide px of the last element of selector on the current slide, or of the selected
// element without selector, with its computed position
const box = (page, selector = null) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present');
  const s = slide.getBoundingClientRect(), k = s.width / slide.offsetWidth;
  const el = ${js(selector)} ? [...slide.querySelectorAll(${js(selector)})].at(-1) : window.BeesonEditor.selection()[0];
  const r = el.getBoundingClientRect();
  return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k, width: r.width / k, position: getComputedStyle(el).position };
})()`);
const layout = (page) => page.evaluate(`document.querySelector('.reveal .slides > section.present').className`);

// a new QR code on slide n, put with its upper left corner at the point p in slide px
async function placed(t, platform, n, p) {
  const page = await load(t, platform, n);
  await exec(page, 'insert.qr');
  await exec(page, 'arrange.setPosition', p);
  return page;
}

// asserts that the command id, a change of layout, keeps the drawn box of the last QR code of the
// slide and writes its width in px, in one entry of the history with an undo and a redo byte for
// byte
async function keeps(page, id, width) {
  const before = await render(page);
  const was = (await codes(page)).at(-1);
  await exec(page, id);
  const after = await render(page);
  const now = (await codes(page)).at(-1);
  assert.notEqual(now.position, was.position, `the theme places the code in the same way: ${js({ was, now })}`);
  assert.ok(near(now.x, was.x) && near(now.y, was.y), `the QR code is moved by the change of layout: ${js({ was, now })}`);
  assert.equal(now.width, was.width, `the QR code is resized by the change of layout: ${js({ was, now })}`);
  const tags = after.match(NEW);
  assert.equal(tags.length, 1, after);
  assert.match(tags[0], new RegExp(`width: ${width}px`), `the width is not written: ${tags[0]}`);
  await undo(page);
  assert.equal(await render(page), before, 'the undo does not give the text before the change byte for byte');
  assert.deepEqual((await codes(page)).at(-1), was);
  await redo(page);
  assert.equal(await render(page), after, 'the redo does not give the text after the change byte for byte');
  assert.deepEqual((await codes(page)).at(-1), now);
  return { before, after, was, now };
}

for (const platform of PLATFORMS) {
  test(`Closing to Title keeps the drawn place and size of a placed QR code, in one entry of the history (${platform})`, async (t) => {
    const page = await placed(t, platform, CLOSING, { x: 700, y: 300 });
    const { before, was } = await keeps(page, 'slide.layout.title', 200);
    assert.match(await layout(page), /\btitle\b/);
    // a change back gives the text again, as the file has it
    await exec(page, 'slide.layout.closing');
    assert.equal(await render(page), before, 'the change back to Closing does not give the text again');
    const back = (await codes(page)).at(-1);
    assert.ok(near(back.x, was.x) && near(back.y, was.y) && back.width === was.width, js({ was, back }));
    assert.deepEqual(errors(page), []);
  });

  test(`Title to Closing keeps the drawn place and size of a placed QR code, in one entry of the history (${platform})`, async (t) => {
    const page = await placed(t, platform, TITLE, { x: 1300, y: 200 });
    await keeps(page, 'slide.layout.closing', 320);
    assert.match(await layout(page), /\bclosing\b/);
    assert.deepEqual(errors(page), []);
  });

  // a run of changes of layout writes the slide from its text before the run, and the code keeps
  // the translate and the width that it has on the title slide
  test(`Closing to Title to Section keeps the place of a QR code on the title slide (${platform})`, async (t) => {
    const page = await placed(t, platform, CLOSING, { x: 700, y: 300 });
    await exec(page, 'slide.layout.title');
    const tag = (await render(page)).match(NEW)[0];
    const was = (await codes(page)).at(-1);
    const before = await render(page);
    await exec(page, 'slide.layout.section');
    assert.match(await layout(page), /\bsection\b/);
    assert.equal((await render(page)).match(NEW)[0], tag);
    const now = (await codes(page)).at(-1);
    assert.equal(now.width, was.width);
    await undo(page);
    assert.equal(await render(page), before);
    assert.deepEqual(errors(page), []);
  });

  // the code of the closing slide of the deck has neither a translate nor a width
  test(`a QR code without a place takes the place and the size of the new layout (${platform})`, async (t) => {
    const page = await placed(t, platform, CLOSING, { x: 700, y: 300 });
    const tag = '<div class="qr" data-qr="https://github.com/beeson-group/slides"></div>';
    assert.ok(page.source.includes(tag));
    await exec(page, 'slide.layout.title');
    const [first] = await codes(page);
    assert.equal(first.style, null);
    assert.equal(first.width, 320, `the QR code does not take the width of the title slide: ${js(first)}`);
    assert.equal(first.position, 'relative');
    assert.ok((await render(page)).includes(tag), 'the tag of the QR code is changed');
    assert.deepEqual(errors(page), []);
  });

  // the QR code of the title slide of the layouts page, in the flow at the upper left corner, and a
  // new one on its content slide with math, in the flow of the text column
  for (const [name, n, insert] of [['title slide', LAYOUT_TITLE, false], ['content slide', LAYOUT_MATH, true]]) {
    test(`a drag of each of the eight handles of a QR code in the flow of a ${name} keeps the opposite edge or corner, in one entry of the history (${platform})`, async (t) => {
      const page = await load(t, platform, n, LAYOUTS);
      if (insert) await exec(page, 'insert.qr');
      const base = await render(page);
      const sel = '.reveal .slides > section.present .qr';
      for (const [handle, [ux, uy]] of Object.entries(HANDLES)) {
        await click(page, sel);
        await settle(page);
        const was = await box(page);
        assert.equal(was.position, 'relative');
        await drag(page, `.beeson-grip[data-handle="${handle}"]`, { dx: 30 * ux, dy: 30 * uy, modifiers: FREE[platform] });
        await settle(page);
        const now = await box(page);
        assert.ok(now.width > was.width + 10, `the handle ${handle} does not resize the QR code: ${js({ was, now })}`);
        if (ux) assert.ok(near(ux > 0 ? now.left : now.right, ux > 0 ? was.left : was.right, 1.5), `the handle ${handle} moves the opposite edge: ${js({ was, now })}`);
        if (uy) assert.ok(near(uy > 0 ? now.top : now.bottom, uy > 0 ? was.top : was.bottom, 1.5), `the handle ${handle} moves the opposite edge: ${js({ was, now })}`);
        await undo(page);
        assert.equal(await render(page), base, `one undo does not take the drag of the handle ${handle} off`);
      }
      assert.deepEqual(errors(page), []);
    });
  }

  test(`Insert > QR Code on the title slide puts the code on the slide, off its texts (${platform})`, async (t) => {
    const page = await load(t, platform, TITLE);
    await exec(page, 'insert.qr');
    const q = (await codes(page)).at(-1);
    const b = await box(page, '.reveal .slides > section.present .qr');
    const texts = await page.evaluate(`(() => {
      const slide = document.querySelector('.reveal .slides > section.present');
      const s = slide.getBoundingClientRect(), k = s.width / slide.offsetWidth;
      return [...slide.querySelectorAll('.block > *')].map((e) => e.getBoundingClientRect()).map((r) => ({ left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k }));
    })()`);
    assert.ok(b.left >= 0 && b.top >= 0 && b.right <= 1920 && b.bottom <= 1080, `the QR code is not on the slide: ${js(b)}`);
    for (const r of texts) assert.ok(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom, `the QR code lies over a text: ${js({ b, r })}`);
    assert.equal(q.position, 'relative');
    t.diagnostic(`the new QR code is at ${js(b)} in slide px`);
    assert.deepEqual(errors(page), []);
  });

  // the theme places a code in the flow in the same way on a title slide and on a section slide
  test(`Title to Section keeps the translate of a QR code in the flow as text (${platform})`, async (t) => {
    const page = await placed(t, platform, TITLE, { x: 1300, y: 200 });
    const tag = (await render(page)).match(NEW)[0];
    await exec(page, 'slide.layout.section');
    assert.match(await layout(page), /\bsection\b/);
    assert.equal((await render(page)).match(NEW)[0], tag);
    assert.deepEqual(errors(page), []);
  });
}

// a QR code of the title slide that a change to Closing gave a width of 320 px is drawn 320 px
// wide by default on a section slide and on a content slide. hence the next change takes the
// width off and writes only the translate
for (const platform of PLATFORMS) {
  for (const to of ['section', 'content']) {
    test(`Title to Closing to ${to[0].toUpperCase() + to.slice(1)} writes only the translate of a placed QR code, whose default width is its width (${platform})`, async (t) => {
      const page = await placed(t, platform, TITLE, { x: 413, y: 517 });
      await exec(page, 'slide.layout.closing');
      assert.match((await render(page)).match(NEW)[0], /width: 320px/);
      const before = await render(page);
      const was = (await codes(page)).at(-1);
      await exec(page, `slide.layout.${to}`);
      assert.match(await layout(page), to === 'content' ? /^(?!.*\b(title|closing|section)\b)/ : /\bsection\b/);
      const after = await render(page);
      const tag = after.match(NEW)[0];
      assert.doesNotMatch(tag, /width/, `a surplus width is written: ${tag}`);
      assert.match(tag, /translate: /);
      const now = (await codes(page)).at(-1);
      assert.ok(near(now.x, was.x) && near(now.y, was.y) && now.width === was.width, `the QR code is moved or resized: ${js({ was, now })}`);
      await undo(page);
      assert.equal(await render(page), before, 'the undo does not give the text before the change byte for byte');
      await redo(page);
      assert.equal(await render(page), after, 'the redo does not give the text after the change byte for byte');
      assert.deepEqual(errors(page), []);
    });
  }
}
