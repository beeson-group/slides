import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';

const DECK = 'test/pages/stacks.html';
const IDS = ['one-text', 'one-math', 'two-text', 'two-math', 'shared'];
const STEPS = [['one-text', 'one-math'], ['one-text', 'one-math', 'shared'], ['two-text', 'two-math', 'shared']];

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

const shownIn = (root) => `${JSON.stringify(IDS)}.filter((id) => getComputedStyle(${root}.querySelector('#' + id)).visibility === 'visible')`;

test('a child of a stack is shown from its step until the step of the next child, in the place of the others', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(deckUrl(DECK, 'still'));
  await page.waitFor(deckSettled);
  const seen = [];
  for (let k = 0; k < 3; k++) {
    if (k) await page.evaluate('Reveal.next()');
    await page.waitFor(`(Reveal.getIndices().f ?? -1) === ${k - 1}`);
    await page.waitFor(`${shownIn('document')}.length === ${STEPS[k].length}`);
    seen.push(await page.evaluate(shownIn('document')));
    const [a, b] = await page.evaluate(`[...document.querySelector('.r-stack').children].map((c) => c.getBoundingClientRect().top)`);
    assert.equal(a, b);
  }
  assert.deepEqual(seen, STEPS);
  const below = `document.getElementById('shared').getBoundingClientRect().top >= Math.max(...[...document.querySelector('.r-stack').children].map((c) => c.getBoundingClientRect().bottom)) - 0.5`;
  assert.equal(await page.evaluate(below), true);
});

test('a stack alone on its slide does not add a step that restores dimmed steps', { timeout: 60000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(deckUrl(DECK, 'still'));
  await page.waitFor(deckSettled);
  assert.equal(await page.evaluate(`document.querySelector('#three').closest('section').querySelectorAll('.fragment').length`), 2);
});

test('the print view has a page for each step, with one child of the stack on it', { timeout: 300000 }, async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await printView(page, deckUrl(DECK, 'print-pdf&still'));
  const pages = await page.evaluate(`[...document.querySelectorAll('.pdf-page')].filter((p) => p.querySelector('#shared')).map((p) => ${shownIn('p')})`);
  assert.deepEqual(pages, [...STEPS, STEPS[2]]);
});

function unzip(file) {
  const end = file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const parts = new Map();
  let at = file.readUInt32LE(end + 16);
  for (let n = 0; n < file.readUInt16LE(end + 10); n += 1) {
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

test('the PowerPoint file has a slide for each page of the print view', { timeout: 300000 }, () => {
  const folder = mkdtempSync(join(tmpdir(), 'beeson-stack-'));
  try {
    const output = join(folder, 'deck.pptx');
    const run = spawnSync(process.execPath, ['scripts/export-pptx.mjs', '--still', DECK, output], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const slides = [...unzip(readFileSync(output)).keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    assert.equal(slides.length, 15);
    assert.match(run.stdout, /15 slides for 15 steps/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
