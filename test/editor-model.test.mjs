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

// defect 5 of the save model: the start tag of an element inside a block was copied from the file,
// hence a change of its class on the page, e.g. by a restore of the typing in the block, was lost
test('a changed class of a span inside a block is written, and the classes of the theme are not', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, text, status } = await editorPage(browser);
  assert.deepEqual(status.problems, []);
  const span = `[...document.querySelectorAll('.reveal span')].find((s) => s.textContent === 'Coriolis terms')`;
  // the span is colored at a step, hence hl-target is put on it at run time
  assert.equal(await page.evaluate(`${span}.classList.contains('hl-target')`), true);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
  await page.evaluate(`${span}.classList.add('small')`);
  const before = '<span class="coriolis">Coriolis terms</span>';
  assert.equal(text.split(before).length, 2);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text.replace(before, '<span class="coriolis small">Coriolis terms</span>'));
  // a span made anew, as by a restore of the content of its block, is written with its own class
  await page.evaluate(`${span}.outerHTML = '<span class="potential">Coriolis terms</span>'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text.replace(before, '<span class="potential">Coriolis terms</span>'));
  await page.evaluate(`${span}.className = 'coriolis'`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
  assert.deepEqual(page.errors, []);
});
