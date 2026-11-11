// regression tests of R14.4 on both platforms with trusted input: the declarations of the layer
// commands of commands/order.ts are taken off the whole slide once it is drawn in the order of the
// file again (juror item 3b), and a layer command passes a text in the flow that was never moved
// (D25 and D26)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
// the slide of the demo deck with a heading, a paragraph, a list, and a figure in a zone
const FIGURES = [...readFileSync(DECK, 'utf8').matchAll(/<section[\s\S]*?<\/section>/g)].findIndex((m) => m[0].includes('Figures are first class citizens'));
const PLATFORMS = ['mac', 'other'];
const KEYS = {
  mac: { front: 'Mod+Shift+F', forward: 'Mod+Alt+Shift+F', backward: 'Mod+Alt+Shift+B', back: 'Mod+Shift+B' },
  other: { front: 'Mod+Shift+ArrowUp', forward: 'Mod+ArrowUp', backward: 'Mod+ArrowDown', back: 'Mod+Shift+ArrowDown' },
};
const S = '.reveal section.present';
const EL = { h2: `${S} > h2`, p: `${S} > p`, ul: `${S} > ul`, figure: `${S} > figure` };
const LIST_KEY = { mac: 'Mod+Shift+L', other: 'Alt+F10' };
const ROW = '.beeson-edit-objects .row';

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));
const orders = async (page) => Object.fromEntries(await Promise.all(['front', 'forward', 'backward', 'back'].map(async (o) => [o, (await state(page, `arrange.order.${o}`)).enabled])));
const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((e) => e.localName)`);
// the rows of the object list from front to back, by their kind and the first word of their name
const rows = (page) => page.evaluate(`[...document.querySelectorAll(${js(ROW)})].map((r) => r.querySelector('.name').textContent.replace(/^(\\w+)(: (\\S+))?.*$/, '$1:$3'))`);

async function load(t, platform) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${DECK}?edit&still&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${FIGURES})`);
  await frames(page);
  return page;
}

// the element name of the slide selected as an object, by a click and Esc out of its text
async function pick(page, name) {
  await click(page, EL[name]);
  await frames(page);
  if (js(await selected(page)) !== js([name])) await press(page, 'Escape');
  await frames(page);
  assert.deepEqual(await selected(page), [name]);
}

async function layer(page, platform, name, order) {
  await pick(page, name);
  await press(page, KEYS[platform][order]);
  await frames(page);
}

// the child of the slide drawn at the center of the element name, past the chrome of the editor
const drawnAt = (page, name) => page.evaluate(`(() => {
  const r = document.querySelector(${js(EL[name])}).getBoundingClientRect();
  const hit = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((e) => e.closest(${js(S)}));
  return hit ? hit.closest(${js(S + ' > *')}).localName : null;
})()`);

for (const platform of PLATFORMS) {
  test(`${platform}: the declarations of the layer commands of several elements are taken off once the slide is in the order of the file`, async (t) => {
    const page = await load(t, platform);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    const opened = await rows(page);
    await layer(page, platform, 'p', 'front');
    await layer(page, platform, 'figure', 'front');
    await layer(page, platform, 'p', 'backward');
    assert.deepEqual(await rows(page), opened);
    assert.equal(await render(page), page.source, 'a declaration is left on an element that the last command did not move');
    await layer(page, platform, 'p', 'front');
    await layer(page, platform, 'ul', 'front');
    await layer(page, platform, 'p', 'backward');
    await layer(page, platform, 'figure', 'front');
    assert.deepEqual(await rows(page), opened);
    assert.equal(await render(page), page.source, 'a declaration is left on the list or the figure');
    const { text } = await saveAndReopen(page, `.r14-4-clean-${platform}.html`);
    assert.equal(text, page.source);
    assert.deepEqual(errors(page), []);
  });

  test(`${platform}: Send to Back and Send Backward pass the texts in the flow that the object list shows under a list`, async (t) => {
    const page = await load(t, platform);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    await pick(page, 'ul');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: true, back: true }, 'a command that passes a text in the flow is dimmed');
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.notEqual(await render(page), page.source);
    assert.equal((await rows(page)).at(-1), 'Text:Dark', 'the list is not at the back of the object list');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source);
    await pick(page, 'p');
    await press(page, KEYS[platform].backward);
    await frames(page);
    assert.equal((await rows(page)).at(-1), 'Text:Export', 'Send Backward does not pass the heading');
    await undo(page);
    await frames(page);
    assert.equal(await render(page), page.source, 'the undo of Send Backward does not give back the file');
  });

  test(`${platform}: a figure moved over the heading is sent behind it, in the object list and on the slide`, async (t) => {
    const page = await load(t, platform);
    await press(page, LIST_KEY[platform]);
    await frames(page);
    await pick(page, 'figure');
    await page.evaluate(`window.BeesonEditor.doc.setTag(document.querySelector(${js(EL.figure)}), { style: { translate: '-530px -40px' } })`);
    await frames(page);
    assert.equal(await drawnAt(page, 'h2'), 'figure');
    await press(page, KEYS[platform].back);
    await frames(page);
    assert.equal((await rows(page)).at(-1), 'Figure:Zero-velocity', 'the figure is not at the back of the object list');
    assert.equal(await drawnAt(page, 'h2'), 'h2', 'the figure is still drawn over the heading');
    assert.deepEqual(await orders(page), { front: true, forward: true, backward: false, back: false });
  });
}
