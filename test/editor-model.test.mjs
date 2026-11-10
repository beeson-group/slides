// the document model of the editor in headless Chrome. each structural edit made through
// window.BeesonEditor.doc is written into the text of the file. after an undo, the text is the file
// byte for byte, and after a redo it has the edit again. the text of a save is opened again and
// paired with zero problems

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';

const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';

// the editor on a deck, opened with the text of its file
async function editorPage(browser, file = 'index.html') {
  const text = readFileSync(file, 'utf8');
  const page = await browser.newPage();
  await page.goto(deckUrl(file, 'edit&still'));
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`);
  return { page, text, status };
}

// defect 4 of the save model: reveal.js removed a slide with data-visibility="hidden" from the page
// without showHiddenSlides, and its blocks were then problems
test('a deck with a hidden slide pairs with zero problems, and its hidden slide is edited', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, text, status } = await editorPage(browser, 'test/pages/editor-hidden.html');
  assert.deepEqual(status.problems, []);
  assert.equal(status.sections, 3);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
  await page.evaluate(`[...document.querySelectorAll('.reveal p')].find((p) => p.textContent === 'The hidden slide.').firstChild.data = 'Edited.'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text.replace('The hidden slide.', 'Edited.'));
  assert.deepEqual(page.errors, []);
});
