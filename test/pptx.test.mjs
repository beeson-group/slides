// checks of the PowerPoint export, read from the XML of the file, as AGENTS.md asks

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, posix } from 'node:path';
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

const box = (px) => `<a:off x="${px.x * EMU_PER_PX}" y="${px.y * EMU_PER_PX}"/><a:ext cx="${px.width * EMU_PER_PX}" cy="${px.height * EMU_PER_PX}"/>`;

test('a zip is read back with its names and contents', () => {
  const parts = unzip(zip([['a.xml', '<a>é</a>'], ['b/c.png', Buffer.from([1, 2, 3])]]));
  assert.equal(text(parts, 'a.xml'), '<a>é</a>');
  assert.deepEqual([...parts.get('b/c.png')], [1, 2, 3]);
});

test('a video that is shown on two steps is embedded once, and it starts by itself', () => {
  const video = { path: 'demo/clip-dark.mp4', poster: Buffer.from([1]), x: 10, y: 20, width: 30, height: 40, duration: 6000, loop: true, muted: true };
  const step = { name: 'A & B', image: Buffer.from([2]), notes: ['One'], videos: [video] };
  const parts = unzip(pptx([step, step]));
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
