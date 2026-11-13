// A writer of an MP4 file with one H.264 video track, for the recordings of scripts/record.mjs. The
// samples are the chunks of a WebCodecs VideoEncoder configured with avc: { format: 'avc' }, in
// decode order and without reordered frames, hence the file does not need a ctts box. Every sample
// lasts one frame, and moov is written before mdat, so that a player starts without reading the file
// to its end. The files of this writer play in PowerPoint 16 and Keynote 15 on the Mac and in
// PowerPoint for Windows.

const u8 = (...v) => Buffer.from(v);
const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b; };
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); return b; };
const zeros = (n) => Buffer.alloc(n);
const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(body.length + 8), Buffer.from(type, 'latin1'), body]);
};
// a box with a version and flags
const full = (type, version, flags, ...parts) => box(type, u8(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...parts);
const MATRIX = Buffer.concat([0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].map(u32));
// the code points of ISO/IEC 23091-2 for the names of a VideoColorSpace, and 2 for unspecified
const PRIMARIES = { bt709: 1, bt470bg: 5, smpte170m: 6 };
const TRANSFER = { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13 };
const COEFFICIENTS = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6 };

/**
 * Returns the bytes of an MP4 file. samples is an array of { data, key } in decode order, fps the
 * frames per second, avcC the description of the decoder config of the encoder, and color its
 * colorSpace, or undefined for a file without a colr box. perChunk is the number of samples in a
 * chunk of mdat.
 */
export function mp4({ width, height, fps, samples, avcC, color, perChunk = fps }) {
  const timescale = fps * 1000, delta = 1000, duration = samples.length * delta;
  const ftyp = box('ftyp', Buffer.from('isom', 'latin1'), u32(0x200), Buffer.from('isomiso2avc1mp41', 'latin1'));
  const colr = color
    ? box('colr', Buffer.from('nclx', 'latin1'), u16(PRIMARIES[color.primaries] ?? 2), u16(TRANSFER[color.transfer] ?? 2),
      u16(COEFFICIENTS[color.matrix] ?? 2), u8(color.fullRange ? 0x80 : 0))
    : zeros(0);
  const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(width), u16(height), u32(0x480000), u32(0x480000), zeros(4), u16(1),
    zeros(32), u16(0x18), u16(0xffff), box('avcC', avcC), colr);
  const chunks = [];
  for (let i = 0; i < samples.length; i += perChunk) chunks.push(samples.slice(i, i + perChunk));
  const last = chunks.at(-1).length;
  const stsc = [[1, perChunk]];
  if (chunks.length === 1) stsc[0][1] = last;
  else if (last !== perChunk) stsc.push([chunks.length, last]);
  const keys = samples.flatMap((s, i) => (s.key ? [i + 1] : []));
  const moov = (offsets) => box('moov',
    full('mvhd', 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u32(0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(2)),
    box('trak',
      full('tkhd', 0, 3, u32(0), u32(0), u32(1), zeros(4), u32(duration), zeros(8), u16(0), u16(0), u16(0), zeros(2), MATRIX,
        u32(width << 16), u32(height << 16)),
      box('mdia',
        full('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0)),
        full('hdlr', 0, 0, u32(0), Buffer.from('vide', 'latin1'), zeros(12), Buffer.from('VideoHandler\0', 'latin1')),
        box('minf',
          full('vmhd', 0, 1, zeros(8)),
          box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
          box('stbl',
            full('stsd', 0, 0, u32(1), avc1),
            full('stts', 0, 0, u32(1), u32(samples.length), u32(delta)),
            full('stss', 0, 0, u32(keys.length), ...keys.map(u32)),
            full('stsc', 0, 0, u32(stsc.length), ...stsc.flatMap(([first, n]) => [u32(first), u32(n), u32(1)])),
            full('stsz', 0, 0, u32(0), u32(samples.length), ...samples.map((s) => u32(s.data.length))),
            full('stco', 0, 0, u32(offsets.length), ...offsets.map(u32)))))));
  // the offsets of the chunks depend on the size of moov, which does not depend on them
  const head = ftyp.length + moov(chunks.map(() => 0)).length + 8;
  const offsets = [];
  let at = head;
  for (const chunk of chunks) {
    offsets.push(at);
    for (const s of chunk) at += s.data.length;
  }
  return Buffer.concat([ftyp, moov(offsets), u32(at - head + 8), Buffer.from('mdat', 'latin1'), ...samples.map((s) => s.data)]);
}
