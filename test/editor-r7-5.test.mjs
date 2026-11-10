// the steps, code boxes, and formulas of R7.5 with trusted input on either platform: Play From a
// step of the Steps tab, the line steps of a code box listed as rows of the Steps tab, the stepper
// of the Delay field, the glyphs of the TeX completion list, and the switch Small of the Code pane.
// after each edit an undo gives the file byte for byte, a redo gives the edit, and a save is
// opened again without problems

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, press, saveAndReopen, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';
const SIDE = '.beeson-edit-side';
const REDO = { mac: 'Mod+Shift+Z', other: 'Mod+Y' };
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const CODE = '<code class="language-python" data-line-numbers="1-3|4|5-7|8-9">def halo_family():';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const js = (v) => JSON.stringify(v);
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const rendered = (page) => page.evaluate('window.BeesonEditor.render()');
const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo').label`);

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

// the editor on a deck served over HTTP, opened with text, on the slide of the element matched by
// at, with the Format tab or the Steps tab shown
async function open(t, platform, { deck = 'index.html', text = readFileSync(deck, 'utf8'), at = 'pre > code', tab = 'format', width = 1600, height = 1000 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = text;
  await page.evaluate('localStorage.clear()');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(text)})`)).problems, []);
  if (tab === 'format' && !(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
  if (tab === 'steps') await page.evaluate(`window.BeesonEditor.exec('view.steps')`);
  await page.evaluate(`Reveal.slide(Reveal.getIndices(document.querySelector(${js(at)}).closest('section')).h)`);
  await sleep(150);
  await frames(page);
  return page;
}

async function undoRedo(page, platform, before, after) {
  await press(page, 'Mod+Z');
  await frames(page);
  assert.equal(await rendered(page), before, 'an undo does not give the file before the edit');
  await press(page, REDO[platform]);
  await frames(page);
  assert.equal(await rendered(page), after, 'a redo does not give the edit again');
}

// the problems of the scope rule in text that the source of the page did not have
const newProblems = (page, text) => {
  const old = textProblems(page.source, THEME);
  return textProblems(text, THEME).filter((p) => !old.includes(p));
};

// saved writes the text into a file, opens it again without problems, and checks it byte for byte
let saves = 0;
async function saved(page, text) {
  const out = await saveAndReopen(page, `r7-5-${++saves}.html`);
  assert.equal(out.text, text);
}

// selectCode selects the code box of the current slide as a block, by a click in its first line
// and Esc
async function selectCode(page) {
  const at = await page.evaluate(`(() => {
    const code = document.querySelector('.reveal section.present pre > code');
    const r = document.createRange();
    r.setStart(code.firstChild, 2);
    r.setEnd(code.firstChild, 3);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
  await click(page, at);
  await press(page, 'Escape');
  await frames(page);
}

const SMALL = `${PANEL} label:has(> input[data-command="code.small"])`;

for (const platform of PLATFORMS) {
  test(`the switch Small of the Code pane sets the code at 18 px, and off restores the tag on ${platform}`, async (t) => {
    const page = await open(t, platform);
    const source = page.source;
    await selectCode(page);
    const box = `${SMALL} input`;
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).checked`), false);
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).disabled`), false);
    const size = () => page.evaluate(`getComputedStyle(document.querySelector('.reveal section.present pre')).fontSize`);
    assert.equal(await size(), '22px');
    await click(page, SMALL);
    await frames(page);
    const small = source.replace('<pre><code class="language-python"', '<pre style="font-size: 18px"><code class="language-python"');
    assert.equal(await rendered(page), small);
    assert.equal(await size(), '18px');
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).checked`), true);
    assert.equal(await undoLabel(page), 'Undo Small Code');
    assert.deepEqual(newProblems(page, small), []);
    await undoRedo(page, platform, source, small);
    // off takes the declaration out, and the tag is as it was, byte for byte
    await click(page, SMALL);
    await frames(page);
    assert.equal(await rendered(page), source);
    assert.equal(await size(), '22px');
    assert.equal(await page.evaluate(`document.querySelector(${js(box)}).checked`), false);
    await undoRedo(page, platform, small, source);
    await click(page, SMALL);
    await frames(page);
    await saved(page, small);
    assert.deepEqual(errors(page), []);
  });

  test(`Small keeps the other declarations of the pre, and off gives its tag back byte for byte on ${platform}`, async (t) => {
    const text = readFileSync('index.html', 'utf8').replace('<pre><code class="language-python"', '<pre style="translate: 0px 12px;"><code class="language-python"');
    const page = await open(t, platform, { text });
    await selectCode(page);
    await click(page, SMALL);
    await frames(page);
    const small = await rendered(page);
    assert.match(small, /<pre style="translate: 0px 12px; font-size: 18px;?"><code class="language-python"/);
    assert.deepEqual(newProblems(page, small), []);
    await undoRedo(page, platform, text, small);
    await click(page, SMALL);
    await frames(page);
    assert.equal(await rendered(page), text);
    assert.deepEqual(errors(page), []);
  });
}
