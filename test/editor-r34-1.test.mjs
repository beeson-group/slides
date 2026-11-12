// the section Backdrop of the Slide pane, R34.1, on both platforms. the section names the drawing
// of the slide next to the button Select on a slide with a backdrop, and shows the button Add
// Backdrop… on a slide without one. it follows the slide while the pane stays the same, i.e. once
// the file is opened on the first slide, and at an undo or a redo of Add Backdrop and of Delete

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { click, editorPage, press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

let last = null;
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}).then(() => true)`);

async function slidePage(platform) {
  await last?.close().catch(() => {});
  const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}`, page: { width: 1600, height: 1000 } });
  last = page;
  if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
  await frames(page);
  return page;
}

// the pane that is shown, and the note and the buttons of its section Backdrop
const SECTION = `(() => {
  const pane = document.querySelector('#beeson-edit-panel-format .ed-panes');
  const sec = [...(pane?.querySelectorAll('.ed-sec') ?? [])].find((s) => s.querySelector('h5')?.textContent === 'Backdrop');
  const shown = (el) => !el.hidden && el.getClientRects().length > 0;
  return {
    pane: pane?.dataset.pane ?? null,
    name: sec ? [...sec.querySelectorAll('.ed-note')].filter(shown).map((n) => n.textContent).join(' ') : null,
    buttons: sec ? [...sec.querySelectorAll('button')].filter(shown).map((b) => b.textContent) : null,
    backdrop: !!document.querySelector('section.present > .backdrop'),
  };
})()`;
const section = async (page) => { await frames(page); return page.evaluate(SECTION); };
const WITH = (name) => ({ pane: 'slide', name, buttons: ['Select'], backdrop: true });
const WITHOUT = { pane: 'slide', name: '', buttons: ['Add Backdrop…'], backdrop: false };

for (const platform of PLATFORMS) {
  test(`the Slide pane names the backdrop of the first slide once the file is opened (${platform})`, async () => {
    const page = await slidePage(platform);
    assert.deepEqual(await section(page), WITH('Beeson Logo'));
    // the button selects the backdrop, and Esc shows the same section again
    await click(page, '#beeson-edit-panel-format .ed-sec button[data-command="backdrop.select"]');
    assert.equal((await section(page)).pane, 'backdrop');
    await press(page, 'Escape');
    assert.deepEqual(await section(page), WITH('Beeson Logo'));
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
  });

  test(`the section Backdrop of the Slide pane follows an undo and a redo of Add Backdrop and of Delete (${platform})`, async () => {
    const page = await slidePage(platform);
    // the first content slide without a backdrop
    const index = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => !/\\b(title|section|closing|figure|split)\\b/.test(s.className) && !s.querySelector(':scope > .backdrop'))`);
    assert.ok(index > 0, 'the deck does not have a content slide without a backdrop');
    await page.evaluate(`Reveal.slide(${index})`);
    assert.deepEqual(await section(page), WITHOUT);
    await click(page, '#beeson-edit-panel-format .ed-sec button[data-command="backdrop.choose"]');
    await page.waitFor(`!!document.querySelector('.beeson-backdrop-gallery [data-tile="nest"]')`);
    await click(page, '.beeson-backdrop-gallery [data-tile="nest"]');
    assert.equal((await section(page)).pane, 'backdrop');
    await press(page, 'Escape');
    assert.deepEqual(await section(page), WITH('Lyapunov Families'));
    await exec(page, 'edit.undo');
    assert.deepEqual(await section(page), WITHOUT, 'after the undo of Add Backdrop');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    await exec(page, 'edit.redo');
    await press(page, 'Escape');
    assert.deepEqual(await section(page), WITH('Lyapunov Families'), 'after the redo of Add Backdrop');
    // Delete of the backdrop, selected from the pane, and its undo
    await click(page, '#beeson-edit-panel-format .ed-sec button[data-command="backdrop.select"]');
    await press(page, 'Delete');
    assert.deepEqual(await section(page), WITHOUT, 'after Delete of the backdrop');
    await exec(page, 'edit.undo');
    await press(page, 'Escape');
    assert.deepEqual(await section(page), WITH('Lyapunov Families'), 'after the undo of Delete');
  });
}
