// the work of R12.4 on both platforms: the place of a new table and of a new plot, a text laid over
// a figure by a change of the layout, the pair of an image for the two modes, the caption of a
// picture, the slide made from the Content tile, and the name and the path of an unsaved picture.
// each edit of the file is checked byte for byte, after an undo and a redo, and after a save and
// an open

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { click, drag, press, saveAndReopen } from './helpers/editor.mjs';

const DECK = 'index.html';
// the slides of index.html with a list beside a backdrop, with a figure in a zone, and with a video
const STEPS = 2;
const FIGURES = 4;
const VIDEO = 10;
// the slide of editor-layouts.html with a heading and a backdrop
const GLIDE = 13;
const PLATFORMS = ['mac', 'other'];
const DARK_FILE = resolve('demo/figure-dark.png');
const LIGHT_FILE = resolve('demo/figure-light.png');

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
const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg !== undefined ? `, ${js(arg)}` : ''})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the box in slide px of each shown element of selector on the current slide
const boxes = (page, selector) => page.evaluate(`(() => {
  const slide = document.querySelector('.reveal .slides > section.present, .reveal .slides > section > section.present');
  const s = slide.getBoundingClientRect();
  const k = s.width / slide.offsetWidth;
  return [...slide.querySelectorAll(${js(selector)})].filter((e) => e.getClientRects().length).map((e) => {
    const r = e.getBoundingClientRect();
    return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, right: (r.right - s.left) / k, bottom: (r.bottom - s.top) / k };
  });
})()`);
const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

// the editor on a deck served over HTTP, with the storage of the origin emptied first, and with
// slide n shown
async function load(t, platform, { deck = DECK, n = 0, size = { width: 1600, height: 1000 }, query = '' } = {}) {
  const page = await browser.newPage(size);
  t.after(() => page.close().catch(() => {}));
  await page.goto(`${server.origin}/theme/beeson.css`);
  await page.evaluate('localStorage.clear()');
  await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}${query}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(deck, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${n})`);
  await frames(page);
  return page;
}

// the rendered text differs from before, an undo gives before and a redo the edited text byte for
// byte, and the saved text is opened again without problems
async function checkEdit(page, before, name) {
  const edited = await render(page);
  assert.notEqual(edited, before);
  await undo(page);
  assert.equal(await render(page), before);
  await redo(page);
  assert.equal(await render(page), edited);
  const { text } = await saveAndReopen(page, name);
  assert.equal(text, edited);
  return edited;
}

// the files at paths given to the open file chooser of the editor, as a person picks them
async function choose(page, paths) {
  await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
  const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
  await page.send('DOM.setFileInputFiles', { files: paths, objectId: result.objectId });
}

// a trusted drag of the files at paths from the Finder, dropped at the point at. it returns the
// tag of the drop outline before the drop
async function dropFiles(page, at, paths) {
  const data = { items: [], files: paths, dragOperationsMask: 1 };
  await page.send('Input.dispatchDragEvent', { type: 'dragEnter', x: at.x, y: at.y, data });
  await page.send('Input.dispatchDragEvent', { type: 'dragOver', x: at.x, y: at.y, data });
  const outline = await page.evaluate(`(() => { const b = document.querySelector('.beeson-drop'); return b && !b.hidden ? b.textContent : null; })()`);
  await page.send('Input.dispatchDragEvent', { type: 'drop', x: at.x, y: at.y, data });
  return outline;
}

const waitText = (page, text) => page.waitFor(`window.BeesonEditor.render().includes(${js(text)})`, 30000);
const tabs = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-edit-inspector .ed-tabs button')].map((t) => t.textContent.trim())`);

// a save into a folder of the private file system, which a stub of showDirectoryPicker gives as the
// folder that the person chooses, and an open of the saved text. it returns the saved text and the
// names of the files of its media/
async function saveInto(page, folder) {
  const saved = await page.evaluate(`(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(${js(folder)}, { create: true });
    const deck = await dir.getFileHandle('deck.html', { create: true });
    window.showDirectoryPicker = async () => dir;
    window.BeesonEditor.attach(deck);
    await window.BeesonEditor.save();
    const files = [];
    try {
      for await (const [name] of (await dir.getDirectoryHandle('media')).entries()) files.push(name);
    } catch {}
    return { text: await (await deck.getFile()).text(), files: files.sort() };
  })()`);
  const status = await page.evaluate(`window.BeesonEditor.open(${js(saved.text)})`);
  assert.deepEqual(status.problems, []);
  return saved;
}

for (const platform of PLATFORMS) {
  // tables-equations-insert-5
  test(`a new table beside the list of a slide with a backdrop is put in the free space over the backdrop (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS });
    const before = await render(page);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await frames(page);
    const [table] = await boxes(page, ':scope > table');
    assert.ok(table, 'no table was inserted');
    for (const b of await boxes(page, ':scope > ul > li, :scope > p, :scope > h2')) {
      assert.ok(!meets(table, b), `the table at ${js(table)} lies over a text at ${js(b)}`);
    }
    await checkEdit(page, before, `r12-4-table-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  // tables-equations-insert-5 on slide 5 (states 23, 93, 157, and 318 to 320), where a free place of
  // the size of the table is not left beside the figure. the table is then put off every text, over
  // the figure, as a new picture is
  test(`a new table on a slide without a free place of its size is kept off the texts (${platform})`, async (t) => {
    const page = await load(t, platform, { n: FIGURES });
    const before = await render(page);
    await exec(page, 'insert.table', { rows: 3, columns: 3 });
    await frames(page);
    const [table] = await boxes(page, ':scope > table');
    assert.ok(table, 'no table was inserted');
    for (const b of await boxes(page, ':scope > ul > li, :scope > p')) assert.ok(!meets(table, b), `the table at ${js(table)} lies over a text at ${js(b)}`);
    assert.ok(table.left >= 0 && table.right <= 1920 && table.top >= 0 && table.bottom <= 1080, `the table runs past the slide: ${js(table)}`);
    await checkEdit(page, before, `r12-4-table5-${platform}.html`);
    assert.deepEqual(errors(page), []);
  });

  // tables-equations-insert-6. the theme draws a plot at the size of a zone, 600 by 800 slide px,
  // and the slides of index.html with a figure or a video in the zone do not have a free place of
  // that size, where the plot stays in the zone off every text. the slide of editor-layouts.html
  // with a QR code moved into the zone has one, at the left over its backdrop
  test(`a new plot is put off the figures and the texts already on the slide (${platform})`, async (t) => {
    for (const [deck, n, first] of [['test/pages/editor-layouts.html', GLIDE, 'insert.qr'], [DECK, FIGURES], [DECK, VIDEO]]) {
      const page = await load(t, platform, { deck, n });
      const before = await render(page);
      if (first) {
        // the QR code is dragged from the text column into the zone place
        await exec(page, first);
        await frames(page);
        const k = await page.evaluate(`(() => { const s = document.querySelector('.reveal section.present'); return s.getBoundingClientRect().width / s.offsetWidth; })()`);
        await drag(page, '.reveal section.present > .qr', { dx: 1180 * k, dy: 60 * k });
        await frames(page);
      }
      const texts = await boxes(page, ':scope > p, :scope > ul > li, :scope > .foot');
      const figures = await boxes(page, ':scope > .qr');
      await exec(page, 'insert.plot');
      await exec(page, 'plot.closeData');
      await frames(page);
      const [plot] = await boxes(page, ':scope > .plot');
      assert.ok(plot, 'no plot was inserted');
      assert.equal(figures.length, first ? 1 : 0);
      if (first) assert.ok(figures[0].left > 1100, `the QR code was not moved into the zone place: ${js(figures[0])}`);
      for (const b of [...texts, ...figures]) assert.ok(!meets(plot, b), `on slide ${n} of ${deck}, the plot at ${js(plot)} lies over ${js(b)}`);
      if (!first) await checkEdit(page, before, `r12-4-plot-${n}-${platform}.html`);
      assert.deepEqual(errors(page), []);
    }
  });

  // navigator-slides-canvas-1
  test(`a text laid over the figure of its slide by a change of the layout is marked and named in the status (${platform})`, async (t) => {
    for (const id of ['slide.layout.wide', 'slide.layout.title', 'slide.layout.closing']) {
      const page = await load(t, platform, { n: FIGURES });
      assert.equal((await page.evaluate('window.BeesonEditor.status()')).overflow, 0, 'the slide is reported before the change');
      await exec(page, id);
      await frames(page);
      await frames(page);
      const s = await page.evaluate('window.BeesonEditor.status()');
      assert.ok(s.overflow > 0, `after ${id}, the texts over the figure are not counted`);
      assert.match(s.message, /over a figure/, `after ${id}, the status reads ${s.message}`);
      assert.ok(await page.evaluate(`document.querySelectorAll('.reveal section.present .beeson-overflow').length > 0`));
      await undo(page);
      await frames(page);
      await frames(page);
      assert.equal((await page.evaluate('window.BeesonEditor.status()')).overflow, 0, `after an undo of ${id}, the slide is still reported`);
    }
  });

  // media-arrange-2
  test(`a picture hidden by Dark in light mode keeps its Image pane, and a drop or Replace adds its twin for light mode (${platform})`, async (t) => {
    for (const how of ['drop', 'replace']) {
      const page = await load(t, platform, { n: STEPS, query: '&theme=light' });
      const insert = page.evaluate(`window.BeesonEditor.exec('insert.image').then(() => true)`);
      await choose(page, [DARK_FILE]);
      await insert;
      await waitText(page, 'media/figure-dark.png');
      await frames(page);
      await exec(page, 'figure.mode.dark');
      await frames(page);
      const before = await render(page);
      assert.match(before, /<img src="media\/figure-dark.png" class="for-dark"/);
      assert.ok((await tabs(page)).includes('Image'), `the inspector shows only ${await tabs(page)}`);
      const replace = await page.evaluate(`window.BeesonEditor.state('media.replace')`);
      assert.equal(replace.enabled, true);
      assert.match(replace.label, /Light Mode/);
      assert.equal((await page.evaluate(`window.BeesonEditor.state('figure.mode.both')`)).enabled, true);
      if (how === 'drop') {
        const at = await page.evaluate(`(() => { const f = window.BeesonEditor.selection()[0]; const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        const outline = await dropFiles(page, at, [LIGHT_FILE]);
        assert.match(outline ?? '', /Light Mode/);
      } else {
        const run = page.evaluate(`window.BeesonEditor.exec('media.replace').then(() => true)`);
        await choose(page, [LIGHT_FILE]);
        await run;
      }
      await waitText(page, 'media/figure-light.png');
      await frames(page);
      const edited = await render(page);
      assert.match(edited, /<img src="media\/figure-dark.png" class="for-dark">\s*<img class="for-light" src="media\/figure-light.png"/);
      assert.equal(edited.split('<figure').length, before.split('<figure').length, 'the file was added as a new figure');
      assert.equal(await page.evaluate(`[...document.querySelectorAll('.reveal section.present img.for-light')].filter((e) => e.getBoundingClientRect().width > 0).length`), 1);
      await undo(page);
      assert.equal(await render(page), before);
      await redo(page);
      assert.equal(await render(page), edited);
      const saved = await saveInto(page, `r12-4-pair-${how}-${platform}`);
      assert.equal(saved.text, edited);
      assert.deepEqual(saved.files, ['figure-dark.png', 'figure-light.png']);
      assert.deepEqual(errors(page), []);
    }
  });

  // feel-3. a caption is switched on in the Image pane, as with Caption in the Style tab of Keynote
  // (K34), and edited in place
  test(`a picture is given a caption by the Caption switch of the Image pane, and the caption is typed into (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS });
    const insert = page.evaluate(`window.BeesonEditor.exec('insert.image').then(() => true)`);
    await choose(page, [DARK_FILE]);
    await insert;
    await waitText(page, 'media/figure-dark.png');
    await frames(page);
    const before = await render(page);
    const box = await page.evaluate(`(() => [...document.querySelectorAll('.beeson-edit-inspector label')].some((l) => l.textContent.trim() === 'Caption'))()`);
    assert.ok(box, 'the Image pane does not have a Caption switch');
    const state = await page.evaluate(`window.BeesonEditor.state('figure.caption')`);
    assert.deepEqual([state.enabled, state.checked], [true, false]);
    await exec(page, 'figure.caption');
    await frames(page);
    await page.send('Input.insertText', { text: 'A new caption' });
    await frames(page);
    const edited = await render(page);
    assert.match(edited, /<img src="media\/figure-dark.png"[^>]*>\s*<figcaption class="caption">A new caption<\/figcaption>\s*<\/figure>/);
    assert.equal((await page.evaluate(`window.BeesonEditor.state('figure.caption')`)).checked, true);
    // the switch is one entry and the typing another
    await undo(page);
    await undo(page);
    assert.equal(await render(page), before);
    await redo(page);
    await redo(page);
    assert.equal(await render(page), edited);
    const saved = await saveInto(page, `r12-4-caption-${platform}`);
    assert.equal(saved.text, edited);
    // Caption off takes the caption off
    await page.evaluate(`Reveal.slide(${STEPS})`);
    await frames(page);
    await click(page, '.reveal section.present > figure img');
    await frames(page);
    await exec(page, 'figure.caption');
    assert.equal(await render(page), before);
    assert.deepEqual(errors(page), []);
  });

  // feel-4. a new Content slide holds what its tile in Add Slide shows: a heading, a paragraph, and
  // a dash list, as a new Title & Bullets slide of Keynote holds the placeholders of its thumbnail
  // (K95). the tile is drawn from the same skeleton
  test(`a new Content slide holds the paragraph and the list of its tile (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS });
    const before = await render(page);
    await exec(page, 'slide.new.content');
    await frames(page);
    const made = await render(page);
    await undo(page);
    assert.equal(await render(page), before);
    await redo(page);
    assert.equal(await render(page), made);
    await frames(page);
    const slide = await page.evaluate(`(() => { const s = document.querySelector('.reveal .slides > section.present'); return { tags: [...s.children].filter((c) => !c.hasAttribute('data-generated') && !c.matches('aside.notes')).map((c) => c.localName + (c.className ? '.' + [...c.classList].filter((k) => !k.startsWith('beeson')).join('.') : '')), items: s.querySelectorAll(':scope > ul > li').length }; })()`);
    assert.deepEqual(slide.tags.filter((x) => !x.startsWith('div.run') && !x.startsWith('div.foot')), ['h2', 'p', 'ul']);
    const { sampleText } = await import('../src/editor/model/templates.ts');
    assert.ok(!sampleText('content').includes('zone'), 'the Content tile draws a zone that a new slide does not have');
    assert.equal(slide.items, 1);
    // typing into the list item gives a dash item, and Return a second one
    await click(page, '.reveal section.present > ul > li');
    await page.send('Input.insertText', { text: 'A first point' });
    await press(page, 'Enter');
    await page.send('Input.insertText', { text: 'A second point' });
    await frames(page);
    const edited = await render(page);
    assert.match(edited, /<li>A first point<\/li>\s*<li>A second point<\/li>/);
    const { text } = await saveAndReopen(page, `r12-4-content-${platform}.html`);
    assert.equal(text, edited);
    assert.deepEqual(errors(page), []);
  });

  // round 5, judge opus, finding 5 (state 303). an empty placeholder of the old layout without a
  // place in the new one is dropped, and the placeholders of the new layout are shown as on a new
  // slide of it, as Change Layout of PowerPoint does (P33)
  test(`a new content slide changed to Figure holds the plate, the heading, and the caption of a new figure slide (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS });
    await exec(page, 'slide.new.content');
    await frames(page);
    const before = await render(page);
    await exec(page, 'slide.layout.figure');
    await frames(page);
    await frames(page);
    const tags = await page.evaluate(`[...document.querySelector('.reveal .slides > section.present').children].filter((c) => !c.hasAttribute('data-generated') && !c.matches('aside.notes')).map((c) => c.localName + (c.classList.contains('caption') ? '.caption' : c.classList.contains('plate') ? '.plate' : ''))`);
    assert.deepEqual(tags, ['div.plate', 'h2', 'p.caption']);
    const s = await page.evaluate('window.BeesonEditor.status()');
    assert.equal(s.overflow, 0, `the status reads ${s.message}`);
    const [caption] = await boxes(page, ':scope > p.caption');
    assert.ok(caption && caption.bottom <= 1080 && caption.right - caption.left > 1, `the caption placeholder is not shown: ${js(caption)}`);
    const edited = await render(page);
    await undo(page);
    assert.equal(await render(page), before);
    await redo(page);
    assert.equal(await render(page), edited);
    // the change back gives the slide as it was
    await exec(page, 'slide.layout.content');
    assert.equal(await render(page), before);
    assert.deepEqual(errors(page), []);
  });

  // round 5, judge opus, finding 6 (state 302). the list of slide 3 in the black panel of Split is
  // kept off the footnote of the panel, or else it is marked and named in the status
  test(`after Change Layout to Split on slide 3, a list over the footnote of the panel is reported (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS });
    await exec(page, 'slide.layout.split');
    await frames(page);
    await frames(page);
    const [foot] = await boxes(page, ':scope > .panel > .foot');
    assert.ok(foot, 'the footnote is not in the panel');
    const over = (await boxes(page, ':scope > .panel > ul > li, :scope > .panel > p')).filter((b) => meets(b, foot));
    const s = await page.evaluate('window.BeesonEditor.status()');
    if (over.length) {
      assert.ok(s.overflow >= over.length, `${over.length} texts lie over the footnote at ${js(foot)}, and the status reads ${s.message}`);
      assert.match(s.message, /past the slide or into its footnote/);
    }
    assert.deepEqual(errors(page), []);
  });
  // feel-5
  test(`the Steps pane names a new picture by the name of its file, not by its object URL (${platform})`, async (t) => {
    const page = await load(t, platform, { n: STEPS });
    const insert = page.evaluate(`window.BeesonEditor.exec('insert.image').then(() => true)`);
    await choose(page, [DARK_FILE]);
    await insert;
    await waitText(page, 'media/figure-dark.png');
    if (!(await page.evaluate(`window.BeesonEditor.state('view.steps').checked`))) await exec(page, 'view.steps');
    await frames(page);
    const rows = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-side [aria-label]')].map((r) => r.getAttribute('aria-label')).filter((l) => /Figure/.test(l))`);
    assert.ok(rows.some((l) => l.includes('figure-dark.png')), `the rows read ${js(rows)}`);
    assert.ok(!rows.some((l) => /[0-9a-f]{8}-[0-9a-f]{4}-/.test(l)), `a row names the object URL: ${js(rows)}`);
    assert.deepEqual(errors(page), []);
  });
}
