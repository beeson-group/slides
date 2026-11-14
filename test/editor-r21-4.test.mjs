// regression tests of R21.4 on both platforms, for the findings V14 and V15 with V21 of the review
// of round 8: a dimmed step in the presenter display and in Preview Transition, and the marks of a
// centered list

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const SLIDE = '.reveal .slides > section.present';
const GHOST = '0.25';

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
const wait = (page, ms = 300) => page.evaluate(`new Promise((d) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => d(true))), ${ms}))`);
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

async function load(t, platform, deck, slide = 0) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await wait(page);
  return page;
}

// the computed opacity of the paragraph that starts with each of words, in the clone drawn into
// the first element that matches host
const opacities = (page, host, words) => page.evaluate(`(() => {
  const root = document.querySelector(${js(host)})?.shadowRoot;
  if (!root) return null;
  return ${js(words)}.map((w) => { const p = [...root.querySelectorAll('p')].find((e) => e.textContent.startsWith(w)); return p ? getComputedStyle(p).opacity : null; });
})()`);

// V14. on slide 3 of the fixture of R20.8, Zeta is a step set to Dim at index 1, which the show
// draws at the ghost opacity from its step on. Eta and Theta are plain steps after it
for (const platform of PLATFORMS) {
  test(`V14 ${platform}: the presenter display draws a step set to Dim at the ghost opacity from its step on`, async (t) => {
    const page = await load(t, platform, 'test/pages/editor-r20-8.html', 2);
    await page.evaluate('(() => { window.open = () => null; return true; })()');
    await press(page, 'Alt+Enter');
    await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open] .shot.current .pic')`, 20000);
    const current = [];
    const next = [];
    for (let k = 0; k < 4; k++) {
      await wait(page, 400);
      current.push(await opacities(page, 'dialog.beeson-edit-presenter[open] .shot.current .pic', ['Zeta', 'Eta']));
      next.push(await opacities(page, 'dialog.beeson-edit-presenter[open] .shot.next .pic', ['Zeta']));
      await press(page, 'ArrowRight');
    }
    assert.deepEqual(current.map((s) => s[0]), ['1', GHOST, GHOST, GHOST], 'Zeta on the current slide');
    // a plain step before the last shown one is still dimmed to 0.45, as in the show
    assert.deepEqual(current.map((s) => s[1]), ['1', '1', '1', '0.45'], 'Eta on the current slide');
    assert.equal(next[0][0], GHOST, 'Zeta on the next step');
    assert.deepEqual(errors(page), []);
  });

  test(`V14 ${platform}: Preview Transition draws a step set to Dim at the ghost opacity on the slide it leaves`, async (t) => {
    const page = await load(t, platform, 'test/pages/editor-r20-8.html', 2);
    await exec(page, 'slide.previewTransition');
    await page.waitFor(`document.querySelector('.beeson-edit-preview')?.dataset.phase === 'play'`, 10000);
    assert.deepEqual(await opacities(page, '.beeson-edit-preview .shot', ['Zeta', 'Eta', 'Theta']), [GHOST, '1', '1']);
    await press(page, 'Escape');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}

// the left of the mark, the left and the right of the first words, and the left and the right of
// the box of each item of the n-th list of the slide, and the width of the list, in slide px from
// the left of the list. the mark is the box of the ::before of its item, read from the box model of
// the DevTools protocol, since a centered list draws it in the line of the words
const marks = async (page, n) => {
  const items = await page.evaluate(`(() => {
  const list = document.querySelectorAll('${SLIDE} > :is(ul, ol)')[${n}];
  const box = list.getBoundingClientRect();
  const scale = box.width / list.offsetWidth;
  window.probed = [...list.children];
  return [...list.children].map((li) => {
    const r = li.getBoundingClientRect();
    const node = li.firstChild;
    const range = document.createRange();
    range.setStart(node, node.data.length - node.data.trimStart().length);
    range.setEnd(node, node.data.trimEnd().length);
    const words = range.getBoundingClientRect();
    const at = (x) => Math.round((x - box.left) / scale);
    return { origin: box.left, scale, words: at(words.left), end: at(words.right), left: at(r.left), right: at(r.right), width: Math.round(box.width / scale) };
  });
})()`);
  // the protocol hands out the node of an object only after the document is requested
  await page.send('DOM.getDocument', { depth: -1 });
  const { result } = await page.send('Runtime.evaluate', { expression: 'window.probed', returnByValue: false });
  const { result: props } = await page.send('Runtime.getProperties', { objectId: result.objectId, ownProperties: true });
  const lis = props.filter((p) => /^\d+$/.test(p.name)).sort((a, b) => a.name - b.name);
  for (const [i, m] of items.entries()) {
    const { nodeId } = await page.send('DOM.requestNode', { objectId: lis[i].value.objectId });
    const { node } = await page.send('DOM.describeNode', { nodeId, depth: 1 });
    const before = node.pseudoElements.find((p) => p.pseudoType === 'before');
    const { model } = await page.send('DOM.getBoxModel', { backendNodeId: before.backendNodeId });
    m.mark = Math.round((model.border[0] - m.origin) / m.scale);
    delete m.origin;
    delete m.scale;
  }
  return items;
};

// V15 and V21. each mark of a centered list is drawn beside the words of its item, at the distance
// of an uncentered list, and the item with its mark is centered on the list. the four lists of
// slide 1 of the fixture of R20.4 are a list of chevrons, of dots, of dashes, and of numbers
const KINDS = [['chevrons', '<ul class="center">\n    <li>Alpha'], ['dots', '<ul class="dots center">'], ['dashes', '<ul class="dashes center">'], ['numbers', '<ol start="4" class="center">']];
for (const platform of PLATFORMS) {
  test(`V15 ${platform}: Center draws the mark of each item of a list of chevrons, dots, dashes, or numbers beside its centered words`, async (t) => {
    const page = await load(t, platform, 'test/pages/editor-r20-4.html');
    for (const [n, [kind, written]] of KINDS.entries()) {
      const before = await marks(page, n);
      await page.evaluate(`(() => { const li = document.querySelectorAll('${SLIDE} > :is(ul, ol)')[${n}].querySelector('li'); li.focus(); getSelection().collapse(li.firstChild, 1); return true; })()`);
      await wait(page, 100);
      await exec(page, 'text.align.center');
      await wait(page);
      assert.ok((await render(page)).includes(written), `${kind}: the list is not written with the class center`);
      for (const [i, m] of (await marks(page, n)).entries()) {
        // an item that holds a nested list is as wide as the nested list, and its words are centered in it
        assert.ok(Math.abs(m.words - m.mark - (before[i].words - before[i].mark)) <= 2, `${kind}, item ${i + 1}: the mark at ${js(m)} is not beside its words`);
        // the item with its mark runs from its words less the padding of an uncentered item to the end of its words
        const start = m.words - (before[i].words - before[i].left);
        assert.ok(Math.abs(start + m.end - m.width) <= 2 && start > 0, `${kind}, item ${i + 1}: the item at ${js(m)} is not centered on the list`);
      }
    }
    for (let i = 0; i < KINDS.length; i++) await undo(page);
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
