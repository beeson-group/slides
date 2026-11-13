// regression tests of R19.1 on both platforms: a click elsewhere that leaves an emptied new text
// box acts as it does with a box that is not emptied, and a new text box left empty after an undo
// of its first letter does not leave an entry of the box on either stack

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];

let browser;
let server;
before(async () => {
  browser = await launch({ offline: false });
  server = await serve('.');
});
after(async () => {
  await browser?.close();
  server?.close();
});

const js = (v) => JSON.stringify(v);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => press(page, 'Mod+Z').then(() => sleep(250));
const redo = (page) => press(page, 'Mod+Shift+Z').then(() => sleep(250));
const labels = (page) => page.evaluate(`(() => { const u = window.BeesonEditor.state('edit.undo'), r = window.BeesonEditor.state('edit.redo'); return { undo: u.label, redo: r.label, undoOn: !!u.enabled, redoOn: !!r.enabled }; })()`);
const pendings = (page) => page.evaluate(`document.querySelectorAll('.reveal .slides p.beeson-pending').length`);

// the editor on slide n of the demo deck, served over HTTP, with a record of the slides shown
async function load(t, platform, n = 0) {
  const text = readFileSync('test-deck.html', 'utf8');
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/test-deck.html?edit&still&theme=light&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(text)})`);
  assert.deepEqual(s.problems, []);
  if (n) await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// a new text box with the letter h typed into it and taken out again by Backspace, with the
// Backspace in the typing of h or after the pause of the typing
async function emptied(page, pause) {
  await click(page, '.beeson-edit-top [data-command="insert.text"]');
  await sleep(300);
  await type(page, 'h');
  await sleep(pause);
  await press(page, 'Backspace');
  await sleep(300);
  assert.equal(await pendings(page), 0);
}

// D1 of review part 2 of round 7: a click that left an emptied new text box lost its target. the
// caret was not left in the clicked text, and a click on a row of the navigator went back to the
// slide of the box
for (const platform of PLATFORMS) {
  test(`a click into another text that leaves an emptied text box leaves the caret there (${platform})`, async (t) => {
    for (const [n, pause] of [[4, 300], [4, 1300], [0, 300]]) {
      const page = await load(t, platform, n);
      const at = `on slide ${n + 1} with a pause of ${pause} ms`;
      await emptied(page, pause);
      const target = n === 0 ? 'section.present .block h1' : 'section.present h2';
      await click(page, target);
      await sleep(700);
      assert.deepEqual(await page.evaluate(`(() => { const t = document.querySelector(${js(target)}); const a = getSelection().anchorNode; return { slide: Reveal.getIndices().h, caret: !!a && t.contains(a) }; })()`), { slide: n, caret: true }, `the click does not leave the caret in the text ${at}`);
      await press(page, 'End');
      await type(page, 'Z');
      await sleep(300);
      const written = await render(page);
      const tag = n === 0 ? 'h1' : 'h2';
      const was = page.source.split(/<section/)[n + 1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))[1];
      assert.ok(written.includes(`${was}Z</${tag}>`), `the letter is not typed at the end of the text ${at}`);
      assert.doesNotMatch(written, /<p( style="[^"]*")?>(<br>)?<\/p>/, `the emptied box is kept ${at}`);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });

  test(`a click on a row of the navigator that leaves an emptied text box shows its slide (${platform})`, async (t) => {
    // the first child of the list of the navigator is not a row, hence row k is slide k - 1
    for (const [n, row] of [[4, 2], [0, 4]]) {
      const page = await load(t, platform, n);
      await emptied(page, 300);
      await page.evaluate(`window.__shown = []; Reveal.on('slidechanged', (e) => window.__shown.push(e.indexh))`);
      await click(page, `.beeson-edit-nav .row:nth-child(${row})`);
      await sleep(700);
      assert.deepEqual(await page.evaluate(`({ slide: Reveal.getIndices().h, shown: window.__shown, row: document.activeElement.matches('.beeson-edit-nav .row') })`), { slide: row - 2, shown: [row - 2], row: true }, `the click on the row of slide ${row - 1} from slide ${n + 1}`);
      await byteExact(page);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}

// D2 of review part 2 of round 7: a new text box left empty after an undo of its first letter left
// the first letter on the redo stack, whose redo wrote a box without an insert under it. the box
// left empty is written as an empty paragraph in the entry of its insert
for (const platform of PLATFORMS) {
  test(`a text box left empty after an undo of its first letter leaves nothing to redo (${platform})`, async (t) => {
    for (const leaveBy of ['Escape', 'click']) {
      const page = await load(t, platform, 4);
      // an older entry, which stays undoable
      await click(page, 'section.present h2');
      await press(page, 'End');
      await type(page, 'Q');
      await sleep(1300);
      const older = await render(page);
      await click(page, '.beeson-edit-top [data-command="insert.text"]');
      await sleep(300);
      await type(page, 'h');
      await sleep(1300);
      await undo(page);
      assert.equal(await pendings(page), 1);
      if (leaveBy === 'Escape') {
        await press(page, 'Escape');
        await press(page, 'Escape');
      } else await click(page, { x: 1580, y: 600 });
      await sleep(300);
      assert.equal(await pendings(page), 0, `the box is held outside the file after ${leaveBy}`);
      const left = await render(page);
      assert.equal(left.match(/<p( [^>]*)?><\/p>/g)?.length, 1, `the empty box is not written after ${leaveBy}`);
      const l = await labels(page);
      assert.deepEqual({ redo: l.redoOn, undo: l.undo }, { redo: false, undo: 'Undo Insert Text Box' }, `the history after the box is left by ${leaveBy}: ${js(l)}`);
      await redo(page);
      assert.equal(await render(page), left, `a redo after the box is left by ${leaveBy} changes the file`);
      await undo(page);
      assert.equal(await render(page), older);
      await undo(page);
      await byteExact(page);
      assert.deepEqual(errors(page), []);
      await page.close();
    }
  });
}
