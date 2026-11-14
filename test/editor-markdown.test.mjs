// the substitution Markdown Formatting of the Edit menu: a span closed by the mark that opened it
// is written in the tag of the mark when its closing character is typed, the typing after it is
// outside the tag, and one undo gives back the marks as typed

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { markdownSpan } from '../src/editor/text/substitute.ts';

const LAYOUTS = 'test/pages/editor-layouts.html';
// the paragraph of slide 2 of LAYOUTS, which the typing is appended to
const PARAGRAPH = '<p>A paragraph with <strong>bold</strong>, <em>italic</em>, <code>code</code>, and \\(x^2\\) inline.</p>';

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

const js = (v) => JSON.stringify(v);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function load(t) {
  const page = await browser.newPage();
  t.after(() => page.close().catch(() => {}));
  await page.goto(new URL(`../${LAYOUTS}?edit&still`, import.meta.url).href);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  await page.evaluate('Reveal.slide(2)');
  // the caret at the end of the paragraph
  await page.evaluate(`(() => {
    const p = document.querySelector('.reveal section.present > p');
    p.closest('[contenteditable="true"]').focus();
    const r = document.createRange();
    r.selectNodeContents(p);
    r.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  })()`);
  return page;
}

// each character typed as a trusted key, as the substitutions are made only for typed characters
async function typeKeys(page, text) {
  for (const c of text) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: c, text: c, unmodifiedText: c });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: c });
  }
  await sleep(100);
}

const appended = (html) => PARAGRAPH.replace('inline.</p>', `inline.${html}</p>`);

test('the span of each mark is found at its closing character, and a mark inside words is left', () => {
  assert.deepEqual(markdownSpan('a **bold**'), { start: 2, words: 'bold', tag: 'strong' });
  assert.deepEqual(markdownSpan('a __bold__'), { start: 2, words: 'bold', tag: 'strong' });
  assert.deepEqual(markdownSpan('a *it*'), { start: 2, words: 'it', tag: 'em' });
  assert.deepEqual(markdownSpan('_it_'), { start: 0, words: 'it', tag: 'em' });
  assert.deepEqual(markdownSpan('a `x = 1`'), { start: 2, words: 'x = 1', tag: 'code' });
  assert.deepEqual(markdownSpan('a ~~gone~~'), { start: 2, words: 'gone', tag: 's' });
  // the first closing mark of a double one, a name in snake_case, a span with a space inside its
  // marks, an empty span, and TeX are left as typed
  for (const text of ['a **bold*', 'snake_case_', 'a * x*', 'a **', 'a ``', '\\(a *b*']) assert.equal(markdownSpan(text), null, text);
});

test('a span typed at the end of a paragraph is written in its tag, and the typing after it is outside the tag', async (t) => {
  const page = await load(t);
  for (const [typed, html] of [[' **bold** x', ' <strong>bold</strong> x'], [' *it* y', ' <em>it</em> y'], [' _it_ z', ' <em>it</em> z'], [' `f(x)` w', ' <code>f(x)</code> w'], [' ~~old~~ v', ' <s>old</s> v'], [' __b__ u', ' <strong>b</strong> u']]) {
    const was = await render(page);
    await typeKeys(page, typed);
    assert.equal(await render(page), was.replace(/(inline\..*)<\/p>/, `$1${html}</p>`), typed);
  }
  assert.equal(await render(page), page.source.replace(PARAGRAPH, appended(' <strong>bold</strong> x <em>it</em> y <em>it</em> z <code>f(x)</code> w <s>old</s> v <strong>b</strong> u')));
});

test('two spans of the same mark typed one after the other are written as two elements', async (t) => {
  const page = await load(t);
  await typeKeys(page, ' **a****b**');
  assert.equal(await render(page), page.source.replace(PARAGRAPH, appended(' <strong>a</strong><strong>b</strong>')));
});

test('one undo gives back the marks as typed, and a second takes back the typing', async (t) => {
  const page = await load(t);
  await typeKeys(page, ' **bold**');
  assert.equal(await render(page), page.source.replace(PARAGRAPH, appended(' <strong>bold</strong>')));
  assert.equal(await page.evaluate(`window.BeesonEditor.state('edit.undo').label`), 'Undo Markdown');
  await undo(page);
  await sleep(100);
  assert.equal(await render(page), page.source.replace(PARAGRAPH, appended(' **bold**')));
  await undo(page);
  await sleep(100);
  assert.equal(await render(page), page.source);
});

test('the marks are left as typed inside inline code and with Markdown Formatting off', async (t) => {
  const page = await load(t);
  await page.evaluate(`(() => {
    const code = document.querySelector('.reveal section.present > p code');
    const r = document.createRange();
    r.setStart(code.firstChild, 2);
    r.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  })()`);
  await typeKeys(page, '*a*');
  assert.equal(await render(page), page.source.replace('<code>code</code>', '<code>co*a*de</code>'));
  await exec(page, 'text.smart.markdown');
  t.after(() => page.evaluate(`localStorage.removeItem('beeson-edit-smart-markdown')`).catch(() => {}));
  assert.equal(await page.evaluate(`window.BeesonEditor.state('text.smart.markdown').checked`), false);
  await page.evaluate(`(() => {
    const p = document.querySelector('.reveal section.present > p');
    const r = document.createRange();
    r.selectNodeContents(p);
    r.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  })()`);
  await typeKeys(page, ' *b*');
  assert.ok((await render(page)).includes('inline. *b*</p>'));
});
