// helpers of the browser tests of the editor, with trusted input sent over the DevTools protocol,
// which is closer to a user than dispatchEvent. a key string names the modifiers before the key,
// e.g. 'Mod+Shift+Z', where Mod is ⌘ with ?edit-platform=mac and Ctrl otherwise

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deckSettled, deckUrl } from '../../scripts/chrome.mjs';

const ready = 'window.BeesonEditor && window.BeesonEditor.ready.then(() => true)';

// the bits of the modifiers in Input.dispatchKeyEvent and Input.dispatchMouseEvent
const BITS = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 };

// the key, code, and key code of a named key, e.g. ArrowUp, and of a letter or a digit
const NAMED = {
  Enter: ['Enter', 'Enter', 13],
  Escape: ['Escape', 'Escape', 27],
  Tab: ['Tab', 'Tab', 9],
  Backspace: ['Backspace', 'Backspace', 8],
  Delete: ['Delete', 'Delete', 46],
  Space: [' ', 'Space', 32],
  ArrowLeft: ['ArrowLeft', 'ArrowLeft', 37],
  ArrowUp: ['ArrowUp', 'ArrowUp', 38],
  ArrowRight: ['ArrowRight', 'ArrowRight', 39],
  ArrowDown: ['ArrowDown', 'ArrowDown', 40],
  Home: ['Home', 'Home', 36],
  End: ['End', 'End', 35],
  PageUp: ['PageUp', 'PageUp', 33],
  PageDown: ['PageDown', 'PageDown', 34],
};

function keyOf(name, shift) {
  if (NAMED[name]) return NAMED[name];
  if (/^[a-z]$/i.test(name)) {
    const upper = name.toUpperCase();
    return [shift ? upper : name.toLowerCase(), `Key${upper}`, upper.charCodeAt(0)];
  }
  if (/^[0-9]$/.test(name)) return [name, `Digit${name}`, name.charCodeAt(0)];
  if (/^F[0-9]+$/.test(name)) return [name, name, 111 + Number(name.slice(1))];
  throw new Error(`the key ${name} is not known to press()`);
}

// the platform of a page, read from its URL parameter edit-platform as the editor reads it
async function platformOf(page) {
  return page.evaluate(`(() => {
    const p = new URLSearchParams(location.search).get('edit-platform');
    if (p === 'mac' || p === 'other') return p;
    return /Mac|iPhone|iPad/.test(navigator.platform) ? 'mac' : 'other';
  })()`);
}

/**
 * The editor on a deck, with every block paired with its file. deck is the path of the deck from
 * the root of the repository, and text is the text passed to open(), by default the file itself.
 */
export async function editorPage(browser, { deck = 'index.html', query = 'edit&still', text, page: options } = {}) {
  const page = await browser.newPage(options);
  await page.goto(deckUrl(deck, query));
  await page.waitFor(deckSettled);
  await page.waitFor(ready);
  const source = text ?? readFileSync(deck, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(source)})`);
  assert.deepEqual(status.problems, [], `the blocks of ${deck} are not all paired`);
  page.source = source;
  return page;
}

// the center of the first shown element matched by selector, in CSS pixels of the viewport
export async function center(page, selector) {
  const point = await page.evaluate(`(() => {
    const r = [...document.querySelectorAll(${JSON.stringify(selector)})].map((el) => el.getBoundingClientRect()).find((r) => r.width && r.height);
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  })()`);
  if (!point) throw new Error(`nothing is shown at ${selector}`);
  return point;
}

const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });

/**
 * A trusted click at a point { x, y } or at the center of the element matched by a selector.
 * button is 'left' or 'right', count is the click count, and modifiers is a key string, e.g. 'Shift'.
 */
export async function click(page, at, { button = 'left', count = 1, modifiers = '' } = {}) {
  const { x, y } = typeof at === 'string' ? await center(page, at) : at;
  const bits = await maskOf(page, modifiers);
  const buttons = button === 'right' ? 2 : 1;
  await mouse(page, 'mouseMoved', x, y, { modifiers: bits });
  for (let n = 1; n <= count; n++) {
    await mouse(page, 'mousePressed', x, y, { button, buttons, clickCount: n, modifiers: bits });
    await mouse(page, 'mouseReleased', x, y, { button, clickCount: n, modifiers: bits });
  }
}

/**
 * The figure around the image of a selector selected by itself, by a click on the image, since a
 * picture with its caption is one object.
 */
export async function selectFigure(page, image) {
  await click(page, image);
}

/**
 * The image of a selector selected by itself, by a second click on it after the click that
 * selects its figure.
 */
export async function selectPicture(page, image) {
  await click(page, image);
  await click(page, image);
}

/**
 * A trusted drag from a point or a selector by { dx, dy } in CSS pixels, in steps moves. With hold
 * set, the button is not released, e.g. for a screenshot of the drag in progress.
 */
export async function drag(page, from, { dx = 0, dy = 0, steps = 10, modifiers = '', hold = false } = {}) {
  const { x, y } = typeof from === 'string' ? await center(page, from) : from;
  const bits = await maskOf(page, modifiers);
  await mouse(page, 'mouseMoved', x, y, { modifiers: bits });
  await mouse(page, 'mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1, modifiers: bits });
  for (let i = 1; i <= steps; i++) {
    await mouse(page, 'mouseMoved', x + (dx * i) / steps, y + (dy * i) / steps, { button: 'left', buttons: 1, modifiers: bits });
  }
  await page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))');
  if (!hold) await mouse(page, 'mouseReleased', x + dx, y + dy, { button: 'left', clickCount: 1, modifiers: bits });
}

// the bit mask of the modifiers of a key string, with Mod resolved for the platform of the page
async function maskOf(page, modifiers) {
  const names = modifiers ? modifiers.split('+') : [];
  const mac = names.includes('Mod') && (await platformOf(page)) === 'mac';
  return names.reduce((bits, name) => bits | (name === 'Mod' ? (mac ? BITS.Meta : BITS.Ctrl) : BITS[name] ?? 0), 0);
}

/** A trusted press of a key string, e.g. 'Mod+Z', 'Shift+ArrowUp', or 'Escape'. */
export async function press(page, keys) {
  const names = keys.split('+');
  const name = names.pop();
  for (const m of names) if (m !== 'Mod' && !(m in BITS)) throw new Error(`the modifier ${m} is not known to press()`);
  const modifiers = await maskOf(page, names.join('+'));
  const shift = names.includes('Shift');
  const [key, code, keyCode] = keyOf(name, shift);
  // a printable key without a command modifier types its character
  const text = key.length === 1 && !(modifiers & (BITS.Ctrl | BITS.Meta)) ? key : undefined;
  const base = { key, code, windowsVirtualKeyCode: keyCode, modifiers };
  await page.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text, unmodifiedText: text } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

/** Trusted typing of text at the caret, as an input method commits it. */
export async function type(page, text) {
  await page.send('Input.insertText', { text });
}

/**
 * Saves into a file of the origin private file system, opens the saved text again, and returns it
 * with the status after the open, whose problems must be empty. The page must be served over HTTP.
 */
export async function saveAndReopen(page, name = 'saved.html') {
  const text = await page.evaluate(`(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(${JSON.stringify(name)}, { create: true });
    window.BeesonEditor.attach(handle);
    await window.BeesonEditor.save();
    return (await handle.getFile()).text();
  })()`);
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`);
  assert.deepEqual(status.problems, [], `the blocks of the saved text are not all paired`);
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), text, 'the saved text is not rendered byte for byte');
  return { text, status };
}

/**
 * Asserts that the text rendered by the editor is the source of the page with each pair [old, new]
 * of edits replaced once, and that each old text occurs once in the source.
 */
export async function byteExact(page, edits = []) {
  let expected = page.source;
  for (const [before, after] of edits) {
    assert.equal(expected.split(before).length, 2, `${before} does not occur once in the deck`);
    expected = expected.replace(before, () => after);
  }
  assert.equal(await page.evaluate('window.BeesonEditor.render()'), expected);
}
