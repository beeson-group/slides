// Drives the in-place editor in Firefox or Safari over WebDriver, with trusted keys and pointer
// actions, and prints one line per check with pass, fail, or skip and what it measured.
//
//   node scripts/check-editor.mjs --browser firefox|safari [--only <part of a check name>]
//
// The deck is served from a local port, since Safari refuses a page from file:// under automation.
// The checks cover Present and the show in place, the speaker view, and a smoke pass of the main
// gestures. After each change and its undo, the text written by the editor must be the file. The
// script exits nonzero when a check fails.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { deckSettled } from './chrome.mjs';
import { launch, serve } from './webdriver.mjs';

const { values: options } = parseArgs({ options: { browser: { type: 'string', default: 'firefox' }, only: { type: 'string' } } });
const DECK = 'index.html';
const SOURCE = readFileSync(DECK, 'utf8');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const js = (v) => JSON.stringify(v);

// the code points of WebDriver for the named keys and the modifiers
const KEYS = {
  Enter: '', Escape: '', Tab: '', Backspace: '', Delete: '', Space: ' ',
  ArrowLeft: '', ArrowUp: '', ArrowRight: '', ArrowDown: '',
  Shift: '', Ctrl: '', Alt: '', Meta: '',
};

const browser = await launch(options.browser);
const server = await serve('.');
const session = browser.session;
const page = browser.newPage();
// the value of edit-platform, which sets whether Mod is the Command key or Ctrl
let platform = 'mac';
const results = [];

const evaluate = (expression) => page.evaluate(expression);
const waitFor = (expression, wait = 15000) => page.waitFor(expression, wait);
const within = (expression, wait) => waitFor(expression, wait).then(() => true, () => false);
const frames = () => evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

const modifiers = (names) => names.map((m) => KEYS[m === 'Mod' ? (platform === 'mac' ? 'Meta' : 'Ctrl') : m]);
async function perform(actions) {
  await session('POST', '/actions', { actions });
  await session('DELETE', '/actions');
}

/** A trusted press of a key string, e.g. 'Mod+Z', 'Shift+ArrowUp', 'Escape', or 'e'. */
async function press(keys) {
  const names = keys.split('+');
  const name = names.pop();
  const mods = modifiers(names);
  const key = KEYS[name] ?? name;
  await perform([{
    type: 'key',
    id: 'keys',
    actions: [
      ...mods.map((value) => ({ type: 'keyDown', value })),
      { type: 'keyDown', value: key },
      { type: 'keyUp', value: key },
      ...mods.reverse().map((value) => ({ type: 'keyUp', value })),
    ],
  }]);
}

/** Trusted typing of text, one key per character. */
async function type(text) {
  await perform([{ type: 'key', id: 'keys', actions: [...text].flatMap((value) => [{ type: 'keyDown', value }, { type: 'keyUp', value }]) }]);
}

async function centerOf(selector) {
  const point = await evaluate(`(() => {
    const r = [...document.querySelectorAll(${js(selector)})].map((el) => el.getBoundingClientRect()).find((r) => r.width && r.height);
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  })()`);
  if (!point) throw new Error(`nothing is shown at ${selector}`);
  return point;
}

const move = (x, y, duration = 0) => ({ type: 'pointerMove', x: Math.round(x), y: Math.round(y), origin: 'viewport', duration });

// the pointer actions of a gesture, with the modifiers held down by a key source over the same ticks
async function pointer(steps, mods = []) {
  const keys = modifiers(mods);
  const pause = { type: 'pause', duration: 0 };
  await perform([
    { type: 'key', id: 'keys', actions: [...keys.map((value) => ({ type: 'keyDown', value })), ...steps.map(() => pause), ...keys.map((value) => ({ type: 'keyUp', value }))] },
    { type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [...keys.map(() => pause), ...steps, ...keys.map(() => pause)] },
  ]);
}

/** A trusted click at a point or at the center of a selector, with a button and a click count. */
async function click(at, { button = 0, count = 1, mods = [] } = {}) {
  const { x, y } = typeof at === 'string' ? await centerOf(at) : at;
  const clicks = Array.from({ length: count }, () => [{ type: 'pointerDown', button }, { type: 'pointerUp', button }]).flat();
  await pointer([move(x, y), ...clicks], mods);
}

/** A trusted drag from a point or a selector by dx and dy in CSS px, in steps moves. */
async function drag(from, { dx = 0, dy = 0, steps = 10, mods = [] } = {}) {
  const { x, y } = typeof from === 'string' ? await centerOf(from) : from;
  const moves = Array.from({ length: steps }, (_, i) => move(x + (dx * (i + 1)) / steps, y + (dy * (i + 1)) / steps, 16));
  await pointer([move(x, y), { type: 'pointerDown', button: 0 }, ...moves, { type: 'pause', duration: 50 }, { type: 'pointerUp', button: 0 }], mods);
}

const handles = () => session('GET', '/window/handles');

// load opens the editor on slide n of the deck, with the storage of the browser cleared
async function load(n = 0, { query = 'edit&still&theme=light' } = {}) {
  const url = `${server.origin}/${DECK}?${query}&edit-platform=${platform}`;
  await page.goto(`${server.origin}/${DECK}?still`);
  await evaluate('(localStorage.clear(), true)');
  await page.goto(url);
  await waitFor(deckSettled, 30000);
  await waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)', 30000);
  const s = await evaluate(`window.BeesonEditor.open(${js(SOURCE)})`);
  if (s.problems.length) throw new Error(`blocks not paired: ${js(s.problems)}`);
  if (n) await evaluate(`(Reveal.slide(${n}), true)`);
  await frames();
}

const render = () => evaluate('window.BeesonEditor.render()');
async function byteExact(what) {
  const text = await render();
  if (text !== SOURCE) throw new Error(`${what}: the text differs from the file at character ${[...text].findIndex((c, i) => c !== SOURCE[i])}`);
}

// SHOW is the window of the show in place, i.e. of the frame in .beeson-edit-show
const SHOW = `document.querySelector('.beeson-edit-show iframe')?.contentWindow`;
const showReady = `(() => { try { const w = ${SHOW}; if (!w?.Reveal?.isReady()) return false; return !w.MathJax || (w.MathJax.startup?.promise?.then(() => true) ?? false); } catch { return false; } })()`;
const stageGone = `!document.querySelector('.beeson-edit-show')`;
const showHeading = () => evaluate(`${SHOW}.Reveal.getCurrentSlide().querySelector('h1, h2').textContent.trim()`);
const editorHeading = () => evaluate(`Reveal.getCurrentSlide().querySelector('h1, h2').textContent.trim()`);
// stageLook reads whether the show is full screen, fills the window, or neither
const stageLook = `(() => {
  const el = document.querySelector('.beeson-edit-show');
  const full = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  if (full === el) return 'full screen';
  const r = el.querySelector('iframe').getBoundingClientRect();
  return r.left === 0 && r.top === 0 && Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1 ? 'fills the window' : 'smaller than the window ' + [r.width, r.height, innerWidth, innerHeight].join(',');
})()`;

async function check(name, fn) {
  if (options.only && !name.includes(options.only)) return;
  let line;
  try {
    const measured = await fn();
    line = measured?.skip ? ['skip', measured.skip] : ['pass', measured ?? ''];
  } catch (error) {
    line = ['fail', String(error.message ?? error).split('\n')[0]];
    // the next check starts from a single window
    for (const h of (await handles().catch(() => [])).slice(1)) {
      await session('POST', '/window', { handle: h }).then(() => session('DELETE', '/window')).catch(() => {});
    }
    const [first] = await handles().catch(() => []);
    if (first) await session('POST', '/window', { handle: first }).catch(() => {});
  }
  results.push([name, ...line]);
  console.log(`${line[0].padEnd(4)}  ${name}${line[1] ? `: ${line[1]}` : ''}`);
}

function expect(ok, message) {
  if (!ok) throw new Error(message);
}

// present starts the show by Mod+Enter or by the Present button, asserts that a window is not
// opened, and returns how the stage is shown
async function present(how) {
  const before = (await handles()).length;
  if (how === 'button') await click('.beeson-edit-top [data-command="file.present"]');
  else await press('Mod+Enter');
  await waitFor(showReady, 30000);
  await sleep(300);
  const after = (await handles()).length;
  expect(after === before, `a new window is opened (${before} to ${after})`);
  return evaluate(stageLook);
}

try {
  for (const [p, how] of [['mac', 'button'], ['mac', 'key'], ['other', 'key']]) {
    platform = p;
    await check(`present: ${how === 'button' ? 'the Present button' : p === 'mac' ? 'Cmd+Enter' : 'Ctrl+Enter'} plays the deck in place (${p})`, async () => {
      await load(2);
      const look = await present(how);
      expect(look !== null && !look.startsWith('smaller'), `the show is ${look}`);
      const heading = await showHeading();
      expect(heading === 'Show your steps one at a time', `the show opens at ${heading}`);
      await press('Escape');
      await waitFor(stageGone, 5000);
      return `in a frame over the editor, ${look}`;
    });
  }

  platform = 'mac';
  await check('present: ArrowRight, Space, and ArrowLeft play the steps, o opens the overview, d flips the mode', async () => {
    await load(2);
    await present('key');
    const f = () => evaluate(`${SHOW}.Reveal.getIndices().f ?? -1`);
    const seen = [await f()];
    for (const key of ['ArrowRight', 'Space', 'ArrowLeft']) {
      await press(key);
      await sleep(300);
      seen.push(await f());
    }
    expect(js(seen) === js([-1, 0, 1, 0]), `the steps are ${js(seen)}, and not [-1,0,1,0]`);
    await press('o');
    const overview = await within(`${SHOW}.Reveal.isOverview()`, 3000);
    await press('o');
    const closed = await within(`!${SHOW}.Reveal.isOverview()`, 3000);
    expect(overview && closed, `o: overview opened ${overview}, closed ${closed}`);
    const mode = () => evaluate(`${SHOW}.document.documentElement.dataset.theme`);
    const m0 = await mode();
    await press('d');
    await sleep(500);
    const m1 = await mode();
    expect(m0 !== m1, `d leaves the mode at ${m0}`);
    await press('Escape');
    await waitFor(stageGone, 5000);
    return `steps ${js(seen)}, overview opened and closed, mode ${m0} to ${m1}`;
  });

  for (const key of ['Escape', 'e']) {
    await check(`present: ${key === 'e' ? 'e' : 'Esc'} ends the show at the slide shown last`, async () => {
      await load(2);
      await present('key');
      await evaluate(`(${SHOW}.Reveal.slide(4), true)`);
      await sleep(400);
      const shown = await showHeading();
      await press(key);
      expect(await within(stageGone, 5000), `${key} does not end the show`);
      const at = await editorHeading();
      expect(at === shown, `the editor is at ${at}, and the show was at ${shown}`);
      expect(await evaluate('!document.fullscreenElement'), 'the window is still full screen');
      await byteExact('after the show');
      return `at ${at}`;
    });
  }

  await check('present: with unsaved changes, Present asks first, then plays the saved file', async () => {
    await load(2);
    await evaluate(`(window.BeesonEditor.exec('slide.hide'), true)`);
    await press('Mod+Enter');
    const asked = await within(`[...document.querySelectorAll('dialog[open] button')].some((b) => b.textContent === 'Present the saved file')`, 5000);
    expect(asked, 'Present does not ask first');
    const at = await evaluate(`(() => { const r = [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent === 'Present the saved file').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(at);
    await waitFor(showReady, 30000);
    const look = await evaluate(stageLook);
    await press('Escape');
    await waitFor(stageGone, 5000);
    expect(await evaluate('window.BeesonEditor.status().dirty'), 'the edit is lost');
    await evaluate('window.BeesonEditor.undo()');
    await byteExact('after the undo');
    return `asked, then played in place, ${look}`;
  });

  for (const p of ['mac', 'other']) {
    platform = p;
    await check(`present: after the show, the arrow keys nudge a selected block and Mod+Z undoes, without a click (${p})`, async () => {
      await load(2);
      await click('.reveal section.present > p');
      await press('Escape');
      const sel = await evaluate('window.BeesonEditor.selection().map((e) => e.localName).join()');
      expect(sel === 'p', `the selection is ${sel}`);
      await present('key');
      await press('Escape');
      await waitFor(stageGone, 5000);
      await sleep(300);
      await press('ArrowRight');
      await frames();
      const style = await evaluate(`document.querySelector('.reveal section.present > p').getAttribute('style')`);
      expect(/translate/.test(style ?? ''), `ArrowRight does not nudge the block (style ${style}, focus on ${await evaluate('document.activeElement?.localName')})`);
      await press('Mod+Z');
      await frames();
      await byteExact('after Mod+Z');
      return `nudged to ${style}, undone`;
    });
  }
  platform = 'mac';

  // speakerOpen presses s in the show, and returns the window handles once the speaker view is
  // opened, or null when the browser does not open it
  const speakerOpen = async () => {
    await sleep(500);
    await press('s');
    for (let i = 0; i < 50 && (await handles()).length < 2; i++) await sleep(200);
    const all = await handles();
    return all.length > 1 ? all : null;
  };
  const speakerReady = `(() => { try { return !!document.querySelector('#current-slide iframe')?.contentWindow?.Reveal?.isReady?.(); } catch { return false; } })()`;
  const closedBy = async (speaker) => {
    for (let i = 0; i < 25; i++) {
      if (!(await handles()).includes(speaker)) return true;
      await sleep(200);
    }
    return false;
  };
  for (const key of ['e', 'Escape']) {
    await check(`speaker view: ${key === 'e' ? 'e' : 'Esc'} in the speaker view ends the show, returns to the editor, and closes the speaker view`, async () => {
      await load(2);
      await present('key');
      await evaluate(`(${SHOW}.Reveal.slide(3), true)`);
      await sleep(400);
      const shown = await showHeading();
      const all = await speakerOpen();
      if (!all) return { skip: 'the popup of the speaker view is not opened under WebDriver' };
      const [main, speaker] = all;
      await session('POST', '/window', { handle: speaker });
      await waitFor(speakerReady, 20000);
      await sleep(500);
      await press(key);
      const closed = await closedBy(speaker);
      await session('POST', '/window', { handle: main });
      const ended = await within(stageGone, 5000);
      const at = await editorHeading();
      expect(ended, `${key} in the speaker view does not end the show`);
      expect(at === shown, `the editor is at ${at}, and the show was at ${shown}`);
      expect(closed, 'the speaker view is left open');
      return `ended at ${at}, speaker view closed`;
    });
  }

  await check('speaker view: e in the speaker view of a deck opened by itself opens the editor in its window, and closes the speaker view', async () => {
    await page.goto(`${server.origin}/${DECK}?still&edit-platform=mac#/2`);
    await waitFor(deckSettled, 30000);
    const all = await speakerOpen();
    if (!all) return { skip: 'the popup of the speaker view is not opened under WebDriver' };
    const [main, speaker] = all;
    await session('POST', '/window', { handle: speaker });
    await waitFor(speakerReady, 20000);
    await sleep(500);
    await press('e');
    const closed = await closedBy(speaker);
    await session('POST', '/window', { handle: main });
    const editing = await within(`new URLSearchParams(location.search).has('edit') && !!window.BeesonEditor`, 10000);
    expect(editing, 'e in the speaker view does not open the editor in the window of the deck');
    expect(closed, 'the speaker view is left open');
    await waitFor('window.BeesonEditor.ready.then(() => true)', 30000);
    const h = await evaluate('Reveal.getIndices().h');
    expect(h === 2, `the editor is opened at slide ${h + 1}`);
    return 'editor opened at slide 3, speaker view closed';
  });

  const FRAME = '.beeson-overlay > .beeson-frame.selected';
  const IMG = '.reveal section.present img';
  // the picture of the mode shown, since the picture of the other mode has a width of 0
  const shownImg = `[...document.querySelectorAll(${js(IMG)})].find((i) => i.getBoundingClientRect().width)`;
  // the box of the picture drawn in the image of the mode shown, inside its box with object-fit
  const drawn = `((img) => {
    const b = img.getBoundingClientRect();
    if (getComputedStyle(img).objectFit !== 'contain') return b;
    const q = Math.min(b.width / img.naturalWidth, b.height / img.naturalHeight);
    const w = img.naturalWidth * q, h = img.naturalHeight * q;
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    const left = b.left + (b.width - w) * px, top = b.top + (b.height - h) * py;
    return { left, top, right: left + w, bottom: top + h, width: w, height: h };
  })(${shownImg})`;
  await check('smoke: a click on the picture of slide 5 selects its figure with its caption, in one frame', async () => {
    await load(4);
    await click(IMG);
    await frames();
    const sel = await evaluate(`window.BeesonEditor.selection().map((e) => e.localName + (e.classList[0] ? '.' + e.classList[0] : ''))`);
    const n = await evaluate(`[...document.querySelectorAll(${js(FRAME)})].filter((f) => f.getBoundingClientRect().width).length`);
    const holds = await evaluate(`(() => {
      const f = document.querySelector(${js(FRAME)}).getBoundingClientRect();
      const fig = window.BeesonEditor.selection()[0];
      const inside = (r) => r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1 && r.bottom <= f.bottom + 1;
      const cap = fig.querySelector('.caption, figcaption');
      const box = (r) => [r.left, r.top, r.right, r.bottom].map(Math.round).join(',');
      return inside(${drawn}) && (!cap || inside(cap.getBoundingClientRect())) ? true : 'frame ' + box(f) + ', picture ' + box(${drawn}) + ', caption ' + (cap ? box(cap.getBoundingClientRect()) : 'none');
    })()`);
    expect(sel.length === 1 && n === 1 && holds === true, `selection ${js(sel)}, ${n} frames, picture and caption in the frame: ${holds}`);
    return `selected ${sel[0]}, one frame around picture and caption`;
  });

  await check('smoke: a drag moves the figure, and Mod+Z takes the move back', async () => {
    await load(4);
    await click(IMG);
    await frames();
    const before = await centerOf(IMG);
    await drag(IMG, { dx: -80, dy: 40 });
    await frames();
    const after = await centerOf(IMG);
    const moved = [after.x - before.x, after.y - before.y].map(Math.round);
    expect(Math.abs(moved[0] + 80) <= 12 && Math.abs(moved[1] - 40) <= 12, `the picture moved by ${moved}`);
    const text = await render();
    expect(/translate/.test(text) && text !== SOURCE, 'the move is not written');
    await press('Mod+Z');
    await frames();
    await byteExact('after Mod+Z');
    return `moved by ${moved}, undone byte for byte`;
  });

  await check('smoke: a drag of a corner grip resizes the figure with the grip under the pointer', async () => {
    await load(4);
    await click(IMG);
    await frames();
    const grips = await evaluate(`Object.fromEntries([...document.querySelectorAll('.beeson-grip')].filter((g) => g.getBoundingClientRect().width).map((g) => { const q = g.getBoundingClientRect(); return [g.dataset.handle, { x: q.left + q.width / 2, y: q.top + q.height / 2 }]; }))`);
    const corner = ['se', 'sw', 'ne', 'nw'].find((h) => grips[h]);
    expect(corner, `no corner grip among ${Object.keys(grips)}`);
    const w0 = await evaluate(`${drawn}.width`);
    const from = grips[corner];
    const dx = corner.endsWith('e') ? -60 : 60;
    const dy = corner.startsWith('s') ? -34 : 34;
    // the Command key on the Mac, as Alt elsewhere, turns the snap off, as in test/editor-r9-1.test.mjs
    await drag(from, { dx, dy, mods: [platform === 'mac' ? 'Meta' : 'Alt'] });
    await frames();
    const w1 = await evaluate(`${drawn}.width`);
    const grip = await evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip')].find((g) => g.dataset.handle === ${js(corner)}); const q = g.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
    // a corner keeps the aspect a of the picture, hence the grip is at the pointer when the offset
    // between them is at a right angle to the diagonal of a box of aspect a
    const a = await evaluate(`${drawn}.width / ${drawn}.height`);
    const [sx, sy] = [corner.endsWith('e') ? 1 : -1, corner.startsWith('s') ? 1 : -1];
    const u = [sx, sy / a];
    const off = Math.abs(((from.x + dx - grip.x) * u[0] + (from.y + dy - grip.y) * u[1]) / Math.hypot(...u));
    expect(Math.abs(w1 - w0) > 20, `the width went from ${w0} to ${w1}`);
    expect(off <= 2, `the ${corner} grip at ${Math.round(grip.x)},${Math.round(grip.y)} is ${off.toFixed(1)} px along its diagonal from the pointer at ${Math.round(from.x + dx)},${Math.round(from.y + dy)}`);
    await press('Mod+Z');
    await frames();
    await byteExact('after Mod+Z');
    return `${corner} grip: width ${w0.toFixed(0)} to ${w1.toFixed(0)} px, grip ${off.toFixed(1)} px along its diagonal from the pointer, undone`;
  });

  const PARA = '.reveal section.present > p';
  await check('smoke: a double click into a paragraph puts the caret there, typed text appears, and Mod+Z takes it back', async () => {
    await load(2);
    const r = await evaluate(`(() => { const p = document.querySelector(${js(PARA)}); const range = document.createRange(); range.selectNodeContents(p); const last = [...range.getClientRects()].at(-1); return { x: last.right - 2, y: last.top + last.height / 2 }; })()`);
    await click(r, { count: 2 });
    await frames();
    const caret = await evaluate(`(() => { const s = getSelection(); return !!s.rangeCount && document.querySelector(${js(PARA)}).contains(s.anchorNode) && document.activeElement?.isContentEditable; })()`);
    expect(caret, `the caret is not in the paragraph (focus on ${await evaluate('document.activeElement?.localName')})`);
    // ArrowRight collapses a selected word, hence the text is typed after it
    await press('ArrowRight');
    await type(' qzx');
    await frames();
    const typed = await evaluate(`document.querySelector(${js(PARA)}).textContent.includes('qzx')`);
    const written = (await render()).includes('qzx');
    expect(typed && written, `typed text shown ${typed}, written ${written}`);
    await press('Mod+Z');
    await frames();
    const left = await evaluate(`document.querySelector(${js(PARA)}).textContent.includes('qzx')`);
    expect(!left, 'Mod+Z leaves the typed text');
    await press('Escape');
    await press('Escape');
    await byteExact('after Mod+Z');
    return 'caret in the paragraph, text typed and undone byte for byte';
  });

  await check('smoke: Mod+B makes a selected word bold', async () => {
    await load(2);
    const r = await evaluate(`(() => { const p = document.querySelector(${js(PARA)}); const t = [...p.childNodes].find((n) => n.nodeType === 3 && /\\w{4,}/.test(n.textContent)); const m = /\\w{4,}/.exec(t.textContent); const range = document.createRange(); range.setStart(t, m.index); range.setEnd(t, m.index + m[0].length); const q = range.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, word: m[0] }; })()`);
    await click(r, { count: 2 });
    await frames();
    const chosen = await evaluate('getSelection().toString().trim()');
    expect(chosen === r.word, `the double click selects '${chosen}', and not '${r.word}'`);
    await press('Mod+B');
    await frames();
    const text = await render();
    expect(text.includes(`<strong>${r.word}</strong>`), `the word ${r.word} is not written in strong`);
    await press('Mod+Z');
    await frames();
    await press('Escape');
    await press('Escape');
    await byteExact('after Mod+Z');
    return `${r.word} made bold and undone`;
  });

  await check('smoke: a right-click on a formula opens the menu of the editor', async () => {
    await load(3);
    await evaluate(`(Reveal.slide(3, 0, 9), true)`);
    await frames();
    await evaluate(`(window.__context = [], addEventListener('contextmenu', (e) => setTimeout(() => window.__context.push(e.defaultPrevented)), true), true)`);
    await click('.reveal section.present div.math mjx-container', { button: 2 });
    await sleep(400);
    const ours = await evaluate(`!!document.querySelector('.beeson-edit-menu')`);
    const mathjax = await evaluate(`document.querySelectorAll('[class*=CtxtMenu_Menu]').length`);
    const prevented = await evaluate('window.__context');
    expect(ours && !mathjax && prevented.length && prevented.every(Boolean), `menu of the editor ${ours}, menus of MathJax ${mathjax}, browser menu prevented ${js(prevented)}`);
    await press('Escape');
    await byteExact('after the menu');
    return 'the menu of the editor, the browser menu prevented, no menu of MathJax';
  });

  const openBar = async (bar) => {
    await click(await evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-menubar [role=menuitem]')].find((b) => b.textContent.trim() === ${js(bar)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`));
    await frames();
  };
  const choose = async (label) => {
    const at = await evaluate(`(() => { const i = [...document.querySelectorAll('.beeson-edit-menu .item')].find((i) => i.querySelector('.label')?.textContent === ${js(label)} && i.getAttribute('aria-disabled') !== 'true'); if (!i) return null; const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    expect(at, `the menu does not have an item ${label}`);
    await click(at);
    await frames();
  };

  await check('smoke: Insert > Table inserts a table, Tab moves between its cells, and Esc from a cell selects the table', async () => {
    await load(2);
    await openBar('Insert');
    await choose('Table…');
    expect(await within(`!!document.querySelector('.beeson-table-picker .grid')`, 3000), 'the grid of Insert Table is not opened');
    // the cell in the third column of the second row of the grid
    const at = await evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-table-picker .grid > div')]; const top = g[0].getBoundingClientRect().top; const cols = g.filter((d) => d.getBoundingClientRect().top === top).length; const r = g[cols + 2].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click({ x: at.x - 2, y: at.y - 2 });
    await click(at);
    expect(await within(`!!document.querySelector('.reveal section.present table')`, 3000), 'a table is not inserted');
    const shape = await evaluate(`(() => { const t = document.querySelector('.reveal section.present table'); return [t.rows.length, t.rows[0].cells.length]; })()`);
    const cellOf = `(() => { const n = getSelection().anchorNode; const c = (n?.nodeType === 1 ? n : n?.parentElement)?.closest('td, th'); return c ? [c.parentElement.rowIndex, c.cellIndex] : null; })()`;
    let c0 = await evaluate(cellOf);
    if (!c0) {
      await click('.reveal section.present table tr:first-child > *:first-child', { count: 2 });
      await frames();
      c0 = await evaluate(cellOf);
    }
    expect(c0, 'the caret is not in a cell');
    await press('Tab');
    await frames();
    const c1 = await evaluate(cellOf);
    expect(c1 && (c1[0] !== c0[0] || c1[1] !== c0[1]), `Tab leaves the caret at ${js(c1)}, from ${js(c0)}`);
    await press('Escape');
    await frames();
    const sel = await evaluate('window.BeesonEditor.selection().map((e) => e.localName).join()');
    const caretGone = await evaluate('!document.activeElement?.isContentEditable');
    expect(sel === 'table' && caretGone, `Esc from a cell selects ${sel || 'nothing'}, and the caret is ${caretGone ? 'gone' : 'kept'}`);
    await press('Mod+Z');
    await frames();
    await byteExact('after Mod+Z');
    return `table ${shape[1]} by ${shape[0]}, Tab from ${js(c0)} to ${js(c1)}, Esc selects the table, undone`;
  });

  await check('smoke: View > Object List lists the objects of the slide', async () => {
    await load(4);
    await openBar('View');
    await choose('Object List');
    expect(await within(`!!document.querySelector('.beeson-edit-objects:not([hidden]) [role=treeitem]')`, 3000), 'the object list is not shown');
    const rows = await evaluate(`[...document.querySelectorAll('.beeson-edit-objects [role=treeitem] .name')].map((n) => n.textContent)`);
    expect(rows.length > 0, 'the list is empty');
    await byteExact('after the list');
    return `${rows.length} rows: ${rows.join(' | ').slice(0, 80)}`;
  });

  await check('smoke: Help > Keyboard Shortcuts opens the sheet, and Esc closes it', async () => {
    await load(2);
    await openBar('Help');
    await choose('Keyboard Shortcuts');
    expect(await within(`!!document.querySelector('dialog.beeson-edit-keys[open]')`, 3000), 'the sheet is not opened');
    await press('Escape');
    expect(await within(`!document.querySelector('dialog.beeson-edit-keys[open]')`, 3000), 'Esc does not close the sheet');
    await byteExact('after the sheet');
    return 'opened and closed';
  });
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(([, state]) => state === 'fail').length;
console.log(`${options.browser}: ${results.length - failed} of ${results.length} checks pass or skip, ${failed} fail`);
process.exit(failed ? 1 : 0);
