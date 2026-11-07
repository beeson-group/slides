// checks of the PowerPoint export, read from the XML of the file, as AGENTS.md asks

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { pptx, zip } from '../scripts/pptx.mjs';

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

function exportDeck(deck) {
  const folder = mkdtempSync(join(tmpdir(), 'beeson-pptx-'));
  try {
    const output = join(folder, 'deck.pptx');
    const run = spawnSync(process.execPath, ['scripts/export-pptx.mjs', deck, output], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    return unzip(readFileSync(output));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
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

test('the demo deck is exported with a step for each page of its PDF', () => {
  const parts = exportDeck('index.html');
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
