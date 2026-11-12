// regression tests of R35.3 on both platforms. the row Flip Horizontal and Flip Vertical of the
// Arrange pane follows the picture of the selected figure while the pane is kept, i.e. at a flip of
// the mode and at an undo or a redo of Shown in Dark, as in a pane built fresh for the same figure.
// a paste of a QR code in the flow of the slide of its source is put after the last copy that is
// still in the slide, and a paste drawn on a source or a copy is moved on in steps of 20 px, also
// after a paste was undone or deleted and after a copy was nudged onto the next place of the flow.
// each paste is one entry of the history, and an undo, a redo, and a save are byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, editorPage, press, saveAndReopen } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const MOD = { mac: 4, other: 2 };

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
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${js(id)}).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const undoLabel = (page) => page.evaluate('window.BeesonEditor.state("edit.undo").label');
const undo = async (page) => {
  await page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  await frames(page);
};
const redo = async (page) => {
  await page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  await frames(page);
};

// item 1: the figure of one image on slide 2 of the deck, shown in both modes until Shown in Dark
const FIGURE = 'test/pages/editor-figure.html';
const IMG = 'section.present figure img';

async function figurePage(t, platform) {
  const page = await editorPage(browser, { deck: FIGURE, query: `edit&still&edit-platform=${platform}`, page: { width: 1600, height: 1000 }, clear: true });
  t.after(() => page.close().catch(() => {}));
  if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
  await page.evaluate('Reveal.slide(1)');
  await frames(page);
  return page;
}

// the shown pane of the Format tab, the headings of its shown sections, and the commands of its
// shown controls
const PANE = `(() => {
  const root = document.querySelector('#beeson-edit-panel-format .ed-panes');
  const shown = (el) => !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  return {
    pane: root?.dataset.pane ?? null,
    sections: [...(root?.querySelectorAll('.ed-sec') ?? [])].filter(shown).map((s) => s.querySelector(':scope > h5')?.textContent ?? ''),
    commands: [...(root?.querySelectorAll('[data-command]') ?? [])].filter(shown).map((b) => b.dataset.command),
  };
})()`;
const pane = async (page) => {
  await frames(page);
  return page.evaluate(PANE);
};
// the same after the Format tab is built again for the same selection
const fresh = async (page) => {
  await exec(page, 'shell.format');
  await exec(page, 'shell.format');
  return pane(page);
};
const flips = (p) => p.commands.filter((c) => c.startsWith('arrange.flip'));
const FLIPS = ['arrange.flipHorizontal', 'arrange.flipVertical'];
const shown = (page) => page.evaluate(`document.querySelector(${js(IMG)}).getBoundingClientRect().width > 0`);
const arrangeTab = async (page) => {
  await click(page, '#beeson-edit-panel-format .ed-tabs button:nth-child(2)');
  await frames(page);
  assert.equal((await pane(page)).pane, 'arrange');
};
const shownInDark = async (page) => {
  await click(page, '#beeson-edit-panel-format button[data-command="figure.mode.dark"]');
  await sleep(150);
  await frames(page);
};
const flipMode = async (page) => {
  await press(page, 'D');
  await sleep(150);
  await frames(page);
};

// asserts that the kept pane is the pane built fresh, with the row Flip when the image is shown
async function followed(page, image, what) {
  assert.equal(await shown(page), image, `the image is not ${image ? 'shown' : 'hidden'} ${what}`);
  const kept = await pane(page);
  assert.equal(kept.pane, 'arrange');
  assert.deepEqual(flips(kept), image ? FLIPS : [], `the row Flip of the kept Arrange pane does not follow the image ${what}: ${js(kept.commands)}`);
  assert.deepEqual(kept, await fresh(page), `the kept Arrange pane is not the pane built fresh ${what}`);
}

for (const platform of PLATFORMS) {
  test(`1: the row Flip of the Arrange pane is shown once a flip of the mode shows the image (${platform})`, async (t) => {
    const page = await figurePage(t, platform);
    await click(page, IMG);
    await frames(page);
    await shownInDark(page);
    await flipMode(page);
    await arrangeTab(page);
    await followed(page, false, 'in light mode after Shown in Dark');
    await flipMode(page);
    await followed(page, true, 'after the flip back to dark mode');
    // the button of the kept row flips the image
    await click(page, '#beeson-edit-panel-format button[data-command="arrange.flipHorizontal"]');
    await frames(page);
    assert.equal(await undoLabel(page), 'Undo Flip Horizontal');
    assert.deepEqual(errors(page), []);
  });

  test(`1: the row Flip of the Arrange pane follows an undo and a redo of Shown in Dark (${platform})`, async (t) => {
    const page = await figurePage(t, platform);
    await flipMode(page);
    await click(page, IMG);
    await frames(page);
    await shownInDark(page);
    await arrangeTab(page);
    await followed(page, false, 'in light mode after Shown in Dark');
    await press(page, 'Mod+Z');
    await sleep(200);
    await followed(page, true, 'after the undo of Shown in Dark');
    await press(page, 'Mod+Shift+Z');
    await sleep(200);
    await followed(page, false, 'after the redo of Shown in Dark');
    assert.deepEqual(errors(page), []);
  });

  test(`1: the row Flip of the Arrange pane is hidden once a flip of the mode hides the image (${platform})`, async (t) => {
    const page = await figurePage(t, platform);
    await click(page, IMG);
    await frames(page);
    await shownInDark(page);
    await arrangeTab(page);
    await followed(page, true, 'in dark mode after Shown in Dark');
    await flipMode(page);
    await followed(page, false, 'after the flip to light mode');
    assert.deepEqual(errors(page), []);
  });
}

// item 2: the deck of a QR code of 160 px in the flow of the slide, moved by a translate
const FLOW = 'test/pages/editor-r33-1.html';

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${FLOW}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(readFileSync(FLOW, 'utf8'))})`)).problems, []);
  await page.send('Page.bringToFront');
  await page.send('Browser.grantPermissions', { origin: server.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await page.evaluate('Reveal.slide(0)');
  await sleep(150);
  // copy and paste as trusted keys that carry the editing commands of the browser
  const key = async (k, code, kc, cmd) => {
    const e = { key: k, code, windowsVirtualKeyCode: kc, modifiers: MOD[platform] };
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...e, commands: [cmd] });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...e });
    await sleep(400);
    await frames(page);
  };
  const at = (x, y) => page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); const k = r.width / s.offsetWidth; return { x: r.left + ${x} * k, y: r.top + ${y} * k }; })()`);
  return {
    page,
    copy: async () => {
      await click(page, await at(1430, 500));
      await frames(page);
      assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((e) => e.style.translate)'), ['1300px 160px']);
      await key('c', 'KeyC', 67, 'copy');
    },
    paste: () => key('v', 'KeyV', 86, 'paste'),
    // the selection nudged by 10 px down n times
    down: async (n) => {
      for (let i = 0; i < n; i++) await press(page, 'Shift+ArrowDown');
      await sleep(1100);
      await frames(page);
    },
    // the drawn places of the QR codes of the slide in slide px, in the order of the file
    boxes: () => page.evaluate(`(() => { const s = document.querySelector('.reveal .slides'); const r = s.getBoundingClientRect(); const k = r.width / s.offsetWidth; return [...Reveal.getCurrentSlide().querySelectorAll(':scope > .qr')].map((e) => { const b = e.getBoundingClientRect(); return [b.left - r.left, b.top - r.top].map((v) => Math.round(v / k)); }); })()`),
  };
}

const twice = (list) => list.filter((x, i) => list.indexOf(x) !== i);

// asserts that the last action, labeled label, is one entry of the history from the text before,
// that an undo and a redo and a save and a reopen are byte for byte, and that the page logged no error
async function entry(page, before, label) {
  const done = await render(page);
  assert.equal(await undoLabel(page), `Undo ${label}`);
  await undo(page);
  assert.equal(await render(page), before, `one undo does not give the file back before the ${label}`);
  await redo(page);
  assert.equal(await render(page), done);
  const { text } = await saveAndReopen(page);
  assert.equal(text, done, 'the save differs from the text');
  assert.deepEqual(errors(page), []);
}

for (const platform of PLATFORMS) {
  // the case qrPasteUndoPaste of the second check of R33.1: the paste takes the place that the
  // undone paste freed, after the first copy, rather than the place of the first copy
  test(`2: a QR code in the flow pasted after an undone paste is not put on the first copy (${platform})`, async (t) => {
    const { page, copy, paste, boxes } = await load(t, platform);
    const [[x, y]] = await boxes();
    await copy();
    await paste();
    await paste();
    assert.deepEqual(await boxes(), [[x, y], [x, y + 160], [x, y + 320]]);
    await undo(page);
    const before = await render(page);
    await paste();
    const p = await boxes();
    assert.deepEqual(twice(p.map(js)), [], `a paste after an undone paste lands on the first copy: ${js(p)}`);
    assert.deepEqual(p, [[x, y], [x, y + 160], [x, y + 320]]);
    await entry(page, before, 'Paste');
  });

  // the case qrPasteDeletePaste of the same check: the second copy deleted in place of the undo
  test(`2: a QR code in the flow pasted after a deleted copy is not put on the first copy (${platform})`, async (t) => {
    const { page, copy, paste, boxes } = await load(t, platform);
    const [[x, y]] = await boxes();
    await copy();
    await paste();
    await paste();
    await press(page, 'Delete');
    await frames(page);
    assert.deepEqual(await boxes(), [[x, y], [x, y + 160]]);
    const before = await render(page);
    await paste();
    const p = await boxes();
    assert.deepEqual(twice(p.map(js)), [], `a paste after a deleted copy lands on the first copy: ${js(p)}`);
    assert.deepEqual(p, [[x, y], [x, y + 160], [x, y + 320]]);
    await entry(page, before, 'Paste');
  });

  // the case qrPasteOntoNext of the same check: the copy nudged 160 px down onto the next place of
  // the flow, then a paste, which goes after the copy and is moved on 20 px past it
  test(`2: a QR code in the flow pasted after the copy was nudged onto the next place is not put on it (${platform})`, async (t) => {
    const { page, copy, paste, down, boxes } = await load(t, platform);
    const [[x, y]] = await boxes();
    await copy();
    await paste();
    assert.deepEqual(await boxes(), [[x, y], [x, y + 160]]);
    await down(16);
    assert.deepEqual(await boxes(), [[x, y], [x, y + 320]]);
    const before = await render(page);
    await paste();
    const p = await boxes();
    assert.deepEqual(twice(p.map(js)), [], `a paste after the copy was nudged onto the next place lands on it: ${js(p)}`);
    assert.deepEqual(p, [[x, y], [x, y + 320], [x + 20, y + 340]]);
    await entry(page, before, 'Paste');
  });

  // the places of today stay: two pastes go under the source in the order of the file
  test(`3: a QR code in the flow pasted twice keeps the places of today (${platform})`, async (t) => {
    const { page, copy, paste, boxes } = await load(t, platform);
    const [[x, y]] = await boxes();
    await copy();
    await paste();
    const before = await render(page);
    await paste();
    assert.deepEqual(await boxes(), [[x, y], [x, y + 160], [x, y + 320]]);
    await entry(page, before, 'Paste');
  });
}
