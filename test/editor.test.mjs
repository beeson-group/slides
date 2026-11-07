// the in-place editor on the demo deck in headless Chrome: the text of index.html with no edit and
// with one edit is written back byte for byte, apart from the edited text, the keys of reveal.js do
// not fire while a block is typed into, the editor is loaded only with ?edit, and a save writes the
// file through a handle of the File System Access API

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const deckText = readFileSync('index.html', 'utf8');
const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';
const openDeck = `window.BeesonEditor.open(${JSON.stringify(deckText)})`;

async function editorPage(browser, query = 'edit&still') {
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', query));
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  return page;
}

// the edited text must be the file with one replacement, hence the old text occurs once
function replaced(oldText, newText) {
  assert.equal(deckText.split(oldText).length, 2, `${oldText} is not unique in index.html`);
  return deckText.replace(oldText, newText);
}

test('a deck without ?edit does not load the editor, with ?edit it does on file://', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const plain = await browser.newPage();
  await plain.goto(deckUrl('index.html', 'still'));
  await plain.waitFor(deckSettled);
  assert.equal(await plain.evaluate(`!!document.querySelector('script[src$="editor.js"]') || 'BeesonEditor' in window`), false);
  assert.deepEqual(plain.errors, []);
  await plain.close();
  const page = await editorPage(browser);
  const status = await page.evaluate('window.BeesonEditor.status()');
  assert.equal(status.supported, true);
  assert.equal(status.state, 'waiting');
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-top button')].filter((b) => !b.hidden).map((b) => b.textContent)`), ['Undo', 'Redo', 'Open…', 'Save', 'Save as…', 'Autosave', 'Present']);
  // the card asks for the file, with the folder of the deck
  assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-card').hidden`), false);
  assert.match(await page.evaluate(`document.querySelector('.beeson-edit-card p').textContent`), /index\.html in \//);
  assert.deepEqual(page.errors, []);
});

test('the print view of the PDF and of PowerPoint does not load the editor', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl('index.html', 'print-pdf&still'));
  assert.equal(await page.evaluate(`!!document.querySelector('script[src$="editor.js"]') || 'BeesonEditor' in window`), false);
  assert.deepEqual(page.errors, []);
});

// polls an expression across a navigation that the page starts itself
async function until(page, expression, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      if (await page.evaluate(expression)) return;
    } catch {
      // the document is being replaced
    }
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${expression}`);
    await new Promise((done) => setTimeout(done, 50));
  }
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

test('E opens the slide in the editor', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', 'still', '/3'));
  await page.waitFor(deckSettled);
  assert.equal(await page.evaluate(`'BeesonEditor' in window`), false);
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', keyCode: 69, which: 69, bubbles: true, cancelable: true }))`);
  await until(page, `location.search === '?still&edit' && !!window.BeesonEditor`);
  await page.waitFor(ready);
  assert.equal(await page.evaluate('location.hash'), '#/3');
  assert.equal(await page.evaluate('Reveal.getIndices().h'), 3);
  // in the editor, the key does nothing
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', keyCode: 69, which: 69, bubbles: true, cancelable: true }))`);
  await sleep(200);
  assert.equal(await page.evaluate('location.search'), '?still&edit');
  assert.deepEqual(page.errors, []);
});

