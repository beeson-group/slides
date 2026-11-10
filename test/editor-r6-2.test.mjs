// the fixes of R6.2 on both platforms: the ghost of a step dragged in the Steps tab beside its drop
// line, Preview of the transition of a slide, Use Rehearsed Timings in a show opened from the
// editor, and the Accessibility check, with Select and Show in dark mode, the reading order of a
// slide, and link text that says nothing

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press } from './helpers/editor.mjs';

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

let last = null;

// the editor on deck served over HTTP, opened with text, at the slide of index, or at the slide of
// the first element matched by a selector
async function editor(platform, { deck = 'index.html', text = readFileSync(deck, 'utf8'), index = 0, change = '' } = {}) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  await page.evaluate('localStorage.clear()');
  page.source = text;
  if (change) await page.evaluate(change);
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(typeof index === 'number' ? `Reveal.slide(${index})` : `Reveal.slide(Reveal.getIndices(document.querySelector(${JSON.stringify(index)}).closest('section')).h)`);
  await frames(page);
  return page;
}

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// a click on the item of an open menu whose label starts with name
async function choose(page, name) {
  const at = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('[role="menu"] .item')].find((i) => i.textContent.trim().startsWith(${JSON.stringify(name)}));
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `an open menu does not have an item ${name}`);
  // an item is taken at a release 250 ms after the press that opened its menu
  await wait(300);
  await click(page, at);
  await frames(page);
}

// the light figure of the demo deck without its alt text, in the file and on the page
const LIGHT_ALT = '<img class="for-light" src="demo/figure-light.png" alt="Zero-velocity curves of the Earth–Moon system, light version">';
const LIGHT_BARE = '<img class="for-light" src="demo/figure-light.png">';
const bareLight = () => readFileSync('index.html', 'utf8').replace(LIGHT_ALT, LIGHT_BARE);
const BARE_PAGE = `document.querySelector('.reveal img.for-light[src="demo/figure-light.png"]').removeAttribute('alt')`;

// two boxes overlap when they share an area, or a line of a box of zero height
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top <= b.bottom && b.top <= a.bottom;

for (const platform of PLATFORMS) {
  // round 2 of the council, finding 40 of qwen3: the ghost of a dragged step covered the row and
  // the drop line it aimed at
  test(`the ghost of a dragged step leaves its drop line and the row after it in view on ${platform}`, async () => {
    const page = await editor(platform, { index: 'div.math[data-keep]' });
    if (!(await page.evaluate(`window.BeesonEditor.state('view.steps').checked`))) await exec(page, 'view.steps');
    await frames(page);
    const at = await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('.beeson-edit-side .rows .card.step')];
      const grip = cards.at(-1).querySelector('.row .grip').getBoundingClientRect();
      const y = (cards[0].getBoundingClientRect().bottom + cards[1].getBoundingClientRect().top) / 2;
      return { x: grip.left + grip.width / 2, y: grip.top + grip.height / 2, to: y };
    })()`);
    await drag(page, at, { dy: at.to - at.y, steps: 12, hold: true });
    const boxes = await page.evaluate(`(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
      const line = document.querySelector('.beeson-edit-side .drop-line');
      const ghost = document.querySelector('.beeson-steps-ghost');
      const target = document.querySelectorAll('.beeson-edit-side .rows .card.step')[1];
      return { shown: !!line && !line.hidden && !!ghost, line: line && box(line), ghost: ghost && box(ghost), target: box(target) };
    })()`);
    await press(page, 'Escape');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.to, button: 'left', clickCount: 1 });
    assert.ok(boxes.shown, 'the drag does not show its drop line and its ghost');
    assert.ok(!overlap(boxes.ghost, boxes.line), `the ghost ${JSON.stringify(boxes.ghost)} covers the drop line ${JSON.stringify(boxes.line)}`);
    assert.ok(!overlap(boxes.ghost, boxes.target), `the ghost ${JSON.stringify(boxes.ghost)} covers the row after the drop line ${JSON.stringify(boxes.target)}`);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  // round 2 of the council, finding 33 of qwen3: in dark mode, Select and Show of an image of the
  // light mode drew the frame of its selection collapsed at 0, 0
  test(`Select and Show of a light image in dark mode frames the image on ${platform}`, async () => {
    const page = await editor(platform, { text: bareLight(), change: BARE_PAGE });
    if ((await page.evaluate('Beeson.theme.get()')) !== 'dark') await page.evaluate(`Beeson.theme.set('dark')`);
    await page.waitFor(`document.documentElement.dataset.theme === 'dark' && !document.documentElement.classList.contains('to-dark')`);
    await exec(page, 'view.accessibility');
    await frames(page);
    await click(page, '.beeson-edit-a11y .item[data-check="alt"] .fix');
    await choose(page, 'Select and Show');
    await page.waitFor(`!!document.querySelector('.beeson-frame.selected:not([hidden])')`);
    await wait(700);
    await frames(page);
    const got = await page.evaluate(`(() => {
      const img = document.querySelector('.reveal img.for-light[src="demo/figure-light.png"]');
      const box = (r) => ({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
      const frame = [...document.querySelectorAll('.beeson-frame.selected')].find((f) => !f.hidden);
      // the frame of an image is drawn around its picture, fit into its box with object-fit contain
      const r = img.getBoundingClientRect();
      const k = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      const picture = { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
      return { frame: frame && box(frame.getBoundingClientRect()), image: box(picture), theme: Beeson.theme.get() };
    })()`);
    assert.ok(got.frame && got.frame.width > 40 && got.frame.height > 40, `the frame ${JSON.stringify(got.frame)} is collapsed`);
    assert.ok(got.image.width > 40, 'the light image is not shown');
    assert.equal(got.theme, 'light');
    for (const k of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(got.frame[k] - got.image[k]) <= 4, `the frame ${JSON.stringify(got.frame)} is not at the image ${JSON.stringify(got.image)}`);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    assert.deepEqual(errors(page), []);
  });
}
