// the fixes of R6.2 on both platforms: the ghost of a step dragged in the Steps tab beside its drop
// line, Preview of the transition of a slide, Use Rehearsed Timings in a show opened from the
// editor, and the Accessibility check, with Select and Show in dark mode, the reading order of a
// slide, and link text that says nothing

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// the layer of a preview of a transition: its kind, its phase, and the opacity of each shot
const previewState = (page) => page.evaluate(`(() => {
  const layer = document.querySelector('.beeson-edit-preview');
  if (!layer) return null;
  return { kind: layer.dataset.kind, phase: layer.dataset.phase ?? 'hold', shots: [...layer.querySelectorAll('.shot')].map((s) => Number(getComputedStyle(s).opacity)) };
})()`);
const idle = (page) => page.evaluate(`({ h: Reveal.getIndices().h, undo: window.BeesonEditor.state('edit.undo').enabled })`);

for (const platform of PLATFORMS) {
  test(`Preview plays the fade into the slide from the slide before and leaves the slide as it was on ${platform}`, async () => {
    const page = await editor(platform, { index: 3 });
    const before = await idle(page);
    const items = await page.evaluate(`window.BeesonEditor.state('slide.previewTransition')`);
    assert.equal(items.enabled, true);
    assert.equal(items.label, 'Preview Transition');
    await exec(page, 'slide.previewTransition');
    const hold = await previewState(page);
    assert.deepEqual(hold, { kind: 'fade', phase: 'hold', shots: [1, 0] });
    await page.waitFor(`document.querySelector('.beeson-edit-preview')?.dataset.phase === 'play'`);
    await wait(120);
    const mid = await previewState(page);
    assert.ok(mid.shots[1] > 0 && mid.shots[1] < 1, `the slide is not faded in: ${JSON.stringify(mid)}`);
    await page.waitFor(`!document.querySelector('.beeson-edit-preview')`, 5000);
    assert.deepEqual(await idle(page), before);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`Preview cuts into a slide with None, and Esc ends it, from the head of the Steps tab on ${platform}`, async () => {
    const page = await editor(platform, { index: 3 });
    await exec(page, 'slide.transition.none');
    const edited = await page.evaluate('window.BeesonEditor.render()');
    if (!(await page.evaluate(`window.BeesonEditor.state('view.steps').checked`))) await exec(page, 'view.steps');
    await frames(page);
    await click(page, '.beeson-edit-transition .preview');
    assert.equal((await previewState(page)).kind, 'none');
    await page.waitFor(`document.querySelector('.beeson-edit-preview')?.dataset.phase === 'play'`);
    assert.deepEqual((await previewState(page)).shots, [0, 1]);
    await press(page, 'Escape');
    assert.equal(await previewState(page), null);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), edited);
    assert.deepEqual(errors(page), []);
  });

  test(`Preview plays Magic Move into the next slide, moving the matched heading on ${platform}`, async () => {
    const page = await editor(platform, { index: 3 });
    await exec(page, 'slide.magicMove');
    await page.evaluate('window.BeesonEditor.status()');
    await page.evaluate('Reveal.slide(3)');
    await frames(page);
    const edited = await page.evaluate('window.BeesonEditor.render()');
    await exec(page, 'slide.previewTransition');
    assert.equal((await previewState(page)).kind, 'magic');
    await page.waitFor(`document.querySelector('.beeson-edit-preview')?.dataset.phase === 'play'`);
    const moving = await page.evaluate(`(() => {
      const to = document.querySelectorAll('.beeson-edit-preview .shot')[1].shadowRoot;
      return to.querySelector('h2').getAnimations().length;
    })()`);
    assert.equal(moving, 1, 'the heading of the next slide is not moved');
    await page.waitFor(`!document.querySelector('.beeson-edit-preview')`, 5000);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 3);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), edited);
    assert.deepEqual(errors(page), []);
  });
}

// the demo deck with a rehearsed second on each of its first two slides, in a file of its own
const TIMED = () => readFileSync('index.html', 'utf8').replace('<section class="title">', '<section class="title" data-timing="1">').replace('<section class="section">', '<section class="section" data-timing="1">');

for (const platform of PLATFORMS) {
  test(`with Use Rehearsed Timings on, a show opened from the editor moves on after the timings on ${platform}`, async (t) => {
    const file = `.timed-${process.pid}-${platform}.html`;
    const text = TIMED();
    writeFileSync(file, text);
    t.after(() => rmSync(file, { force: true }));
    const page = await editor(platform, { deck: file, text });
    assert.equal((await page.evaluate(`window.BeesonEditor.state('play.useTimings')`)).checked, false);
    // the show is played in place, in a frame over the editor, and Esc ends it
    const SHOW = `document.querySelector('.beeson-edit-show iframe')?.contentWindow`;
    const shown = async () => page.evaluate(`(() => { try { const R = ${SHOW}?.Reveal; return R?.isReady?.() ? R.getIndices().h : null; } catch { return null; } })()`);
    const end = async () => {
      await press(page, 'Escape');
      await page.waitFor(`!document.querySelector('.beeson-edit-show')`);
    };

    // without the switch, the show waits for a key
    await press(page, 'Mod+Shift+Enter');
    await page.waitFor(`(() => { try { return !!${SHOW}?.Reveal?.isReady?.(); } catch { return false; } })()`, 15000);
    await wait(1800);
    assert.equal(await shown(), 0);
    await end();

    await exec(page, 'play.useTimings');
    assert.equal((await page.evaluate(`window.BeesonEditor.state('play.useTimings')`)).checked, true);
    await press(page, 'Mod+Shift+Enter');
    await page.waitFor(`(() => { try { return ${SHOW}?.Reveal?.isReady?.() && ${SHOW}.Reveal.getIndices().h === 2; } catch { return false; } })()`, 15000);
    const delays = await page.evaluate(`[...${SHOW}.document.querySelectorAll('.reveal .slides > section')].slice(0, 3).map((s) => s.getAttribute('data-autoslide'))`);
    assert.deepEqual(delays, ['1000', '1000', null]);
    await end();
    // the delays are set in the show only
    assert.equal(readFileSync(file, 'utf8'), text);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
    assert.deepEqual(errors(page), []);
  });
}

// the deck of layouts with the small paragraph of its first content slide moved above the
// paragraph before it, and a link named "here" in the paragraph, in the file and on the page
const LAYOUTS = 'test/pages/editor-layouts.html';
const SMALL = '<p class="small fragment" data-fragment-index="3">A small paragraph.</p>';
const SMALL_UP = '<p class="small fragment" data-fragment-index="3" style="translate: 0px -560px">A small paragraph.</p>';
const INLINE = 'and \\(x^2\\) inline.</p>';
const LINKED = 'and \\(x^2\\) inline, see <a href="https://example.com">here</a>.</p>';
const reviewed = () => readFileSync(LAYOUTS, 'utf8').replace(SMALL, SMALL_UP).replace(INLINE, LINKED);
const REVIEWED_PAGE = `(() => {
  const p = [...document.querySelectorAll('.reveal p.small')].find((e) => e.textContent === 'A small paragraph.');
  p.style.translate = '0px -560px';
  const q = [...document.querySelectorAll('.reveal p')].find((e) => e.textContent.startsWith('A paragraph with'));
  q.lastChild.textContent = q.lastChild.textContent.replace(/inline\\.$/, 'inline, see ');
  const a = document.createElement('a');
  a.href = 'https://example.com';
  a.textContent = 'here';
  q.append(a, '.');
})()`;

for (const platform of PLATFORMS) {
  test(`the checker warns of a reading order other than the drawn order and of a link named here on ${platform}`, async () => {
    const page = await editor(platform, { deck: LAYOUTS, text: reviewed(), change: REVIEWED_PAGE, index: 2 });
    await exec(page, 'view.accessibility');
    await frames(page);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y .item')].map((r) => r.dataset.check + ' ' + r.querySelector('.what').textContent)`);
    assert.equal(rows.length, 2, JSON.stringify(rows));
    assert.match(rows[0], /^order "A small paragraph\." after "Text, a list, and a bac…" Slide \d+$/);
    assert.equal(rows[1], 'link Link "here" Slide 3');
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .status').textContent`), /2 warnings/);
    const heads = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y .check')].map((c) => c.textContent)`);
    assert.deepEqual(heads, ['Check reading order1', 'Unclear link text1']);

    // Select and Show selects the element drawn above the one read before it
    await page.evaluate('Reveal.slide(0)');
    await click(page, '.beeson-edit-a11y .item[data-check="order"] .fix');
    await choose(page, 'Select and Show');
    await page.waitFor(`window.BeesonEditor.status().then ? true : true`);
    await frames(page);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 2);
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .info').textContent`), /reads the elements of a slide in the order of the file/);

    // Edit Link opens the dialog of the link
    await click(page, '.beeson-edit-a11y .item[data-check="link"] .fix');
    await choose(page, 'Edit Link');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-link[open]')`);
    await press(page, 'Escape');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`a deck with links that name their targets and elements in reading order has no warnings on ${platform}`, async () => {
    const text = readFileSync(LAYOUTS, 'utf8').replace(INLINE, 'and \\(x^2\\) inline, see <a href="https://example.com">the example site</a>.</p>');
    const page = await editor(platform, { deck: LAYOUTS, text, change: REVIEWED_PAGE.replace("p.style.translate = '0px -560px';", '').replace("a.textContent = 'here';", "a.textContent = 'the example site';") });
    await exec(page, 'view.accessibility');
    await frames(page);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y .item')].map((r) => r.dataset.check)`), []);
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .status').textContent`), /Good to go/);
    assert.deepEqual(errors(page), []);
  });
}
