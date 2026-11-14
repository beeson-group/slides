// checks of the MP4 writer of the recordings, read back from the boxes of a written file

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mp4 } from '../scripts/mp4.mjs';
import { boxes, find } from './helpers/mp4.mjs';

// samples of 1 to 300 bytes, each filled with its index, with a key frame at the first sample
const samples = (n) => Array.from({ length: n }, (_, i) => ({ data: Buffer.alloc(1 + ((i * 37) % 300), i & 255), key: i === 0 }));
const avcC = Buffer.from([1, 0x64, 0, 0x34, 0xff, 0xe1, 0, 4, 0x67, 0x64, 0, 0x34, 1, 0, 4, 0x68, 0xee, 0x3c, 0x80]);
const color = { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false };

test('a written file has its header before its samples, one size per frame, and one key frame', () => {
  const frames = 151, fps = 60;
  const input = samples(frames);
  const file = mp4({ width: 3840, height: 2160, fps, samples: input, avcC, color });
  const tree = boxes(file);

  assert.deepEqual(tree.map((b) => b.type), ['ftyp', 'moov', 'mdat']);
  assert.equal(tree.at(-1).start + tree.at(-1).size, file.length);

  // the durations of the movie, the track, and the media, in units of the timescale of mvhd and mdhd
  const mvhd = find(tree, 'moov/mvhd').body;
  const timescale = mvhd.readUInt32BE(12);
  assert.equal(mvhd.readUInt32BE(16) / timescale, frames / fps);
  const tkhd = find(tree, 'moov/trak/tkhd').body;
  assert.equal(tkhd.readUInt32BE(20) / timescale, frames / fps);
  assert.equal(tkhd.readUInt32BE(76) >>> 16, 3840);
  assert.equal(tkhd.readUInt32BE(80) >>> 16, 2160);
  const mdhd = find(tree, 'moov/trak/mdia/mdhd').body;
  assert.equal(mdhd.readUInt32BE(16) / mdhd.readUInt32BE(12), frames / fps);

  // stsd holds one sample entry, avc1, with the size of the frames, the given avcC, and a colr box
  const stbl = find(tree, 'moov/trak/mdia/minf/stbl').children;
  const stsd = find(stbl, 'stsd').body;
  assert.equal(stsd.readUInt32BE(4), 1);
  const entry = stsd.subarray(8);
  assert.equal(entry.toString('latin1', 4, 8), 'avc1');
  assert.equal(entry.readUInt32BE(0), entry.length);
  assert.equal(entry.readUInt16BE(8 + 24), 3840);
  assert.equal(entry.readUInt16BE(8 + 26), 2160);
  const inner = boxes(entry, 8 + 78, entry.length);
  assert.deepEqual(inner.map((b) => b.type), ['avcC', 'colr']);
  assert.deepEqual(inner[0].body, avcC);
  const colr = inner[1].body;
  assert.equal(colr.toString('latin1', 0, 4), 'nclx');
  // BT.709 primaries, transfer, and matrix, in limited range
  assert.deepEqual([colr.readUInt16BE(4), colr.readUInt16BE(6), colr.readUInt16BE(8), colr[10]], [1, 1, 1, 0]);

  const stts = find(stbl, 'stts').body;
  assert.deepEqual([stts.readUInt32BE(4), stts.readUInt32BE(8), stts.readUInt32BE(12)], [1, frames, timescale / fps]);
  const stss = find(stbl, 'stss').body;
  assert.equal(stss.readUInt32BE(4), 1);
  assert.equal(stss.readUInt32BE(8), 1);
  const stsz = find(stbl, 'stsz').body;
  assert.equal(stsz.readUInt32BE(4), 0);
  assert.equal(stsz.readUInt32BE(8), frames);
  const sizes = Array.from({ length: frames }, (_, i) => stsz.readUInt32BE(12 + 4 * i));
  assert.deepEqual(sizes, input.map((s) => s.data.length));

  // the chunks of stsc and stco point at the bytes of the samples in mdat, in order
  const stsc = find(stbl, 'stsc').body;
  const runs = Array.from({ length: stsc.readUInt32BE(4) }, (_, i) => [stsc.readUInt32BE(8 + 12 * i), stsc.readUInt32BE(12 + 12 * i)]);
  const stco = find(stbl, 'stco').body;
  const offsets = Array.from({ length: stco.readUInt32BE(4) }, (_, i) => stco.readUInt32BE(8 + 4 * i));
  const mdat = tree.at(-1);
  let sample = 0;
  offsets.forEach((offset, chunk) => {
    const perChunk = runs.findLast(([first]) => first <= chunk + 1)[1];
    let at = offset;
    for (let k = 0; k < perChunk; k++, sample++) {
      assert.ok(at >= mdat.start + 8 && at + sizes[sample] <= file.length);
      assert.deepEqual(file.subarray(at, at + sizes[sample]), input[sample].data);
      at += sizes[sample];
    }
  });
  assert.equal(sample, frames);
});

test('a file of one chunk without a color space is written without a colr box', () => {
  const file = mp4({ width: 640, height: 360, fps: 30, samples: samples(12), avcC });
  const tree = boxes(file);
  const stbl = find(tree, 'moov/trak/mdia/minf/stbl').children;
  const stsc = find(stbl, 'stsc').body;
  assert.deepEqual([stsc.readUInt32BE(4), stsc.readUInt32BE(8), stsc.readUInt32BE(12)], [1, 1, 12]);
  const entry = find(stbl, 'stsd').body.subarray(8);
  assert.deepEqual(boxes(entry, 8 + 78, entry.length).map((b) => b.type), ['avcC']);
});
