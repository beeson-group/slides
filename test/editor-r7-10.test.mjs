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

// the controls of the chrome that may keep the keys after a click: the tabs Format and Steps at
// the head of the inspector, the tabs of the panes of an image, a check box of the Image pane, and
// the buttons and the zoom slider of the status bar. each is found by a test of its element b and
// its box r in the window, with the image selected first where image is set
const CONTROLS = [
  { name: 'the tab Format', find: "b.textContent.trim() === 'Format' && r.left > innerWidth * 0.7 && r.top > 80" },
  { name: 'the tab Steps', find: "b.textContent.trim() === 'Steps' && r.left > innerWidth * 0.7 && r.top > 80" },
  { name: 'the pane tab Image', find: "b.textContent.trim() === 'Image' && r.left > innerWidth * 0.7", image: true },
  { name: 'the pane tab Arrange', find: "b.textContent.trim() === 'Arrange' && r.left > innerWidth * 0.7", image: true },
  { name: 'the check box Decorative', find: "b.type === 'checkbox' && b.labels?.[0]?.textContent.trim() === 'Decorative'", image: true },
  { name: 'the button Fit', find: "b.textContent.trim() === 'Fit' && r.top > innerHeight - 60" },
  { name: 'the zoom slider', find: "b.type === 'range' && r.top > innerHeight - 60" },
  { name: 'the mode button', find: "b.getAttribute('aria-label') === 'Flip the mode of the slide' && r.top > innerHeight - 60", undo: true },
  { name: 'the button Next slide', find: "b.getAttribute('aria-label') === 'Next slide' && r.top > innerHeight - 60", back: true },
];

const controlOf = (page, find) => page.evaluate(`(() => {
  const b = [...document.querySelectorAll('button, input, select')].find((b) => { const r = b.getBoundingClientRect(); return r.width && (${find}); });
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// the declaration translate of the start tag of each image of the pair in the text of the editor
const translates = async (page) => {
  const text = await render(page);
  return [...text.matchAll(/<img class="for-(dark|light)"[^>]*>/g)].map((m) => [m[1], m[0].match(/translate: ([^;"]+)/)?.[1] ?? null]);
};

for (const platform of PLATFORMS) {
  for (const control of CONTROLS) {
    test(`a click on the image gives the keys to the slide after a click on ${control.name} (${platform})`, async (t) => {
      const page = await load(t, platform);
      if (control.image) {
        await click(page, IMG);
        await frames(page);
      }
      const at = await controlOf(page, control.find);
      assert.ok(at, `the window does not show ${control.name}`);
      await click(page, at);
      await frames(page);
      // the slide of the image again after Next slide, and the mode of the deck after the flip
      if (control.back) await page.evaluate(`Reveal.slide(${FIGURE})`);
      if (control.undo) await click(page, at);
      if (control.image && control.find.includes('checkbox')) await page.evaluate('window.BeesonEditor.undo()');
      await frames(page);
      const chrome = await focused(page);
      await click(page, IMG);
      await frames(page);
      assert.deepEqual(await selected(page), ['img.for-dark']);
      // ArrowRight nudges the image and its twin by one slide pixel
      await press(page, 'ArrowRight');
      await frames(page);
      assert.deepEqual(await translates(page), [['dark', '1px 0px'], ['light', '1px 0px']], `ArrowRight does not nudge the image, with the keys on ${chrome}`);
      assert.equal(await focused(page), 'body', `the keys stay on ${chrome} after a click on the image`);
      await page.evaluate('window.BeesonEditor.undo()');
      await byteExact(page);
      // Esc selects the figure, and Backspace deletes it
      await press(page, 'Escape');
      await frames(page);
      assert.deepEqual(await selected(page), ['figure.zone'], 'Esc does not select the figure of the image');
      await press(page, 'Backspace');
      await frames(page);
      assert.equal(await page.evaluate(`document.querySelectorAll(${js(IMG)}).length`), 0, 'Backspace does not delete the figure');
      await roundTrip(page);
    });
  }
}

// a press on a line or on the grip of its end, which the line module takes before the presses of
// the canvas, gives the keys to the slide as well
const LINE = '.reveal section.present svg.line';
const lineState = (page) => page.evaluate(`(() => {
  const svg = document.querySelector(${js(LINE)});
  const l = svg.querySelector('line');
  return { translate: svg.style.translate, x2: l.getAttribute('x2') };
})()`);

for (const platform of PLATFORMS) {
  for (const part of ['line', 'end grip']) {
    test(`a press on the ${part} of a line gives the keys to the slide after a click on the tab Format (${platform})`, async (t) => {
      const page = await load(t, platform);
      await exec(page, 'insert.arrow', { from: { x: 150, y: 960 }, to: { x: 650, y: 960 } });
      await frames(page);
      page.source = await render(page);
      const format = await controlOf(page, CONTROLS[0].find);
      await click(page, format);
      await frames(page);
      assert.match(await focused(page), /^button/);
      if (part === 'line') {
        await press(page, 'Escape');
        await click(page, format);
        const r = await page.evaluate(`(() => { const r = document.querySelector(${js(LINE)} + ' line').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await click(page, r);
      } else {
        const end = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-line-end')].find((g) => !g.hidden && g.dataset.end === '2' && g.getBoundingClientRect().width); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await drag(page, end, { dx: 20, dy: 0 });
      }
      await frames(page);
      assert.deepEqual(await selected(page), ['svg.line']);
      const before = await lineState(page);
      await press(page, 'ArrowRight');
      await frames(page);
      assert.notDeepEqual(await lineState(page), before, `ArrowRight does not nudge the line, with the keys on ${await focused(page)}`);
      assert.equal(await focused(page), 'body', 'the keys stay on the tab Format after a press on the line');
      await press(page, 'Backspace');
      await frames(page);
      assert.equal(await page.evaluate(`document.querySelectorAll(${js(LINE)}).length`), 0, 'Backspace does not delete the line');
      await roundTrip(page, part === 'line' ? 2 : 3);
    });
  }
}

// the start tags of the paragraph and of the pair of images of the figure slide
const P_TAG = '<p>Export your matplotlib figure';
const DARK_TAG = '<img class="for-dark" src="demo/figure-dark.png" alt="Zero-velocity curves of the Earth–Moon system, dark version">';
const LIGHT_TAG = '<img class="for-light" src="demo/figure-light.png" alt="Zero-velocity curves of the Earth–Moon system, light version">';
const withAttr = (tag, attr) => tag.replace(/>$/, ` ${attr}>`);
const theme = (page) => page.evaluate('document.documentElement.dataset.theme');
// the mode of the deck flipped by the button of the status bar
async function flipMode(page) {
  const was = await theme(page);
  await click(page, await controlOf(page, CONTROLS.find((c) => c.undo).find));
  await frames(page);
  assert.notEqual(await theme(page), was, 'the mode button does not flip the mode');
}

for (const platform of PLATFORMS) {
  test(`a group of an image and a paragraph is written on both images of the pair and holds in the other mode (${platform})`, async (t) => {
    const page = await load(t, platform);
    assert.equal(await theme(page), 'dark');
    await click(page, IMG);
    await click(page, PARA, { modifiers: 'Shift' });
    await frames(page);
    assert.deepEqual((await selected(page)).sort(), ['img.for-dark', 'p']);
    await press(page, platform === 'mac' ? 'Mod+Alt+G' : 'Mod+G');
    await frames(page);
    await byteExact(page, [[P_TAG, '<p data-group="g1">Export your matplotlib figure'], [DARK_TAG, withAttr(DARK_TAG, 'data-group="g1"')], [LIGHT_TAG, withAttr(LIGHT_TAG, 'data-group="g1"')]]);
    await roundTrip(page);
    // in light mode a click on the picture selects the group with the light image, and a drag
    // moves the paragraph and both images of the pair
    await page.evaluate(`Reveal.slide(${FIGURE})`);
    await flipMode(page);
    await click(page, IMG);
    await frames(page);
    assert.deepEqual((await selected(page)).sort(), ['img.for-light', 'p'], 'the click in light mode does not select the group');
    await drag(page, IMG, { dx: -60, dy: -40 });
    await frames(page);
    const text = await render(page);
    const tags = [...text.matchAll(/<(p|img) [^>]*data-group="g1"[^>]*>/g)].map((m) => [m[0].match(/for-(dark|light)/)?.[0] ?? 'p', m[0].match(/translate: ([^;"]+)/)?.[1] ?? null]);
    assert.equal(tags.length, 3, `the group is not written on three tags: ${js(tags)}`);
    assert.ok(tags.every(([, tr]) => tr && tr === tags[0][1]), `the drag in light mode does not move the whole group: ${js(tags)}`);
    await roundTrip(page);
  });

  test(`a lock of an image is written on both images of the pair and holds in the other mode (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    await frames(page);
    await press(page, 'Mod+L');
    await frames(page);
    await byteExact(page, [[DARK_TAG, withAttr(DARK_TAG, 'data-locked')], [LIGHT_TAG, withAttr(LIGHT_TAG, 'data-locked')]]);
    await roundTrip(page);
    await page.evaluate(`Reveal.slide(${FIGURE})`);
    await flipMode(page);
    await click(page, IMG);
    await drag(page, IMG, { dx: -80, dy: -100 });
    await frames(page);
    await byteExact(page);
    await press(page, 'ArrowLeft');
    await frames(page);
    await byteExact(page);
    // the unlock in light mode takes the lock off both images
    await exec(page, 'arrange.unlock');
    await frames(page);
    assert.ok(!(await render(page)).includes('data-locked'), 'the unlock in light mode leaves a lock in the file');
    await roundTrip(page);
  });

  test(`a flip of an image is written on both images of the pair, and its alt and Paper are not (${platform})`, async (t) => {
    const page = await load(t, platform);
    await click(page, IMG);
    await frames(page);
    await exec(page, 'arrange.flipHorizontal');
    await frames(page);
    await byteExact(page, [[DARK_TAG, DARK_TAG.replace('>', ' style="scale: -1 1">')], [LIGHT_TAG, LIGHT_TAG.replace('>', ' style="scale: -1 1">')]]);
    await roundTrip(page);
    // the alt, the mode, and Paper of the dark image are its own
    await page.evaluate(`Reveal.slide(${FIGURE})`);
    await click(page, IMG);
    await frames(page);
    await exec(page, 'figure.alt', 'Curves of the dark version');
    await exec(page, 'figure.paper');
    await frames(page);
    const text = await render(page);
    assert.ok(text.includes('<img class="for-light" src="demo/figure-light.png" alt="Zero-velocity curves of the Earth–Moon system, light version" style="scale: -1 1">'), 'the alt or Paper of the dark image is written on the light image');
    assert.ok(text.includes('<img class="for-dark paper" src="demo/figure-dark.png" alt="Curves of the dark version" style="scale: -1 1">'));
    assert.deepEqual(errors(page), []);
  });
}

// Delete and Cut of the image selected in its figure take the pair off, with the white space before
// each image, since the image of the other mode would be left alone in the figure
for (const platform of PLATFORMS) {
  // Cut is run as a command, since its key is left to the clipboard event of the browser
  for (const key of ['Backspace', 'edit.cut']) {
    test(`${key === 'Backspace' ? 'Delete' : 'Cut'} of an image takes both images of the pair off (${platform})`, async (t) => {
      const page = await load(t, platform);
      await click(page, IMG);
      await frames(page);
      assert.deepEqual(await selected(page), ['img.for-dark']);
      if (key === 'Backspace') await press(page, key);
      else await exec(page, key);
      await frames(page);
      await byteExact(page, [[`\n    ${DARK_TAG}\n    ${LIGHT_TAG}`, '']]);
      await roundTrip(page);
    });
  }
}
