// the seams of the editor: the deck with every layout is paired and written back byte for byte,
// the commands of the registry are run and read by their ids, and the keys sent as trusted input
// reach the commands on either platform

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, editorPage, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';

test('every block of the deck with every layout is paired, and the deck is written back byte for byte', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser, { deck: LAYOUTS });
  const status = await page.evaluate('window.BeesonEditor.status()');
  assert.ok(status.blocks > 40, `${status.blocks} blocks`);
  assert.equal(status.sections, (page.source.match(/<section/g) ?? []).length);
  await byteExact(page);
  assert.deepEqual(page.errors, []);
});

test('a command is run and read by its id, and an unknown id is an error', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser, { deck: LAYOUTS });
  assert.deepEqual(await page.evaluate(`window.BeesonEditor.state('edit.undo')`), { id: 'edit.undo', label: 'Undo', enabled: false, checked: null });
  assert.equal((await page.evaluate(`window.BeesonEditor.state('file.autosave')`)).checked, false);
  await page.evaluate(`window.BeesonEditor.exec('file.autosave')`);
  assert.equal((await page.evaluate(`window.BeesonEditor.state('file.autosave')`)).checked, true);
  await page.evaluate(`window.BeesonEditor.exec('view.notes')`);
  assert.equal(await page.evaluate(`document.documentElement.classList.contains('beeson-notes')`), true);
  await assert.rejects(page.evaluate(`window.BeesonEditor.exec('no.such')`), /there is no command no\.such/);
  await assert.rejects(page.evaluate(`window.BeesonEditor.state('no.such')`), /there is no command no\.such/);
  assert.deepEqual(page.errors, []);
});

for (const platform of ['mac', 'other']) {
  test(`typed text is undone and redone with the keys of the platform ${platform}`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await editorPage(browser, { deck: LAYOUTS, query: `edit&still&edit-platform=${platform}` });
    await page.evaluate(`Reveal.slide(2)`);
    await click(page, '.reveal section.present > h2');
    await press(page, 'End');
    await type(page, ' now');
    const edit = ['<h2>Text, a list, and a backdrop</h2>', '<h2>Text, a list, and a backdrop now</h2>'];
    await byteExact(page, [edit]);
    assert.deepEqual(await page.evaluate(`window.BeesonEditor.state('edit.undo')`), { id: 'edit.undo', label: 'Undo', enabled: true, checked: null });
    await press(page, 'Mod+Z');
    await page.waitFor(`!window.BeesonEditor.status().undo`);
    await byteExact(page);
    await press(page, 'Mod+Shift+Z');
    await page.waitFor(`!window.BeesonEditor.status().redo`);
    await byteExact(page, [edit]);
    assert.deepEqual(page.errors, []);
  });
}

test('a deck with every layout is saved and opened again without a problem', async (t) => {
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const server = await serve('.');
  t.after(() => server.close());
  const page = await browser.newPage();
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still`);
  await page.waitFor('window.Reveal?.isReady() && window.BeesonEditor && window.BeesonEditor.ready.then(() => window.BeesonEditor.status().state === "loaded")');
  await page.evaluate(`document.querySelector('.reveal .slides p.caption').firstChild.data = 'An edited caption.'`);
  const { text } = await saveAndReopen(page, 'layouts.html');
  assert.ok(text.includes('<p class="caption">An edited caption.</p>'));
  assert.deepEqual(page.errors.filter((e) => !e.includes('favicon.ico')), []);
});

// a handle whose write takes ms, so that an edit can be made while the file is written
const slowHandle = (ms) => `window.BeesonEditor.attach({
  name: 'slow.html',
  createWritable: async () => ({
    write: async (text) => { await new Promise((done) => setTimeout(done, ${ms})); window.__written = text; },
    close: async () => {},
  }),
})`;

test('an edit made while the file is written keeps the deck dirty after both edits are undone', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser, { deck: LAYOUTS });
  await page.evaluate(`Reveal.slide(2)`);
  await page.evaluate(slowHandle(400));
  await click(page, '.reveal section.present > h2');
  await press(page, 'End');
  await type(page, ' A');
  await page.evaluate(`window.__save = window.BeesonEditor.save(), true`);
  await click(page, '.reveal section.present > p.small');
  await press(page, 'End');
  await type(page, ' B');
  await page.evaluate('window.__save');
  const editA = ['<h2>Text, a list, and a backdrop</h2>', '<h2>Text, a list, and a backdrop A</h2>'];
  assert.equal(await page.evaluate('window.__written'), page.source.replace(...editA));
  await page.evaluate('window.BeesonEditor.undo()');
  const afterB = await page.evaluate('window.BeesonEditor.status()');
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  // the file on disk has edit A, which the page no longer has
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, true);
  // with edit B undone, the page reads as the file on disk again
  assert.equal(afterB.dirty, false);
  assert.deepEqual(page.errors, []);
});

test('an error in the render of a draft is caught and shown in the status line', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser, { deck: LAYOUTS });
  await page.evaluate(`Reveal.slide(2)`);
  await click(page, '.reveal section.present > h2');
  await press(page, 'End');
  await type(page, ' A');
  await page.evaluate(`MathJax.startup.document.getMathItemsWithin = () => { throw new Error('the render broke'); }`);
  await page.waitFor(`/the render broke/.test(window.BeesonEditor.status().message)`, 3000);
  assert.match((await page.evaluate('window.BeesonEditor.status()')).message, /could not be kept in this browser/);
  assert.deepEqual(page.errors, []);
});
