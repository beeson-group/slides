// regression tests of R8.2 on both platforms with trusted input. the text of a panel fitted by a
// change of layout to Split is drawn in the color of the panel. the rotate grip of a selected
// element is drawn on a stem above the top center of its frame, outside its text, and the handle
// of a block is drawn clear of the grips. a group is turned by its own rotate grip and by the field
// Angle of the Arrange pane, each member about the center of the group. a thumbnail of the
// navigator is drawn only from typeset formulas. after each edit the text is checked byte for byte,
// after an undo and a redo, and after a save and an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
// the slide of the demo deck with the figure and its caption, under a paragraph and over a list
const FIGURE = 4;
const IMG = '.reveal section.present figure.zone > img';
const PANEL = '#beeson-edit-panel-format';

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
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
let saves = 0;

// the editor on the slide n of the demo deck served over HTTP, in a window of 1600 by 1000 px as
// in the shoot of the council, in the mode of the slides given, with the Format tab shown. with
// watch set, every drawing of a thumbnail is checked for raw TeX from before the open on
async function load(t, platform, { n = FIGURE, mode = 'dark', watch = false } = {}) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  const url = `${server.origin}/index.html?edit&still&theme=${mode}&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  if (watch) await page.evaluate(WATCH);
  page.source = readFileSync('index.html', 'utf8');
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
  const { text } = await saveAndReopen(page, `r8-2-${++saves}.html`);
  assert.equal(text, edited);
  assert.deepEqual(errors(page), []);
  page.source = text;
  return edited;
}

const release = (page, at) => page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });

// finding 1: Change Layout to Split set the panel text in the style Small, which the theme colors
// gray for a note on a white or black slide, and thus drew it gray on the black panel
for (const platform of PLATFORMS) {
  for (const mode of ['dark', 'light']) {
    test(`the text of a panel fitted by Change Layout to Split is drawn in the color of the panel in ${mode} mode (${platform})`, async (t) => {
      const page = await load(t, platform, { mode });
      await exec(page, 'slide.layout.split');
      await sleep(300);
      await frames(page);
      const seen = await page.evaluate(`(() => {
        const panel = document.querySelector('.reveal section.present > .panel');
        const small = [...panel.querySelectorAll('.small')];
        const texts = [...small, ...small.flatMap((s) => [...s.querySelectorAll('li')])];
        return { panel: getComputedStyle(panel).color, small: small.length, colors: texts.map((e) => [e.localName, e.textContent.trim().slice(0, 24), getComputedStyle(e).color]) };
      })()`);
      assert.ok(seen.small > 0, 'the text of the panel is not fitted with the style Small');
      for (const [tag, words, color] of seen.colors) assert.equal(color, seen.panel, `the ${tag} "${words}" of the fitted panel is drawn in ${color}, and not in ${seen.panel} as the panel`);
      assert.equal(seen.panel, 'rgb(242, 242, 239)', 'the text color of the panel is not #f2f2ef');
      await roundTrip(page);
    });
  }
}
