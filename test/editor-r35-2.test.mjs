// the Steps pane and the Object List, R35.2, on both platforms. after a flip of the mode, the rows
// of a dark and light pair of pictures in the section are bound to the twin that is shown. a folded
// group row of the Object List selects and locks the members that its group has now, after a
// Delete, an undo, a Duplicate of a member, and Arrange > Group

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { click, editorPage, press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r35-2.html';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

let last = null;
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}).then(() => true)`);

async function deckPage(platform, slide = 0) {
  await last?.close().catch(() => {});
  const page = await editorPage(browser, { deck: DECK, query: `edit&still&edit-platform=${platform}`, page: { width: 1600, height: 1000 }, clear: true });
  last = page;
  if (slide) await page.evaluate(`Reveal.slide(${slide})`);
  if (!(await page.evaluate(`window.BeesonEditor.state('view.objects').checked`))) await exec(page, 'view.objects');
  await frames(page);
  return page;
}

// the selection, each element named by its class or its words, and marked when it is hidden or
// out of the page
const SELECTION = `window.BeesonEditor.selection().map((e) => (e.localName === 'img' ? 'img.' + e.className.split(' ')[0] : e.textContent.trim()) + (!e.isConnected ? ' (detached)' : e.getClientRects().length ? '' : ' (hidden)'))`;
const selection = async (page) => { await frames(page); return page.evaluate(SELECTION); };

// the center of the row of the Object List with the name, or of the part of this row
const objectRow = (page, name, part = null) => page.evaluate(`(() => {
  const r = [...document.querySelectorAll('.beeson-edit-objects .row')].find((r) => r.querySelector('.name').textContent === ${JSON.stringify(name)});
  if (!r) return null;
  const b = (${part ? `r.querySelector(${JSON.stringify(part)})` : 'r'}).getBoundingClientRect();
  return { x: b.left + b.width * ${part ? 0.5 : 0.6}, y: b.top + b.height / 2 };
})()`);
const objectRows = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].map((r) => r.getAttribute('aria-level') + ':' + r.querySelector('.name').textContent + (r.getAttribute('aria-expanded') ? ' [' + r.getAttribute('aria-expanded') + ']' : ''))`);

// the words of the row of the picture pair in the Steps pane, and the point at its center
const STEP_ROW = `[...document.querySelectorAll('.beeson-edit-side .rows .row')].find((r) => r.textContent.includes('A figure'))`;
const stepRow = (page) => page.evaluate(`(() => {
  const r = ${STEP_ROW};
  if (!r) return null;
  const b = r.getBoundingClientRect();
  return { text: r.querySelector('.body').textContent, x: b.left + b.width * 0.6, y: b.top + b.height / 2 };
})()`);

// the picture that is shown, the marked rows of the two lists, whether the fields of the step are
// shown, and the picture at which the number of the step is drawn
const MARKED = `({
  shown: [...document.querySelectorAll('section.present img')].filter((i) => i.getClientRects().length).map((i) => 'img.' + i.className.split(' ')[0]),
  steps: [...document.querySelectorAll('.beeson-edit-side .rows .row.selected')].map((r) => r.querySelector('.body').textContent),
  objects: [...document.querySelectorAll('.beeson-edit-objects .row[aria-selected="true"]')].map((r) => r.textContent),
  fields: !document.querySelector('.beeson-edit-side .detail').classList.contains('off'),
  badge: [...document.querySelectorAll('.beeson-badge')].map((b) => b.owner?.localName === 'img' ? 'img.' + b.owner.className.split(' ')[0] : null).filter(Boolean),
})`;

// asserts that each way to the picture pair reaches the twin that is shown, and that its Steps row
// reads the alt of this twin
async function pairBound(page, twin, alt) {
  await frames(page);
  await click(page, await objectRow(page, 'Image'));
  assert.deepEqual(await selection(page), [twin], 'the row Image of the Object List selects the hidden twin');
  const row = await stepRow(page);
  assert.ok(row.text.startsWith(alt), `the Steps row reads ${row.text}`);
  const marked = await page.evaluate(MARKED);
  assert.deepEqual(marked.shown, [twin]);
  assert.deepEqual(marked.badge, [twin], 'the number of the step is not drawn at the shown picture');
  assert.deepEqual(marked.objects, ['Image']);
  assert.equal(marked.steps.length, 1, 'the row Image of the Object List does not mark the Steps row');
  await press(page, 'Escape');
  await frames(page);
  const at = await stepRow(page);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  await frames(page);
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.beeson-hover')].map((e) => e.localName + '.' + [...e.classList].find((c) => /^for-/.test(c)))`), [twin], 'the hover on the Steps row marks the hidden twin');
  await click(page, at);
  assert.deepEqual(await selection(page), [twin], 'the Steps row selects the hidden twin');
  await press(page, 'Escape');
  // a click on the picture on the slide marks its rows and shows the fields Start, Delay, and Effect
  await click(page, { x: 100, y: 950 });
  await click(page, 'section.present img');
  assert.deepEqual(await selection(page), [twin]);
  const on = await page.evaluate(MARKED);
  assert.equal(on.steps.length, 1, 'a click on the shown picture does not mark its Steps row');
  assert.ok(on.steps[0].startsWith(alt));
  assert.deepEqual(on.objects, ['Image']);
  assert.equal(on.fields, true, 'the fields Start, Delay, and Effect are hidden');
}

for (const platform of PLATFORMS) {
  // the pair of slide 1 has one alt, hence the words of its Steps row stay the same at a flip, and
  // the pair of slide 3 has two alts
  for (const [slide, dark, light] of [[0, 'A figure', 'A figure'], [2, 'A figure, dark', 'A figure, light']]) {
    test(`the rows of the Steps pane and of the Object List follow the twin shown after a flip of the mode, on slide ${slide + 1} (${platform})`, async () => {
      const page = await deckPage(platform, slide);
      await exec(page, 'view.steps');
      await frames(page);
      await pairBound(page, 'img.for-dark', dark);
      // D flips the mode while the hidden twin of the next mode is selected
      await press(page, 'Escape');
      await click(page, 'section.present img');
      await press(page, 'D');
      await frames(page);
      assert.equal(await page.evaluate('document.documentElement.dataset.theme'), 'light');
      await pairBound(page, 'img.for-light', light);
      // View > Slide in Dark Mode flips it back, with the selection cleared
      await press(page, 'Escape');
      await exec(page, 'view.slideDark');
      await frames(page);
      assert.equal(await page.evaluate('document.documentElement.dataset.theme'), 'dark');
      await pairBound(page, 'img.for-dark', dark);
      assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    });
  }

  test(`a folded group row selects and locks the members of its group after a Delete and its undo (${platform})`, async () => {
    const page = await deckPage(platform, 1);
    await click(page, await objectRow(page, 'Rectangle: Gamma'));
    await click(page, await objectRow(page, 'Group', '.twist'));
    assert.deepEqual(await objectRows(page), ['1:Rectangle: Delta', '1:Group [false]', '1:Text: A paragraph.', '1:Text: Groups']);
    assert.deepEqual(await selection(page), ['Gamma']);
    await press(page, 'Delete');
    await frames(page);
    await click(page, await objectRow(page, 'Group'));
    assert.deepEqual(await selection(page), ['Alpha', 'Beta'], 'the folded row selects the deleted member');
    await click(page, await objectRow(page, 'Group', '.lock'));
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('section.present .shape[data-locked]').length`), 2);
    // the undo of the lock and of the Delete brings the file back
    await press(page, 'Mod+Z');
    await press(page, 'Mod+Z');
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    await click(page, await objectRow(page, 'Group'));
    assert.deepEqual(await selection(page), ['Alpha', 'Beta', 'Gamma'], 'the folded row does not select the member brought back by the undo');
    assert.deepEqual(await objectRows(page), ['1:Rectangle: Delta', '1:Group [false]', '1:Text: A paragraph.', '1:Text: Groups']);
  });

  test(`a folded group row selects and locks the members of its group after a Duplicate and Arrange > Group (${platform})`, async () => {
    const page = await deckPage(platform, 1);
    await click(page, await objectRow(page, 'Rectangle: Gamma'));
    await click(page, await objectRow(page, 'Group', '.twist'));
    await exec(page, 'edit.duplicate');
    await frames(page);
    // the copy of a lone member is put outside the group, by copiedGroups of model/groups.ts
    const group = await page.evaluate(`[...document.querySelectorAll('section.present .shape')].map((s) => s.getAttribute('data-group'))`);
    assert.deepEqual(group, ['g1', 'g1', 'g1', null, null]);
    assert.deepEqual(await objectRows(page), ['1:Rectangle: Delta', '1:Rectangle: Gamma', '1:Group [false]', '1:Text: A paragraph.', '1:Text: Groups']);
    await click(page, await objectRow(page, 'Group'));
    assert.deepEqual(await selection(page), ['Alpha', 'Beta', 'Gamma']);
    await click(page, await objectRow(page, 'Group', '.lock'));
    await frames(page);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('section.present .shape')].map((s) => s.hasAttribute('data-locked'))`), [true, true, true, false, false]);
    assert.equal(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].find((r) => r.querySelector('.name').textContent === 'Group').querySelector('.lock').getAttribute('aria-pressed')`), 'true');
    await press(page, 'Mod+Z');
    await frames(page);
    // Arrange > Group of the folded group and Delta puts both in a new group, under which the
    // folded row keeps its three members
    await click(page, await objectRow(page, 'Group'));
    await click(page, await objectRow(page, 'Rectangle: Delta'), { modifiers: 'Shift' });
    assert.deepEqual(await selection(page), ['Alpha', 'Beta', 'Gamma', 'Delta']);
    await exec(page, 'arrange.group');
    await frames(page);
    assert.deepEqual(await objectRows(page), ['1:Group [true]', '2:Rectangle: Delta', '2:Group [false]', '1:Rectangle: Gamma', '1:Text: A paragraph.', '1:Text: Groups']);
    // the folded row of g1, under the row of the new group
    const inner = (part) => page.evaluate(`(() => { const r = [...document.querySelectorAll('.beeson-edit-objects .row')].filter((r) => r.querySelector('.name').textContent === 'Group')[1]; const b = (${part ? `r.querySelector('${part}')` : 'r'}).getBoundingClientRect(); return { x: b.left + b.width * ${part ? 0.5 : 0.6}, y: b.top + b.height / 2 }; })()`);
    await click(page, await inner());
    assert.deepEqual(await selection(page), ['Alpha', 'Beta', 'Gamma']);
    await click(page, await inner('.lock'));
    await frames(page);
    assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('section.present .shape')].map((s) => s.hasAttribute('data-locked'))`), [true, true, true, false, false]);
    await press(page, 'Mod+Z');
    await frames(page);
    // the undo of the Group and of the Duplicate leaves the folded row with the three members
    await press(page, 'Mod+Z');
    await press(page, 'Mod+Z');
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    await click(page, await objectRow(page, 'Group'));
    assert.deepEqual(await selection(page), ['Alpha', 'Beta', 'Gamma'], 'the folded row selects the copy that the undo took off');
    await click(page, await objectRow(page, 'Group', '.lock'));
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelectorAll('section.present .shape[data-locked]').length`), 3);
    await press(page, 'Mod+Z');
    await press(page, 'Mod+Shift+Z');
    await frames(page);
    // the rendered text, opened again, has the three locks and every block paired
    const text = await page.evaluate('window.BeesonEditor.render()');
    assert.equal((text.match(/data-locked/g) ?? []).length, 3);
    assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(text)})`)).problems, []);
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), text);
  });
}
