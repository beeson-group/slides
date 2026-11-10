// checks of the QR codes of src/qr.ts: the encoder at every version, decoded with jsQR from a
// raster of its modules, and the codes of test/pages/qr.html and of the demo deck in Chrome,
// decoded from screenshots of the slides in both modes, in the print view, and in the editor

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import jsQR from 'jsqr';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { QUIET, capacity, encode } from '../src/qr.ts';

const PAGE = 'test/pages/qr.html';
const ADDRESSES = [
  'https://example.com/x.pdf',
  'https://github.com/beeson-group/slides',
  'https://arc.aiaa.org/doi/10.2514/6.2026-1234?download=true&utm_source=beeson-group-talk&slide=42',
  'https://beeson-group.github.io/slides/talks/2026/bifurcation-tracking/slides.pdf?from=qr&session=astrodynamics-specialist-conference&track=orbit-determination-and-mission-design&room=ballroom-b&note=the-families-of-halo-orbits-continued-through-their-bifurcations',
  'https://example.com/café/Δv?ν=1',
];

// the RGBA pixels of a code drawn black on white at scale pixels per module, with its quiet zone
function raster(code, scale = 4) {
  const side = (code.size + 2 * QUIET) * scale;
  const px = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < code.size; r++) {
    for (let c = 0; c < code.size; c++) {
      if (!code.dark[r][c]) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const i = (((r + QUIET) * scale + y) * side + (c + QUIET) * scale + x) * 4;
          px[i] = px[i + 1] = px[i + 2] = 0;
        }
      }
    }
  }
  return { px, side };
}

// a text of n bytes in the characters of an address
const filler = (n) => Array.from({ length: n }, (_, i) => 'abcdefghijklmnopqrstuvwxyz0123456789-./?='[(i * 7) % 41]).join('');

test('a text as long as each version holds is encoded in that version, and decoded back, at versions 1 to 40', () => {
  for (let version = 1; version <= 40; version++) {
    const text = filler(capacity(version));
    const code = encode(text);
    assert.equal(code.version, version);
    assert.equal(code.size, 4 * version + 17);
    const { px, side } = raster(code);
    const read = jsQR(px, side, side, { inversionAttempts: 'dontInvert' });
    assert.equal(read?.data, text, `version ${version}`);
    assert.equal(read.version, version);
  }
  // the byte capacities of level M in table 7 of ISO/IEC 18004
  assert.deepEqual([1, 2, 3, 10, 40].map(capacity), [14, 26, 42, 213, 2331]);
  assert.throws(() => encode(filler(2332)), /holds at most 2331/);
});

test('a code is read with a square of its modules inverted, hence its error correction is decoded', () => {
  const text = 'https://github.com/beeson-group/slides';
  const code = encode(text);
  // a square of 6 by 6 modules in the data, away from the alignment pattern of version 3, which
  // spans up to 9 codewords, while the one block of version 3 corrects 13
  assert.equal(code.version, 3);
  for (let r = 9; r < 15; r++) for (let c = 9; c < 15; c++) code.dark[r][c] = !code.dark[r][c];
  const { px, side } = raster(code);
  assert.equal(jsQR(px, side, side, { inversionAttempts: 'dontInvert' })?.data, text);
});

// jsQR in the page, as a classic script that defines window.jsQR
const require = createRequire(import.meta.url);
const jsqrSource = readFileSync(require.resolve('jsqr/dist/jsQR.js'), 'utf8');

// the text of each code on the current slide of page, read from a screenshot of the slide without
// inverting its colors, and the colors of the tile and of the ink
async function readSlide(page) {
  const boxes = await page.evaluate(`[...document.querySelectorAll('.reveal .slides section.present .qr > svg')].map((svg) => {
    const r = svg.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, side: svg.viewBox.baseVal.width };
  })`);
  const out = [];
  for (const { side, ...box } of boxes) {
    const png = (await page.screenshot({ ...box, scale: 1 })).toString('base64');
    // the center of the finder at the upper left, a dark module
    const finder = (QUIET + 3.5) / side;
    out.push(await page.evaluate(`(async () => {
      if (!window.jsQR) (0, eval)(${JSON.stringify(jsqrSource)});
      const image = new Image();
      image.src = 'data:image/png;base64,${png}';
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, image.width, image.height);
      const read = window.jsQR(data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      const tile = [...context.getImageData(Math.floor(image.width / 2), 2, 1, 1).data.slice(0, 3)];
      const ink = [...context.getImageData(Math.floor(image.width * ${finder}), Math.floor(image.height * ${finder}), 1, 1).data.slice(0, 3)];
      return { text: read?.data ?? null, tile, ink };
    })()`));
  }
  return out;
}

const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

test('each code of the test deck is read back from the slide in both modes, dark on a light tile, without inverting it', { timeout: 90000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  for (const theme of ['dark', 'light']) {
    await page.goto(deckUrl(PAGE, `theme=${theme}&still`));
    await page.waitFor(deckSettled);
    assert.equal(await page.evaluate('document.documentElement.dataset.theme'), theme);
    const read = [];
    for (let h = 0; h < ADDRESSES.length; h++) {
      // the last step, at which the code in a fragment is shown
      await page.evaluate(`Reveal.slide(${h}, 0, 99)`);
      await page.waitFor(deckSettled);
      await new Promise((done) => setTimeout(done, 500));
      const codes = await readSlide(page);
      assert.equal(codes.length, 1, `${theme}, slide ${h + 1}`);
      read.push(codes[0].text);
      // the tile is light and the modules dark in both modes
      assert.ok(luminance(codes[0].tile) > 0.9, `${theme}, slide ${h + 1}: the tile is ${codes[0].tile}`);
      assert.ok(luminance(codes[0].ink) < 0.1, `${theme}, slide ${h + 1}: the ink is ${codes[0].ink}`);
    }
    assert.deepEqual(read, ADDRESSES, theme);
    assert.match(await page.evaluate(`document.querySelector('#too-long .qr-error')?.textContent`), /2332 bytes long, and a QR code at level M holds at most 2331/);
    assert.deepEqual(page.errors, []);
  }
});

test('a code added to a slide after the start is drawn by Beeson.mount on the code itself', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(PAGE, 'still'));
  await page.waitFor(deckSettled);
  const drawn = await page.evaluate(`(() => {
    const qr = Object.assign(document.createElement('div'), { className: 'qr' });
    qr.dataset.qr = 'https://example.com';
    document.querySelector('.reveal .slides section').append(qr);
    window.Beeson.mount(qr);
    return !!qr.querySelector(':scope > svg');
  })()`);
  assert.equal(drawn, true);
  assert.deepEqual(page.errors, []);
});

test('every printed page of the test deck carries the code of its slide, as drawn in the slides', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl(PAGE, 'print-pdf&still'));
  const printed = await page.evaluate(`[...document.querySelectorAll('.pdf-page')].map((p) => {
    const qr = p.querySelector('.qr');
    const visible = qr && getComputedStyle(qr).opacity !== '0' && getComputedStyle(qr).visibility !== 'hidden';
    return { address: qr?.dataset.qr ?? null, drawn: qr?.querySelectorAll(':scope > svg').length ?? 0, visible: !!visible, path: qr?.querySelector('path')?.getAttribute('d') ?? null };
  })`);
  // the slide with the code in a fragment is printed before and after its step
  assert.deepEqual(printed.map((p) => [p.address?.slice(0, 22) ?? null, p.drawn, p.visible]), [
    ['https://example.com/x.', 1, true],
    ['https://github.com/bee', 1, true],
    ['https://arc.aiaa.org/d', 1, false],
    ['https://arc.aiaa.org/d', 1, true],
    ['https://beeson-group.g', 1, true],
    ['https://example.com/ca', 1, true],
    ['x'.repeat(22), 0, true],
  ]);
  // a clone of the print view is the code written in the slides
  await page.goto(deckUrl(PAGE, 'still'));
  await page.waitFor(deckSettled);
  const live = await page.evaluate(`[...document.querySelectorAll('.qr path')].map((p) => p.getAttribute('d'))`);
  assert.deepEqual(printed.filter((p) => p.path).map((p) => p.path), [live[0], live[1], live[2], live[2], live[3], live[4]]);
});

test('the code of the demo deck is read back, moved by a drag in the editor, and its offset written into its tag', { timeout: 60000 }, async (t) => {
  const deckText = readFileSync('index.html', 'utf8');
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  // Alt is the free modifier of a drag on Windows and Linux, and the copy modifier on a Mac
  await page.goto(deckUrl('index.html', 'edit&still&edit-platform=other'));
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  const opened = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(deckText)})`);
  assert.deepEqual(opened.problems, []);
  await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector('.qr').closest('section')).h)`);
  await new Promise((done) => setTimeout(done, 300));
  const [code] = await readSlide(page);
  assert.equal(code.text, 'https://github.com/beeson-group/slides');
  const moved = await page.evaluate(`(async () => {
    const qr = document.querySelector('.qr');
    const r = qr.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const scale = Reveal.getScale();
    // with Alt, so that the code does not snap to an edge on its way
    const at = (type, cx, cy) => document.elementFromPoint(cx, cy).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, pointerId: 1, altKey: true }));
    at('pointermove', x, y);
    at('pointerdown', x, y);
    at('pointermove', x - 30 * scale, y - 20 * scale);
    at('pointermove', x - 60 * scale, y - 40 * scale);
    at('pointerup', x - 60 * scale, y - 40 * scale);
    return { movable: qr.classList.contains('beeson-movable'), translate: qr.style.translate };
  })()`);
  assert.deepEqual(moved, { movable: true, translate: '-60px -40px' });
  const tag = '<div class="qr" data-qr="https://github.com/beeson-group/slides">';
  assert.equal(deckText.split(tag).length, 2);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), deckText.replace(tag, '<div class="qr" data-qr="https://github.com/beeson-group/slides" style="translate: -60px -40px">'));
});
