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

const CONTRAST = 'test/pages/editor-contrast.html';
const rowsOf = (page, cls) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y .${cls}')].map((r) => r.dataset.check + ' ' + r.querySelector('.what').textContent)`);

for (const platform of PLATFORMS) {
  test(`the checker reports text under the contrast of WCAG 2 in each mode, and lists a label over a backdrop as a tip (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: CONTRAST });
    await exec(page, 'view.accessibility');
    await frames(page);
    // the tones of the theme, a table, and the footnote of slide 1 are not reported in either mode
    assert.deepEqual(await rowsOf(page, 'item'), [
      'contrast "A small text with a dar…" 1.7:1 in dark mode Slide 2',
      'contrast "A gray on the black pan…" 2.7:1 in dark mode Slide 3',
      'contrast "A gray on the black pan…" 2.7:1 in light mode Slide 3',
    ]);
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .status').textContent`), /Investigate3 warnings/);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y :is(.check, .tiphead)')].map((c) => c.textContent)`), ['Hard-to-read text contrast3', 'Check text over a picture1']);
    assert.deepEqual(await rowsOf(page, 'hint'), ['behind Label Slide 4']);
    // the same rows in light mode, with the page in its own colors after the measure
    await page.evaluate(`document.documentElement.dataset.theme = 'light'`);
    await exec(page, 'view.accessibility');
    await exec(page, 'view.accessibility');
    await frames(page);
    assert.equal((await rowsOf(page, 'item')).length, 3);
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.reveal section h2')).color`), 'rgb(20, 20, 19)');
    // a row shows its slide in its mode and selects its block
    await click(page, '.beeson-edit-a11y .item[data-i]:nth-child(1)');
    await page.waitFor(`document.documentElement.dataset.theme === 'dark' && window.BeesonEditor.selection().length === 1`);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 1);
    assert.equal(await page.evaluate(`window.BeesonEditor.selection()[0].textContent`), 'A small text with a dark gray.');
    assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .info').textContent`), /WCAG 2 asks for a contrast of 4\.5:1/);
    const light = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y .item')].findIndex((r) => r.textContent.includes('light mode'))`);
    await click(page, `.beeson-edit-a11y .item[data-i="${light}"]`);
    await page.waitFor(`document.documentElement.dataset.theme === 'light' && window.BeesonEditor.selection()[0]?.textContent === 'A gray on the black panel.'`);
    assert.equal(await page.evaluate('Reveal.getIndices().h'), 2);
    // the row of a tip selects the label
    await click(page, '.beeson-edit-a11y .hint');
    await page.waitFor(`window.BeesonEditor.selection()[0]?.matches('.lab')`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

for (const platform of PLATFORMS) {
  test(`the demo deck has no contrast warning in either mode, and its tips leave it Good to go (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: 'index.html' });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(`document.documentElement.dataset.theme = '${theme}'`);
      await exec(page, 'view.accessibility');
      await frames(page);
      assert.deepEqual(await rowsOf(page, 'item'), []);
      assert.ok((await rowsOf(page, 'hint')).includes('behind "Thank you" Slide 12'));
      assert.match(await page.evaluate(`document.querySelector('.beeson-edit-a11y .status').textContent`), /Good to go/);
      await exec(page, 'view.accessibility');
      assert.equal(await page.evaluate(`document.querySelector('.beeson-edit-bottom .a11y').textContent`), 'Accessibility: Good to go');
    }
    assert.deepEqual(errors(page), []);
  });
}

// states 172 and 276: the parts of the presenter display could not be chosen, and the Play menu
// did not have Customize Presenter Display… of Keynote (K52). PARTS reads the open display: the
// parts seen, whether the popover of the parts is open, and its checkboxes
const PARTS = `(() => {
  const d = document.querySelector('dialog.beeson-edit-presenter[open]');
  if (!d) return null;
  const seen = (sel) => { const e = d.querySelector(sel); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const pop = d.querySelector('.parts');
  return {
    shown: ['.shot.current', '.shot:not(.current)', '.notes', '.clock', '.elapsed'].filter(seen).length,
    hidden: { current: !seen('.shot.current'), next: !seen('.shot:not(.current)'), notes: !seen('.notes'), clock: !seen('.clock'), timer: !seen('.elapsed') },
    open: !!pop && !pop.hidden,
    boxes: pop ? [...pop.querySelectorAll('input[type=checkbox]')].map((b) => b.closest('label').textContent.trim() + (b.checked ? ' on' : ' off')) : [],
  };
})()`;
const KEY = `localStorage.getItem('beeson-presenter-parts:' + location.pathname)`;
const box = (label) => `.beeson-edit-presenter .parts label:nth-child(${['Current Slide', 'Next Slide', 'Presenter Notes', 'Clock', 'Timer'].indexOf(label) + 1})`;
const count = (page) => page.evaluate(`document.querySelector('.beeson-edit-presenter .count').textContent`);

for (const platform of PLATFORMS) {
  test(`Customize Presenter Display… of the Play menu opens the display with a popover of its parts, and each part unchecked is hidden and kept for the deck (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 1 });
    await page.evaluate(`(() => { window.__opened = 0; window.open = () => { window.__opened++; return null; }; return true; })()`);
    const play = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].findIndex((b) => b.textContent === 'Play')`);
    assert.ok(play >= 0, 'the menu bar does not have the Play menu');
    await click(page, `.beeson-edit-menubar [role=menuitem]:nth-child(${play + 1})`);
    const item = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].findIndex((i) => i.querySelector('.label')?.textContent === 'Customize Presenter Display…')`);
    assert.ok(item >= 0, 'the Play menu does not have Customize Presenter Display…');
    await click(page, `.beeson-edit-menu .item:nth-of-type(${item + 1})`);
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    let parts = await page.evaluate(PARTS);
    assert.equal(parts.open, true, 'the popover of the parts is not open');
    assert.deepEqual(parts.boxes, ['Current Slide on', 'Next Slide on', 'Presenter Notes on', 'Clock on', 'Timer on']);
    assert.equal(parts.shown, 5);
    assert.equal(await page.evaluate('window.__opened'), 0, 'Customize Presenter Display… opened the show');
    await click(page, box('Next Slide'));
    await click(page, box('Clock'));
    parts = await page.evaluate(PARTS);
    assert.deepEqual(parts.hidden, { current: false, next: true, notes: false, clock: true, timer: false });
    assert.deepEqual(JSON.parse(await page.evaluate(KEY)), ['next', 'clock']);
    // the keys of the show stay live while the popover is open, and Esc closes the popover first
    assert.equal(await count(page), '2 / 3');
    await press(page, 'ArrowRight');
    assert.equal(await count(page), '3 / 3');
    await press(page, 'Escape');
    parts = await page.evaluate(PARTS);
    assert.equal(parts?.open, false, 'Esc did not close the popover, or it ended the display');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    // the display is opened again with the parts chosen, and the file is not changed
    await exec(page, 'play.customizePresenter');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    parts = await page.evaluate(PARTS);
    assert.deepEqual(parts.boxes, ['Current Slide on', 'Next Slide off', 'Presenter Notes on', 'Clock off', 'Timer on']);
    assert.deepEqual(parts.hidden, { current: false, next: true, notes: false, clock: true, timer: false });
    await click(page, box('Next Slide'));
    await click(page, box('Clock'));
    assert.equal((await page.evaluate(PARTS)).shown, 5);
    assert.equal(await page.evaluate(KEY), null);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`the button Display Options of the presenter display opens and closes the popover of its parts, which a click outside closes (${platform})`, async (t) => {
    const page = await load(t, platform, { n: 1 });
    await exec(page, 'play.rehearse');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter.rehearse[open]')`);
    assert.equal((await page.evaluate(PARTS)).open, false);
    const button = `.beeson-edit-presenter .bar.top button[aria-label="Display Options"]`;
    await click(page, button);
    assert.equal((await page.evaluate(PARTS)).open, true, 'the button does not open the popover');
    assert.equal(await page.evaluate(`document.querySelector('${button}').getAttribute('aria-expanded')`), 'true');
    for (const label of ['Current Slide', 'Presenter Notes', 'Timer']) await click(page, box(label));
    const parts = await page.evaluate(PARTS);
    assert.deepEqual(parts.hidden, { current: true, next: false, notes: true, clock: false, timer: true });
    // the next slide is drawn into the room left by the current slide
    assert.ok(await page.evaluate(`document.querySelector('.beeson-edit-presenter .shot:not(.current)').getBoundingClientRect().width > innerWidth * 0.8`), 'the next slide does not take the width of the stage');
    assert.ok(await page.evaluate(`!!document.querySelector('.beeson-edit-presenter .shot:not(.current) .pic').shadowRoot?.querySelector('section')`));
    await click(page, '.beeson-edit-presenter .bar.foot .count');
    assert.equal((await page.evaluate(PARTS)).open, false, 'a click outside does not close the popover');
    assert.equal(await count(page), '2 / 3', 'a click outside moved the display');
    await click(page, button);
    await click(page, button);
    assert.equal((await page.evaluate(PARTS)).open, false, 'a second click on the button does not close the popover');
    assert.deepEqual(JSON.parse(await page.evaluate(KEY)), ['current', 'notes', 'timer']);
    // the rehearsal asks at its end, and Esc leaves the timings as they were
    await press(page, 'Escape');
    await press(page, 'Escape');
    await page.waitFor(`!document.querySelector('dialog.beeson-edit-presenter[open]')`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
