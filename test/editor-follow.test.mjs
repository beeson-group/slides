// the file of the deck followed while the editor is open, on a copy of the demo deck that a test
// changes on disk, as an agent or a git pull does: the page is loaded again after a change without
// unsaved edits, a save merges the edits into a changed file, a card asks at a conflict, and the
// file is written again without a picker after a reload of the editor

import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';

const deckText = readFileSync('index.html', 'utf8');
const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';
// the page after a reload of its own, which a test marks before with window.__before
const reloaded = '!window.__before && !!window.BeesonEditor && window.BeesonEditor.status().blocks > 0';

function replaced(oldText, newText) {
  assert.equal(deckText.split(oldText).length, 2, `${oldText} is not unique in index.html`);
  return deckText.replace(oldText, newText);
}

// polls an expression across a navigation that the page starts itself
async function until(page, expression, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      if (await page.evaluate(expression)) return;
    } catch {
      // the document is being replaced
    }
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${expression}`);
    await new Promise((done) => setTimeout(done, 50));
  }
}

// a copy of the deck in a temporary folder, served with writes. the other files of the repository
// are linked
async function servedCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'beeson-deck-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const name of readdirSync('.')) {
    if (name !== 'index.html' && name !== 'node_modules' && name !== '.git') symlinkSync(resolve(name), join(dir, name));
  }
  const file = join(dir, 'index.html');
  writeFileSync(file, deckText);
  const server = await serve(dir, { writable: true });
  t.after(() => server.close());
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`${server.origin}/index.html?edit&still`);
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  await page.waitFor('window.BeesonEditor.status().blocks > 0');
  const edit = (from, to) => writeFileSync(file, readFileSync(file, 'utf8').replace(from, to));
  return { page, file, edit, disk: () => readFileSync(file, 'utf8') };
}

// a stand-in of a file handle of index.html, read from the server and written with a PUT, since a
// headless browser cannot be given a handle of a file on disk
const SERVED_HANDLE = `({
  name: 'index.html',
  getFile: async () => {
    const text = await (await fetch(location.href.split(/[?#]/)[0], { cache: 'no-store' })).text();
    return { lastModified: Date.now(), text: async () => text };
  },
  createWritable: async () => {
    let body = '';
    return { write: async (t) => { body = t; }, close: async () => { await fetch(location.href.split(/[?#]/)[0], { method: 'PUT', body }); } };
  },
})`;
const typeH2 = (from, to) => `(() => { const h = [...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(from)}); h.firstChild.data = ${JSON.stringify(to)}; h.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const slideOf = (h2) => `Reveal.getIndices([...document.querySelectorAll('.reveal h2')].find((h) => h.textContent === ${JSON.stringify(h2)}).closest('section')).h + 1`;
const h2s = `[...document.querySelectorAll('.reveal h2')].map((h) => h.textContent)`;
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

test('a change of the file without unsaved edits loads the page again, with the changed slide marked', async (t) => {
  const { page, edit } = await servedCopy(t);
  const slide = await page.evaluate(slideOf('Equations are first class citizens'));
  await page.evaluate('window.__before = true');
  edit('<h2>Equations are first class citizens</h2>', '<h2>Equations, by an agent</h2>');
  await until(page, reloaded);
  assert.ok((await page.evaluate(h2s)).includes('Equations, by an agent'));
  const s = await page.evaluate('window.BeesonEditor.status()');
  assert.deepEqual(s.changed, [slide]);
  assert.equal(s.message, `Loaded the changes of the file on slide ${slide}`);
  assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row.changed').length`), 1);
  assert.deepEqual(errors(page), []);
});

test('a save merges the edits into a file changed meanwhile, and loads the page again with both', async (t) => {
  const { page, edit, disk } = await servedCopy(t);
  await page.evaluate(`window.BeesonEditor.attach(${SERVED_HANDLE})`);
  const theirs = await page.evaluate(slideOf('Equations are first class citizens'));
  await page.evaluate(typeH2('Show your steps one at a time', 'Steps, by hand'));
  edit('<h2>Equations are first class citizens</h2>', '<h2>Equations, by an agent</h2>');
  // the change is named while the edits are not saved, and the page is not loaded again
  await until(page, 'window.BeesonEditor.status().stale !== null');
  let s = await page.evaluate('window.BeesonEditor.status()');
  assert.deepEqual([s.dirty, s.stale, s.changed], [true, [theirs], [theirs]]);
  assert.match(s.message, new RegExp(`The file was changed on slide ${theirs}, and a save merges your edits into it`));
  await page.evaluate('window.__before = true; window.BeesonEditor.save()');
  await until(page, reloaded);
  assert.equal(disk(), replaced('<h2>Show your steps one at a time</h2>', '<h2>Steps, by hand</h2>').replace('<h2>Equations are first class citizens</h2>', '<h2>Equations, by an agent</h2>'));
  const shown = await page.evaluate(h2s);
  assert.ok(shown.includes('Steps, by hand') && shown.includes('Equations, by an agent'));
  s = await page.evaluate('window.BeesonEditor.status()');
  assert.match(s.message, new RegExp(`^Saved 1 edit to index\\.html at \\d.*, merged with the changes of the file on slide ${theirs}$`));
  assert.deepEqual([s.dirty, s.changed], [false, [theirs]]);
  assert.deepEqual(errors(page), []);
});

test('a save of a text that the file changed too asks which to keep, and Cancel saves nothing', async (t) => {
  const { page, edit, disk } = await servedCopy(t);
  await page.evaluate(`window.BeesonEditor.attach(${SERVED_HANDLE})`);
  const slide = await page.evaluate(slideOf('Show your steps one at a time'));
  await page.evaluate(typeH2('Show your steps one at a time', 'Steps, by hand'));
  edit('<h2>Show your steps one at a time</h2>', '<h2>Steps, by an agent</h2>');
  edit('<h2>Equations are first class citizens</h2>', '<h2>Equations, by an agent</h2>');
  const both = disk();
  await until(page, 'window.BeesonEditor.status().stale !== null');
  const card = `(() => { const c = document.querySelector('dialog.beeson-edit-card.conflict'); return c && c.open ? { head: c.querySelector('h3').textContent, text: c.querySelector('p').textContent, buttons: [...c.querySelectorAll('button')].map((b) => b.textContent) } : null; })()`;
  const press = (label) => page.evaluate(`[...document.querySelectorAll('dialog.beeson-edit-card.conflict button')].find((b) => b.textContent === ${JSON.stringify(label)}).click()`);
  void page.evaluate('window.BeesonEditor.save()');
  await until(page, `${card} !== null`);
  const shown = await page.evaluate(card);
  assert.equal(shown.head, 'The file changed the texts that you edited');
  assert.match(shown.text, new RegExp(`^You edited texts on slide ${slide} that the file changed too`));
  assert.deepEqual(shown.buttons, ['Keep mine', "Keep the file's", 'Cancel']);
  assert.equal(await page.evaluate(`document.querySelector('.reveal .slides').inert`), true);
  await press('Cancel');
  await until(page, `${card} === null && !document.querySelector('.reveal .slides').inert`);
  assert.equal(disk(), both);
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).dirty, true);
  // Keep mine writes the edit of the page, and keeps the other change of the file
  void page.evaluate('window.__before = true; window.BeesonEditor.save()');
  await until(page, `${card} !== null`);
  await press('Keep mine');
  await until(page, reloaded);
  assert.equal(disk(), replaced('<h2>Show your steps one at a time</h2>', '<h2>Steps, by hand</h2>').replace('<h2>Equations are first class citizens</h2>', '<h2>Equations, by an agent</h2>'));
  assert.deepEqual(errors(page), []);
});

test('after a reload of the editor, the file of the deck is written again without a picker', async (t) => {
  const { page, edit } = await servedCopy(t);
  // the file of the handle stands for the served file, and both are changed, the served one first
  await page.evaluate(`(async () => {
    const root = await navigator.storage.getDirectory();
    window.BeesonEditor.attach(await root.getFileHandle('kept.html', { create: true }));
    await window.BeesonEditor.save();
  })()`);
  assert.equal((await page.evaluate('window.BeesonEditor.status()')).file, 'kept.html');
  await page.evaluate('window.__before = true');
  edit('<h2>Equations are first class citizens</h2>', '<h2>Equations, by an agent</h2>');
  const changed = replaced('<h2>Equations are first class citizens</h2>', '<h2>Equations, by an agent</h2>');
  await page.evaluate(`(async () => {
    const root = await navigator.storage.getDirectory();
    const w = await (await root.getFileHandle('kept.html')).createWritable();
    await w.write(${JSON.stringify(changed)});
    await w.close();
  })()`);
  await until(page, `${reloaded} && window.BeesonEditor.status().file === 'kept.html'`);
  const s = await page.evaluate('window.BeesonEditor.status()');
  assert.deepEqual([s.watching, s.dirty], [true, false]);
  assert.ok((await page.evaluate(h2s)).includes('Equations, by an agent'));
  assert.deepEqual(errors(page), []);
});
