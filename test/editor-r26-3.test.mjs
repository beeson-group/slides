// tests of R26.3 on both platforms where the editor is used: the brace kept inside its box at the
// cusp, a double click on a word of a shape that is not selected, the Text pane on a shape whose
// words are a list, the geometry of a shape drawn during the drag that draws it, and Tab and
// Shift+Tab through the objects of a slide

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';
import { shapePath } from '../src/shapes.ts';

const PLATFORMS = ['mac', 'other'];

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
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));

test('a brace of an empty box, e.g. of a shape taken off the slide, is drawn without a number that is not one', () => {
  for (const [w, h, s] of [[0, 0, 0], [0, 0, 3], [3, 3, 3]]) assert.ok(!shapePath('brace', w, h, s).includes('NaN'), `${w} by ${h} with ${s}: ${shapePath('brace', w, h, s)}`);
});

test('the ink of a brace stays inside its box at the cusp, at each weight and with a flip, with its miter join kept', async (t) => {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(deckUrl('test/pages/shapes.html', 'still'));
  await page.waitFor(deckSettled);
  // the stroke of each brace drawn by the theme is probed past the right and the left edge of its
  // box around the cusp, i.e. with the joins and the miter limit of the browser
  const out = await page.evaluate(`(() => {
    const slide = Reveal.getCurrentSlide();
    const cases = [[160, 240, ''], [160, 240, 'weight-6'], [160, 240, 'weight-8'], [40, 80, 'weight-8'], [80, 400, ''], [80, 400, 'weight-8'], [60, 200, ''], [160, 240, 'weight-8 flip-x']];
    return cases.map(([bw, bh, cls]) => {
      const el = Object.assign(document.createElement('div'), { className: 'shape brace ' + cls });
      el.style.cssText = 'width: ' + bw + 'px; height: ' + bh + 'px';
      slide.append(el);
      window.Beeson.mount(el);
      // a small box is widened by the padding of a shape
      const w = el.offsetWidth, h = el.offsetHeight;
      const path = el.querySelector(':scope > svg path');
      const { strokeLinejoin: join, strokeWidth: width } = getComputedStyle(path);
      const cusp = path.isPointInStroke(new DOMPoint(w - 0.5, h / 2));
      let right = 0, left = 0;
      for (let y = h / 2 - 20; y <= h / 2 + 20; y += 0.25) {
        for (let d = 0.25; d <= 20; d += 0.25) {
          if (path.isPointInStroke(new DOMPoint(w + d, y))) right = Math.max(right, d);
          if (path.isPointInStroke(new DOMPoint(-d, y))) left = Math.max(left, d);
        }
      }
      el.remove();
      return { size: w + ' by ' + h + ' ' + cls, right, left, join, width, cusp };
    });
  })()`);
  for (const c of out) {
    assert.equal(c.join, 'miter', c.size);
    assert.equal(c.width, c.size.includes('weight-8') ? '8px' : c.size.includes('weight-6') ? '6px' : '3px', c.size);
    assert.deepEqual([c.right, c.left], [0, 0], `${c.size}: the ink reaches ${c.right} px past the right edge and ${c.left} px past the left`);
    // the tip of the cusp still reaches the right edge of the box
    assert.ok(c.cusp, `${c.size}: the cusp does not reach the edge`);
  }
  assert.deepEqual(errors(page), [], js(errors(page)));
});

const PAGE = 'test/pages/editor-r26-3.html';
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
// the selected objects by their words, a line as line
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.localName === 'svg' ? 'line' : el.textContent.trim()).sort()`);

// the editor on slide n of the test deck, served over HTTP, with the storage of the origin emptied
async function load(t, platform, n) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${PAGE}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(PAGE, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the center of the word in the shown element of selector whose text holds it, in CSS px
const wordAt = (page, selector, word) => page.evaluate(`(() => {
  const el = [...document.querySelectorAll(${js(selector)})].find((e) => e.getBoundingClientRect().width && e.textContent.includes(${js(word)}));
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const i = n.data.indexOf(${js(word)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + ${word.length});
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
  return null;
})()`);
const words = (page) => page.evaluate('getSelection().toString()');

for (const platform of PLATFORMS) {
  test(`a double click on a word of a shape that is not selected selects the word (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    assert.deepEqual(await selected(page), []);
    await click(page, await wordAt(page, '.reveal section.present .shape p', 'the'), { count: 2 });
    await frames(page);
    assert.equal(await words(page), 'the', 'the double click does not select the word');
    assert.equal(await render(page), page.source);
    // a triple click selects the words of the paragraph
    await click(page, await wordAt(page, '.reveal section.present .shape p', 'bridge'), { count: 3 });
    await frames(page);
    assert.equal((await words(page)).trim(), 'Build the bridge');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`a drag over the words of a selected locked shape selects them and does not move the shape (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    const from = await wordAt(page, '.reveal section.present .shape[data-locked] p', 'Locked');
    await click(page, from);
    await frames(page);
    assert.deepEqual(await selected(page), ['Locked words here']);
    await drag(page, { x: from.x - 30, y: from.y }, { dx: 160 });
    await frames(page);
    assert.ok((await words(page)).length > 3, `the drag selects ${js(await words(page))}`);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`the Text pane formats the words of a selected shape whose words are a list (${platform})`, async (t) => {
    const page = await load(t, platform, 1);
    await click(page, await wordAt(page, '.reveal section.present .shape li', 'Goal'));
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection()[0].matches("div.shape")'), true, 'the shape is not selected');
    for (const id of ['text.smaller', 'text.tone.accent', 'text.bold']) assert.equal((await state(page, id)).enabled, true, `${id} is disabled: ${js(await state(page, id))}`);
    await exec(page, 'text.tone.accent');
    const after = await render(page);
    assert.notEqual(after, page.source, 'Accent does not change the words of the shape');
    assert.equal(after, page.source.replace('<li>Goal</li>', '<li><span class="tone-accent">Goal</span></li>').replace('<li>Path</li>', '<li><span class="tone-accent">Path</span></li>'));
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), after);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });

  test(`the Text pane formats a nested list item of a selected shape, after Tab in its words (${platform})`, async (t) => {
    const page = await load(t, platform, 1);
    const at = await wordAt(page, '.reveal section.present .shape li', 'Path');
    await click(page, at);
    await frames(page);
    await click(page, at);
    await frames(page);
    await press(page, 'Tab');
    await frames(page);
    await press(page, 'Escape');
    await frames(page);
    const indented = await render(page);
    assert.match(indented, /<li>Goal\s*<ul>\s*<li>Path<\/li>\s*<\/ul>\s*<\/li>/, 'Tab does not indent Path');
    assert.equal(await page.evaluate('window.BeesonEditor.selection()[0].matches("div.shape")'), true, 'the shape is not selected');
    // a nested item is part of the block of its item, hence Smaller sets Small on Goal, whose look
    // Path takes
    const look = (word) => page.evaluate(`(() => { const li = [...document.querySelectorAll('.reveal section.present .shape li')].find((e) => e.firstChild.data.trim() === ${js(word)}); const s = getComputedStyle(li); return s.fontSize + ' ' + s.color; })()`);
    const formats = { 'text.tone.accent': [/<li><span class="tone-accent">Goal\s*<\/span>/, '<li><span class="tone-accent">Path</span></li>'], 'text.smaller': [/<li class="small">Goal/, '<li>Path</li>'], 'text.bold': [/<li><strong>Goal\s*<\/strong>/, '<li><strong>Path</strong></li>'] };
    for (const [id, [outer, inner]] of Object.entries(formats)) {
      await exec(page, id);
      const after = await render(page);
      const shape = after.slice(after.indexOf('<h2>List</h2>'), after.indexOf('<h2>Objects</h2>'));
      assert.match(after, outer, `${id} does not format Goal`);
      assert.ok(shape.includes(inner), `${id} does not format the nested Path: ${js(shape)}`);
      if (id === 'text.smaller') assert.equal(await look('Path'), await look('Goal'), 'Path does not take the look of Small');
      await undo(page);
      assert.equal(await render(page), indented);
      await redo(page);
      assert.equal(await render(page), after);
      await undo(page);
    }
    // a nested item starts a sentence of its own, as a block does
    await exec(page, 'text.case.sentence');
    assert.equal(await render(page), indented, 'Sentence case changes the nested Path');
    await exec(page, 'text.tone.accent');
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });

  test(`after Dashes on a selected shape, its words are formatted by the Text pane (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    await click(page, await wordAt(page, '.reveal section.present .shape:not([data-locked]) p', 'Build'));
    await frames(page);
    await exec(page, 'text.list.ul');
    await frames(page);
    assert.match(await render(page), /<ul>\s*<li>Build the bridge<\/li>\s*<\/ul>/);
    assert.equal(await page.evaluate('window.BeesonEditor.selection()[0].matches("div.shape")'), true, 'the shape is not selected');
    for (const id of ['text.smaller', 'text.tone.accent', 'text.bold']) assert.equal((await state(page, id)).enabled, true, `${id} is disabled: ${js(await state(page, id))}`);
    const before = await render(page);
    await exec(page, 'text.bold');
    const after = await render(page);
    assert.notEqual(after, before, 'Bold does not change the words of the shape');
    assert.equal(after, before.replace('<li>Build the bridge</li>', '<li><strong>Build the bridge</strong></li>'));
    await undo(page);
    assert.equal(await render(page), before);
    await redo(page);
    assert.equal(await render(page), after);
    await saveAndReopen(page);
    assert.deepEqual(errors(page), []);
  });
}

const KINDS = ['rounded', 'rectangle', 'ellipse', 'triangle', 'arrow', 'arrow-both', 'brace', 'plus', 'equals'];
const mouse = (page, type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });

for (const platform of PLATFORMS) {
  test(`a shape is drawn with its geometry from the first move of the drag that draws it, with the readout (${platform})`, async (t) => {
    const page = await load(t, platform, 3);
    const box = await page.evaluate(`(() => { const r = Reveal.getCurrentSlide().getBoundingClientRect(); return { x: r.left, y: r.top, scale: r.width / 1920 }; })()`);
    let n = 0;
    for (const kind of KINDS) {
      await exec(page, `insert.shape.${kind}`);
      const from = { x: box.x + (200 + 150 * n) * box.scale, y: box.y + 300 * box.scale };
      await mouse(page, 'mouseMoved', from.x, from.y);
      await mouse(page, 'mousePressed', from.x, from.y);
      // the first move past the click distance, then the drag to 120 by 300 slide px
      for (const [dx, dy] of [[10, 8], [60, 150], [120, 300]]) {
        await mouse(page, 'mouseMoved', from.x + dx * box.scale, from.y + dy * box.scale);
        await frames(page);
        const shown = await page.evaluate(`(() => {
          const g = document.querySelector('.beeson-overlay .beeson-shape-ghost');
          const r = g && !g.hasAttribute('hidden') ? g.getBoundingClientRect() : null;
          const path = g?.querySelector('path');
          const ps = path ? getComputedStyle(path) : null;
          const out = document.querySelector('.beeson-overlay .beeson-offset');
          const m = document.querySelector('.beeson-overlay .beeson-marquee');
          return { r: r && { left: r.left, top: r.top, width: r.width, height: r.height }, kind: g?.dataset.kind, view: g?.getAttribute('viewBox'), d: path?.getAttribute('d'), stroke: ps?.stroke, fill: ps?.fill,
            readout: out && !out.hidden ? out.textContent : null, marquee: !!m && !m.hidden && m.getBoundingClientRect().width > 0 };
        })()`);
        const at = `${kind} at ${dx} by ${dy}`;
        assert.ok(shown.r, `${at}: the geometry is not drawn during the drag`);
        assert.equal(shown.kind, kind, at);
        assert.ok(Math.abs(shown.r.left - from.x) < 1.5 && Math.abs(shown.r.top - from.y) < 1.5, `${at}: ${js(shown.r)}`);
        assert.ok(Math.abs(shown.r.width - dx * box.scale) < 1.5 && Math.abs(shown.r.height - dy * box.scale) < 1.5, `${at}: ${js(shown.r)}`);
        assert.equal(shown.readout, `w: ${dx} px  h: ${dy} px`, at);
        assert.equal(shown.marquee, false, `${at}: a plain rectangle is drawn over the shape`);
        assert.notEqual(shown.stroke, 'none', at);
        // the path of a drawn geometry is the path of the theme, in slide px
        const [, , w, h] = shown.view.split(' ').map(Number);
        assert.ok(Math.abs(w - dx) < 0.6 && Math.abs(h - dy) < 0.6, `${at}: ${shown.view}`);
        if (['triangle', 'arrow', 'arrow-both', 'brace', 'plus', 'equals'].includes(kind)) assert.equal(shown.d, shapePath(kind, w, h, 3), at);
        else assert.equal((shown.d.match(/A/g) ?? []).length, { rectangle: 0, rounded: 4, ellipse: 2 }[kind], `${at}: ${shown.d}`);
        if (kind === 'brace') assert.equal(shown.fill, 'none', at);
      }
      await mouse(page, 'mouseReleased', from.x + 120 * box.scale, from.y + 300 * box.scale);
      await frames(page);
      assert.equal(await page.evaluate(`(() => { const g = document.querySelector('.beeson-overlay .beeson-shape-ghost'); return !!g && !g.hasAttribute('hidden') && g.getBoundingClientRect().width > 0; })()`), false, `${kind}: the geometry is left after the release`);
      const made = await page.evaluate(`(() => { const el = window.BeesonEditor.selection()[0]; return [el.matches('.shape'), el.classList.contains(${js(kind)}), el.style.width, el.style.height]; })()`);
      assert.deepEqual(made, [true, kind !== 'rectangle', '120px', '300px'], kind);
      n++;
    }
    // Esc during the drag takes the geometry off and draws nothing
    const before = await render(page);
    await exec(page, 'insert.shape.triangle');
    const from = { x: box.x + 300 * box.scale, y: box.y + 700 * box.scale };
    await mouse(page, 'mouseMoved', from.x, from.y);
    await mouse(page, 'mousePressed', from.x, from.y);
    await mouse(page, 'mouseMoved', from.x + 100, from.y + 100);
    await frames(page);
    await press(page, 'Escape');
    await mouse(page, 'mouseReleased', from.x + 100, from.y + 100);
    await frames(page);
    assert.equal(await page.evaluate(`(() => { const g = document.querySelector('.beeson-overlay .beeson-shape-ghost'); return !!g && !g.hasAttribute('hidden') && g.getBoundingClientRect().width > 0; })()`), false);
    assert.equal(await render(page), before);
    assert.deepEqual(errors(page), []);
  });
}

// the rows of the sheet of keyboard shortcuts by its group and label, opened from the Help menu
async function sheetRows(page) {
  await exec(page, 'help.keys');
  await frames(page);
  const rows = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('dialog.beeson-edit-keys section')].flatMap((s) => [...s.querySelectorAll('.row')].map((r) => [s.querySelector('h3').textContent + ' > ' + r.firstChild.textContent, r.lastChild.textContent])))`);
  await press(page, 'Escape');
  await frames(page);
  return rows;
}

// the objects of the slide of objects in the order of the Object List, from back to front, i.e.
// from its last row up, in which Tab walks them as in Keynote and PowerPoint
const ORDER = [['Objects'], ['A paragraph.'], ['Back'], ['Locked'], ['One', 'Two'], ['line']];

for (const platform of PLATFORMS) {
  test(`Tab and Shift+Tab select the next and the previous object in the order of the Object List, from back to front, around both ends (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await exec(page, 'view.objects');
    await frames(page);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].map((r) => r.textContent.trim())`);
    assert.deepEqual(rows.filter((r) => !/: (One|Two)$/.test(r)), ['Line', 'Group', 'Ellipse: Locked', 'Rectangle: Back', 'Text: A paragraph.', 'Text: Objects']);
    await click(page, await wordAt(page, '.reveal section.present .shape p', 'Back'));
    await frames(page);
    assert.deepEqual(await selected(page), ['Back']);
    const at = ORDER.findIndex((o) => o[0] === 'Back');
    for (let k = 1; k <= ORDER.length; k++) {
      await press(page, 'Tab');
      await frames(page);
      assert.deepEqual(await selected(page), ORDER[(at + k) % ORDER.length], `Tab ${k}`);
    }
    for (let k = 1; k <= ORDER.length + 1; k++) {
      await press(page, 'Shift+Tab');
      await frames(page);
      assert.deepEqual(await selected(page), ORDER[(at - k + 2 * ORDER.length) % ORDER.length], `Shift+Tab ${k}`);
    }
    // the locked shape is selected as a click selects it, and it is not moved by a key
    while (!(await selected(page)).includes('Locked')) await press(page, 'Tab');
    await press(page, 'ArrowRight');
    await frames(page);
    assert.equal(await render(page), page.source);
    const sheet = await sheetRows(page);
    const keys = platform === 'mac' ? ['⇥', '⇧⇥'] : ['Tab', 'Shift+Tab'];
    const listed = js(Object.entries(sheet).filter(([, k]) => k.includes('⇥') || k.includes('Tab')));
    assert.equal(sheet['Other > Select Next Object'], keys[0], listed);
    assert.equal(sheet['Other > Select Previous Object'], keys[1], listed);
    assert.deepEqual(errors(page), []);
  });

  test(`Tab keeps its meaning in a list item, in a table cell, and in a field of a pane (${platform})`, async (t) => {
    const page = await load(t, platform, 4);
    // in a list item it indents the item
    await click(page, await wordAt(page, '.reveal section.present li', 'Second'));
    await frames(page);
    await press(page, 'Tab');
    await frames(page);
    assert.notEqual(await render(page), page.source, 'Tab does not indent the list item');
    assert.equal(await page.evaluate('!!document.activeElement.closest("li") && document.activeElement.isContentEditable'), true);
    await undo(page);
    assert.equal(await render(page), page.source);
    // in a table cell it moves to the next cell
    await click(page, await wordAt(page, '.reveal section.present td', 'A1'));
    await frames(page);
    await press(page, 'Tab');
    await frames(page);
    assert.equal(await page.evaluate('(getSelection().anchorNode?.parentElement?.closest("td") ?? getSelection().anchorNode)?.textContent'), 'B1');
    // in a field of a pane it moves the focus and keeps the selection
    await press(page, 'Escape');
    await click(page, await wordAt(page, '.reveal section.present h2', 'Text'));
    await press(page, 'Escape');
    await frames(page);
    const before = await selected(page);
    assert.deepEqual(before, ['Text']);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
    await page.evaluate(`[...document.querySelectorAll('.beeson-edit-inspector input, .beeson-edit-inspector button')].find((i) => i.getBoundingClientRect().width && !i.disabled).focus()`);
    const field = await page.evaluate('document.activeElement.outerHTML.slice(0, 80)');
    await press(page, 'Tab');
    await frames(page);
    assert.deepEqual(await selected(page), before, 'Tab in a field changes the selection');
    assert.notEqual(await page.evaluate('document.activeElement.outerHTML.slice(0, 80)'), field, 'Tab does not move the focus');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
