// a seeded run of 200 random edits of the document model on the demo deck, with a save about every
// 25 edits, i.e. the text written and opened again in place. each save pairs with zero problems,
// and after every edit is undone the text is the file byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';

const SEED = 20261110;
const EDITS = 200;

// the run, in the page. the random numbers are those of mulberry32 from the seed
const run = (seed, edits) => `(async () => {
  const E = window.BeesonEditor;
  const doc = E.doc;
  let s = ${seed} >>> 0;
  const random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (list) => list[Math.floor(random() * list.length)];
  const root = document.querySelector('.reveal .slides');
  const slides = () => [...root.querySelectorAll(':scope > section')];
  const inFile = (el) => { try { doc.tagState(el); return true; } catch { return false; } };
  const children = (slide) => [...slide.children].filter((c) => !c.hasAttribute('data-generated') && inFile(c));
  const elements = () => slides().flatMap(children);
  const layouts = ['title', 'section', 'content', 'narrow', 'wide', 'figure', 'split', 'closing'];
  const kinds = ['text', 'image', 'video', 'table', 'formula', 'code', 'qr', 'plot', 'backdrop'];
  const options = { image: { src: 'demo/figure-dark.png', alt: 'A figure' }, video: { src: 'demo/clip-dark.mp4', poster: 'demo/clip-dark.png' } };
  const log = [];
  const saves = [];
  const ops = [
    async () => { const l = pick(layouts); await doc.insertSlide(l, pick([...slides(), null])); return 'slide ' + l; },
    async () => { const k = pick(kinds); const sl = pick(slides()); await doc.insertElement(k, sl, pick([...children(sl), null]), options[k] ?? {}); return 'element ' + k; },
    async () => { await doc.duplicate(pick(slides())); return 'duplicate slide'; },
    async () => { const el = pick(elements()); if (!el) return 'none'; await doc.duplicate(el); return 'duplicate ' + el.localName; },
    async () => { if (slides().length < 4) return 'none'; await doc.remove(pick(slides())); return 'remove slide'; },
    async () => { const el = pick(elements()); if (!el) return 'none'; await doc.remove(el); return 'remove ' + el.localName; },
    async () => { const sl = pick(slides()); await doc.move(sl, root, pick([...slides(), null])); return 'move slide'; },
    async () => {
      const el = pick(elements());
      if (!el) return 'none';
      const to = pick(slides());
      await doc.move(el, to, pick([...children(to).filter((c) => c !== el), null]));
      return 'move ' + el.localName;
    },
    async () => { const sl = pick(slides()); doc.hide(sl, !sl.hasAttribute('data-visibility')); return 'hide'; },
    async () => {
      const el = pick(elements());
      if (!el) return 'none';
      const edit = pick([
        { classes: { small: !el.classList.contains('small') } },
        { fragment: !el.classList.contains('fragment'), index: Math.floor(random() * 4) + 1 },
        { style: { translate: Math.round(random() * 80 - 40) + 'px ' + Math.round(random() * 80 - 40) + 'px' } },
        { translate: null },
        { attrs: { 'data-tone': pick(['violet', 'blue', null]) } },
      ]);
      doc.setTag(el, edit);
      return 'tag ' + el.localName + ' ' + JSON.stringify(edit);
    },
    async () => {
      const el = pick(elements().filter((e) => e.localName === 'p' || e.localName === 'h3'));
      if (!el) return 'none';
      await doc.retag(el, el.localName === 'p' ? 'h3' : 'p');
      return 'retag ' + el.localName;
    },
  ];
  for (let i = 0; i < ${edits}; i++) {
    const what = await pick(ops)();
    log.push(what);
    if (i % 25 === 24) {
      const text = E.render();
      const status = E.open(text, false);
      const again = E.render();
      saves.push({ at: i, problems: status.problems, same: again === text });
    }
  }
  let undone = 0;
  while (E.status().undo) {
    await E.undo();
    undone++;
  }
  return { log, saves, undone, text: E.render(), problems: E.status().problems };
})()`;

test('a seeded run of 200 edits with saves is the file again after every edit is undone', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const text = readFileSync('index.html', 'utf8');
  const page = await browser.newPage();
  await page.goto(deckUrl('index.html', 'edit&still'));
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`)).problems, []);
  const result = await page.evaluate(run(SEED, EDITS));
  assert.equal(result.log.length, EDITS);
  assert.ok(result.log.filter((w) => w !== 'none').length > EDITS * 0.9, result.log.join('\n'));
  for (const save of result.saves) {
    assert.deepEqual(save.problems, [], `the save after edit ${save.at}`);
    assert.ok(save.same, `the text of the save after edit ${save.at} is rendered again`);
  }
  if (result.text !== text) {
    let i = 0;
    while (i < text.length && result.text[i] === text[i]) i++;
    assert.fail(`the text after the undos differs at ${i}: ${JSON.stringify(result.text.slice(i - 80, i + 120))}\nexpected: ${JSON.stringify(text.slice(i - 80, i + 120))}`);
  }
  assert.deepEqual(page.errors, []);
});
