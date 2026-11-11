// regression tests of R14.2 on both platforms with trusted input: Undo and Redo of a line of the
// outline chosen from the Edit menu or the toolbar, which write the typed text of the line first,
// as the keys do, and Undo Typing named and enabled while a typing in the line is not written yet.
// after each edit the text is checked byte for byte after an undo, the edit again after a redo, and
// after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, press, saveAndReopen } from './helpers/editor.mjs';

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

const js = (v) => JSON.stringify(v);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
let saves = 0;

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/index.html?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('index.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate('Reveal.slide(2)');
  await frames(page);
  return page;
}

// keys sends one trusted key press with its text for each character, as a keyboard does
async function keys(page, text) {
  for (const ch of text) {
    const code = ch === ' ' ? 'Space' : `Key${ch.toUpperCase()}`;
    const base = { key: ch, code, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0), modifiers: ch !== ch.toLowerCase() ? 8 : 0 };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ch, unmodifiedText: ch });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
}

// the outline shown on slide 3, with the caret at the end of its line "Two elements..."
async function outlineAt(t, platform) {
  const page = await load(t, platform);
  if (!(await state(page, 'view.outline')).checked) await page.evaluate(`window.BeesonEditor.exec('view.outline')`);
  await wait(page);
  const at = await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('.beeson-edit-outline .text')].find((e) => e.textContent.startsWith('Two elements'));
    t.scrollIntoView({ block: 'center' });
    const r = t.getBoundingClientRect();
    return { x: r.right - 2, y: r.bottom - 6 };
  })()`);
  await click(page, at);
  await press(page, 'End');
  await wait(page);
  assert.ok(await page.evaluate(`document.activeElement.matches('.beeson-edit-outline .text') && document.activeElement.textContent.startsWith('Two elements')`), 'the caret is not in the line of the outline');
  return page;
}

// choose clicks the item of the Edit menu whose label starts with label, and returns the label
// that the item showed, with (disabled) for a dimmed item
async function choose(page, label) {
  if (await page.evaluate(`!!document.querySelector('.beeson-edit-menu .item')`)) {
    await press(page, 'Escape');
    await frames(page);
  }
  await click(page, await page.evaluate(`(() => {
    const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === 'Edit').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`));
  await frames(page);
  const at = await page.evaluate(`(() => {
    const item = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => (i.querySelector('.label')?.textContent ?? '').startsWith(${js(label)}));
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: item.querySelector('.label').textContent, disabled: item.getAttribute('aria-disabled') };
  })()`);
  assert.ok(at, `the Edit menu does not have an item ${label}`);
  await click(page, at);
  await wait(page);
  return at.label + (at.disabled === 'true' ? ' (disabled)' : '');
}

// button clicks the toolbar button of the command id, and returns the label of the command
// before the click, with (disabled) for a dimmed command
async function button(page, id) {
  const before = await state(page, id);
  const at = await page.evaluate(`(() => {
    const r = document.querySelector('[data-command=${js(id)}]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await click(page, at);
  await wait(page);
  return before.label + (before.enabled === false ? ' (disabled)' : '');
}

const WAYS = {
  menu: { undo: (p) => choose(p, 'Undo'), redo: (p) => choose(p, 'Redo') },
  toolbar: { undo: (p) => button(p, 'edit.undo'), redo: (p) => button(p, 'edit.redo') },
};

const SAME = 'Two elements with the same index are shown together.';
const itemText = (s) => `<li class="fragment" data-fragment-index="2">${s}</li>`;

for (const platform of PLATFORMS) {
  for (const [how, way] of Object.entries(WAYS)) {
    // r12-8-outline-objects n1 and D3: Undo from the menu after Return and typing took off the
    // item with its text, named Undo New Paragraph, and Redo gave back an empty item
    test(`in the outline, Undo and Redo of the ${how} after Return and typing take off the typing and then the item, and give both back (${platform})`, async (t) => {
      const page = await outlineAt(t, platform);
      await press(page, 'Enter');
      await wait(page);
      await keys(page, 'New item');
      await wait(page);
      assert.equal(await way.undo(page), 'Undo Typing');
      let text = await render(page);
      assert.ok(text.includes(`${SAME}</li>\n    ${itemText('')}`), 'the first undo does not keep the empty item');
      assert.equal(await way.undo(page), 'Undo New Paragraph');
      await byteExact(page);
      assert.equal(await way.redo(page), 'Redo New Paragraph');
      assert.equal(await way.redo(page), 'Redo Typing');
      text = await render(page);
      assert.ok(text.includes(`${SAME}</li>\n    ${itemText('New item')}`), 'the redos do not give back the item with its text');
      const lines = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-outline .slide')][2].textContent`);
      assert.ok(lines.includes('New item'), 'the outline does not show the text given back');
      const { text: saved } = await saveAndReopen(page, `r14-2-${++saves}.html`);
      assert.equal(saved, text);
      assert.deepEqual(errors(page), []);
    });
  }

  // D4: while a typing in a line of the outline was not written yet, Undo was named Undo and was
  // dimmed in the Edit menu, and the typing could not be taken back from the menu
  test(`in the outline, a typing not written yet is named Undo Typing in the Edit menu and is taken back from it (${platform})`, async (t) => {
    const page = await outlineAt(t, platform);
    await keys(page, ' XY');
    await wait(page);
    const s = await state(page, 'edit.undo');
    assert.equal(s.label, 'Undo Typing');
    assert.notEqual(s.enabled, false, 'Undo is dimmed');
    // a typing clears the redos, hence Redo is dimmed
    assert.deepEqual(await state(page, 'edit.redo').then((r) => [r.label, r.enabled]), ['Redo', false], 'Redo is not a dimmed Redo');
    assert.equal(await choose(page, 'Undo'), 'Undo Typing');
    await byteExact(page);
    const line = await page.evaluate(`document.activeElement.matches('.beeson-edit-outline .text') ? document.activeElement.textContent : null`);
    assert.equal(line, SAME, 'the line does not show the text of the file with the caret in it');
    assert.equal(await choose(page, 'Redo'), 'Redo Typing');
    const text = await render(page);
    assert.ok(text.includes(`${SAME} XY</li>`), 'the redo does not give back the typing');
    const { text: saved } = await saveAndReopen(page, `r14-2-${++saves}.html`);
    assert.equal(saved, text);
    assert.deepEqual(errors(page), []);
  });
}
