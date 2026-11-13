// regression tests of Insert > Text Box: a new text box left without text is kept on the slide and
// written into the file as an empty paragraph, and the insert opens the Format tab of the
// inspector, also from the Steps tab

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { editorPage, press } from './helpers/editor.mjs';

const DECK = 'test/pages/editor-layouts.html';
// the slide of DECK with a heading, a paragraph, and a list
const TEXT = 2;

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

const js = (v) => JSON.stringify(v);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const checked = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)}).checked`);
const PENDING = `document.querySelector('.reveal section.present .beeson-pending')`;
// the paragraphs of the file without text, i.e. a new text box left empty
const emptyParagraphs = (text) => text.match(/<p( [^>]*)?><\/p>/g) ?? [];

async function load(t) {
  const page = await editorPage(browser, { deck: DECK, page: { width: 1600, height: 1000 }, clear: true });
  t.after(() => page.close().catch(() => {}));
  await page.evaluate(`Reveal.slide(${TEXT})`);
  await frames(page);
  return page;
}

test('a new text box left without text by Esc is kept as an empty paragraph, and its undo takes it off', async (t) => {
  const page = await load(t);
  await exec(page, 'insert.text');
  await frames(page);
  assert.equal(await page.evaluate(`${PENDING} === document.activeElement`), true, 'the caret is not in the new box');
  await press(page, 'Escape');
  await sleep(300);
  const text = await render(page);
  assert.equal(emptyParagraphs(text).length, 1, 'the empty box is not written into the file');
  assert.equal(await page.evaluate(`document.querySelectorAll('.reveal section.present p:empty').length`), 1, 'the empty box is not on the slide');
  assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Insert Text Box');
  await page.evaluate('window.BeesonEditor.undo()');
  await sleep(100);
  assert.equal(await render(page), page.source, 'the undo does not take the empty box off');
});

test('a new text box left without text by a click on the canvas is kept, and is typed into later', async (t) => {
  const page = await load(t);
  await exec(page, 'insert.text');
  await frames(page);
  // a click on an empty point of the canvas, left of the slide
  const at = await page.evaluate(`(() => { const r = document.querySelector('.reveal section.present').getBoundingClientRect(); return { x: r.left - 20, y: r.top + r.height / 2 }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', buttons: 1, clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });
  await sleep(300);
  assert.equal(emptyParagraphs(await render(page)).length, 1, 'the empty box is not written into the file');
  await page.evaluate(`document.querySelector('.reveal section.present p:empty').focus()`);
  await press(page, 'x');
  await sleep(300);
  assert.equal(emptyParagraphs(await render(page)).length, 0);
  assert.match(await render(page), /<p( [^>]*)?>x<\/p>/, 'the text typed later is not written into the box');
});

test('Insert Text Box opens the Format tab, from a closed inspector and from the Steps tab', async (t) => {
  const page = await load(t);
  if (await checked(page, 'shell.format')) await exec(page, 'shell.format');
  assert.equal(await checked(page, 'shell.format'), false);
  await exec(page, 'insert.text');
  await frames(page);
  assert.equal(await checked(page, 'shell.format'), true, 'the Format tab is not opened from a closed inspector');
  assert.equal(await page.evaluate(`${PENDING} === document.activeElement`), true, 'the caret is not kept in the new box');
  await page.evaluate('window.BeesonEditor.undo()');
  await exec(page, 'view.steps');
  await frames(page);
  assert.equal(await checked(page, 'view.steps'), true);
  await exec(page, 'insert.text');
  await frames(page);
  assert.equal(await checked(page, 'shell.format'), true, 'the Format tab is not opened from the Steps tab');
  assert.equal(await checked(page, 'view.steps'), false);
});
