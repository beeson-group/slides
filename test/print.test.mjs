// checks of the print view in Chrome, read from the PDF itself. In a PDF from Chrome, the objects
// of the pages and the dictionaries of the images are not compressed

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

// the images drawn directly on each page of a PDF, in the order of the pages, with the width,
// the height, and the number of distinct RGB pixels of each image
function pageImages(pdf) {
  const text = pdf.toString('latin1');
  const objects = new Map();
  for (const m of text.matchAll(/(\d+) 0 obj\b(.*?)(stream\r?\n|endobj)/gs)) {
    objects.set(m[1], { dictionary: m[2], start: m.index + m[0].length });
  }
  const image = (id) => {
    const { dictionary, start } = objects.get(id);
    if (!/\/Subtype \/Image/.test(dictionary)) return null;
    const [width, height, length] = ['Width', 'Height', 'Length'].map((key) => Number(dictionary.match(`/${key} (\\d+)`)[1]));
    const data = inflateSync(pdf.subarray(start, start + length));
    const colors = new Set();
    for (let i = 0; i + 2 < data.length; i += 3) colors.add(data.readUIntBE(i, 3));
    return { width, height, colors: colors.size };
  };
  // the page tree of a longer PDF has inner nodes
  const pages = (id) => {
    const { dictionary } = objects.get(id);
    const kids = dictionary.match(/\/Kids \[(.*?)\]/s);
    if (kids) return [...kids[1].matchAll(/(\d+) 0 R/g)].flatMap(([, kid]) => pages(kid));
    const table = dictionary.match(/\/XObject <<(.*?)>>/s)?.[1] ?? '';
    return [[...table.matchAll(/\/\w+ (\d+) 0 R/g)].map(([, object]) => image(object)).filter(Boolean)];
  };
  return pages(text.match(/\/Pages (\d+) 0 R/)[1]);
}

// the black panel: a clone of a video had not loaded when the page was printed. The clip is held
// back on a local port, since a clip on the disk loads before the print on most runs
test('a video without a poster is printed with its frame on every step', { timeout: 60000 }, async (t) => {
  const server = await serve('.', { delay: (path) => (path.endsWith('.mp4') ? 1500 : 0) });
  const browser = await launch({ offline: false });
  t.after(async () => {
    await browser.close();
    server.close();
  });
  const page = await browser.newPage();
  await printView(page, `${server.origin}/test/pages/video-steps.html?print-pdf&still`);

  const [width, height] = await page.evaluate(`[document.querySelector('video').videoWidth, document.querySelector('video').videoHeight]`);
  const frames = pageImages(await page.pdf()).map((images) => images.filter((i) => i.width === width && i.height === height).length);

  // the last page is the step that restores the dimmed fragments
  assert.deepEqual(frames, [1, 1, 1, 1]);
});

test('a tycho viewer is printed with its scene', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('index.html', 'print-pdf&still'));
  const step = await page.evaluate(`[...document.querySelectorAll('.pdf-page')]
    .findIndex((p) => p.querySelector('h2')?.textContent === 'Embedding TyCHO scenes')`);

  const images = pageImages(await page.pdf())[step];

  const scene = images.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
  assert.ok(scene.colors > 100, `the largest image of the page has ${scene.colors} colors, and it is ${scene.width} by ${scene.height}`);
});

// a viewer is cloned for each step, and only 16 WebGL contexts are kept by Chrome, hence a deck of
// more steps was printed with empty panels on most of them. the stills are read in the page, since
// an image shared by the pages is stored once in the PDF, outside the dictionaries of the pages
test('a tycho viewer is printed with its scene on every step of its slide', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('test/pages/viewer-steps.html', 'print-pdf&still'));

  // the painted pixels of the still of each page, where a still of a lost context has none
  const stills = await page.evaluate(`[...document.querySelectorAll('.pdf-page')].map((p) => {
    const image = p.querySelector('img[alt="A still of a tycho scene"]');
    if (!image) return null;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) painted++;
    return { width: image.naturalWidth, height: image.naturalHeight, painted };
  })`);

  // 17 fragments, the slide before them, and the step that restores the dimmed fragments
  assert.equal(stills.length, 19);
  const empty = stills.map((still, i) => [i + 1, still]).filter(([, still]) => !still || still.painted < still.width * still.height);
  assert.deepEqual(empty, []);
  assert.equal(new Set(stills.map((still) => `${still.width}x${still.height}`)).size, 1, 'the still has one size on every step');
});

test('the check fails on a video without a poster', () => {
  const out = mkdtempSync(join(tmpdir(), 'beeson-poster-'));
  try {
    const run = spawnSync(process.execPath, ['scripts/check.mjs', '--deck', 'test/pages/video-steps.html', '--out', out], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /video without a poster: \.\.\/\.\.\/demo\/clip-dark\.mp4/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// the title backdrop of test/pages/title-step.html is a step of its slide, traced only from this
// step on, hence checkHeads in scripts/check.mjs must show the step before it reads the heads
test('the check reads the heads of a backdrop that is a step', { timeout: 120000 }, () => {
  const out = mkdtempSync(join(tmpdir(), 'beeson-heads-'));
  try {
    const run = spawnSync(process.execPath, ['scripts/check.mjs', '--deck', 'test/pages/title-step.html', '--out', out], { encoding: 'utf8' });
    assert.doesNotMatch(run.stdout + run.stderr, /heads are not painted/);
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
