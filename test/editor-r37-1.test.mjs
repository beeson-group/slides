// tests of R37.1 on both platforms. a video of the fragment style play is listed in the Steps pane
// with the effect Play, which the menu of the effect of a row offers only for a video, after Fade
// In. the checkbox Start on a click of the Video pane sets the effect Play of the video or takes it
// off, and Play while the slide is shown is dimmed and off while it is checked. a preview of the
// steps plays a video of the style play at its step and rewinds it to its poster at its end. the
// class play is in the scope rule, and the hint of the text of a QR code says when the code is
// drawn without the logo. a tycho viewer is started at its step in the same way: Play is offered
// in the Steps pane, Start on a click is in the Arrange pane of a scene, and a preview of the steps
// holds the scene at its first frame until its step. each change is one entry of the history, an undo gives the file byte for
// byte, a redo gives the edit, and a save is opened again without problems

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { textProblems } from '../src/editor/model/scope.ts';
import { encode } from '../src/qr.ts';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const REDO = { mac: 'Mod+Shift+Z', other: 'Mod+Y' };
const PANEL = '#beeson-edit-panel-format';
const DECK = 'test/pages/editor-r37-1.html';
// the index of slide 12 of index.html, "Starting a video on a click"
const CLICK_SLIDE = 11;

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
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const rendered = (page) => page.evaluate('window.BeesonEditor.render()');

// asserts that a text is the expected one, with the first line that differs in the message
function sameText(actual, expected, message = 'the text differs') {
  if (actual === expected) return;
  const a = actual.split('\n'), e = expected.split('\n');
  const i = a.findIndex((line, k) => line !== e[k]);
  assert.fail(`${message} at line ${i + 1}:\n  actual:   ${a[i]?.trim()}\n  expected: ${e[i]?.trim()}`);
}
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})).then(() => true)`);

// the editor on a deck served over HTTP at a slide, with the Steps pane or the Format tab shown
// reduced motion is the setting of the Windows runner of GitHub, and under it a kiosk viewer is
// not started by the tycho runtime at its load. With motion, the page is shown without it
async function open(t, platform, { deck = DECK, slide = 0, pane = 'steps', motion = false } = {}) {
  const page = await browser.newPage({ width: 1920, height: 1080, motion });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  // the drafts that an earlier test left in the shared browser are not offered
  await page.evaluate('localStorage.clear()');
  page.source = readFileSync(deck, 'utf8');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`)).problems, []);
  if (pane === 'steps') await exec(page, 'view.steps');
  else if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${slide})`);
  await sleep(150);
  await frames(page);
  return page;
}

// one change is one entry of the history: an undo gives the text before it byte for byte, and a
// redo gives the text after it
async function undoRedo(page, platform, before, edited) {
  await press(page, 'Mod+Z');
  await frames(page);
  sameText(await rendered(page), before, 'an undo does not give the file before the edit');
  await press(page, REDO[platform]);
  await frames(page);
  sameText(await rendered(page), edited, 'a redo does not give the edit again');
}

// the row of the Steps pane of a kind, e.g. Video, or whose text starts with what
const ROW = (what) => `[...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.querySelector('.meta .kind')?.textContent === ${js(what)} || r.querySelector('.text').textContent.startsWith(${js(what)}))`;
const rowOf = (page, what) => page.evaluate(`(() => { const r = ${ROW(what)}; return r ? { step: r.dataset.step, meta: r.querySelector('.meta').textContent } : null; })()`);
const chipAt = (page, what) => page.evaluate(`(() => { const b = ${ROW(what)}.querySelector('.chip').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);

// the labels of the menu of the chip of a row, which is closed again
async function chipMenu(page, what) {
  await click(page, await chipAt(page, what));
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
  const labels = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item .label')].map((l) => l.textContent)`);
  await press(page, 'Escape');
  await page.waitFor(`!document.querySelector('.beeson-edit-menu')`);
  return labels;
}

// an item of the menu of the chip of a row, chosen with two trusted clicks
async function pick(page, what, label) {
  await click(page, await chipAt(page, what));
  await page.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
  const item = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label').textContent === ${js(label)});
    if (!item || item.getAttribute('aria-disabled') === 'true') return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  const labels = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => i.querySelector('.label').textContent + (i.getAttribute('aria-disabled') === 'true' ? ' (off)' : ''))`);
  assert.ok(item, `the menu of the chip does not have an enabled item ${label}: ${labels.join(', ')}`);
  // an item is taken at a release 250 ms after the press that opened its menu
  await sleep(300);
  await click(page, item);
  await page.evaluate('window.BeesonEditor.status()');
  await frames(page);
}

// the two videos of slide 12 of index.html, with the classes and the index of their step
const pairOf = (step) => [
  `<video class="for-dark${step}" src="demo/clip-dark.mp4" poster="demo/clip-dark.png" muted loop></video>`,
  `<video class="for-light${step}" src="demo/clip-light.mp4" poster="demo/clip-light.png" muted loop></video>`,
];
const PLAY_PAIR = pairOf(' fragment play" data-fragment-index="1');
const withPair = (source, pair) => source.replace(PLAY_PAIR[0], pair[0]).replace(PLAY_PAIR[1], pair[1]);

// the one video of the first slide of DECK, played while its slide is shown, and the same video
// with other attributes after loop
const CLIP = '<video src="../../demo/clip-dark.mp4" poster="../../demo/clip-dark.png" muted loop data-autoplay></video>';
const clip = (attrs) => `<video src="../../demo/clip-dark.mp4" poster="../../demo/clip-dark.png" muted loop${attrs}></video>`;
// the one video of the second slide of DECK, a step played at its step, and the same video with
// other attributes before src and after loop
const STEP_CLIP = '<video class="fragment" data-fragment-index="1" src="../../demo/clip-dark.mp4" poster="../../demo/clip-dark.png" muted loop data-autoplay></video>';
const stepClip = (head, tail) => `<video${head} src="../../demo/clip-dark.mp4" poster="../../demo/clip-dark.png" muted loop${tail}></video>`;

// the shown checkboxes of the Format tab in their order, each with its command
const checks = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-check')].filter((l) => l.getClientRects().length).map((l) => {
  const i = l.querySelector('input');
  return { command: i.dataset.command, text: l.textContent, checked: i.checked, disabled: i.disabled };
})`);
const checkOf = async (page, command) => (await checks(page)).find((c) => c.command === command);
async function toggle(page, command) {
  await click(page, await page.evaluate(`(() => { const b = document.querySelector('${PANEL} input[data-command="${command}"]').closest('label').getBoundingClientRect(); return { x: b.left + 12, y: b.top + b.height / 2 }; })()`));
  await page.evaluate('window.BeesonEditor.status()');
  await sleep(50);
  await frames(page);
}

// the video of the slide shown in the mode of the deck, selected with a trusted click
async function selectVideo(page) {
  const sel = await page.evaluate(`(() => { const v = [...document.querySelectorAll('.reveal section.present video')].find((v) => v.getClientRects().length); return v.classList.contains('for-light') ? 'video.for-light' : v.classList.contains('for-dark') ? 'video.for-dark' : 'video'; })()`);
  await click(page, `.reveal section.present ${sel}`);
  await frames(page);
  assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'video');
}

async function saved(page, name) {
  const before = await rendered(page);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, before);
  assert.deepEqual(errors(page), []);
}

test('the class play of a video is in the scope rule of the editor', () => {
  assert.deepEqual(textProblems('<video class="fragment play" data-fragment-index="1" src="a.mp4" poster="a.png" muted></video>', new Set()), []);
});

// the hint of the QR pane names this limit of src/qr.ts
test('a QR code is drawn with the logo up to 1273 bytes', () => {
  assert.equal(encode('a'.repeat(1273), true).logo, true);
  assert.equal(encode('a'.repeat(1274), true).logo, false);
});

let saves = 0;
for (const platform of PLATFORMS) {
  test(`${platform}: the Steps pane lists the videos of slide 12 with the effect Play, offered only for a video after Fade In`, async (t) => {
    const page = await open(t, platform, { deck: 'index.html', slide: CLICK_SLIDE });
    const source = page.source;
    assert.match((await rowOf(page, 'Video')).meta, /Play$/, 'the row of the videos does not read the effect Play');
    const labels = await chipMenu(page, 'Video');
    assert.equal(labels[labels.indexOf('Fade In') + 1], 'Play', `the menu of the video row reads ${labels.join(', ')}`);
    assert.ok(!(await chipMenu(page, 'Videos of one step')).includes('Play'), 'the menu of a list item offers Play');

    await pick(page, 'Video', 'Fade In');
    const faded = withPair(source, pairOf(' fragment" data-fragment-index="1'));
    sameText(await rendered(page), faded);
    assert.match((await rowOf(page, 'Video')).meta, /Fade In$/);
    assert.equal(await undoLabel(page), 'Undo Set Effect of Step');
    await undoRedo(page, platform, source, faded);

    await pick(page, 'Video', 'Play');
    sameText(await rendered(page), source);
    assert.match((await rowOf(page, 'Video')).meta, /Play$/);
    await undoRedo(page, platform, faded, source);

    // the step taken off a video takes its class play off as well, and the steps after it move up
    await pick(page, 'Video', 'With the Slide');
    const plain = withPair(source, pairOf(''))
      .replace('<li class="fragment" data-fragment-index="2">Videos', '<li class="fragment" data-fragment-index="1">Videos')
      .replace('<li class="fragment" data-fragment-index="3">A video shown later', '<li class="fragment" data-fragment-index="2">A video shown later');
    sameText(await rendered(page), plain);
    await undoRedo(page, platform, source, plain);

    // a pair made a step again by Start on a click is written fragment play on both videos
    await exec(page, 'shell.format');
    await selectVideo(page);
    await toggle(page, 'figure.startOnClick');
    await frames(page);
    const [bare, at] = [pairOf(''), pairOf(' fragment play" data-fragment-index="3')];
    const last = plain.replace(bare[0], at[0]).replace(bare[1], at[1]);
    sameText(await rendered(page), last);
    await undoRedo(page, platform, plain, last);
    await saved(page, `r37-1-${++saves}.html`);
  });

  test(`${platform}: Play in the Steps pane starts a video without a pair at its step, without data-autoplay`, async (t) => {
    const page = await open(t, platform, { slide: 1 });
    const source = page.source;
    assert.deepEqual(await rowOf(page, 'Video'), { step: '0', meta: 'Video · On Click · Fade In' });
    assert.ok((await chipMenu(page, 'Video')).includes('Play'));
    assert.ok(!(await chipMenu(page, 'A paragraph')).includes('Play'), 'the menu of a paragraph offers Play');
    await pick(page, 'Video', 'Play');
    const played = source.replace(STEP_CLIP, stepClip(' class="fragment play" data-fragment-index="1"', ''));
    sameText(await rendered(page), played);
    assert.deepEqual(await rowOf(page, 'Video'), { step: '0', meta: 'Video · On Click · Play' });
    assert.equal(await undoLabel(page), 'Undo Set Effect of Step');
    await undoRedo(page, platform, source, played);

    await pick(page, 'Video', 'Fade In');
    const faded = source.replace(STEP_CLIP, stepClip(' class="fragment" data-fragment-index="1"', ''));
    sameText(await rendered(page), faded);
    await undoRedo(page, platform, played, faded);

    await pick(page, 'Video', 'Play');
    sameText(await rendered(page), played);
    await pick(page, 'Video', 'With the Slide');
    const plain = source.replace(STEP_CLIP, stepClip('', ''));
    sameText(await rendered(page), plain);
    await undoRedo(page, platform, played, plain);
    await saved(page, `r37-1-${++saves}.html`);
  });

  test(`${platform}: Start on a click of the Video pane sets the effect Play of a video without a pair, and dims Play while the slide is shown`, async (t) => {
    const page = await open(t, platform, { pane: 'format' });
    const source = page.source;
    await selectVideo(page);
    const list = await checks(page);
    const at = list.findIndex((c) => c.command === 'figure.autoplay');
    assert.deepEqual(list[at], { command: 'figure.autoplay', text: 'Play while the slide is shown', checked: true, disabled: false });
    assert.deepEqual(list[at + 1], { command: 'figure.startOnClick', text: 'Start on a click', checked: false, disabled: false });

    await toggle(page, 'figure.startOnClick');
    const played = source.replace(CLIP, clip(' class="fragment play" data-fragment-index="3"'));
    sameText(await rendered(page), played);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, true);
    assert.deepEqual(await checkOf(page, 'figure.autoplay'), { command: 'figure.autoplay', text: 'Play while the slide is shown', checked: false, disabled: true });
    assert.equal(await undoLabel(page), 'Undo Start on a Click');
    await undoRedo(page, platform, source, played);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, true);

    await toggle(page, 'figure.startOnClick');
    const faded = source.replace(CLIP, clip(' class="fragment" data-fragment-index="3"'));
    sameText(await rendered(page), faded);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, false);
    assert.deepEqual(await checkOf(page, 'figure.autoplay'), { command: 'figure.autoplay', text: 'Play while the slide is shown', checked: false, disabled: false });
    await undoRedo(page, platform, played, faded);
    await saved(page, `r37-1-${++saves}.html`);
  });

  test(`${platform}: Start on a click of the Video pane is checked on slide 12, and its uncheck leaves the pair a step with the effect Fade In`, async (t) => {
    const page = await open(t, platform, { deck: 'index.html', slide: CLICK_SLIDE, pane: 'format' });
    const source = page.source;
    await selectVideo(page);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, true);
    assert.deepEqual(await checkOf(page, 'figure.autoplay'), { command: 'figure.autoplay', text: 'Play while the slide is shown', checked: false, disabled: true });
    await toggle(page, 'figure.startOnClick');
    const faded = withPair(source, pairOf(' fragment" data-fragment-index="1'));
    sameText(await rendered(page), faded);
    assert.equal((await checkOf(page, 'figure.autoplay')).disabled, false);
    await undoRedo(page, platform, source, faded);
    await toggle(page, 'figure.startOnClick');
    sameText(await rendered(page), source);
    await undoRedo(page, platform, faded, source);
    await saved(page, `r37-1-${++saves}.html`);
  });

  test(`${platform}: a preview of the steps of slide 12 plays its video at its step and rewinds it at its end`, async (t) => {
    const page = await open(t, platform, { deck: 'index.html', slide: CLICK_SLIDE });
    const VIDEO = `[...document.querySelectorAll('.reveal section.present video')].find((v) => v.getClientRects().length)`;
    await sleep(500);
    assert.deepEqual(await page.evaluate(`(() => { const v = ${VIDEO}; return { paused: v.paused, time: v.currentTime }; })()`), { paused: true, time: 0 }, 'the editor plays the video');
    await page.evaluate(`window.BeesonEditor.exec('steps.preview'); true`);
    await page.waitFor(`document.documentElement.classList.contains('beeson-previewing')`);
    assert.equal(await page.evaluate(`${VIDEO}.paused`), true, 'the video is played before its step');
    await page.waitFor(`!${VIDEO}.paused && ${VIDEO}.currentTime > 0`);
    await page.waitFor(`!document.documentElement.classList.contains('beeson-previewing')`);
    await frames(page);
    assert.deepEqual(await page.evaluate(`(() => { const v = ${VIDEO}; return { paused: v.paused, time: v.currentTime }; })()`), { paused: true, time: 0 }, 'the video is not rewound at the end of the preview');
    sameText(await rendered(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // the show draws a video of the style play with its poster at full opacity before its step, and
  // does not dim it at the later steps
  test(`${platform}: a preview of the Steps pane keeps the video of slide 12 at full opacity before and after its step`, async (t) => {
    const page = await open(t, platform, { deck: 'index.html', slide: CLICK_SLIDE });
    await page.evaluate(`(() => {
      window.__seen = [];
      const look = () => {
        const v = [...document.querySelectorAll('.reveal section.present video')].find((v) => v.getClientRects().length);
        if (document.documentElement.classList.contains('beeson-previewing')) window.__seen.push({ step: document.documentElement.dataset.previewStep, paused: v.paused, opacity: getComputedStyle(v).opacity });
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
      window.BeesonEditor.exec('steps.preview');
      return true;
    })()`);
    await page.waitFor(`document.documentElement.classList.contains('beeson-previewing')`);
    await page.waitFor(`!document.documentElement.classList.contains('beeson-previewing')`, 20000);
    const seen = await page.evaluate('window.__seen');
    assert.ok(seen.some((s) => s.step === '0') && seen.some((s) => !s.paused), 'the preview did not show the slide before the step of the video and then play it');
    const dim = seen.filter((s) => Number(s.opacity) < 0.99);
    assert.deepEqual(dim.slice(0, 3), [], 'the video is faded or dimmed by the preview');
    sameText(await rendered(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // the previews of the toolbar draw the slide on a layer, whose video is shown with its poster
  // before its step, played from its step on without a dim, and taken down with the layer
  for (const command of ['preview.steps', 'preview.slide']) {
    test(`${platform}: ${command} of the toolbar plays the video of slide 12 at its step, with its poster before it`, async (t) => {
      const page = await open(t, platform, { deck: 'index.html', slide: CLICK_SLIDE });
      await page.evaluate('window.BeesonEditor.preview.step = 700');
      await page.evaluate(`(() => {
        window.__seen = [];
        const look = () => {
          const host = document.querySelector('.beeson-edit-play .shot');
          const v = host && [...host.shadowRoot.querySelectorAll('video')].find((v) => v.getClientRects().length);
          if (v) {
            const s = getComputedStyle(v);
            window.__seen.push({ step: v.classList.contains('visible'), paused: v.paused, time: v.currentTime, opacity: s.opacity, visibility: s.visibility });
          }
          requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
        window.BeesonEditor.exec(${js(command)});
        return true;
      })()`);
      await page.waitFor(`!!document.querySelector('.beeson-edit-play')`);
      await page.waitFor(`!document.querySelector('.beeson-edit-play')`, 20000);
      const seen = await page.evaluate('window.__seen');
      const before = seen.filter((s) => !s.step);
      const at = seen.filter((s) => s.step);
      assert.ok(before.length && at.length, `the layer did not show the slide before and after the step of the video: ${seen.length} frames`);
      assert.ok(at.some((s) => !s.paused && s.time > 0), 'the video of the layer is not played at its step');
      assert.deepEqual([...new Set(before.map((s) => `${s.paused ? 'paused' : 'playing'} ${s.visibility} ${s.opacity}`))], ['paused visible 1'], 'the poster is not shown before the step');
      assert.deepEqual([...new Set(at.map((s) => `${s.visibility} ${s.opacity}`))], ['visible 1'], 'the video is dimmed at the later steps');
      const VIDEO = `[...document.querySelectorAll('.reveal section.present video')].find((v) => v.getClientRects().length)`;
      assert.deepEqual(await page.evaluate(`(() => { const v = ${VIDEO}; return { paused: v.paused, time: v.currentTime }; })()`), { paused: true, time: 0 }, 'the video of the canvas is played');
      sameText(await rendered(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }

  // an image dropped on a video replaces it and keeps its step, but not the style play of a video
  test(`${platform}: an image that replaces the video of slide 12 is a step with the effect Fade In`, async (t) => {
    const page = await open(t, platform, { deck: 'index.html', slide: CLICK_SLIDE });
    const source = page.source;
    const at = await page.evaluate(`(() => { const v = [...document.querySelectorAll('.reveal section.present video')].find((v) => v.getClientRects().length); const r = v.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const data = { items: [], files: [resolve('demo/figure-dark.png')], dragOperationsMask: 1 };
    for (const type of ['dragEnter', 'dragOver', 'drop']) await page.send('Input.dispatchDragEvent', { type, x: at.x, y: at.y, data });
    // the video is removed after the image is written
    const ZONE = `window.BeesonEditor.render().split('Starting a video on a click')[1].split('</section>')[0]`;
    await page.waitFor(`/<img[^>]*figure-dark/.test(${ZONE}) && ${ZONE}.split('<video').length === 2`, 30000);
    await frames(page);
    const img = (await page.evaluate(ZONE)).match(/<img [^>]*>/)?.[0];
    assert.match(img ?? '', /^<img class="for-(dark|light) fragment" src="media\/figure-dark\.png" data-fragment-index="1">$/, `the image is written ${img}`);
    assert.match((await rowOf(page, 'Figure')).meta, /On Click · Fade In$/);
    await press(page, 'Mod+Z');
    await frames(page);
    sameText(await rendered(page), source, 'an undo does not give the file before the drop');
  });

  test(`${platform}: the hint of the QR pane says when a text is drawn without the logo`, async (t) => {
    const page = await open(t, platform, { slide: 2, pane: 'format' });
    const source = page.source;
    await click(page, '.reveal section.present .qr');
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'qr');
    const FIELD = `${PANEL} textarea[name="qr"]`;
    const hintOf = (p) => p.evaluate(`document.querySelector('${FIELD}').closest('.ed-field').querySelector('.ed-note').textContent`);
    const retype = async (p, text) => {
      await p.evaluate(`document.querySelector('${FIELD}').focus(); document.querySelector('${FIELD}').select(); true`);
      await type(p, text);
      await frames(p);
    };
    const long = 'https://example.com/' + 'a'.repeat(1280);
    await retype(page, long);
    assert.equal(await hintOf(page), '1300 of 2331 bytes, drawn without the logo');
    await retype(page, 'https://example.com/' + 'a'.repeat(1253));
    assert.equal(await hintOf(page), '1273 of 2331 bytes');
    await retype(page, long);
    await press(page, 'Enter');
    await page.evaluate('window.BeesonEditor.status()');
    await frames(page);
    const edited = source.replace('data-qr="https://github.com/beeson-group/slides"', `data-qr="${long}"`);
    sameText(await rendered(page), edited);
    assert.equal(await page.evaluate(`!!document.querySelector('.reveal section.present .qr svg') && !document.querySelector('.reveal section.present .qr .qr-logo')`), true, 'the code is not drawn without the logo');
    assert.equal(await undoLabel(page), 'Undo QR Code Text');
    await page.evaluate(`document.activeElement?.blur(); true`);
    await undoRedo(page, platform, source, edited);
    await saved(page, `r37-1-${++saves}.html`);

    // a deck whose codes are drawn without the logo keeps the hint of the count alone
    const plain = await open(t, platform, { deck: 'test/pages/qr-plain.html', pane: 'format' });
    await click(plain, '.reveal section.present .qr');
    await frames(plain);
    await retype(plain, long);
    assert.equal(await hintOf(plain), '1300 of 2331 bytes');
  });
}

// the viewers of test/pages/viewer-play.html: the viewer of its first slide, which is a step of the
// style play, and the viewer of its third slide, in a zone that is the step
const VIEWERS = 'test/pages/viewer-play.html';
const scene = (attrs) => `<tycho-viewer theme="dark" kiosk id="play"${attrs}>`;
const SCENE = scene(' class="zone fragment play" data-fragment-index="2"');
const LATER = (n) => `<p class="fragment" data-fragment-index="${n}">A later step.</p>`;
const INSIDE = '<div class="zone fragment play" data-fragment-index="1">\n        <tycho-viewer theme="dark" kiosk id="inside">';
const AFTER = (n) => `<p class="fragment" data-fragment-index="${n}">A paragraph after the scene.</p>`;

// the viewer of the slide, or the zone around it, selected with a trusted click, with the Arrange pane shown
async function selectScene(page) {
  await click(page, '.reveal section.present tycho-viewer');
  await frames(page);
  assert.equal(await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.dataset.pane`), 'arrange');
}

for (const platform of PLATFORMS) {
  test(`${platform}: the Steps pane offers Play for a tycho viewer, and writes it as fragment play on its tag`, async (t) => {
    const page = await open(t, platform, { deck: VIEWERS });
    const source = page.source;
    assert.deepEqual(await rowOf(page, 'Scene'), { step: '1', meta: 'Scene · On Click · Play' });
    const labels = await chipMenu(page, 'Scene');
    assert.equal(labels[labels.indexOf('Fade In') + 1], 'Play', `the menu of the scene row reads ${labels.join(', ')}`);
    await pick(page, 'Scene', 'Fade In');
    const faded = source.replace(SCENE, scene(' class="zone fragment" data-fragment-index="2"'));
    sameText(await rendered(page), faded);
    await undoRedo(page, platform, source, faded);
    await pick(page, 'Scene', 'Play');
    sameText(await rendered(page), source);
    assert.equal(await undoLabel(page), 'Undo Set Effect of Step');
    await undoRedo(page, platform, faded, source);
    await saved(page, `r37-1-${++saves}.html`);
  });

  // a kiosk viewer that is only a step is played by tycho while it is hidden, hence a viewer taken
  // off Start on a click is not left a step
  test(`${platform}: Start on a click of the Arrange pane of a scene is checked for a viewer of the style play, and its uncheck shows the viewer with its slide`, async (t) => {
    const page = await open(t, platform, { deck: VIEWERS, pane: 'format' });
    const source = page.source;
    await selectScene(page);
    assert.deepEqual(await checkOf(page, 'figure.startOnClick'), { command: 'figure.startOnClick', text: 'Start on a click', checked: true, disabled: false });
    await toggle(page, 'figure.startOnClick');
    const plain = source.replace(SCENE, scene(' class="zone"')).replace(LATER(3), LATER(2));
    sameText(await rendered(page), plain);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, false);
    assert.equal(await undoLabel(page), 'Undo Start on a Click');
    await undoRedo(page, platform, source, plain);

    // a viewer shown with its slide is made the last step of its slide, with the style play
    await toggle(page, 'figure.startOnClick');
    const last = plain.replace(scene(' class="zone"'), scene(' class="zone fragment play" data-fragment-index="3"'));
    sameText(await rendered(page), last);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, true);
    await undoRedo(page, platform, plain, last);
    await saved(page, `r37-1-${++saves}.html`);
  });

  test(`${platform}: Start on a click is checked for a viewer in a zone that is a step of the style play, and its uncheck takes the step off the zone`, async (t) => {
    const page = await open(t, platform, { deck: VIEWERS, slide: 2, pane: 'format' });
    const source = page.source;
    await selectScene(page);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, true);
    await toggle(page, 'figure.startOnClick');
    const plain = source.replace(INSIDE, INSIDE.replace(' fragment play" data-fragment-index="1"', '"')).replace(AFTER(2), AFTER(1));
    sameText(await rendered(page), plain);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, false);
    await undoRedo(page, platform, source, plain);

    // the step is then written on the tag of the viewer, as the theme reads it
    await toggle(page, 'figure.startOnClick');
    const last = plain.replace('<tycho-viewer theme="dark" kiosk id="inside">', '<tycho-viewer theme="dark" kiosk id="inside" class="fragment play" data-fragment-index="2">');
    sameText(await rendered(page), last);
    assert.equal((await checkOf(page, 'figure.startOnClick')).checked, true);
    await undoRedo(page, platform, plain, last);
    await saved(page, `r37-1-${++saves}.html`);
  });

  test(`${platform}: a picture and a paragraph do not have Start on a click in their Arrange pane`, async (t) => {
    const page = await open(t, platform, { pane: 'format' });
    await click(page, '.reveal section.present h2');
    await frames(page);
    assert.equal(await checkOf(page, 'figure.startOnClick'), undefined);
  });

  test(`${platform}: a preview of the steps holds a viewer of the style play at its first frame until its step, and plays it from its start`, async (t) => {
    const page = await open(t, platform, { deck: VIEWERS, motion: true });
    await page.waitFor(`!!document.getElementById('play').state`);
    await page.waitFor(`document.getElementById('play').playing`);
    await page.evaluate(`(() => {
      window.__seen = [];
      const html = document.documentElement;
      const v = document.getElementById('play');
      const see = () => window.__seen.push({ step: html.dataset.previewStep, playing: v.playing, time: v.time });
      // the scene is read at each step and in each frame, since on a slow runner a frame of the
      // scene can be longer than the 0.8 s of a step
      new MutationObserver(see).observe(html, { attributes: true, attributeFilter: ['data-preview-step'] });
      const look = () => {
        if (html.classList.contains('beeson-previewing')) see();
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
      window.BeesonEditor.exec('steps.preview');
      return true;
    })()`);
    await page.waitFor(`document.documentElement.classList.contains('beeson-previewing')`);
    await page.waitFor(`!document.documentElement.classList.contains('beeson-previewing')`, 20000);
    const seen = await page.evaluate('window.__seen');
    const before = seen.filter((s) => s.step === '0' || s.step === '1');
    assert.ok(before.length > 0, 'the preview did not show the slide before the step of the scene');
    assert.deepEqual(before.filter((s) => s.playing || s.time !== 0).slice(0, 3), [], 'the scene is played before its step');
    const from = seen.find((s) => s.step === '2' && s.playing);
    assert.ok(from && from.time < 0.5, `the scene is not played from its start at its step: ${JSON.stringify(from)}, read ${JSON.stringify(seen.filter((s) => s.step !== '0' && s.step !== '1').slice(0, 4))}`);
    // the editor shows every step, hence the scene is played again after the preview
    await page.waitFor(`document.getElementById('play').playing`);
    sameText(await rendered(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  // a scene is played again after a preview, as the editor shows it, and the next preview starts it anew
  test(`${platform}: a preview from a step at which a viewer is shown, after another preview, plays the scene from its start`, async (t) => {
    const page = await open(t, platform, { deck: VIEWERS, motion: true });
    await page.waitFor(`!!document.getElementById('play').state`);
    await exec(page, 'steps.preview');
    await page.waitFor(`!document.documentElement.classList.contains('beeson-previewing')`, 20000);
    await page.waitFor(`document.getElementById('play').playing && document.getElementById('play').time > 1.5`, 20000);
    // the row of the step after the scene is selected, and the preview is played from the step before it, at which the scene is shown
    await click(page, await page.evaluate(`(() => { const b = ${ROW('A later step')}.querySelector('.text').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`));
    await frames(page);
    await page.evaluate(`window.BeesonEditor.exec('steps.playFrom'); true`);
    await page.waitFor(`document.documentElement.classList.contains('beeson-previewing')`);
    await frames(page);
    const now = await page.evaluate(`({ playing: document.getElementById('play').playing, time: document.getElementById('play').time, step: document.documentElement.dataset.previewStep })`);
    assert.ok(now.playing && now.time < 1, `the scene is not played from its start: ${JSON.stringify(now)}`);
    await page.waitFor(`!document.documentElement.classList.contains('beeson-previewing')`, 20000);
    assert.deepEqual(errors(page), []);
  });
}
