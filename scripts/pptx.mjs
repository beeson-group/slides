// Writes a PowerPoint file of full-slide images, with videos and speaker notes, without an npm
// package. A file is a zip of the parts of ECMA-376, and pptxgenjs does not write the timing of a
// video, which is required for a video to start by itself. The file is written in the form that
// PowerPoint writes, and the schema order of each element is significant.
import { crc32, deflateRawSync } from 'node:zlib';

/** Packs parts, a list of [name, data], into a zip, with XML deflated and media stored. */
export function zip(parts) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of parts) {
    const data = Buffer.from(content);
    const packed = /\.(xml|rels)$/.test(name);
    const stored = packed ? deflateRawSync(data) : data;
    const nameBytes = Buffer.from(name);
    // the common fields of a local and a central header, from the version needed on
    const common = Buffer.alloc(26);
    common.writeUInt16LE(20, 0);
    common.writeUInt16LE(packed ? 8 : 0, 4);
    // the date is 1980-01-01, the first of a zip, hence an export does not depend on the time
    common.writeUInt16LE(0x21, 8);
    common.writeUInt32LE(crc32(data), 10);
    common.writeUInt32LE(stored.length, 14);
    common.writeUInt32LE(data.length, 18);
    common.writeUInt16LE(nameBytes.length, 22);
    const signature = (value) => { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; };
    local.push(signature(0x04034b50), common, nameBytes, stored);
    const tail = Buffer.alloc(14);
    tail.writeUInt32LE(offset, 10);
    central.push(signature(0x02014b50), Buffer.from([20, 0]), common, tail, nameBytes);
    offset += 30 + nameBytes.length + stored.length;
  }
  const directory = Buffer.concat(central);
  if (offset + directory.length >= 2 ** 32) throw new Error('the file is over the 4 GiB of a zip without ZIP64, hence use smaller videos');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
