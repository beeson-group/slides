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
import { listAnimations, recordAnimation } from '../scripts/animations.mjs';
import { color as mp4Color, stream as mp4Stream } from './helpers/mp4.mjs';

const EMU_PER_PX = 6350;

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

function runExport(deck, before = [], after = [], { noH264 = false, reduced = false } = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'beeson-pptx-'));
  try {
    const output = join(folder, 'deck.pptx');
    const preload = [...(noH264 ? ['--import', './test/helpers/no-h264.mjs'] : []), ...(reduced ? ['--import', './test/helpers/reduced-motion.mjs'] : [])];
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
  assert.match(slide, /presetClass="mediacall"[^>]*nodeType="afterEffect"/);
  assert.match(slide, /cmd="playFrom\(0\.0\)"/);
  assert.match(slide, /<p:cMediaNode vol="80000" mute="1"><p:cTn id="\d+" repeatCount="indefinite"/);
  const ids = [...slide.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(ids, ids.map((_, n) => n + 1));
});

const recorded = ({ tops = 3, loop = true } = {}) => ({
  name: 'Recorded',
  notes: [],
  images: [Buffer.from([1])],
  recording: { data: Buffer.from([2]), poster: Buffer.from([3]), duration: 5000, loop },
  tops: Array.from({ length: tops }, (_, n) => Buffer.from([10 + n])),
  videos: [{ data: Buffer.from([4]), poster: Buffer.from([5]), x: 10, y: 20, width: 30, height: 40, duration: 2000, loop: false, muted: false }],
});

const pictures = (slide) => [...slide.matchAll(/<p:pic><p:nvPicPr><p:cNvPr id="(\d+)" name="([^"]+)"/g)].map((m) => m.slice(1));

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

test('a video after another lies under it, which is hidden once it has played, and is started from as far before its start', () => {
  const clip = { data: Buffer.from([1]), poster: Buffer.from([2]), x: 10, y: 20, width: 30, height: 40, duration: 1400, loop: false, muted: true };
  const loop = { ...clip, data: Buffer.from([3]), duration: 2000, loop: true, after: true };
  const slide = text(unzip(pptx([{ name: 'Changed', notes: [], images: [Buffer.from([4]), Buffer.from([5])], videos: [clip, loop] }])), 'ppt/slides/slide1.xml');
  assert.deepEqual(pictures(slide), [['2', 'Step 1'], ['3', 'Step 2'], ['5', 'Video 5'], ['4', 'Video 4']]);
  const effects = [...slide.matchAll(/presetClass="(\w+)"[^>]*nodeType="(\w+)"><p:stCondLst><p:cond delay="(\d+)"\/>[^]*?(?:cmd="([^"]+)"[^]*?)?<p:spTgt spid="(\d+)"/g)]
    .map((m) => m.slice(1).filter(Boolean));
  assert.deepEqual(effects, [
    ['mediacall', 'afterEffect', '0', 'playFrom(0.0)', '4'],
    ['exit', 'withEffect', '1400', '4'],
    ['mediacall', 'withEffect', '0', 'playFrom(0.600)', '5'],
    ['entr', 'clickEffect', '0', '3'],
  ]);
  assert.doesNotMatch(slide, /presetClass="entr"[^>]*nodeType="(after|with)Effect"/);
});

test('a click shows the next picture of the words and hides the one before', () => {
  const slide = text(unzip(pptx([recorded()])), 'ppt/slides/slide1.xml');
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
    /^Error: Recorded: a slide with tops, the images of its words, needs a recording under them$/);
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
  assert.ok(slides[0].includes(box({ x: 1327.5, y: 200, width: 472.5, height: 630 })));
  assert.ok(slides[0].includes('repeatCount="indefinite"') && slides[0].includes('mute="1"'));
  assert.ok(!slides[3].includes('repeatCount') && !slides[3].includes('mute="1"'));
  assert.equal([...parts.keys()].filter((name) => name.endsWith('.mp4')).length, 1);
  const notes = text(parts, 'ppt/notesSlides/notesSlide1.xml');
  assert.ok(notes.includes('<a:t>The first paragraph &lt;of the notes&gt;.</a:t>'), notes);
  assert.ok(notes.includes('<a:t>The second paragraph.</a:t>'), notes);
  assert.ok(!parts.has('ppt/notesSlides/notesSlide2.xml'));
});

test('a video is played through the steps of its slide', () => {
  const parts = exportDeck('test/pages/video-steps.html');
  assertPackage(parts);
  assert.equal(slideCount(parts), 1, 'a video on more than one slide is restarted at each step');
  const slide = text(parts, 'ppt/slides/slide1.xml');
  assert.deepEqual([...slide.matchAll(/<p:pic><p:nvPicPr><p:cNvPr id="(\d+)" name="(\w+)/g)].map((m) => m.slice(1)),
    [['2', 'Step'], ['3', 'Step'], ['4', 'Step'], ['5', 'Step'], ['6', 'Video']]);
  assert.deepEqual([...slide.matchAll(/nodeType="clickEffect".*?<p:spTgt spid="(\d+)"/g)].map((m) => m[1]), ['3', '4', '5']);
  assert.ok(slide.indexOf('nodeType="afterEffect"') < slide.indexOf('nodeType="clickEffect"'));
});

test('a video is started on the click of its step, and two videos of one step together', () => {
  const parts = exportDeck('test/pages/video-play.html');
  assertPackage(parts);
  assert.equal(slideCount(parts), 10);
  const slides = Array.from({ length: 10 }, (_, n) => text(parts, `ppt/slides/slide${n + 1}.xml`));
  assert.deepEqual(slides.map((slide) => slide.match(/<a:videoFile /g)?.length ?? 0), [0, 0, 1, 0, 2, 0, 1, 1, 0, 1]);
  assert.equal(slides[2].match(/nodeType="clickEffect"/g).length, 2);
  assert.deepEqual([...slides[4].matchAll(/presetClass="mediacall"[^>]*nodeType="(\w+)"/g)].map((m) => m[1]), ['afterEffect', 'withEffect']);
  const clips = (n) => [...new Set([...relationships(parts, `ppt/slides/slide${n}.xml`).values()].filter((name) => name.endsWith('.mp4')))];
  const [a, b] = clips(5);
  assert.deepEqual([clips(7), clips(8)], [[a], [b]], 'the second clip is shown in place of the first');
});

test('with --still, a tycho viewer of the style play is exported as its still on every step of its slide', () => {
  const parts = exportDeck('test/pages/viewer-play.html', [], ['--still']);
  assertPackage(parts);
  assert.equal(slideCount(parts), 10);
  const slides = Array.from({ length: 10 }, (_, n) => text(parts, `ppt/slides/slide${n + 1}.xml`));
  assert.deepEqual(slides.map((slide) => slide.match(/name="Step /g)?.length ?? 0), Array(10).fill(1));
  assert.ok(![...parts.keys()].some((name) => name.endsWith('.mp4')));
});

test('the demo deck is exported with a step for each page of its PDF', () => {
  const parts = exportDeck('test-deck.html', ['--still']);
  assertPackage(parts);
  const steps = [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .reduce((total, name) => total + text(parts, name).match(/name="Step /g).length, 0);
  const folder = mkdtempSync(join(tmpdir(), 'beeson-pdf-'));
  try {
    const run = spawnSync(process.execPath, ['scripts/export-pdf.mjs', 'test-deck.html', join(folder, 'deck.pdf')], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(steps, Number(run.stdout.match(/(\d+) pages/)[1]));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  assert.equal(text(parts, 'ppt/presentation.xml').match(/<p:sldId /g).length, slideCount(parts));
  assert.ok([...parts.keys()].some((name) => name.endsWith('.mp4')));
});

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

const stepOf = (parts, n) => parts.get(relationships(parts, `ppt/slides/slide${n}.xml`).get(
  text(parts, `ppt/slides/slide${n}.xml`).match(/<a:blip r:embed="([^"]+)"/)[1]));

test('the picture of each step is its page of the print view, the last page too', { timeout: 300000 }, async (t) => {
  const parts = exportDeck('test/pages/print-rows.html');
  const browser = await launch({ wholeFrames: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ scale: 2 });
  const { heights, shots } = await printedSteps(page, 'test/pages/print-rows.html');
  assert.deepEqual(heights, shots.map(() => 1080));
  assert.equal(slideCount(parts), shots.length);
  const off = [];
  for (const [n, shot] of shots.entries()) {
    const seen = await compare(page, { png: stepOf(parts, n + 1).toString('base64') }, { png: shot.toString('base64') });
    t.diagnostic(`step ${n + 1}: ${JSON.stringify(seen)}`);
    if (!(seen.over < 1e-5 && seen.mean < 0.01)) off.push({ step: n + 1, ...seen });
  }
  assert.deepEqual(off, []);
});

const pngSize = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

function placeOf(slide, shape) {
  const [, x, y, cx, cy] = slide.match(new RegExp(`<p:cNvPr id="${shape}" [^]*?<a:off x="(\\d+)" y="(\\d+)"/><a:ext cx="(\\d+)" cy="(\\d+)"/>`));
  const [left, top, width, height] = [x, y, cx, cy].map((emu) => Number(emu) / EMU_PER_PX);
  return { x: left, y: top, width, height };
}

function videosOf(parts, n) {
  const name = `ppt/slides/slide${n}.xml`;
  const slide = text(parts, name);
  return pictures(slide).filter(([, label]) => label.startsWith('Video')).map(([shape]) => {
    const [link, embed, poster] = targets(parts, name, shape);
    assert.equal(link, embed);
    return { ...placeOf(slide, shape), recording: link, poster };
  });
}

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
  assert.deepEqual(mp4Stream(parts.get(video.recording)), { width: 1200, height: 1600, fps: 60, frames: 60, duration: 1, keys: [1] });
  assert.deepEqual(pngSize(parts.get(video.poster)), [1200, 1600]);
  assert.match(slide, /<p:cMediaNode vol="80000" mute="1"><p:cTn id="\d+" repeatCount="indefinite"/);
  assert.equal(slide.match(/nodeType="clickEffect"/g).length, 1);
  assert.equal([...parts.keys()].filter((name) => name.endsWith('.mp4')).length, 3);
});

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
  const step = parts.get(targets(parts, 'ppt/slides/slide2.xml', 2)[0]);
  const crop = { x: 2 * later.x, y: 2 * later.y, width: 2 * later.width, height: 2 * later.height };
  const seen = await compare(page, { png: step.toString('base64'), crop }, { png: parts.get(later.poster).toString('base64') });
  t.diagnostic(JSON.stringify(seen));
  assert.ok(seen.max <= 8, JSON.stringify(seen));
});

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
    const seen = await compare(page, { png: shot.toString('base64') }, { mp4, time: (k + 0.5) / 60 });
    t.diagnostic(`frame ${k}: ${JSON.stringify(seen)}`);
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

let animationsRun;
const animationsDeck = () => {
  animationsRun ??= runExport('test/pages/animations-record.html', [], [], { reduced: true });
  assert.equal(animationsRun.run.status, 0, animationsRun.run.stderr);
  return animationsRun;
};

function playedOf(parts, n) {
  const slide = text(parts, `ppt/slides/slide${n}.xml`);
  const shapes = pictures(slide).filter(([, label]) => label.startsWith('Video')).map(([shape]) => shape);
  return videosOf(parts, n).map((video, k) => {
    const node = [...slide.matchAll(/<p:cMediaNode [^>]*><p:cTn id="\d+"([^>]*)>[^]*?<p:spTgt spid="(\d+)"/g)].find((m) => m[2] === shapes[k]);
    return { ...video, shape: shapes[k], stream: mp4Stream(parts.get(video.recording)), looped: node[1].includes('repeatCount="indefinite"') };
  });
}

test('a surface is recorded as a loop of one turn in its box, and a step that changes its stage as a clip before the loop', { timeout: 300000 }, () => {
  const { run, parts } = animationsDeck();
  assertPackage(parts);
  assert.match(run.stdout, /recorded surfaces and plots: 5 in \d+\.\d s/);
  assert.equal(slideCount(parts), 5);
  assert.deepEqual(kinds(parts, 1), ['Step', 'Video']);
  const [first] = playedOf(parts, 1);
  const size = [Math.round(first.width), Math.round(first.height)];
  assert.deepEqual({ ...first.stream, duration: undefined }, { width: size[0], height: size[1], fps: 24, frames: 48, duration: undefined, keys: [1] });
  assert.equal(first.looped, true);
  assert.deepEqual(pngSize(parts.get(first.poster)), size);
  assert.deepEqual(kinds(parts, 2), ['Step', 'Step', 'Step', 'Video', 'Video']);
  const [loop, clip] = playedOf(parts, 2);
  assert.deepEqual([loop.looped, loop.stream.frames, loop.x, loop.y], [true, 48, first.x, first.y]);
  assert.notEqual(loop.recording, first.recording);
  const { frames } = clip.stream;
  assert.equal(clip.looped, false);
  assert.ok(frames >= Math.ceil(1.4 * 24) && frames < 3 * 24, `${frames} frames`);
  const slide = text(parts, 'ppt/slides/slide2.xml');
  assert.match(slide, new RegExp(`presetClass="exit"[^>]*nodeType="withEffect"><p:stCondLst><p:cond delay="${Math.round(frames / 24 * 1000)}"/>[^]*?<p:spTgt spid="${clip.shape}"/>`));
  assert.equal(slide.match(/nodeType="clickEffect"/g).length, 2);
  assert.deepEqual(kinds(parts, 5), ['Step']);
});

test('a plot is recorded at each step as a loop of its pass and its hold, at twice the size of its box', { timeout: 300000 }, () => {
  const { parts } = animationsDeck();
  const [one] = playedOf(parts, 3);
  const [two] = playedOf(parts, 4);
  assert.deepEqual([kinds(parts, 3), kinds(parts, 4)], [['Step', 'Video'], ['Step', 'Video']]);
  assert.notEqual(one.recording, two.recording);
  for (const video of [one, two]) {
    const size = [2 * Math.round(video.width), 2 * Math.round(video.height)];
    assert.deepEqual({ ...video.stream, duration: undefined }, { width: size[0], height: size[1], fps: 30, frames: 45, duration: undefined, keys: [1] });
    assert.equal(video.looped, true);
    assert.deepEqual(pngSize(parts.get(video.poster)), size);
  }
});

test('while a surface or a plot is recorded, only its page of the print view is rendered, and every page is rendered again after', { timeout: 300000 }, async (t) => {
  const browser = await launch({ wholeFrames: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ scale: 2, motion: true });
  await printView(page, deckUrl('test/pages/animations-record.html', 'print-pdf&still&pdfPageHeightOffset=0'));
  const rendered = `[...document.querySelectorAll('.pdf-page')].flatMap((page, n) => [...page.children].some((child) => child.checkVisibility()) ? [n] : [])`;
  const all = await page.evaluate(rendered);
  const shown = await listAnimations(page);
  const surface = shown.findIndex((list) => list.some((a) => a.key.startsWith('surface ')));
  const plot = shown.findIndex((list) => list.some((a) => a.key.startsWith('plot ')));
  assert.ok(all.length > 2 && surface >= 0 && plot >= 0, JSON.stringify({ all, surface, plot }));
  const { evaluate } = page;
  for (const step of [surface, plot]) {
    const seen = [];
    page.evaluate = async (expression) => {
      if (/^__animate\.(clip|turn|encode)\(/.test(expression)) seen.push(await evaluate(rendered));
      return evaluate(expression);
    };
    await recordAnimation(page, shown[step][0].index);
    page.evaluate = evaluate;
    assert.ok(seen.length > 0);
    for (const pages of seen) assert.deepEqual(pages, [step]);
    assert.deepEqual(await page.evaluate(rendered), all);
  }
});

test('the frames of a surface are drawn and encoded a second per DevTools call, and at twice the pixel ratio in about the time of the same frames at one', { timeout: 600000 }, async (t) => {
  const browser = await launch({ wholeFrames: true });
  t.after(() => browser.close());
  const record = async (scale) => {
    const page = await browser.newPage({ scale, motion: true });
    try {
      await printView(page, deckUrl('test/pages/animations-record.html', 'print-pdf&still&pdfPageHeightOffset=0'));
      const [first] = (await listAnimations(page)).flat();
      assert.ok(first?.key.startsWith('surface '), JSON.stringify(first));
      const { evaluate } = page;
      let ms = 0, calls = 0;
      page.evaluate = async (expression) => {
        calls++;
        if (!/^__animate\.(clip|turn|step|encode)\(/.test(expression)) return evaluate(expression);
        const start = performance.now();
        const result = await evaluate(expression);
        ms += performance.now() - start;
        return result;
      };
      const { loop } = await recordAnimation(page, first.index);
      return { ms: Math.round(ms), calls, stream: mp4Stream(loop.data) };
    } finally {
      await page.close();
    }
  };
  let ratio = Infinity;
  for (let n = 0; n < 3 && ratio > 1.5; n++) {
    const large = await record(2);
    const small = await record(1);
    assert.deepEqual(large.stream, small.stream);
    assert.ok(large.calls < large.stream.frames / 2, `${large.calls} DevTools calls for ${large.stream.frames} frames`);
    ratio = large.ms / small.ms;
    t.diagnostic(`pixel ratio 1: ${small.ms} ms, pixel ratio 2: ${large.ms} ms, ${small.stream.frames} frames, ${small.calls} DevTools calls`);
  }
  assert.ok(ratio <= 1.5, `the frames at the pixel ratio 2 took ${ratio.toFixed(2)} times as long as at 1`);
});

test('with --still, the surfaces and the plots are the pictures of their steps, and the export needs no H.264 encoder', { timeout: 300000 }, () => {
  const parts = exportDeck('test/pages/animations-record.html', ['--still'], [], { noH264: true });
  assertPackage(parts);
  assert.equal(slideCount(parts), 7);
  for (let n = 1; n <= 7; n++) assert.deepEqual(kinds(parts, n), ['Step']);
  assert.ok(![...parts.keys()].some((name) => name.endsWith('.mp4')));
  const { run } = runExport('test/pages/animations-record.html', [], [], { noH264: true });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /H\.264/);
  assert.match(run.stderr, /--still to keep the surfaces and the plots as stills/);
});

test('a scene is recorded in DevTools calls that each span less than a third of its frames', { timeout: 600000 }, async (t) => {
  const boxes = new Map([['0', { width: 300, height: 400, name: 'A long recorded scene' }]]);
  const browser = await launch();
  t.after(() => browser.close());
  const spanned = (expression) => `(async () => {
    const done = () => window.beesonRecording?.done ?? 0;
    const from = done();
    try {
      return await (0, eval)(${JSON.stringify(expression)});
    } finally {
      (window.spans ??= []).push(done() - from);
    }
  })()`;
  const spans = [];
  const { newPage } = browser;
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    const { evaluate, waitFor, close } = page;
    page.evaluate = (expression) => evaluate(spanned(expression));
    page.waitFor = (expression, timeout) => waitFor(spanned(expression), timeout);
    page.close = async () => {
      spans.push(...await evaluate('window.spans'));
      await close();
    };
    return page;
  };
  const [recording] = (await recordScenes(browser, 'test/pages/scene-long.html', boxes)).values();
  const stream = mp4Stream(recording.data);
  assert.deepEqual(stream, { width: 600, height: 800, fps: 60, frames: 600, duration: 10, keys: [1] });
  t.diagnostic(`${spans.length} calls, which span ${Math.max(...spans)} frames at most`);
  assert.ok(Math.max(...spans) < stream.frames / 3, `a call spans ${Math.max(...spans)} of ${stream.frames} frames`);
});

let recordRun, recordStill;
const recordDeck = () => {
  recordRun ??= runExport('test/pages/record.html');
  assert.equal(recordRun.run.status, 0, recordRun.run.stderr);
  return recordRun;
};
const recordStillDeck = () => (recordStill ??= exportDeck('test/pages/record.html', ['--still']));

const kinds = (parts, n) => pictures(text(parts, `ppt/slides/slide${n}.xml`)).map(([, name]) => name.split(' ')[0]);

function recordingOf(parts, n) {
  const name = `ppt/slides/slide${n}.xml`;
  const slide = text(parts, name);
  const shape = pictures(slide).find(([, label]) => label === 'Recording')?.[0];
  if (!shape) return null;
  const [link, embed, poster] = targets(parts, name, shape);
  assert.equal(link, embed);
  const node = [...slide.matchAll(/<p:cMediaNode [^>]*><p:cTn id="\d+"([^>]*)>[^]*?<p:spTgt spid="(\d+)"/g)].find((m) => m[2] === shape);
  return { part: link, poster, ...mp4Stream(parts.get(link)), looped: node[1].includes('repeatCount="indefinite"') };
}

test('a slide of the deck with a traced backdrop is one PowerPoint slide with its still, its recording, and the words of each step', { timeout: 600000 }, () => {
  const { run, parts } = recordDeck();
  assertPackage(parts);
  assert.match(run.stdout, /recorded backdrops: 6 in \d+\.\d s/);
  assert.equal(slideCount(parts), 11);
  assert.deepEqual(kinds(parts, 1), ['Step', 'Recording', 'Words', 'Words', 'Words', 'Words']);
  const title = recordingOf(parts, 1);
  assert.deepEqual({ ...title, part: undefined, poster: undefined, duration: undefined },
    { width: 3840, height: 2160, fps: 60, frames: 61, keys: [1], looped: false, part: undefined, poster: undefined, duration: undefined });
  assert.deepEqual(pngSize(parts.get(title.poster)), [3840, 2160]);
  assert.deepEqual(pngSize(parts.get(targets(parts, 'ppt/slides/slide1.xml', 2)[0])), [3840, 2160]);
  assert.equal(text(parts, 'ppt/slides/slide1.xml').match(/nodeType="clickEffect"/g).length, 3);
  assert.deepEqual(kinds(parts, 2), ['Step', 'Recording', 'Words']);
  assert.deepEqual(kinds(parts, 8), ['Step', 'Recording', 'Words', 'Words']);
  assert.equal([...parts.keys()].filter((name) => name.endsWith('.mp4')).length, 6);
});

test('a backdrop that is a step starts a new PowerPoint slide at its step, and the slides before it are not recorded', { timeout: 600000 }, () => {
  const { parts } = recordDeck();
  assert.deepEqual(kinds(parts, 4), ['Step']);
  assert.deepEqual(kinds(parts, 5), ['Step', 'Recording', 'Words']);
  assert.equal(recordingOf(parts, 5).frames, 61);
  assert.deepEqual([kinds(parts, 6), kinds(parts, 7)], [['Step'], ['Step']]);
});

test('a backdrop with a step of data-backdrop-play starts a new PowerPoint slide at this step, and the slides before it are not recorded', { timeout: 600000 }, () => {
  const { parts } = recordDeck();
  assert.deepEqual([kinds(parts, 9), kinds(parts, 10)], [['Step'], ['Step']]);
  assert.deepEqual(kinds(parts, 11), ['Step', 'Recording', 'Words', 'Words']);
  assert.equal(recordingOf(parts, 11).frames, 61);
});

test('a loop is a looped recording of one period', { timeout: 600000 }, () => {
  const { parts } = recordDeck();
  const loop = recordingOf(parts, 3);
  assert.equal(loop.looped, true);
  assert.equal(loop.frames, 9 * 60);
  assert.equal(recordingOf(parts, 2).looped, false);
});

test('with --still, a deck with traced backdrops is exported without a recording, one step per PowerPoint slide', { timeout: 300000 }, () => {
  const parts = recordStillDeck();
  assertPackage(parts);
  assert.equal(slideCount(parts), 16);
  for (let n = 1; n <= 16; n++) assert.deepEqual(kinds(parts, n), ['Step']);
  assert.ok(![...parts.keys()].some((name) => name.endsWith('.mp4')));
});

test('without an H.264 encoder, the export of a traced backdrop fails and names --still', { timeout: 300000 }, () => {
  const { run } = runExport('test/pages/record.html', [], [], { noH264: true });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /H\.264/);
  assert.match(run.stderr, /--still/);
});

test('every kind of recording is described in its colr box as full range, with the primaries and matrix of BT.709 and the transfer of sRGB', { timeout: 900000 }, () => {
  const decks = { scenes: sceneDeck(), 'surfaces and plots': animationsDeck().parts, backdrops: recordDeck().parts };
  for (const [kind, parts] of Object.entries(decks)) {
    const files = [...parts.keys()].filter((name) => name.endsWith('.mp4'));
    assert.ok(files.length > 0, kind);
    for (const name of files) assert.deepEqual(mp4Color(parts.get(name)), { primaries: 1, transfer: 13, matrix: 1, fullRange: true }, `${kind}: ${name}`);
  }
});

test('a deck without a scene and without a traced backdrop is exported by a browser without an H.264 encoder', { timeout: 300000 }, () => {
  const { run, parts } = runExport('test/pages/record-none.html', [], [], { noH264: true });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(slideCount(parts), 2);
  assert.ok(![...parts.keys()].some((name) => name.endsWith('.mp4')));
  assert.doesNotMatch(run.stdout, /recorded/);
});

const LAYERS = { mean: 0.005, max: 160, few: 0.0001 };

test('the still of a recorded slide with the words of a step over it is the picture of the step in the file of --still', { timeout: 600000 }, async (t) => {
  const { parts } = recordDeck();
  const still = recordStillDeck();
  const browser = await launch({ wholeFrames: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const picture = (file, n, label) => {
    const name = `ppt/slides/slide${n}.xml`;
    const shape = pictures(text(file, name)).find(([, l]) => l === label)[0];
    return file.get(targets(file, name, shape)[0]).toString('base64');
  };
  for (const [n, k, m] of [[1, 3, 3], [8, 2, 12]]) {
    const seen = await compare(page, { png: [picture(parts, n, 'Step 1'), picture(parts, n, `Words ${k}`)] }, { png: picture(still, m, 'Step 1') });
    t.diagnostic(`slide ${n}, step ${k}: ${JSON.stringify(seen)}`);
    assert.ok(seen.mean <= LAYERS.mean && seen.max <= LAYERS.max && seen.few <= LAYERS.few, `slide ${n}, step ${k}: ${JSON.stringify(seen)}`);
  }
});

test('a strip bundle is exported as the still of each of its steps, without a recording', { timeout: 300000 }, () => {
  const parts = exportDeck('test/pages/bundle.html');
  assertPackage(parts);
  assert.deepEqual([...parts.keys()].filter((name) => name.endsWith('.mp4')), []);
  assert.equal(slideCount(parts), 4);
});

test('a strip bundle with a moving point is exported as the still of each of its states, without a recording', { timeout: 300000 }, () => {
  const parts = exportDeck('test/pages/bundle-point.html');
  assertPackage(parts);
  assert.deepEqual([...parts.keys()].filter((name) => name.endsWith('.mp4')), []);
  assert.equal(slideCount(parts), 6);
});
