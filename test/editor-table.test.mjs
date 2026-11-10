// the tables of the editor: the rows of a table without a tbody tag, inserted and removed through
// the model of the document, are written in their place, and an undo gives the file byte for byte

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact } from './helpers/editor.mjs';

const LAYOUTS_DECK = 'test/pages/editor-layouts.html';

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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const js = (v) => JSON.stringify(v);

async function open(platform, deck = 'index.html') {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(status.problems, []);
  page.platform = platform;
  return page;
}

const LAYOUT_ROWS = [
  '<tr><th>Family</th><th>Period</th></tr>',
  '<tr><td>Lyapunov</td><td>\\(2.69\\)</td></tr>',
  '<tr class="fragment" data-fragment-index="1"><td>Halo</td><td>\\(3.41\\)</td></tr>',
];
const layoutTable = (rows) => `<table>\n${rows.map((r) => `    ${r}\n`).join('')}  </table>`;

// the white space before the first row of a table without a tbody tag is in the table, before the
// tbody of the page, and a row inserted into that tbody was written on the line of the row before
test('a row inserted into a table without a tbody tag is written on a line of its own', async (t) => {
  const page = await open('mac', LAYOUTS_DECK);
  t.after(() => page.close?.());
  const tbody = `document.querySelector('.reveal .slides table').tBodies[0]`;
  await page.evaluate(`window.BeesonEditor.doc.insert('<tr><td>Axial</td><td></td></tr>', ${tbody}, null)`);
  await page.evaluate(`window.BeesonEditor.doc.insert('<tr><td>Vertical</td><td></td></tr>', ${tbody}, ${tbody}.rows[1])`);
  await byteExact(page, [[layoutTable(LAYOUT_ROWS), layoutTable([LAYOUT_ROWS[0], '<tr><td>Vertical</td><td></td></tr>', ...LAYOUT_ROWS.slice(1), '<tr><td>Axial</td><td></td></tr>'])]]);
  await page.evaluate('window.BeesonEditor.undo()');
  await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
});
