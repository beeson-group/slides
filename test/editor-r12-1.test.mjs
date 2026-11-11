// the work of R12.1 on both platforms: the contrast of text measured in the accessibility checker
// against the tokens of each mode, whatever mode is shown and whether the deck is served or opened
// from a file, the menu key and the focus in the checker after a fix, and the focus rings of the
// Go to Slide field, of the popover of the presenter display, and of the bars of the chrome

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, contrast, press } from './helpers/editor.mjs';

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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on index.html, served over HTTP or opened from its file, with query in its URL. the
// script prepare is run on the page before source is opened
async function load(t, { query, file = false, source = readFileSync('index.html', 'utf8'), prepare = '' }) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(file ? deckUrl('index.html', query) : `${server.origin}/index.html?${query}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  if (prepare) await page.evaluate(prepare);
  page.source = source;
  const s = await page.evaluate(`window.BeesonEditor.open(${js(source)})`);
  assert.deepEqual(s.problems, []);
  await frames(page);
  return page;
}

const rowsOf = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-a11y .item')].map((r) => r.dataset.check + ' ' + r.querySelector('.what').textContent)`);
const readout = (page) => page.evaluate(`document.querySelector('.beeson-edit-bottom .a11y').textContent`);

// shell-1 and dialogs-undo-a11y-1: in light mode, and on a deck opened from a file, every text was
// measured against black, and the checker listed 90 rows of 1.1:1
for (const platform of PLATFORMS) {
  test(`the checker lists the same contrast rows in either mode, served or opened from a file (${platform})`, async (t) => {
    const seen = new Map();
    for (const file of [false, true]) {
      for (const theme of ['dark', 'light']) {
        const page = await load(t, { query: `edit&still&theme=${theme}&edit-platform=${platform}`, file });
        await sleep(700);
        const where = `${file ? 'file' : 'http'} ${theme}`;
        const before = await readout(page);
        await exec(page, 'view.accessibility');
        await frames(page);
        const rows = await rowsOf(page);
        assert.ok(rows.every((r) => !/ 1\.\d:1 /.test(r)), `${where}: ${rows.slice(0, 3).join(' | ')}`);
        seen.set(where, rows);
        const state = /Investigate/.test(await page.evaluate(`document.querySelector('.beeson-edit-a11y .status').textContent`)) ? 'Investigate' : 'Good to go';
        assert.equal(before, `Accessibility: ${state}`, where);
        assert.equal(await page.evaluate(`document.documentElement.dataset.theme`), theme);
        assert.equal(await render(page), page.source);
        assert.deepEqual(errors(page), []);
        await page.close();
      }
    }
    const [first] = seen.values();
    for (const [where, rows] of seen) assert.deepEqual(rows, first, where);
  });
}

// shell-1: after D flips the shown mode, the readout of the status bar is the same as before
for (const platform of PLATFORMS) {
  test(`the readout of the checker does not change with the mode shown (${platform})`, async (t) => {
    const page = await load(t, { query: `edit&still&theme=dark&edit-platform=${platform}`, file: true });
    await sleep(700);
    const first = await readout(page);
    for (const theme of ['light', 'dark']) {
      await click(page, { x: 210, y: 500 });
      await press(page, 'D');
      await page.waitFor(`document.documentElement.dataset.theme === ${js(theme)}`);
      await sleep(900);
      assert.equal(await readout(page), first, theme);
    }
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the demo deck with the alt text of its two images taken off, in the page and in the file
const BARE = readFileSync('index.html', 'utf8').replace(/(<img class="for-(?:dark|light)" src="demo\/figure-(?:dark|light)\.png") alt="[^"]*"/g, '$1');
const STRIP = `(() => { for (const img of document.querySelectorAll('.reveal img[src^="demo/figure-"]')) img.removeAttribute('alt'); return true; })()`;
const active = (page) => page.evaluate(`(() => { const a = document.activeElement; return { tag: a.localName, inPane: !!a.closest('.beeson-edit-a11y'), row: a.matches('[role="treeitem"]') ? a.textContent : null }; })()`);
const menuLabel = (page) => page.evaluate(`document.querySelector('[role="menu"]')?.getAttribute('aria-label') ?? null`);

// the row of the second image under Missing alternative text, reached by the keyboard
async function altRow(t, platform) {
  assert.notEqual(BARE, readFileSync('index.html', 'utf8'));
  const page = await load(t, { query: `edit&still&theme=dark&edit-platform=${platform}`, source: BARE, prepare: STRIP });
  await exec(page, 'view.accessibility');
  await frames(page);
  assert.match((await active(page)).row ?? '', /Missing alternative text2/);
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  assert.match((await active(page)).row ?? '', /figure-light\.png/);
  return page;
}

// dialogs-undo-a11y-3: after Enter on a row, its image is selected, and the menu key opened the
// menu of the image in place of the fixes of the row
for (const platform of PLATFORMS) {
  for (const key of ['Shift+F10', 'ContextMenu']) {
    test(`${key} on a row of the checker opens its fixes after Enter has selected its image (${platform})`, async (t) => {
      const page = await altRow(t, platform);
      await press(page, 'Enter');
      await page.waitFor(`window.BeesonEditor.selection().length === 1`);
      assert.ok((await active(page)).inPane);
      if (key === 'ContextMenu') {
        const base = { key: 'ContextMenu', code: 'ContextMenu', windowsVirtualKeyCode: 93 };
        await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      } else await press(page, key);
      await page.waitFor(`!!document.querySelector('[role="menu"]')`);
      assert.equal(await menuLabel(page), 'Fixes');
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }
}

// dialogs-undo-a11y-4: after a fix chosen by the keyboard, the focus fell to the body
for (const platform of PLATFORMS) {
  test(`after Mark as Decorative by the keyboard, the focus stays on a row of the checker (${platform})`, async (t) => {
    const page = await altRow(t, platform);
    await press(page, 'Shift+F10');
    await page.waitFor(`document.querySelector('[role="menu"]')?.getAttribute('aria-label') === 'Fixes'`);
    await press(page, 'ArrowDown');
    await page.waitFor(`document.getElementById(document.activeElement.getAttribute('aria-activedescendant'))?.textContent.startsWith('Mark as Decorative')`);
    await press(page, 'Enter');
    await page.waitFor(`document.querySelector('.beeson-edit-a11y .check[data-check="alt"] .n')?.textContent === '1'`);
    await frames(page);
    const at = await active(page);
    assert.ok(at.inPane && at.row, JSON.stringify(at));
    assert.match(at.row, /figure-dark\.png|Missing alternative text1/);
    await press(page, 'ArrowUp');
    assert.ok((await active(page)).inPane);
    assert.notEqual(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the outline of the focused element, and the color of --ed-focus beside it
const RING = `(() => {
  const a = document.activeElement;
  const cs = getComputedStyle(a);
  const p = document.createElement('div');
  p.style.color = 'var(--ed-focus)';
  a.parentElement.append(p);
  const focus = getComputedStyle(p).color;
  p.remove();
  return { visible: a.matches(':focus-visible'), color: cs.outlineColor, width: parseFloat(cs.outlineWidth), style: cs.outlineStyle, focus };
})()`;

// dialogs-undo-a11y-5: the Go to Slide field and the checkboxes of the presenter display drew the
// thin blue ring of the browser
for (const platform of PLATFORMS) {
  for (const theme of ['dark', 'light']) {
    test(`the Go to Slide field and the checkboxes of Display Options draw the ring of the editor (${platform}, ${theme})`, async (t) => {
      const page = await load(t, { query: `edit&still&theme=${theme}&edit-platform=${platform}` });
      await exec(page, 'navigate.goTo');
      await page.waitFor(`document.activeElement.matches('.jump-to-slide-input')`);
      let ring = await page.evaluate(RING);
      assert.equal(ring.color, ring.focus, 'Go to Slide');
      assert.ok(ring.width >= 2 && ring.style === 'solid', JSON.stringify(ring));
      await press(page, 'Escape');
      await page.evaluate(`(() => { window.open = () => null; return true; })()`);
      await exec(page, 'play.customizePresenter');
      await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open] .parts:not([hidden])')`);
      for (let i = 0; i < 20 && !(await page.evaluate(`document.activeElement.matches('.parts input[type=checkbox]')`)); i++) await press(page, 'Tab');
      ring = await page.evaluate(RING);
      assert.ok(ring.visible);
      // the dialog sets --ed-focus of its own, hence the ring is measured against its bar
      const bar = await page.evaluate(ON_BAR);
      assert.ok(contrast(bar.ring, bar.bg) >= 3, `Display Options: ${bar.ring} on ${bar.bg} is ${contrast(bar.ring, bar.bg).toFixed(2)}:1`);
      assert.ok(ring.width >= 2 && ring.style === 'solid', JSON.stringify(ring));
      assert.deepEqual(errors(page), []);
    });
  }
}

// the ring of the focused element and the first opaque background of its ancestors, i.e. its bar
const ON_BAR = `(() => {
  const a = document.activeElement;
  if (!a || a === document.body || !a.matches(':focus-visible')) return null;
  let bg = null;
  for (let e = a.parentElement; e && !bg; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!c.startsWith('rgba') && c !== 'transparent') bg = c; }
  const cs = getComputedStyle(a);
  return { what: (a.getAttribute('aria-label') || a.title || a.textContent).trim().slice(0, 30), ring: cs.outlineColor, width: parseFloat(cs.outlineWidth), bg };
})()`;

// dialogs-undo-a11y-6: the ring of the buttons of the bars was about 2.2:1 against its bar
for (const platform of PLATFORMS) {
  for (const scheme of ['light', 'dark']) {
    test(`the focus ring of the buttons of the bars has a contrast of 3:1 against its bar (${platform}, ${scheme})`, async (t) => {
      const page = await load(t, { query: `edit&still&theme=${scheme}&edit-platform=${platform}` });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
      await page.evaluate('Reveal.slide(4)');
      await frames(page);
      const seen = [];
      for (let i = 0; i < 6; i++) {
        await press(page, 'F6');
        await frames(page);
        const at = await page.evaluate(ON_BAR);
        if (at && at.width > 0) seen.push(at);
      }
      assert.ok(seen.length >= 3, JSON.stringify(seen));
      for (const at of seen) assert.ok(contrast(at.ring, at.bg) >= 3, `${at.what}: ${at.ring} on ${at.bg} is ${contrast(at.ring, at.bg).toFixed(2)}:1`);
      assert.deepEqual(errors(page), []);
    });
  }
}
