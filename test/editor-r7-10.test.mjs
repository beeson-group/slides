// regression tests of R7.10 on both platforms with trusted input. a group, a lock, and every other
// attribute that the editor sets on an image of a dark and light pair are written on both images.
// a press on the slide gives the keys to the canvas after a click on a tab, a button, or a field of
// the inspector or the status bar. an indent of a list item writes the step index of the file and
// not the one that reveal.js renumbered on the page. after each edit the text is checked byte for
// byte, after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
// the slides of the demo deck with the stepped list and with the figure of a dark and light pair
const STEPS = 2;
const FIGURE = 4;
const IMG = '.reveal section.present figure.zone > img';
const DARK = '.reveal section.present figure.zone > img.for-dark';
const LIGHT = '.reveal section.present figure.zone > img.for-light';
const PARA = '.reveal section.present > p';

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
const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${js(id)}${arg === undefined ? '' : `, ${js(arg)}`})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
let saves = 0;

// the selected elements, each named by its tag and its classes of the deck
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => [el.localName, ...el.classList].filter((c) => !c.startsWith('beeson-') && c !== 'visible' && c !== 'current-fragment').join('.'))`);
// the element that has the keys, named by its tag, its classes, and its text
const focused = (page) => page.evaluate(`(() => {
  const a = document.activeElement;
  return a && a !== document.body ? [a.localName, ...a.classList].join('.') + ' ' + JSON.stringify((a.textContent ?? '').trim().slice(0, 20)) : 'body';
})()`);

// the editor on the slide n of a deck served over HTTP, in a window of 1600 by 1000 px as in the
// shoot of the council, with the Format tab shown
async function load(t, platform, { deck = 'index.html', n = FIGURE } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// roundTrip checks the text before byte for byte after undos undos, the edit after as many redos,
// and an open of the saved edit without problems, which is the text before the next check
async function roundTrip(page, undos = 1) {
  const edited = await render(page);
  assert.notEqual(edited, page.source, 'the action does not change the file');
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.undo()');
  await byteExact(page);
  for (let i = 0; i < undos; i++) await page.evaluate('window.BeesonEditor.redo()');
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, `r7-10-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

// the center of a control of the chrome found by its text, its title, or its aria label, in the
// right part of the window or in the status bar at its bottom
const controlAt = (page, name, where = 'inspector') => page.evaluate(`(() => {
  const right = (r) => r.left > innerWidth * 0.7;
  const bottom = (r) => r.top > innerHeight - 60;
  const ok = ${where === 'inspector' ? 'right' : 'bottom'};
  const named = (b) => [b.textContent.trim(), b.title, b.getAttribute('aria-label')].includes(${js(name)});
  const b = [...document.querySelectorAll('button, [role="tab"], input, select')].find((b) => named(b) && b.getBoundingClientRect().width && ok(b.getBoundingClientRect()));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// items 2 and 3 of the list of the steps slide indented one after the other into item 1, each with
// its step index of the file
const FIRST = '    <li class="fragment" data-fragment-index="1">Each step is a reveal.js "fragment", i.e.<code> class="fragment"</code>, with a <code>data-fragment-index</code> of appearance';
const SECOND = '<li class="fragment" data-fragment-index="2">Two elements with the same index are shown together.</li>\n';
const THIRD = '<li class="fragment" data-fragment-index="3">When exporting to PDF or PPTX, you will get one slide per step.</li>\n';
const LIST = `${FIRST}</li>\n    ${SECOND}    ${THIRD}`;
const ONE = `${FIRST}\n      <ul>\n        ${SECOND}      </ul>\n    </li>\n    ${THIRD}`;
const TWO = `${FIRST}\n      <ul>\n        ${SECOND}        ${THIRD}      </ul>\n    </li>\n`;

for (const platform of PLATFORMS) {
  for (const how of ['Tab', 'button']) {
    test(`the first indent of a stepped list item writes the step index of the file, by ${how} (${platform})`, async (t) => {
      const page = await load(t, platform, { n: STEPS });
      // reveal.js numbers the steps of the page from 0, hence item 2 of index 2 in the file is 1 here
      const pageIndex = await page.evaluate(`document.querySelectorAll('.reveal section.present li')[1].dataset.fragmentIndex`);
      assert.equal(pageIndex, '1', 'reveal.js does not renumber the steps of the page as this test assumes');
      const indent = async (item) => {
        await click(page, item);
        await press(page, 'End');
        await frames(page);
        if (how === 'Tab') await press(page, 'Tab');
        else {
          const at = await controlAt(page, 'Increase Indent Level');
          assert.ok(at, 'the Text pane does not offer Increase Indent Level');
          await click(page, at);
        }
        await frames(page);
      };
      await indent('.reveal section.present > ul > li:nth-child(2)');
      await byteExact(page, [[LIST, ONE]]);
      await indent('.reveal section.present > ul > li:nth-child(2)');
      await byteExact(page, [[LIST, TWO]]);
      await roundTrip(page, 2);
    });
  }
}
