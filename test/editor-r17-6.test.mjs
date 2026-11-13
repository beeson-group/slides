// regression tests of R17.6 on both platforms. Edit > Undo with a value typed into a field of the
// inspector enters the value as an entry of its own and undoes it, as the Undo of the toolbar does
// (6e, N29), and the Undo of the toolbar keeps the focus in the field (N32). the report of an
// overlap comes back after an undo of a drag (N20), and it names three kinds of figures (N13,
// N22). the well Slide Layout draws Content, Narrow as its tile does (N55), and the card of
// PowerPoint... names the attached file and leaves out a folder that it does not know (N42)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { center, click, drag, press, type } from './helpers/editor.mjs';

const DECK = 'index.html';
const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
// slide 5 of the demo deck, with a heading, a paragraph, a list of three items, and a figure
const FIGURES = 4;
const SLIDE = '.reveal .slides > section.present';
const IMG = `${SLIDE} figure.zone img.for-dark`;

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const labels = async (page) => [(await state(page, 'edit.undo')).label, (await state(page, 'edit.redo')).label];
const focused = (page) => page.evaluate(`(() => { const a = document.activeElement; return a ? a.localName + (a.id ? '#' + a.id : '') : null; })()`);
const fieldValue = (page, id) => page.evaluate(`document.querySelector('#beeson-edit-num-${id}')?.value ?? null`);
const title = (page) => page.evaluate(`document.querySelector('.beeson-edit-menubar .state, .beeson-edit-header .state')?.textContent ?? null`);
const rect = (page, expr) => page.evaluate(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const findItem = `(l) => [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.getClientRects().length && (i.querySelector('.label')?.firstChild?.textContent ?? '') === l)`;

async function load(t, platform, { deck = DECK, slide = FIGURES } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// the item label of the menu bar named bar, chosen by trusted clicks
async function choose(page, bar, label) {
  await click(page, await rect(page, `[...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)})`));
  await wait(page, 200);
  const at = await rect(page, `(${findItem})(${js(label)})`);
  assert.ok(at, `the ${bar} menu does not have ${label}`);
  await click(page, at);
  await wait(page, 400);
}

// the figure of slide 5 moved by one press of the right arrow key, with the Arrange pane open and
// the focus in W. text is the file after the move
async function moved(t, platform) {
  const page = await load(t, platform);
  await click(page, await center(page, IMG));
  await press(page, 'ArrowRight');
  await wait(page, 1100);
  const text = await render(page);
  assert.notEqual(text, page.source, 'the right arrow key did not move the figure');
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await wait(page);
  await exec(page, 'arrange.sizeAndPosition');
  await wait(page);
  return { page, text };
}

async function typeInto(page, id, value) {
  const sel = `#beeson-edit-num-${id}`;
  await click(page, await center(page, sel));
  await page.evaluate(`document.querySelector(${js(sel)}).select()`);
  await type(page, value);
  await wait(page);
}

// each field with the value typed into it and the label of the entry that this value enters
const FIELDS = [['x', '300', 'Position'], ['width', '400', 'Size'], ['angle', '15', 'Rotate']];

for (const platform of PLATFORMS) {
  for (const [id, value, entry] of FIELDS) {
    // 6e and N29: Edit > Undo undid the Move and kept 300 in X, and the next Tab wrote 300 as a
    // new entry, which took the redo of the Move away
    test(`Edit > Undo with ${value} typed into ${id} enters the value and undoes it, and keeps the Move (${platform})`, async (t) => {
      const { page, text } = await moved(t, platform);
      const shown = await fieldValue(page, id);
      await typeInto(page, id, value);
      await choose(page, 'Edit', 'Undo Move');
      assert.equal(await render(page), text, 'the file after Edit > Undo is not the moved one');
      assert.deepEqual(await labels(page), ['Undo Move', `Redo ${entry}`]);
      assert.equal(await focused(page), `input#beeson-edit-num-${id}`, 'the focus left the field');
      assert.equal(await fieldValue(page, id), shown, 'the field does not show the value of the moved figure');
      await press(page, 'Tab');
      await wait(page, 400);
      assert.equal(await render(page), text, 'Tab wrote the typed value after the undo');
      assert.deepEqual(await labels(page), ['Undo Move', `Redo ${entry}`], 'Tab took the redo away');
      await choose(page, 'Edit', `Redo ${entry}`);
      assert.notEqual(await render(page), text, 'Edit > Redo did not give the typed value back');
      await choose(page, 'Edit', `Undo ${entry}`);
      await choose(page, 'Edit', 'Undo Move');
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }

  test(`the Undo of the toolbar with 300 typed into X enters the value, undoes it, and keeps the focus in X (${platform})`, async (t) => {
    const { page, text } = await moved(t, platform);
    const shown = await fieldValue(page, 'x');
    await typeInto(page, 'x', '300');
    await click(page, await center(page, '[data-command="edit.undo"]'));
    await wait(page, 500);
    assert.equal(await render(page), text);
    assert.deepEqual(await labels(page), ['Undo Move', 'Redo Position']);
    assert.equal(await focused(page), 'input#beeson-edit-num-x', 'the focus left the field');
    assert.equal(await fieldValue(page, 'x'), shown);
    assert.deepEqual(errors(page), []);
  });

  // N32: the focus moved to the body, and the next Tab selected the heading of the slide
  test(`the Undo of the toolbar after a step of Angle by the up arrow key keeps the focus in Angle (${platform})`, async (t) => {
    const { page, text } = await moved(t, platform);
    await click(page, await center(page, '#beeson-edit-num-angle'));
    await press(page, 'ArrowUp');
    await wait(page, 400);
    assert.notEqual(await render(page), text, 'the up arrow key did not turn the figure');
    await click(page, await center(page, '[data-command="edit.undo"]'));
    await wait(page, 500);
    assert.equal(await render(page), text);
    assert.equal(await focused(page), 'input#beeson-edit-num-angle', 'the focus left the field');
    assert.equal(await fieldValue(page, 'angle'), '0');
    await press(page, 'Tab');
    await wait(page, 200);
    assert.equal(await page.evaluate(`!!document.activeElement?.closest('.beeson-edit-inspector')`), true, 'Tab left the inspector');
    assert.deepEqual(errors(page), []);
  });

  // N20: the style of the list was 'translate: 0px 20px' at the check and 'translate: 0px 20px;'
  // after the undo, hence the report stayed 'A picture covers 1 text'
  test(`after Wide, an undo of a drag of the list brings the report of its items back (${platform})`, async (t) => {
    const page = await load(t, platform);
    await exec(page, 'slide.layout.wide');
    await wait(page, 300);
    const wide = await render(page);
    const said = await title(page);
    assert.match(said, /A picture covers 4 texts/);
    const start = await page.evaluate(`(() => { const r = document.createRange(); r.selectNodeContents(Reveal.getCurrentSlide().querySelector(':scope > ul > li')); const l = r.getClientRects()[0]; return { x: l.left + 12, y: l.top + l.height / 2 }; })()`);
    await click(page, start);
    await press(page, 'Escape');
    await wait(page);
    const k = await page.evaluate('Reveal.getCurrentSlide().getBoundingClientRect().width / 1920');
    const handle = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-handle')].find((d) => !d.hidden && d.getClientRects().length).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await drag(page, handle, { dx: 0, dy: 40 * k, steps: 8 });
    await wait(page, 300);
    assert.notEqual(await render(page), wide, 'the drag did not move the list');
    assert.match(await title(page), /A picture covers 1 text\b/);
    await undo(page);
    await wait(page, 300);
    assert.equal(await render(page), wide);
    assert.equal(await title(page), said, 'the report after the undo of the drag');
    assert.deepEqual(errors(page), []);
  });

  // N22: a picture, a table, and a QR code over texts read '3 figures cover 4 texts'
  test(`the report names a picture, a table, and a QR code over texts by their kinds (${platform})`, async (t) => {
    const page = await load(t, platform);
    // a new table is put off the words where it can be, hence it is moved over the list
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await wait(page);
    await exec(page, 'arrange.setPosition', { x: 200, y: 560 });
    await wait(page);
    await exec(page, 'insert.qr');
    await wait(page);
    await exec(page, 'arrange.setPosition', { x: 300, y: 250 });
    await wait(page);
    await exec(page, 'slide.layout.wide');
    await wait(page, 400);
    const said = await title(page);
    const m = said.replace(/^Unsaved changes\. /, '').match(/^(.+) cover (\d+) texts$/);
    assert.ok(m, `the report reads ${js(said)}`);
    const parts = m[1].replace(/^A /, 'a ').split(/, and |, | and /);
    assert.deepEqual([...parts].sort(), ['a QR code', 'a picture', 'a table'], `the report reads ${js(said)}`);
    assert.match(m[1], /^A [^,]+, a [^,]+, and a [^,]+$/, 'three kinds are not named with a serial comma');
    assert.deepEqual(errors(page), []);
  });

  // N13: two tables and a plot over texts read '3 figures cover 5 texts'. a deck plot is named in
  // editor-r20-1, since a plot is not inserted by the editor
  test(`the report names two tables and a QR code over texts by their kinds and counts (${platform})`, async (t) => {
    const page = await load(t, platform);
    for (const [id, arg, x, y] of [['insert.table', { rows: 3, columns: 3 }, 200, 250], ['insert.table', { rows: 3, columns: 3 }, 200, 560], ['insert.qr', undefined, 900, 300]]) {
      await exec(page, id, arg);
      await wait(page);
      await exec(page, 'arrange.setPosition', { x, y });
      await wait(page);
    }
    await exec(page, 'slide.layout.wide');
    await wait(page, 400);
    const said = await title(page);
    assert.doesNotMatch(said, /figures/, `the report reads ${js(said)}`);
    const m = said.replace(/^Unsaved changes\. /, '').match(/^(.+) cover (\d+) texts$/);
    assert.ok(m, `the report reads ${js(said)}`);
    const parts = m[1].replace(/^A /, 'a ').split(/, and |, | and /);
    assert.ok(parts.includes('2 tables'), `the report reads ${js(said)}`);
    assert.ok(parts.includes('a QR code'), `the report reads ${js(said)}`);
    assert.equal(new Set(parts).size, parts.length, `a kind is named twice in ${js(said)}`);
    assert.deepEqual(errors(page), []);
  });

  // N55: the well drew Content, Narrow as an inset block at 31, 6 with 28 by 24 of its 64 by 36
  test(`the well Slide Layout draws the backdrop of Content, Narrow as its tile does (${platform})`, async (t) => {
    const page = await load(t, platform, { deck: LAYOUTS, slide: 4 });
    const well = await page.evaluate(`(() => {
      const svg = document.querySelector('.beeson-edit-inspector .ed-card .thumb svg');
      const name = document.querySelector('.beeson-edit-inspector .ed-card .what span:last-child')?.textContent ?? null;
      const boxes = svg ? [...svg.querySelectorAll('rect')].filter((r) => r.getAttribute('fill') === 'var(--ed-faint)' && Number(r.getAttribute('height')) > 10)
        .map((r) => ['x', 'y', 'width', 'height'].map((k) => Number(r.getAttribute(k)))) : null;
      return { name, boxes };
    })()`);
    assert.equal(well.name, 'Content, Narrow');
    // the tile draws the backdrop at 920, 0 with 1000 by 1080 in slide px, i.e. at 30.7, 0 with
    // 33.3 by 36 in the units of the sketch, which is cut at its frame from 0.5 to 63.5
    const boxes = well.boxes.filter(([x]) => x > 20);
    assert.ok(boxes.length >= 1, `the well does not draw the backdrop: ${js(well.boxes)}`);
    const left = Math.min(...boxes.map((b) => b[0]));
    const top = Math.min(...boxes.map((b) => b[1]));
    const right = Math.max(...boxes.map((b) => b[0] + b[2]));
    const bottom = Math.max(...boxes.map((b) => b[1] + b[3]));
    assert.ok(Math.abs(left - (920 * 64) / 1920) < 0.6, `the backdrop of the well starts at ${left}`);
    assert.ok(top <= 0.5 && bottom >= 35.5, `the backdrop of the well runs from ${top} to ${bottom}`);
    assert.ok(right >= 63.5, `the backdrop of the well ends at ${right}`);
    assert.deepEqual(errors(page), []);
  });

  // N42: over HTTP at the root, the card read 'run in the folder of the deck, i.e. /', and it
  // named index.html after the deck was saved into another file
  test(`the card of PowerPoint... names the attached file and leaves out the folder of an address (${platform})`, async (t) => {
    const page = await load(t, platform);
    await page.evaluate(`(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle('talk-r17.html', { create: true });
      window.BeesonEditor.attach(handle);
      await window.BeesonEditor.save();
      return true;
    })()`);
    // the card is open until it is closed, hence the command is not awaited
    await page.evaluate(`void window.BeesonEditor.exec('file.export.pptx'); true`);
    await wait(page);
    const shown = await page.evaluate(`(() => { const d = document.querySelector('dialog.beeson-edit-card.pptx'); return d && d.open ? { text: d.textContent, code: d.querySelector('code')?.textContent ?? null } : null; })()`);
    assert.ok(shown, 'the card of PowerPoint... is not open');
    assert.equal(shown.code, 'npm run pptx -- talk-r17.html');
    assert.match(shown.text, /saved talk-r17\.html/);
    assert.doesNotMatch(shown.text, /index\.html/);
    assert.doesNotMatch(shown.text, /i\.e\. \//, `the card names a folder from the address: ${js(shown.text)}`);
    assert.deepEqual(errors(page), []);
  });
}
