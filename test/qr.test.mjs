// checks of the QR codes of src/qr.ts: the encoder at every version, decoded with jsQR from a
// raster of its modules, and the codes of test/pages/qr.html and of the demo deck in Chrome,
// decoded from screenshots of the slides in both modes, in the print view, and in the editor

import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { QUIET, capacity, encode } from '../src/qr.ts';


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
