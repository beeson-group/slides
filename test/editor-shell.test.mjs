// the shell of the editor: the regions of the window, the menus and the context menus drawn from
// the registry of commands, the dialogs, the stage of the slide with its zoom, and the order of the
// focus. the commands that the packages of the plan have not defined yet are defined by the tests

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { click, editorPage, press } from './helpers/editor.mjs';

const scheme = (page, value) => page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
const frames = (page) => page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');

// a regression test of the edge of the slide, which was not seen since the page and the slide were
// both painted in --bg: the pasteboard around the slide must differ from the slide in both modes
test('the slide is set off from the pasteboard in both modes of the slide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  for (const mode of ['dark', 'light']) {
    await page.evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(mode)}`);
    await frames(page);
    const look = await page.evaluate(`(() => {
      const probe = document.createElement('div');
      probe.style.background = 'var(--bg)';
      document.querySelector('.reveal').append(probe);
      const slide = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { slide, pasteboard: getComputedStyle(document.body).backgroundColor, shadow: getComputedStyle(document.querySelector('.reveal')).boxShadow };
    })()`);
    assert.notEqual(look.pasteboard, look.slide, `${mode}: the pasteboard is the color of the slide`);
    assert.notEqual(look.shadow, 'none', `${mode}: the slide has no shadow`);
  }
  assert.deepEqual(page.errors, []);
});

// a regression test of the focus left on Slides and Steps after a pointer click, since nav.ts and
// steps.ts wire them without the blur of wire()
test('a pointer click on Slides or Steps leaves the focus off the button', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  for (const name of ['Slides', 'Steps']) {
    const at = await page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-bottom button')].find((b) => b.textContent === ${JSON.stringify(name)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, at);
    await frames(page);
    assert.notEqual(await page.evaluate('document.activeElement.textContent'), name, `the focus is left on ${name}`);
  }
  assert.deepEqual(page.errors, []);
});

// a regression test of the order of Tab, in which the slide came before the toolbar, since the
// shell was appended after .reveal
test('Tab from the start of the page reaches the bars before the slide', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser);
  // the focus is put on a mark at the start of the body, from which Tab goes on in the order of the DOM
  await page.evaluate(`{ const mark = document.createElement('span'); mark.id = 'start'; mark.tabIndex = -1; document.body.prepend(mark); mark.focus(); }`);
  await press(page, 'Tab');
  const first = await page.evaluate(`(() => { const a = document.activeElement; return { inSlide: !!a.closest('.reveal'), inBars: !!a.closest('.beeson-edit-header, .beeson-edit-top') }; })()`);
  assert.deepEqual(first, { inSlide: false, inBars: true });
  assert.deepEqual(page.errors, []);
});
