// checks of the PowerPoint export, read from the XML of the file, as AGENTS.md asks

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { pptx, zip } from '../scripts/pptx.mjs';
import { recordScenes } from '../scripts/scenes.mjs';
import { stream as mp4Stream } from './helpers/mp4.mjs';

const EMU_PER_PX = 6350;

// the parts of a zip, from its central directory, as a map of a name to a Buffer
function unzip(file) {
  const end = file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const parts = new Map();
  let at = file.readUInt32LE(end + 16);
  for (let n = 0; n < file.readUInt16LE(end + 10); n += 1) {
    assert.equal(file.readUInt32LE(at), 0x02014b50);
    const method = file.readUInt16LE(at + 10);
    const size = file.readUInt32LE(at + 20);
    const nameLength = file.readUInt16LE(at + 28);
    const local = file.readUInt32LE(at + 42);
    const name = file.toString('utf8', at + 46, at + 46 + nameLength);
    const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28);
    const data = file.subarray(start, start + size);
    parts.set(name, method === 8 ? inflateRawSync(data) : data);
    at += 46 + nameLength;
  }
  return parts;
}

const text = (parts, name) => parts.get(name).toString('utf8');

// the relationships of a part, as a map of an id to the name of the target part
function relationships(parts, name) {
  const rels = `${dirname(name)}/_rels/${posix.basename(name)}.rels`;
  if (!parts.has(rels)) return new Map();
  return new Map([...text(parts, rels).matchAll(/<Relationship Id="([^"]+)" Type="[^"]+" Target="([^"]+)"/g)]
    .map(([, id, target]) => [id, posix.normalize(`${dirname(name)}/${target}`)]));
}

function assertBalanced(xml, name) {
  const open = [];
  for (const [, close, tag, empty] of xml.replace(/<\?.*?\?>/g, '').matchAll(/<(\/?)([\w:]+)(?:\s[^<>]*?)?(\/?)>/g)) {
    if (close) assert.equal(open.pop(), tag, `${name}: ${tag} is closed out of order`);
    else if (!empty) open.push(tag);
  }
  assert.deepEqual(open, [], `${name}: elements are left open`);
}

// every XML part is balanced, every part has a content type, and every reference has a target
function assertPackage(parts) {
  const types = text(parts, '[Content_Types].xml');
  for (const [name, data] of parts) {
    if (/\.(xml|rels)$/.test(name)) assertBalanced(data.toString('utf8'), name);
    if (name === '[Content_Types].xml') continue;
    const extension = name.split('.').pop();
    assert.ok(types.includes(`PartName="/${name}"`) || types.includes(`Extension="${extension}"`), `${name} has a content type`);
    if (name.endsWith('.rels') || !name.endsWith('.xml')) continue;
    const rels = relationships(parts, name);
    for (const target of rels.values()) assert.ok(parts.has(target), `${name}: ${target} exists`);
    for (const [, id] of text(parts, name).matchAll(/r:(?:id|embed|link)="([^"]+)"/g)) {
      assert.ok(rels.has(id), `${name}: ${id} is a relationship`);
    }
  }
  for (const [, name] of types.matchAll(/PartName="\/([^"]+)"/g)) assert.ok(parts.has(name), `${name} of the content types exists`);
}

// the run of the export of a deck, with options before and after the deck and the output, and the
// parts of its file. with noH264, the export is run in a browser without an H.264 encoder
function runExport(deck, before = [], after = [], { noH264 = false } = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'beeson-pptx-'));
  try {
    const output = join(folder, 'deck.pptx');
    const preload = noH264 ? ['--import', './test/helpers/no-h264.mjs'] : [];
    const run = spawnSync(process.execPath, [...preload, 'scripts/export-pptx.mjs', ...before, deck, output, ...after], { encoding: 'utf8' });
    return { run, parts: run.status === 0 ? unzip(readFileSync(output)) : null };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

function exportDeck(deck, before, after, options) {
  const { run, parts } = runExport(deck, before, after, options);
  assert.equal(run.status, 0, run.stderr);
  return parts;
}

const slideCount = (parts) => [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length;
const box = (px) => `<a:off x="${px.x * EMU_PER_PX}" y="${px.y * EMU_PER_PX}"/><a:ext cx="${px.width * EMU_PER_PX}" cy="${px.height * EMU_PER_PX}"/>`;

test('a zip is read back with its names and contents', () => {
  const parts = unzip(zip([['a.xml', '<a>é</a>'], ['b/c.png', Buffer.from([1, 2, 3])]]));
  assert.equal(text(parts, 'a.xml'), '<a>é</a>');
  assert.deepEqual([...parts.get('b/c.png')], [1, 2, 3]);
});

test('a video that is shown on two slides is embedded once, and it starts by itself', () => {
  const video = { path: 'demo/clip-dark.mp4', poster: Buffer.from([1]), x: 10, y: 20, width: 30, height: 40, duration: 6000, loop: true, muted: true };
  const deckSlide = { name: 'A & B', images: [Buffer.from([2])], notes: ['One'], videos: [video] };
  const parts = unzip(pptx([deckSlide, deckSlide]));
  assertPackage(parts);
  assert.equal([...parts.keys()].filter((name) => name.endsWith('.mp4')).length, 1);
  const slide = text(parts, 'ppt/slides/slide2.xml');
  assert.ok(slide.includes('descr="A &amp; B"'));
  assert.ok(slide.includes(box(video)));
  assert.match(slide, /<a:videoFile r:link="rId\d+"\/>/);
  assert.match(slide, /<p14:media [^>]*r:embed="rId\d+"\/>/);
  // an effect that starts after the previous one, in place of one on a click, keeps a click a step
  assert.match(slide, /presetClass="mediacall"[^>]*nodeType="afterEffect"/);
  assert.match(slide, /cmd="playFrom\(0\.0\)"/);
  assert.match(slide, /<p:cMediaNode vol="80000" mute="1"><p:cTn id="\d+" repeatCount="indefinite"/);
  const ids = [...slide.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(ids, ids.map((_, n) => n + 1));
});

// a slide of one still, a recording, three pictures of the words, and a video, with small Buffers
// in place of the PNGs and MP4s
const recorded = ({ tops = 3, loop = true } = {}) => ({
  name: 'Recorded',
  notes: [],
  images: [Buffer.from([1])],
  recording: { data: Buffer.from([2]), poster: Buffer.from([3]), duration: 5000, loop },
  tops: Array.from({ length: tops }, (_, n) => Buffer.from([10 + n])),
  videos: [{ data: Buffer.from([4]), poster: Buffer.from([5]), x: 10, y: 20, width: 30, height: 40, duration: 2000, loop: false, muted: false }],
});

const pictures = (slide) => [...slide.matchAll(/<p:pic><p:nvPicPr><p:cNvPr id="(\d+)" name="([^"]+)"/g)].map((m) => m.slice(1));

// the parts that a picture of a slide points to, in the order of its r:link and r:embed
function targets(parts, name, shape) {
  const picture = text(parts, name).match(new RegExp(`<p:cNvPr id="${shape}" [^]*?</p:pic>`))[0];
  const rels = relationships(parts, name);
  return [...picture.matchAll(/r:(?:embed|link)="([^"]+)"/g)].map((m) => rels.get(m[1]));
}

test('a recording is above the still of its slide, under the words, which are under the videos', () => {
  const parts = unzip(pptx([recorded()]));
  assertPackage(parts);
  const name = 'ppt/slides/slide1.xml';
  const slide = text(parts, name);
  assert.deepEqual(pictures(slide), [['2', 'Step 1'], ['3', 'Recording'], ['4', 'Words 1'], ['5', 'Words 2'], ['6', 'Words 3'], ['7', 'Video 7']]);
  const [link, embed, poster] = targets(parts, name, 3);
  assert.equal(link, embed);
  assert.deepEqual([...parts.get(link)], [2]);
  assert.deepEqual([...parts.get(poster)], [3]);
  assert.ok(slide.match(/<p:cNvPr id="3" [^]*?<\/p:pic>/)[0].includes(box({ x: 0, y: 0, width: 1920, height: 1080 })));
  assert.deepEqual(targets(parts, name, 5).map((part) => [...parts.get(part)]), [[11]]);
  assert.deepEqual([...parts.get(targets(parts, name, 7)[0])], [4]);
});

test('a recording is started first with its slide, muted, and the videos are started with it', () => {
  const looped = text(unzip(pptx([recorded()])), 'ppt/slides/slide1.xml');
  assert.deepEqual([...looped.matchAll(/presetClass="mediacall"[^>]*nodeType="(\w+)"[^]*?<p:spTgt spid="(\d+)"/g)].map((m) => m.slice(1)),
    [['afterEffect', '3'], ['withEffect', '7']]);
  const nodes = [...looped.matchAll(/<p:cMediaNode ([^>]*)><p:cTn id="\d+"([^>]*)>[^]*?<p:spTgt spid="(\d+)"/g)].map((m) => m.slice(1));
  assert.deepEqual(nodes, [
    ['vol="80000" mute="1"', ' repeatCount="indefinite" fill="hold" display="0"', '3'],
    ['vol="80000"', ' fill="hold" display="0"', '7'],
  ]);
  const once = text(unzip(pptx([recorded({ loop: false })])), 'ppt/slides/slide1.xml');
  assert.ok(once.includes('<p:cMediaNode vol="80000" mute="1"><p:cTn id="') && !once.includes('repeatCount'));
});

test('a click shows the next picture of the words and hides the one before', () => {
  const slide = text(unzip(pptx([recorded()])), 'ppt/slides/slide1.xml');
  // in the main sequence, a click is a lone indefinite condition. the media nodes after the
  // sequence have one as well
  const sequence = slide.slice(0, slide.indexOf('<p:prevCondLst>'));
  const clicks = sequence.split('<p:cond delay="indefinite"/></p:stCondLst>').slice(1);
  assert.equal(clicks.length, 2);
  assert.equal(slide.match(/nodeType="clickEffect"/g).length, 2);
  const swaps = clicks.map((click) => [
    ...click.matchAll(/presetClass="(entr|exit)"[^>]*nodeType="(\w+)"[^]*?<p:spTgt spid="(\d+)"[^]*?<p:strVal val="(\w+)"/g),
  ].map((m) => m.slice(1)));
  assert.deepEqual(swaps, [
    [['entr', 'clickEffect', '5', 'visible'], ['exit', 'withEffect', '4', 'hidden']],
    [['entr', 'clickEffect', '6', 'visible'], ['exit', 'withEffect', '5', 'hidden']],
  ]);
  const ids = [...slide.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(ids, ids.map((_, n) => n + 1));
});

test('a slide with a recording and one picture of the words does not have a click', () => {
  const slide = text(unzip(pptx([recorded({ tops: 1 })])), 'ppt/slides/slide1.xml');
  assert.deepEqual(pictures(slide).map(([, name]) => name), ['Step 1', 'Recording', 'Words 1', 'Video 5']);
  assert.ok(!slide.includes('clickEffect') && !slide.includes('presetClass="exit"'));
  assert.match(slide, /presetClass="mediacall"[^>]*nodeType="afterEffect"/);
});

test('a recording and a video of one Buffer on two slides are each embedded once', () => {
  const deckSlide = recorded();
  const parts = unzip(pptx([deckSlide, { ...deckSlide, tops: [Buffer.from([20])] }]));
  assertPackage(parts);
  const videos = [...parts.keys()].filter((name) => name.endsWith('.mp4'));
  assert.equal(videos.length, 2);
  for (const name of ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml']) {
    const shapes = pictures(text(parts, name));
    const shape = (label) => shapes.find(([, picture]) => picture.startsWith(label))[0];
    assert.deepEqual(targets(parts, name, shape('Recording')).slice(0, 2), [videos[0], videos[0]]);
    assert.deepEqual(targets(parts, name, shape('Video')).slice(0, 2), [videos[1], videos[1]]);
  }
});

test('a recording is on a slide of one still, and the pictures of the words need a recording', () => {
  assert.throws(() => pptx([{ ...recorded(), images: [Buffer.from([1]), Buffer.from([2])] }]),
    /^Error: Recorded: a slide with a recording has one image, the still under it, and not 2$/);
  assert.throws(() => pptx([{ ...recorded(), recording: undefined }]),
    /^Error: Recorded: a slide with tops, the pictures of its words, needs a recording under them$/);
});

test('every XML part of a file with a recording is well formed, as read by xmllint', (t) => {
  if (spawnSync('xmllint', ['--version']).error) {
    t.skip('xmllint is not installed');
    return;
  }
  const parts = unzip(pptx([recorded(), { ...recorded({ tops: 1 }), notes: ['A <note> & more'] }]));
  const folder = mkdtempSync(join(tmpdir(), 'beeson-pptx-'));
  try {
    const files = [...parts].filter(([name]) => /\.(xml|rels)$/.test(name)).map(([name, data], n) => {
      const file = join(folder, `${n}-${posix.basename(name)}`);
      writeFileSync(file, data);
      return file;
    });
    const run = spawnSync('xmllint', ['--noout', ...files], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('videos are placed on their steps of a deck, in the box of their picture', () => {
  const parts = exportDeck('test/pages/video-placed.html');
  assertPackage(parts);
  assert.equal(slideCount(parts), 4);
  const slides = [1, 2, 3, 4].map((n) => text(parts, `ppt/slides/slide${n}.xml`));
  assert.deepEqual(slides.map((slide) => slide.match(/<a:videoFile /g)?.length ?? 0), [1, 0, 0, 1]);
  // a clip of 1200 by 1600 px in a plate of 1680 by 630 px is at its right, as in object-position
  assert.ok(slides[0].includes(box({ x: 1327.5, y: 200, width: 472.5, height: 630 })));
  assert.ok(slides[0].includes('repeatCount="indefinite"') && slides[0].includes('mute="1"'));
  assert.ok(!slides[3].includes('repeatCount') && !slides[3].includes('mute="1"'));
  // the videos of the for-light class are hidden, hence one clip is in the file
  assert.equal([...parts.keys()].filter((name) => name.endsWith('.mp4')).length, 1);
  const notes = text(parts, 'ppt/notesSlides/notesSlide1.xml');
  assert.ok(notes.includes('<a:t>The first paragraph &lt;of the notes&gt;.</a:t>'), notes);
  assert.ok(notes.includes('<a:t>The second paragraph.</a:t>'), notes);
  assert.ok(!parts.has('ppt/notesSlides/notesSlide2.xml'));
});

// a video is restarted on a new PowerPoint slide, and a later step is shown on a click in its place
test('a video is played through the steps of its slide', () => {
  const parts = exportDeck('test/pages/video-steps.html');
  assertPackage(parts);
  assert.equal(slideCount(parts), 1, 'a video on more than one slide is restarted at each step');
  const slide = text(parts, 'ppt/slides/slide1.xml');
  assert.deepEqual([...slide.matchAll(/<p:pic><p:nvPicPr><p:cNvPr id="(\d+)" name="(\w+)/g)].map((m) => m.slice(1)),
    [['2', 'Step'], ['3', 'Step'], ['4', 'Step'], ['5', 'Step'], ['6', 'Video']]);
  // the last click is the step that restores the dimmed fragments
  assert.deepEqual([...slide.matchAll(/nodeType="clickEffect".*?<p:spTgt spid="(\d+)"/g)].map((m) => m[1]), ['3', '4', '5']);
  assert.ok(slide.indexOf('nodeType="afterEffect"') < slide.indexOf('nodeType="clickEffect"'));
});

// a clip of the style play is in the images of the steps before its own, and it is started on the
// PowerPoint slide of its step. A clip under a later one of its place is left out
test('a video is started on the click of its step, and two videos of one step together', () => {
  const parts = exportDeck('test/pages/video-play.html');
  assertPackage(parts);
  assert.equal(slideCount(parts), 10);
  const slides = Array.from({ length: 10 }, (_, n) => text(parts, `ppt/slides/slide${n + 1}.xml`));
  assert.deepEqual(slides.map((slide) => slide.match(/<a:videoFile /g)?.length ?? 0), [0, 0, 1, 0, 2, 0, 1, 1, 0, 1]);
  // the steps after the step of the clip are clicks on its slide
  assert.equal(slides[2].match(/nodeType="clickEffect"/g).length, 2);
  assert.deepEqual([...slides[4].matchAll(/presetClass="mediacall"[^>]*nodeType="(\w+)"/g)].map((m) => m[1]), ['afterEffect', 'withEffect']);
  // the clips of a slide, the first test pattern and then the second on the slide of two
  const clips = (n) => [...new Set([...relationships(parts, `ppt/slides/slide${n}.xml`).values()].filter((name) => name.endsWith('.mp4')))];
  const [a, b] = clips(5);
  assert.deepEqual([clips(7), clips(8)], [[a], [b]], 'the second clip is shown in place of the first');
});

// with --still, a tycho viewer of the style play is in the image of each step of its slide, as the
// still of its first frame. The stills themselves are checked in the print view, in
// test/viewers.test.mjs
test('with --still, a tycho viewer of the style play is exported as its still on every step of its slide', () => {
  const parts = exportDeck('test/pages/viewer-play.html', [], ['--still']);
  assertPackage(parts);
  assert.equal(slideCount(parts), 10);
  const slides = Array.from({ length: 10 }, (_, n) => text(parts, `ppt/slides/slide${n + 1}.xml`));
  assert.deepEqual(slides.map((slide) => slide.match(/name="Step /g)?.length ?? 0), Array(10).fill(1));
  assert.ok(![...parts.keys()].some((name) => name.endsWith('.mp4')));
});

// with --still, since the loop of the scene of the demo deck lasts 72 s
test('the demo deck is exported with a step for each page of its PDF', () => {
  const parts = exportDeck('index.html', ['--still']);
  assertPackage(parts);
  const steps = [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .reduce((total, name) => total + text(parts, name).match(/name="Step /g).length, 0);
  const folder = mkdtempSync(join(tmpdir(), 'beeson-pdf-'));
  try {
    const run = spawnSync(process.execPath, ['scripts/export-pdf.mjs', 'index.html', join(folder, 'deck.pdf')], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(steps, Number(run.stdout.match(/(\d+) pages/)[1]));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  assert.equal(text(parts, 'ppt/presentation.xml').match(/<p:sldId /g).length, slideCount(parts));
  assert.ok([...parts.keys()].some((name) => name.endsWith('.mp4')));
});

// runs in Chrome. a and b are { png } or { mp4, time }, where png is the base64 of a PNG or a list
// of them drawn one over the other, and mp4 is the base64 of an MP4 at a time in s, each with a crop
// { x, y, width, height } in px of the file or without one. Returns the largest difference of a
// channel, the shares of the pixels off by more than 8 and by more than 32 in a channel, the mean
// difference of a channel, and the PSNR in dB over RGB
async function differences(a, b) {
  const pixels = async ({ png, mp4, time, crop }) => {
    let source, over = [];
    if (png) {
      [source, ...over] = await Promise.all([png].flat().map(async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        return image;
      }));
    } else {
      source = document.createElement('video');
      source.muted = true;
      source.src = URL.createObjectURL(new Blob([Uint8Array.from(atob(mp4), (c) => c.charCodeAt(0))], { type: 'video/mp4' }));
      await new Promise((done, fail) => {
        source.onloadeddata = done;
        source.onerror = () => fail(new Error(`the MP4 is not decoded: ${source.error?.message}`));
      });
      source.currentTime = time;
      await new Promise((done) => { source.onseeked = done; });
    }
    const { x = 0, y = 0, width = source.videoWidth ?? source.naturalWidth, height = source.videoHeight ?? source.naturalHeight } = crop ?? {};
    const g = new OffscreenCanvas(width, height).getContext('2d');
    for (const image of [source, ...over]) g.drawImage(image, x, y, width, height, 0, 0, width, height);
    return g.getImageData(0, 0, width, height);
  };
  const [p, q] = await Promise.all([pixels(a), pixels(b)]);
  if (p.width !== q.width || p.height !== q.height) return { size: [p.width, p.height, q.width, q.height] };
  const n = p.width * p.height;
  let max = 0, few = 0, over = 0, sum = 0, squares = 0;
  for (let i = 0; i < n; i++) {
    let most = 0;
    for (let c = 0; c < 3; c++) {
      const e = Math.abs(p.data[4 * i + c] - q.data[4 * i + c]);
      most = Math.max(most, e);
      sum += e;
      squares += e * e;
    }
    max = Math.max(max, most);
    if (most > 8) few++;
    if (most > 32) over++;
  }
  return { size: [p.width, p.height], max, few: few / n, over: over / n, mean: sum / (3 * n), psnr: 10 * Math.log10((255 * 255 * 3 * n) / Math.max(squares, 1)) };
}

const compare = (page, a, b) => page.evaluate(`(${differences})(${JSON.stringify(a)}, ${JSON.stringify(b)})`);

// the height in px and the picture of each .pdf-page of the print view of a deck in page, clipped to
// the box of the page in the document. with pdfPageHeightOffset=0, a page is as high as its slide,
// in place of a pixel less
async function printedSteps(page, deck) {
  await printView(page, deckUrl(deck, 'print-pdf&still&pdfPageHeightOffset=0'));
  const boxes = await page.evaluate(`[...document.querySelectorAll('.pdf-page')]
    .map((step) => ({ y: window.scrollY + step.getBoundingClientRect().top, height: step.getBoundingClientRect().height }))`);
  const shots = [];
  for (const { y } of boxes) {
    await page.evaluate(`window.scrollTo(0, ${y})`);
    await page.waitFor('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');
    shots.push(await page.screenshot({ x: 0, y, width: 1920, height: 1080, scale: 1 }));
  }
  return { heights: boxes.map((b) => b.height), shots };
}

// the picture of PowerPoint slide n of a file of one picture per slide
const stepOf = (parts, n) => parts.get(relationships(parts, `ppt/slides/slide${n}.xml`).get(
  text(parts, `ppt/slides/slide${n}.xml`).match(/<a:blip r:embed="([^"]+)"/)[1]));

// each slide of test/pages/print-rows.html has a bar on its first row and another on its last row.
// by default, a page of the print view is 1079 px high. a picture of 1080 px then ends on the first
// row of the next page, and on the last page the scroll stops a pixel short of its top
test('the picture of each step is its page of the print view, the last page too', { timeout: 300000 }, async (t) => {
  const parts = exportDeck('test/pages/print-rows.html');
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ scale: 2 });
  // every picture is taken before the comparisons, which are made in the same page
  const { heights, shots } = await printedSteps(page, 'test/pages/print-rows.html');
  assert.deepEqual(heights, shots.map(() => 1080));
  assert.equal(slideCount(parts), shots.length);
  const off = [];
  for (const [n, shot] of shots.entries()) {
    const seen = await compare(page, { png: stepOf(parts, n + 1).toString('base64') }, { png: shot.toString('base64') });
    t.diagnostic(`step ${n + 1}: ${JSON.stringify(seen)}`);
    // measured on a Mac as equal. a picture with the last row of a slide replaced has 0.09 % of
    // its pixels off by more than 32
    if (!(seen.over < 1e-5 && seen.mean < 0.01)) off.push({ step: n + 1, ...seen });
  }
  assert.deepEqual(off, []);
});

const pngSize = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

// the box in px of a picture of a slide
function placeOf(slide, shape) {
  const [, x, y, cx, cy] = slide.match(new RegExp(`<p:cNvPr id="${shape}" [^]*?<a:off x="(\\d+)" y="(\\d+)"/><a:ext cx="(\\d+)" cy="(\\d+)"/>`));
  const [left, top, width, height] = [x, y, cx, cy].map((emu) => Number(emu) / EMU_PER_PX);
  return { x: left, y: top, width, height };
}

// the videos of a PowerPoint slide of a file, each with its box and the parts of its recording and
// its poster
function videosOf(parts, n) {
  const name = `ppt/slides/slide${n}.xml`;
  const slide = text(parts, name);
  return pictures(slide).filter(([, label]) => label.startsWith('Video')).map(([shape]) => {
    const [link, embed, poster] = targets(parts, name, shape);
    assert.equal(link, embed);
    return { ...placeOf(slide, shape), recording: link, poster };
  });
}

// the file of test/pages/scene-record.html, exported once for the tests of its recordings
let sceneParts;
const sceneDeck = () => (sceneParts ??= exportDeck('test/pages/scene-record.html'));

test('a tycho scene is recorded into a video in the box of its viewer, at twice its size, at 60 frames per second, and with one key frame', () => {
  const parts = sceneDeck();
  assertPackage(parts);
  assert.equal(slideCount(parts), 3);
  const slide = text(parts, 'ppt/slides/slide1.xml');
  assert.deepEqual(pictures(slide).map(([, name]) => name.split(' ')[0]), ['Step', 'Step', 'Video']);
  const [video] = videosOf(parts, 1);
  assert.deepEqual({ ...video, recording: undefined, poster: undefined }, { x: 1200, y: 120, width: 600, height: 800, recording: undefined, poster: undefined });
  // the loop of the scene lasts 1 s
  assert.deepEqual(mp4Stream(parts.get(video.recording)), { width: 1200, height: 1600, fps: 60, frames: 60, duration: 1, keys: [1] });
  assert.deepEqual(pngSize(parts.get(video.poster)), [1200, 1600]);
  // a scene is played without sound and looped, as in its viewer, and the later step is a click
  assert.match(slide, /<p:cMediaNode vol="80000" mute="1"><p:cTn id="\d+" repeatCount="indefinite"/);
  assert.equal(slide.match(/nodeType="clickEffect"/g).length, 1);
  // a recording for each of the three viewers
  assert.equal([...parts.keys()].filter((name) => name.endsWith('.mp4')).length, 3);
});

// the viewer without the attribute kiosk is on the PowerPoint slides of both steps, and it is
// recorded once
test('a viewer of the style play starts a new PowerPoint slide at its step, with its first frame in the pictures before', { timeout: 120000 }, async (t) => {
  const parts = sceneDeck();
  const [first] = videosOf(parts, 2);
  const [again, later] = videosOf(parts, 3);
  assert.equal(videosOf(parts, 2).length, 1);
  assert.equal(again.recording, first.recording);
  assert.notEqual(later.recording, first.recording);
  assert.ok(first.x + first.width <= later.x && first.y === later.y, JSON.stringify([first, later]));
  for (const video of [first, later]) {
    assert.deepEqual(mp4Stream(parts.get(video.recording)), { width: 2 * Math.round(video.width), height: 2 * Math.round(video.height), fps: 60, frames: 60, duration: 1, keys: [1] });
  }
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  // the step of slide 2 is a picture at twice the size of the slide
  const step = parts.get(targets(parts, 'ppt/slides/slide2.xml', 2)[0]);
  const crop = { x: 2 * later.x, y: 2 * later.y, width: 2 * later.width, height: 2 * later.height };
  const seen = await compare(page, { png: step.toString('base64'), crop }, { png: parts.get(later.poster).toString('base64') });
  t.diagnostic(JSON.stringify(seen));
  // the same pixels, since the first frame is put in place of the still of the print view
  assert.ok(seen.max <= 8, JSON.stringify(seen));
});

// a frame of the recording, decoded in Chrome, against a screenshot of the viewer at the time of
// the frame, both at twice the size of the slide
test('a frame of a recording is the picture of its viewer on the page at the same time', { timeout: 120000 }, async (t) => {
  const [video] = videosOf(sceneDeck(), 1);
  const mp4 = sceneDeck().get(video.recording).toString('base64');
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ scale: 2 });
  await page.goto(deckUrl('test/pages/scene-record.html'));
  await page.waitFor(deckSettled);
  await page.waitFor('!!(steady.state && steady.renderer)');
  for (const k of [0, 20, 45]) {
    await page.evaluate(`steady.seek(${k} / 60)`);
    await page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))');
    const box = await page.evaluate('steady.getBoundingClientRect().toJSON()');
    const shot = await page.screenshot({ x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 });
    // the middle of frame k
    // in the page of the deck, since a page behind it does not get animation frames
    const seen = await compare(page, { png: shot.toString('base64') }, { mp4, time: (k + 0.5) / 60 });
    t.diagnostic(`frame ${k}: ${JSON.stringify(seen)}`);
    // measured on a Mac at 44 to 46 dB, with 0.03 to 0.06 % of the pixels off by more than 32.
    // the drawn frames differ from the page by 50 dB and 0.004 %, all in the rotated label of the
    // axis y, and the rest is the loss of the encoder
    assert.ok(seen.psnr > 40 && seen.over < 0.003 && seen.mean < 1, `frame ${k}: ${JSON.stringify(seen)}`);
  }
  assert.deepEqual(page.errors, []);
});

test('without an H.264 encoder, the export of a scene fails with the reason and names --still', () => {
  const { run } = runExport('test/pages/scene-record.html', [], [], { noH264: true });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /H\.264/);
  assert.match(run.stderr, /--still/);
  const parts = exportDeck('test/pages/scene-record.html', ['--still'], [], { noH264: true });
  assert.ok(![...parts.keys()].some((name) => name.endsWith('.mp4')));
});

// the scene of the demo deck is recorded in 83 s on a Mac, and in minutes on a runner of GitHub,
// above the limit of 120 s of a DevTools call in launch() of scripts/chrome.mjs. The limit of the
// second browser is a third of the time of the first recording, and twice the time of every call
// before it, i.e. of the load of the deck
test('a scene is recorded in a browser whose DevTools calls are each answered in less time than the recording', { timeout: 600000 }, async (t) => {
  const boxes = new Map([['0', { width: 300, height: 400, name: 'A long recorded scene' }]]);
  const timed = async (options) => {
    const browser = await launch(options);
    try {
      const start = Date.now();
      let started;
      const { newPage } = browser;
      browser.newPage = async (...args) => {
        const page = await newPage(...args);
        const { evaluate } = page;
        page.evaluate = (expression) => {
          if (started === undefined && expression.includes('exportVideo')) started = Date.now();
          return evaluate(expression);
        };
        return page;
      };
      const [recording] = (await recordScenes(browser, 'test/pages/scene-long.html', boxes)).values();
      return { recording, load: started - start, record: Date.now() - started };
    } finally {
      await browser.close();
    }
  };
  const first = await timed();
  const timeout = Math.round(Math.max(first.record / 3, 2 * first.load));
  t.diagnostic(`load ${first.load} ms, recording ${first.record} ms, limit of a call ${timeout} ms`);
  if (timeout > first.record / 2) return t.skip(`the load of the deck, ${first.load} ms, is too close to the recording, ${first.record} ms`);
  const second = await timed({ timeout });
  t.diagnostic(`load ${second.load} ms, recording ${second.record} ms`);
  // the bytes of two recordings of one scene differ by a few hundred
  const stream = { width: 600, height: 800, fps: 60, frames: 600, duration: 10, keys: [1] };
  assert.deepEqual(mp4Stream(first.recording.data), stream);
  assert.deepEqual(mp4Stream(second.recording.data), stream);
});

