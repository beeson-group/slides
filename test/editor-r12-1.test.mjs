// the work of R12.1 on both platforms: the focus rings of the Go to Slide field, of the popover of
// the presenter display, and of the bars of the chrome

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { contrast, press } from './helpers/editor.mjs';

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
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
