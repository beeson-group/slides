// the work of R10.3 on both platforms: Tab and Shift+Tab across slides in the outline view, the
// check of the contrast of text in the accessibility checker, and the parts of the presenter
// display. each edit of the file is checked byte for byte, after an undo and a redo, and after a
// save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const OUTLINE = 'test/pages/editor-outline.html';
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

const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg !== undefined ? `, ${JSON.stringify(arg)}` : ''})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on a deck served over HTTP, with the storage of the origin emptied first, and with
// slide n shown
async function load(t, platform, { deck = OUTLINE, n = 0, size = { width: 1600, height: 1000 } } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the rendered text is edited, an undo gives the text before and a redo the edited text byte for
// byte, and the saved text is opened again without problems
async function checkEdit(page, before, edited) {
  assert.equal(await render(page), edited);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page);
  assert.equal(text, edited);
}

// the lines of the outline view: per slide, the kind, level, and text of each line
const outline = (page) =>
  page.evaluate(`[...document.querySelectorAll('.beeson-edit-outline .slide')].map((s) => [...s.querySelectorAll('.line')].map((l) => {
    const kind = [...l.classList].find((c) => ['title', 'para', 'item', 'other'].includes(c));
    const t = l.querySelector('.text');
    return kind + ' ' + l.style.getPropertyValue('--depth') + ' ' + (t.dataset.tex ?? t.textContent);
  }))`);

// the caret put at the end of the line of the outline view with text, after a click on the line
async function caretIn(page, text) {
  const at = await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('.beeson-edit-outline .text')].find((t) => (t.dataset.tex ?? t.textContent) === ${JSON.stringify(text)});
    t.scrollIntoView({ block: 'center' });
    const r = t.getBoundingClientRect();
    return { x: r.left + 4, y: r.top + r.height / 2 };
  })()`);
  await click(page, at);
  await page.evaluate(`(() => { const t = document.activeElement; const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);
}

// the index of the slide of the focused line of the outline view, and its text
const focused = (page) =>
  page.evaluate(`(() => {
    const t = document.activeElement;
    const s = t?.closest('.beeson-edit-outline .slide');
    return s ? [[...s.parentElement.children].indexOf(s), t.textContent] : null;
  })()`);

const FIRST = `<section>
  <h2>Transfers through the L1 gateway</h2>
  <p>The spacecraft spirals out of Earth orbit and joins a halo orbit tube.</p>
  <ul>
    <li>Spiral out on low thrust</li>
    <li>Thrust along the velocity
      <ul>
        <li>Burn at perigee</li>
      </ul>
    </li>
    <li>Coast onto the stable manifold</li>
  </ul>
</section>`;

for (const platform of PLATFORMS) {
  test(`Shift+Tab on a first-level item of the outline promotes it to the title of a new slide with the lines after it (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'view.outline');
    await frames(page);
    const source = page.source;
    await caretIn(page, 'Thrust along the velocity');
    await press(page, 'Shift+Tab');
    await sleep(300);
    assert.deepEqual(await outline(page), [
      ['title 0 Transfers through the L1 gateway', 'para 1 The spacecraft spirals out of Earth orbit and joins a halo orbit tube.', 'item 1 Spiral out on low thrust'],
      ['title 0 Thrust along the velocity', 'item 1 Burn at perigee', 'item 1 Coast onto the stable manifold'],
      ['title 0 Transfer budget', 'para 1 The budget is \\(\\Delta v = 3.2\\) km/s.', 'item 1 Escape'],
      ['title 0 Halo orbit at L1'],
    ]);
    assert.deepEqual(await focused(page), [1, 'Thrust along the velocity']);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 1);
    assert.equal((await page.evaluate('window.BeesonEditor.state("edit.undo")')).label, 'Undo Promote to Slide');
    const edited = source.replace(
      FIRST,
      `<section>
  <h2>Transfers through the L1 gateway</h2>
  <p>The spacecraft spirals out of Earth orbit and joins a halo orbit tube.</p>
  <ul>
    <li>Spiral out on low thrust</li>
  </ul>
</section>

<section>
  <h2>Thrust along the velocity</h2>
  <ul>
    <li>Burn at perigee</li>
    <li>Coast onto the stable manifold</li>
  </ul>
</section>`,
    );
    await checkEdit(page, source, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`Shift+Tab on the first item of a list takes the list off its slide (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 1 });
    await exec(page, 'view.outline');
    await frames(page);
    const source = page.source;
    await caretIn(page, 'Escape');
    await press(page, 'Shift+Tab');
    await sleep(300);
    assert.deepEqual((await outline(page)).slice(1, 3), [['title 0 Transfer budget', 'para 1 The budget is \\(\\Delta v = 3.2\\) km/s.'], ['title 0 Escape']]);
    const edited = source.replace(
      `  <ul>
    <li>Escape</li>
  </ul>
</section>`,
      `</section>

<section>
  <h2>Escape</h2>
</section>`,
    );
    await checkEdit(page, source, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`Tab on the title of a slide of text demotes it to the last first-level line of the slide before, with its body after it (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 1 });
    await exec(page, 'view.outline');
    await frames(page);
    const source = page.source;
    await caretIn(page, 'Transfer budget');
    await press(page, 'Tab');
    await sleep(300);
    assert.deepEqual(await outline(page), [
      [
        'title 0 Transfers through the L1 gateway',
        'para 1 The spacecraft spirals out of Earth orbit and joins a halo orbit tube.',
        'item 1 Spiral out on low thrust',
        'item 1 Thrust along the velocity',
        'item 2 Burn at perigee',
        'item 1 Coast onto the stable manifold',
        'item 1 Transfer budget',
        'para 1 The budget is \\(\\Delta v = 3.2\\) km/s.',
        'item 1 Escape',
      ],
      ['title 0 Halo orbit at L1'],
    ]);
    assert.deepEqual(await focused(page), [0, 'Transfer budget']);
    assert.equal((await page.evaluate('window.BeesonEditor.state("edit.undo")')).label, 'Undo Demote Slide');
    const edited = source.replace(
      `    <li>Coast onto the stable manifold</li>
  </ul>
</section>

<section>
  <h2>Transfer budget</h2>
  <p>The budget is \\(\\Delta v = 3.2\\) km/s.</p>
  <ul>
    <li>Escape</li>
  </ul>
</section>`,
      `    <li>Coast onto the stable manifold</li>
    <li>Transfer budget</li>
  </ul>
  <p>The budget is \\(\\Delta v = 3.2\\) km/s.</p>
  <ul>
    <li>Escape</li>
  </ul>
</section>`,
    );
    await checkEdit(page, source, edited);
    assert.deepEqual(errors(page), []);
  });

  test(`Shift+Tab on a paragraph promotes it with the list after it, and Tab demotes it into a slide of a title alone (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 1 });
    await exec(page, 'view.outline');
    await frames(page);
    const source = page.source;
    const budget = `<section>
  <h2>Transfer budget</h2>
  <p>The budget is \\(\\Delta v = 3.2\\) km/s.</p>
  <ul>
    <li>Escape</li>
  </ul>
</section>`;
    await caretIn(page, 'The budget is \\(\\Delta v = 3.2\\) km/s.');
    await press(page, 'Shift+Tab');
    await sleep(300);
    assert.deepEqual((await outline(page)).slice(1, 3), [['title 0 Transfer budget'], ['title 0 The budget is \\(\\Delta v = 3.2\\) km/s.', 'item 1 Escape']]);
    const promoted = source.replace(
      budget,
      `<section>
  <h2>Transfer budget</h2>
</section>

<section>
  <h2>The budget is \\(\\Delta v = 3.2\\) km/s.</h2>
  <ul>
    <li>Escape</li>
  </ul>
</section>`,
    );
    await checkEdit(page, source, promoted);
    page.source = promoted;
    await exec(page, 'view.outline');
    await exec(page, 'view.outline');
    await frames(page);
    await caretIn(page, 'The budget is \\(\\Delta v = 3.2\\) km/s.');
    await press(page, 'Tab');
    await sleep(300);
    assert.deepEqual((await outline(page)).slice(1, 3), [['title 0 Transfer budget', 'item 1 The budget is \\(\\Delta v = 3.2\\) km/s.', 'item 1 Escape'], ['title 0 Halo orbit at L1']]);
    const demoted = source.replace(
      budget,
      `<section>
  <h2>Transfer budget</h2>
  <ul>
    <li>The budget is \\(\\Delta v = 3.2\\) km/s.</li>
    <li>Escape</li>
  </ul>
</section>`,
    );
    await checkEdit(page, promoted, demoted);
    assert.deepEqual(errors(page), []);
  });

  test(`Tab on the title of the first slide or of a slide with a backdrop does nothing (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'view.outline');
    await frames(page);
    const lines = await outline(page);
    for (const title of ['Transfers through the L1 gateway', 'Halo orbit at L1']) {
      await caretIn(page, title);
      await press(page, 'Tab');
      await sleep(250);
      assert.deepEqual(await outline(page), lines);
      assert.equal(await render(page), page.source);
      assert.equal((await focused(page))?.[1], title);
    }
    assert.deepEqual(errors(page), []);
  });
}
