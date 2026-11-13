// the text tools of Keynote and PowerPoint on both platforms: Strikethrough, Change Case, Copy
// Style and Paste Style with the Format Painter, the smart quotes and dashes, and the kinds Email
// and Phone of the link popover. each edit is checked byte for byte, after an undo and a redo,
// against the scope rule, and after a save and an open of the saved text. the clipboard of the
// system is not used, since other tests may run beside these

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { mailtoHref, parseHref, telHref } from '../src/editor/text/link.ts';
import { nextCase, recase } from '../src/editor/text/inline.ts';
import { substitution } from '../src/editor/text/substitute.ts';
import { byteExact, click, drag, press, saveAndReopen, type } from './helpers/editor.mjs';

const LAYOUTS = 'test/pages/editor-layouts.html';
const PLATFORMS = ['mac', 'other'];
const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
const PANEL = '#beeson-edit-panel-format';
const P = '.reveal section.present > p';

const PARAGRAPH = '<p>A paragraph with <strong>bold</strong>, <em>italic</em>, <code>code</code>, and \\(x^2\\) inline.</p>';
const SMALL = '<p class="small fragment" data-fragment-index="3">A small paragraph.</p>';
const word = (html, w = 'paragraph') => [PARAGRAPH, PARAGRAPH.replace(w, html)];

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

let last = null;

// the editor on the third slide of the deck of layouts, served over HTTP, where a save is written
// into the origin private file system, with the Format tab of the inspector shown
async function textPage(platform) {
  await last?.close().catch(() => {});
  const page = await browser.newPage();
  last = page;
  await page.send('Page.bringToFront');
  await page.goto(`${server.origin}/${LAYOUTS}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(LAYOUTS, 'utf8');
  const status = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
  assert.deepEqual(status.problems, []);
  if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
  await page.evaluate('Reveal.slide(2)');
  await frames(page);
  return page;
}

// the point (node, offset) of the visible character k of the text of the first element at selector
// whose text contains has, as the source of an expression in the page
const pointIn = (selector, has) => `
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.includes(${JSON.stringify(has)}));
  const at = (k) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let left = k;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (left <= n.length) return [n, left];
      left -= n.length;
    }
    return [el, el.childNodes.length];
  };`;

// selects the characters start to end of the text of the first element at selector whose text
// contains has, with its block focused
const select = (page, selector, has, start, end = start) =>
  page.evaluate(`(() => {
    ${pointIn(selector, has)}
    el.closest('[contenteditable="true"]').focus();
    const r = document.createRange();
    r.setStart(...at(${start}));
    r.setEnd(...at(${end}));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return true;
  })()`);

// the points in the viewport at the characters start and end of the same text, a little inside
const pointsOf = (page, selector, has, start, end) =>
  page.evaluate(`(() => {
    ${pointIn(selector, has)}
    const r = document.createRange();
    r.setStart(...at(${start}));
    r.setEnd(...at(${end}));
    const rects = [...r.getClientRects()].filter((b) => b.width);
    const a = rects[0];
    const b = rects[rects.length - 1];
    return { from: { x: a.left + 1, y: a.top + a.height / 2 }, to: { x: b.right - 1, y: b.top + b.height / 2 } };
  })()`);

// the point in the viewport at the middle of the first character of the word w in the element at
// selector, found in the text node that holds it
const wordAt = (page, selector, w) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.data.indexOf(${JSON.stringify(w)});
      if (i < 0 || n.parentElement.closest('mjx-container')) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 1);
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return null;
  })()`);

// the caret put before the word w of the element at selector, with its block focused
const caretBefore = (page, selector, w) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.data.indexOf(${JSON.stringify(w)});
      if (i < 0 || n.parentElement.closest('mjx-container')) continue;
      el.closest('[contenteditable="true"]').focus();
      getSelection().collapse(n, i);
      return true;
    }
    return false;
  })()`);

const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

// a trusted key with its key, code, and Windows key code given, for a symbol or a character that
// press() does not know. mods holds the bits Alt 1, Ctrl 2, Meta 4, and Shift 8. text is typed
async function raw(page, key, code, keyCode, mods = 0, text) {
  await page.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers: mods, ...(text ? { text, unmodifiedText: text } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers: mods });
}

// the characters of a US layout typed as keys, each with its code and Shift
const KEYS = { '"': ['Quote', 222, 8], "'": ['Quote', 222, 0], '-': ['Minus', 189, 0], ' ': ['Space', 32, 0] };
async function typeKeys(page, text) {
  for (const c of text) {
    const [code, keyCode, mods] = KEYS[c] ?? [`Key${c.toUpperCase()}`, c.toUpperCase().charCodeAt(0), 0];
    await raw(page, c, code, keyCode, mods, c);
  }
}

// a click on the button of the Text pane at selector, with count clicks
async function tap(page, selector, count = 1) {
  const at = await page.evaluate(`(() => {
    const b = document.querySelector('${PANEL} ' + ${JSON.stringify(selector)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  assert.ok(at, `the Text pane does not have ${selector}`);
  await click(page, at, { count });
  await frames(page);
}

// the problems of the scope rule in the rendered text that the file did not have before
async function inScope(page) {
  const now = textProblems(await page.evaluate('window.BeesonEditor.render()'), THEME);
  for (const p of textProblems(page.source, THEME)) {
    const i = now.indexOf(p);
    if (i >= 0) now.splice(i, 1);
  }
  assert.deepEqual(now, []);
}

// the edit checked byte for byte, then after an undo, which gives the file with the edits before,
// and again after a redo
async function roundTrip(page, edits, label, before = []) {
  await byteExact(page, edits);
  await inScope(page);
  if (label) assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
  await undo(page);
  await byteExact(page, before);
  await redo(page);
  await byteExact(page, edits);
}

const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

let saves = 0;
async function saved(page, edits) {
  const { text } = await saveAndReopen(page, `tools-${++saves}.html`);
  page.source = text;
  await byteExact(page);
  assert.ok(edits.every(([, after]) => text.includes(after)));
}

test('the case of a text is changed by kind, and Shift+F3 cycles as in PowerPoint', () => {
  assert.equal(recase('the orbit. a halo', 'sentence'), 'The orbit. A halo');
  assert.equal(recase('HALO ORBIT', 'sentence', 'An '), 'halo orbit');
  assert.equal(recase("don't stop-now", 'title'), "Don't Stop-Now");
  assert.equal(recase('Halo Orbit', 'toggle'), 'hALO oRBIT');
  assert.equal(recase('Straße', 'upper'), 'STRASSE');
  assert.equal(recase('word', 'title', 'a'), 'word');
  assert.deepEqual(['abc', 'ABC', 'Abc', '12'].map(nextCase), ['upper', 'title', 'lower', 'lower']);
});

test('a typed quote or hyphen is substituted after the text before it', () => {
  const on = { quotes: true, dashes: true };
  assert.deepEqual(substitution('', '"', on), { remove: 1, insert: '“' });
  assert.deepEqual(substitution('say “hi', '"', on), { remove: 1, insert: '”' });
  assert.deepEqual(substitution('(', "'", on), { remove: 1, insert: '‘' });
  assert.deepEqual(substitution('it', "'", on), { remove: 1, insert: '’' });
  assert.deepEqual(substitution('a -', '-', on), { remove: 2, insert: '—' });
  assert.deepEqual(substitution('1 -', ' ', on), { remove: 2, insert: '– ' });
  assert.equal(substitution('1-', '2', on), null);
  assert.equal(substitution('a --', '-', on), null);
  assert.equal(substitution('\\(f', "'", on), null);
  assert.deepEqual(substitution('\\(f\\) is', "'", on), { remove: 1, insert: '’' });
  assert.equal(substitution('it', "'", { quotes: false, dashes: true }), null);
  assert.equal(substitution('a -', '-', { quotes: true, dashes: false }), null);
});

test('an email and a phone number are made mailto and tel links, and read back', () => {
  assert.equal(mailtoHref(' me@example.com '), 'mailto:me@example.com');
  assert.equal(mailtoHref('me@example.com', 'Halo orbits & more'), 'mailto:me@example.com?subject=Halo%20orbits%20%26%20more');
  assert.equal(mailtoHref('me@example'), null);
  assert.equal(telHref('+1 (609) 258-3000'), 'tel:+1(609)258-3000');
  assert.equal(telHref('call me'), null);
  assert.equal(telHref('12'), null);
  assert.deepEqual(parseHref('mailto:me@example.com?subject=Halo%20orbits%20%26%20more'), { kind: 'email', to: 'me@example.com', subject: 'Halo orbits & more' });
  assert.deepEqual(parseHref('tel:+1(609)258-3000'), { kind: 'phone', number: '+1(609)258-3000' });
  assert.deepEqual(parseHref('#/7'), { kind: 'slide', slide: 7 });
  assert.deepEqual(parseHref('https://example.com'), { kind: 'webpage', url: 'https://example.com' });
});

test('a struck word, written as s, is in the scope rule', () => {
  assert.deepEqual(textProblems('<p>A <s>struck</s> word.</p>', THEME), []);
});

for (const platform of PLATFORMS) {
  const mod = platform === 'mac' ? 4 : 2;

  test(`Strikethrough is set by its key and by the S of the Text pane, and taken off again on ${platform}`, async () => {
    const page = await textPage(platform);
    await select(page, P, 'A paragraph', 2, 11);
    if (platform === 'mac') await press(page, 'Mod+Shift+X');
    else await raw(page, '%', 'Digit5', 53, 1 | 8);
    await roundTrip(page, [word('<s>paragraph</s>')], 'Strikethrough');
    await select(page, P, 'A paragraph', 2, 11);
    assert.equal((await state(page, 'text.strike')).checked, true);
    await tap(page, '[data-command="text.strike"]');
    await byteExact(page);
    assert.equal(await page.evaluate(`document.querySelector('${PANEL} [data-command="text.strike"]').getAttribute('aria-pressed')`), 'false');
    // the caret in a word strikes the word, and Clear Formatting takes it off
    await select(page, P, 'A paragraph', 5);
    await tap(page, '[data-command="text.strike"]');
    await byteExact(page, [word('<s>paragraph</s>')]);
    await select(page, P, 'A paragraph', 0, 11);
    await exec(page, 'text.clear');
    await byteExact(page);
    await undo(page);
    await byteExact(page, [word('<s>paragraph</s>')]);
    await saved(page, [word('<s>paragraph</s>')]);
    assert.deepEqual(errors(page), []);
  });

  test(`Change Case sets each kind on the words of a selection, keeping their formats, and Shift+F3 cycles on ${platform}`, async () => {
    const page = await textPage(platform);
    const head = (text) => [PARAGRAPH, PARAGRAPH.replace('A paragraph with <strong>bold</strong>', text)];
    const kinds = [
      ['upper', 'UPPERCASE', 'A PARAGRAPH WITH <strong>BOLD</strong>'],
      ['lower', 'lowercase', 'a paragraph with <strong>bold</strong>'],
      ['title', 'Capitalize Each Word', 'A Paragraph With <strong>Bold</strong>'],
      ['toggle', 'tOGGLE cASE', 'a pARAGRAPH wITH <strong>bOLD</strong>'],
      ['sentence', 'Sentence case.', 'A paragraph with <strong>bold</strong>'],
    ];
    let before = [];
    for (const [kind, , text] of kinds) {
      await select(page, P, 'inline', 0, 21);
      await exec(page, `text.case.${kind}`);
      const edits = text === 'A paragraph with <strong>bold</strong>' ? [] : [head(text)];
      if (edits.length) await roundTrip(page, edits, 'Change Case', before);
      else await byteExact(page);
      before = edits;
    }
    // Shift+F3 with the caret in a word: lowercase, then UPPERCASE, then Capitalize Each Word
    await select(page, P, 'A paragraph', 5);
    await press(page, 'Shift+F3');
    await roundTrip(page, [word('PARAGRAPH')], 'Change Case');
    await select(page, P, 'A PARAGRAPH', 5);
    await press(page, 'Shift+F3');
    await byteExact(page, [word('Paragraph')]);
    await select(page, P, 'A Paragraph', 5);
    await press(page, 'Shift+F3');
    await byteExact(page);
    // the menu of the Text pane runs the same commands
    await select(page, P, 'A paragraph', 2, 11);
    await tap(page, '.ed-btn.case');
    await page.waitFor(`[...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.includes('UPPERCASE'))`);
    await page.evaluate(`[...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.includes('UPPERCASE')).click()`);
    await page.waitFor(`window.BeesonEditor.render().includes('PARAGRAPH')`);
    await byteExact(page, [word('PARAGRAPH')]);
    await saved(page, [word('PARAGRAPH')]);
    assert.deepEqual(errors(page), []);
  });

  test(`Copy Style and Paste Style carry the formats, the tone, and the paragraph style by their keys on ${platform}`, async () => {
    const page = await textPage(platform);
    const copy = () => (platform === 'mac' ? raw(page, 'ç', 'KeyC', 67, 1 | mod) : press(page, 'Mod+Shift+C'));
    const paste = () => (platform === 'mac' ? raw(page, '√', 'KeyV', 86, 1 | mod) : press(page, 'Mod+Shift+V'));
    assert.equal((await state(page, 'text.pasteStyle')).enabled, false);
    // the bold of a word is put on italic in place of its italic
    await select(page, P, 'bold', 18);
    await copy();
    assert.equal(await page.evaluate('window.BeesonEditor.status().undo'), false);
    await select(page, P, 'italic', 23, 29);
    await paste();
    const italic = [PARAGRAPH, PARAGRAPH.replace('<em>italic</em>', '<strong>italic</strong>')];
    await roundTrip(page, [italic], 'Paste Style');
    // a word in bold and orange gives its bold and its tone to the A before it
    await select(page, P, 'A paragraph', 2, 11);
    await exec(page, 'text.bold');
    await exec(page, 'text.tone.accent');
    const toned = italic[1].replace('paragraph', '<span class="tone-accent"><strong>paragraph</strong></span>');
    await byteExact(page, [[PARAGRAPH, toned]]);
    await select(page, P, 'A paragraph', 5);
    await copy();
    await select(page, P, 'A paragraph', 0, 1);
    await paste();
    const both = toned.replace('<p>A ', '<p><strong><span class="tone-accent">A</span></strong> ');
    await roundTrip(page, [[PARAGRAPH, both]], 'Paste Style', [[PARAGRAPH, toned]]);
    // the style of a plain word of a small paragraph is copied, and its whole text is given the
    // paragraph style Small once more after an undo. a whole list item is made a small paragraph
    await select(page, P, 'with', 13);
    await exec(page, 'text.style.small');
    await select(page, P, 'with', 13);
    await copy();
    await undo(page);
    await byteExact(page, [[PARAGRAPH, both]]);
    await select(page, '.reveal section.present li', 'A first item', 0, 12);
    await paste();
    const ITEM = '  <ul>\n    <li class="fragment" data-fragment-index="1">A first item</li>\n';
    const item = [ITEM, '  <p class="fragment small" data-fragment-index="1">A first item</p>\n  <ul>\n'];
    await roundTrip(page, [[PARAGRAPH, both], item], 'Paste Style', [[PARAGRAPH, both]]);
    await undo(page);
    await select(page, P, 'with', 0, 200);
    await paste();
    const small = `<p class="small">A paragraph with bold, italic, code, and \\(x^2\\) inline.</p>`;
    await roundTrip(page, [[PARAGRAPH, small]], 'Paste Style', [[PARAGRAPH, both]]);
    await saved(page, [[PARAGRAPH, small]]);
    assert.deepEqual(errors(page), []);
  });

  test(`the Format Painter paints one selection after a click, and stays armed after a double click on ${platform}`, async () => {
    const page = await textPage(platform);
    await select(page, P, 'bold', 18);
    await tap(page, '.ed-btn.painter');
    assert.equal((await state(page, 'text.formatPainter')).checked, true);
    assert.equal(await page.evaluate(`document.documentElement.classList.contains('beeson-painting')`), true);
    // a drag over a word of the slide paints it, and the painter is put down
    const { from, to } = await pointsOf(page, P, 'A paragraph', 2, 11);
    await drag(page, from, { dx: to.x - from.x, dy: 0 });
    await page.waitFor(`window.BeesonEditor.render().includes('<strong>paragraph</strong>')`);
    await roundTrip(page, [word('<strong>paragraph</strong>')], 'Paste Style');
    assert.equal((await state(page, 'text.formatPainter')).checked, false);
    // a double click keeps it armed for two clicks into words, and Esc puts it down
    await select(page, P, 'italic', 27);
    await tap(page, '.ed-btn.painter', 2);
    assert.equal((await state(page, 'text.formatPainter')).checked, true);
    for (const w of ['A ', 'inline']) {
      await click(page, await wordAt(page, P, w));
      await frames(page);
    }
    await page.waitFor(`window.BeesonEditor.render().includes('<em>inline</em>')`);
    const painted = PARAGRAPH.replace('A paragraph', '<em>A</em> <strong>paragraph</strong>').replace('inline', '<em>inline</em>');
    await byteExact(page, [[PARAGRAPH, painted]]);
    assert.equal((await state(page, 'text.formatPainter')).checked, true);
    await press(page, 'Escape');
    assert.equal((await state(page, 'text.formatPainter')).checked, false);
    assert.equal(await page.evaluate(`document.documentElement.classList.contains('beeson-painting')`), false);
    await undo(page);
    await byteExact(page, [[PARAGRAPH, painted.replace('<em>inline</em>', 'inline')]]);
    await saved(page, [[PARAGRAPH, painted.replace('<em>inline</em>', 'inline')]]);
    assert.deepEqual(errors(page), []);
  });

  test(`smart quotes and dashes are typed, an undo takes back only the substitution, and the switches are kept on ${platform}`, async () => {
    const page = await textPage(platform);
    const at = (text) => [PARAGRAPH, PARAGRAPH.replace('A paragraph', `A ${text}paragraph`)];
    assert.equal((await state(page, 'text.smart.quotes')).checked, true);
    await select(page, P, 'A paragraph', 2);
    await typeKeys(page, '"');
    await byteExact(page, [at('“')]);
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Smart Quote');
    await undo(page);
    await byteExact(page, [at('"')]);
    await redo(page);
    await byteExact(page, [at('“')]);
    // the hyphen and the space after it are typing, and the en dash put for them is its own entry
    await typeKeys(page, "it's -- a - ");
    await byteExact(page, [at('“it’s — a – ')]);
    await undo(page);
    await byteExact(page, [at('“it’s — a - ')]);
    await redo(page);
    await inScope(page);
    // a quote in inline code and a quote of a script are left straight
    await select(page, P + ' code', 'code', 2);
    await typeKeys(page, "'");
    await page.evaluate(`document.execCommand('insertText', false, '"')`);
    const kept = PARAGRAPH.replace('A paragraph', 'A “it’s — a – paragraph').replace('<code>code</code>', `<code>co'"de</code>`);
    await byteExact(page, [[PARAGRAPH, kept]]);
    // Smart Quotes switched off in the Edit menu is kept in the local storage
    await exec(page, 'text.smart.quotes');
    assert.equal((await state(page, 'text.smart.quotes')).checked, false);
    assert.ok(await caretBefore(page, P, 'inline'));
    await typeKeys(page, '"--');
    const off = kept.replace(' inline', ' "—inline');
    await byteExact(page, [[PARAGRAPH, off]]);
    await saved(page, [[PARAGRAPH, off]]);
    const again = await textPage(platform);
    assert.equal((await state(again, 'text.smart.quotes')).checked, false);
    assert.equal((await state(again, 'text.smart.dashes')).checked, true);
    await exec(again, 'text.smart.quotes');
    assert.equal(await again.evaluate(`localStorage.getItem('beeson-edit-smart-quotes')`), 'on');
    assert.deepEqual(errors(again), []);
  });

  test(`a link to an email with a subject and to a phone number is written from the popover on ${platform}`, async () => {
    const page = await textPage(platform);
    await select(page, P, 'A paragraph', 2, 11);
    await press(page, 'Mod+K');
    await page.waitFor(`document.querySelector('dialog.beeson-edit-link[open]') !== null`);
    await click(page, 'dialog.beeson-edit-link [data-kind="email"]');
    await page.waitFor(`document.activeElement?.name === 'mailto'`);
    await type(page, 'me@example');
    assert.equal(await page.evaluate(`document.querySelector('dialog.beeson-edit-link .done').disabled`), true);
    assert.equal(await page.evaluate(`document.querySelector('dialog.beeson-edit-link .note').textContent`), 'This is not an email address.');
    await type(page, '.com');
    await press(page, 'Tab');
    assert.equal(await page.evaluate('document.activeElement?.name'), 'subject');
    await type(page, 'Halo orbits');
    await press(page, 'Enter');
    await page.waitFor(`window.BeesonEditor.render().includes('mailto:')`);
    const mail = word('<a href="mailto:me@example.com?subject=Halo%20orbits">paragraph</a>');
    await roundTrip(page, [mail], 'Link');
    // the popover opens on the kind of the link at the caret, with its fields filled
    await select(page, '.reveal section.present a', 'paragraph', 3);
    await press(page, 'Mod+K');
    await page.waitFor(`document.querySelector('dialog.beeson-edit-link [data-kind="email"][aria-checked="true"]') !== null`);
    assert.deepEqual(await page.evaluate(`['mailto', 'subject'].map((n) => document.querySelector('dialog.beeson-edit-link [name="' + n + '"]').value)`), ['me@example.com', 'Halo orbits']);
    await press(page, 'Escape');
    await page.waitFor(`document.querySelector('dialog.beeson-edit-link') === null`);
    // a phone number, from the popover opened by exec on its kind
    await select(page, P, 'italic', 23, 29);
    await exec(page, 'text.link', { kind: 'phone' });
    await page.waitFor(`document.activeElement?.name === 'tel'`);
    await type(page, '+1 (609) 258-3000');
    await press(page, 'Enter');
    await page.waitFor(`window.BeesonEditor.render().includes('tel:')`);
    const phone = [PARAGRAPH, mail[1].replace('<em>italic</em>', '<a href="tel:+1(609)258-3000"><em>italic</em></a>')];
    await roundTrip(page, [phone], 'Link', [mail]);
    await saved(page, [phone]);
    assert.deepEqual(errors(page), []);
  });
}
