// the formulas of the editor on either platform: an inline formula put at the caret of a text, the
// completion of the macros of the deck in the TeX field, the gray prompt of an empty TeX, and the
// Formula pane of the inspector, with its TeX field, Hold, and the color of a symbol at a step.
// after each edit an undo gives the file byte for byte, a redo gives the edit, and a save is opened
// again without problems

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, press, saveAndReopen, type } from './helpers/editor.mjs';

const EQUATIONS = 3;
const DISPLAY = String.raw`\[\ddot x - \class{coriolis}{2\dot y} = -\frac{\partial \class{potential}{\tilde U}}{\partial x},\qquad \ddot y + \class{coriolis}{2\dot x} = -\frac{\partial \class{potential}{\tilde U}}{\partial y},\]`;
const STEP2 = String.raw`<p class="fragment" data-fragment-index="2">where \(\tilde U\) is the effective potential.</p>`;
const STEP4 = '<p class="fragment" data-fragment-index="4" data-highlight="potential" data-tone="violet">';
const FORMAT = '#beeson-edit-panel-format';

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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const settle = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(window.BeesonEditor.status()))))');
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

async function open(platform) {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/index.html?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  await page.evaluate(`Reveal.slide(${EQUATIONS})`);
  await sleep(150);
  return page;
}

let saves = 0;
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the edit did not change the text');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await sleep(300);
  await byteExact(page);
  assert.equal((await settle(page)).undo, false, `the edit is more than ${undos} entries of the history`);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  await sleep(300);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `math-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
}

// the key of an inline formula: ⌥⌘E on a Mac, and Alt+= elsewhere, sent as the browser sends it
async function inlineKey(page, platform) {
  if (platform === 'mac') return press(page, 'Mod+Alt+E');
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: '=', code: 'Equal', windowsVirtualKeyCode: 187, modifiers: 1 });
}

// the caret at the end of the paragraph of step 2, found by its text, since reveal.js counts the
// fragments of the live page from 0
const STEP2_LIVE = `[...document.querySelectorAll('.reveal section.present p')].find((p) => p.textContent.startsWith('where'))`;
async function caretInStep2(page) {
  const at = await page.evaluate(`(() => { const r = ${STEP2_LIVE}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(page, at);
  await sleep(150);
  await press(page, 'End');
}

// the display of the slide selected, with the Formula pane shown
async function selectDisplay(page) {
  await page.evaluate(`Reveal.slide(${EQUATIONS})`);
  await page.evaluate(`(() => { window.BeesonEditor.state('view.steps').checked && window.BeesonEditor.exec('view.steps'); window.BeesonEditor.state('shell.format').checked || window.BeesonEditor.exec('shell.format'); })()`);
  await click(page, await center(page, '.reveal section.present div.math mjx-container'));
  await sleep(300);
  await press(page, 'Escape');
  await sleep(300);
  assert.equal(await page.evaluate(`document.querySelector('${FORMAT} .ed-panes')?.dataset.pane`), 'formula');
}

// the text from start to end of the TeX field of the pane selected
const selectInField = (page, part) =>
  page.evaluate(`(() => {
    const f = document.querySelector('${FORMAT} textarea[name="tex"]');
    f.focus();
    const i = f.value.indexOf(${JSON.stringify(part)});
    f.setSelectionRange(i, i + ${part.length});
    f.dispatchEvent(new Event('select'));
    return i;
  })()`);

async function chooseStep(page, prefix) {
  await click(page, await center(page, `${FORMAT} .ed-step`));
  await sleep(150);
  const at = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('[role=menu] [role=menuitemcheckbox]')].find((i) => i.textContent.startsWith(${JSON.stringify(prefix)}));
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the menu of the steps does not have ${prefix}`);
  await click(page, at);
  await sleep(150);
}

for (const platform of ['mac', 'other']) {
  test(`an inline formula is written as \\(x\\) at the caret and typeset (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await caretInStep2(page);
    await inlineKey(page, platform);
    await sleep(200);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math .title')?.textContent`), 'Insert Inline Formula');
    await type(page, 'x');
    await sleep(400);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math .preview mjx-container')`), true, 'the preview is not typeset');
    await press(page, 'Mod+Enter');
    await sleep(500);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math')`), false);
    await byteExact(page, [[STEP2, STEP2.replace('potential.</p>', String.raw`potential.\(x\)</p>`)]]);
    assert.equal(await page.evaluate(`${STEP2_LIVE}.querySelectorAll('mjx-container').length`), 2, 'the formula is not typeset');
    await roundTrip(page);
  });

  test(`a macro of the deck is completed in the TeX field (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await caretInStep2(page);
    await inlineKey(page, platform);
    await sleep(200);
    await type(page, String.raw`x + \L`);
    await sleep(200);
    const items = await page.evaluate(`[...document.querySelectorAll('.beeson-complete [role=option]')].map((o) => o.textContent)`);
    assert.ok(items[0]?.startsWith(String.raw`\LL`), `the macro of the deck is not first: ${items}`);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math textarea').getAttribute('aria-expanded')`), 'true');
    await press(page, 'Enter');
    await type(page, '1');
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math textarea').value`), String.raw`x + \LL{1}`);
    // Escape closes the list, and a second Escape the sheet
    await type(page, String.raw` \fr`);
    await sleep(200);
    await press(page, 'Escape');
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math')`), true, 'Escape closed the sheet with the list open');
    await press(page, 'Escape');
    await sleep(200);
    assert.equal(await page.evaluate(`!!document.querySelector('.beeson-math')`), false);
    await byteExact(page);
    assert.equal((await settle(page)).undo, false, 'a canceled formula is kept in the history');
    assert.deepEqual(errors(page), []);
  });

  test(`an empty TeX is a gray prompt and not an error (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await caretInStep2(page);
    await inlineKey(page, platform);
    await sleep(300);
    const [text, prompt, disabled] = await page.evaluate(`(() => {
      const m = document.querySelector('.beeson-math .error');
      return [m?.textContent, m?.classList.contains('prompt'), [...document.querySelectorAll('.beeson-math button')].find((b) => b.textContent === 'Insert').disabled];
    })()`);
    assert.deepEqual([text, prompt, disabled], ['The formula is empty', true, true]);
    await type(page, String.raw`\frac{`);
    await sleep(400);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-math .error')?.classList.contains('prompt')`), false, 'an error of the TeX is gray');
    await press(page, 'Escape');
    assert.deepEqual(errors(page), []);
  });

  test(`a TeX typed in the Formula pane is written into the display (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await selectDisplay(page);
    await selectInField(page, String.raw`\qquad`);
    await type(page, String.raw`\quad`);
    await press(page, 'Enter');
    await sleep(500);
    await byteExact(page, [[DISPLAY, DISPLAY.replace(String.raw`\qquad`, String.raw`\quad`)]]);
    await roundTrip(page);
  });

  test(`Hold through the next step takes data-keep off the display (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await selectDisplay(page);
    await click(page, await center(page, `${FORMAT} input[type=checkbox]`));
    await sleep(300);
    await byteExact(page, [['<div class="math fragment" data-fragment-index="1" data-keep>', '<div class="math fragment" data-fragment-index="1">']]);
    await roundTrip(page);
  });

  test(`a symbol colored violet at step 4 writes \\class and data-highlight with data-tone="violet" (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await selectDisplay(page);
    await selectInField(page, String.raw`\ddot y`);
    await click(page, await center(page, `${FORMAT} .ed-tones button[aria-label="Violet"]`));
    await chooseStep(page, 'Step 4');
    await click(page, await center(page, `${FORMAT} button[data-command="math.color"]`));
    await sleep(600);
    await byteExact(page, [
      [DISPLAY, DISPLAY.replace(String.raw`\ddot y`, String.raw`\class{y}{\ddot y}`)],
      [STEP4, '<p class="fragment" data-fragment-index="4" data-highlight="potential y" data-tone="violet">'],
    ]);
    assert.equal(await page.evaluate(`document.querySelector('.reveal section.present div.math .y')?.classList.contains('hl-violet')`), true, 'the symbol is not colored at step 4');
    const rows = await page.evaluate(`[...document.querySelectorAll('${FORMAT} .ed-colored li')].map((l) => l.querySelector('.sym').textContent + ' ' + l.querySelector('.at').textContent)`);
    assert.ok(rows.includes(String.raw`\ddot y Violet, Step 4`), `the pane does not list the symbol: ${rows}`);
    await roundTrip(page);
    // its color removed in the pane gives the file back
    await selectDisplay(page);
    await click(page, await center(page, `${FORMAT} button[aria-label="Remove the color of y"]`));
    await sleep(600);
    await byteExact(page);
  });

  test(`a symbol colored blue at step 2 writes data-tone="blue" on the paragraph of step 2 (${platform})`, async (t) => {
    const page = await open(platform);
    t.after(() => page.close?.());
    await selectDisplay(page);
    await selectInField(page, String.raw`\ddot x`);
    await click(page, await center(page, `${FORMAT} .ed-tones button[aria-label="Blue"]`));
    await chooseStep(page, 'Step 2');
    await click(page, await center(page, `${FORMAT} button[data-command="math.color"]`));
    await sleep(600);
    await byteExact(page, [
      [DISPLAY, DISPLAY.replace(String.raw`\ddot x`, String.raw`\class{x}{\ddot x}`)],
      [STEP2, STEP2.replace('data-fragment-index="2"', 'data-fragment-index="2" data-highlight="x" data-tone="blue"')],
    ]);
    await roundTrip(page);
  });
}
