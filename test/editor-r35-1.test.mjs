// the panes of the Format tab that are kept across a change that they depend on, R35.1, on both
// platforms. the Slide pane shows the sections and the controls of a pane built fresh for the same
// selection after Mod+A or Mod+click in the navigator, and after a change of the layout of several
// slides that keeps the current slide, with its undo and its redo. the Image pane and the Video
// pane name the twin of a dark and light pair that a flip of the mode shows, and act on it. the
// Poster Frame slider of the Video pane is on again once the video is loaded after an undo or a
// redo of Replace…

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { click, editorPage, press, type } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const PANEL = '#beeson-edit-panel-format';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

let last = null;
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}).then(() => true)`);

async function open(platform) {
  await last?.close().catch(() => {});
  const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}`, page: { width: 1600, height: 1000 }, clear: true });
  last = page;
  if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
  await frames(page);
  return page;
}

// a click on the row of slide n of the navigator, counted from 1. Chrome on a macOS host turns a
// trusted Ctrl+click into a context menu without a click, hence the Ctrl+click of other is
// dispatched in the page there
async function row(page, n, modifiers = '') {
  const at = await page.evaluate(`(() => {
    const r = document.querySelectorAll('.beeson-edit-nav .row')[${n - 1}];
    r.scrollIntoView({ block: 'nearest' });
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
  const ctrl = modifiers === 'Mod' && process.platform === 'darwin' && (await page.evaluate(`new URLSearchParams(location.search).get('edit-platform')`)) === 'other';
  if (ctrl) await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row')[${n - 1}].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true, clientX: ${at.x}, clientY: ${at.y} }))`);
  else await click(page, at, { modifiers });
  await frames(page);
}

// the pane that is shown: its shown sections, its layout card, and the state of each shown control
const PANE = `(() => {
  const root = document.querySelector('${PANEL} .ed-panes');
  const shown = (el) => !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  return {
    pane: root?.dataset.pane ?? null,
    sections: [...(root?.querySelectorAll('.ed-sec') ?? [])].filter(shown).map((s) => s.querySelector(':scope > h5')?.textContent ?? '(untitled)'),
    card: root?.querySelector('.ed-chooser .what > span:last-child')?.textContent ?? null,
    notes: [...(root?.querySelectorAll('.ed-note') ?? [])].filter(shown).map((n) => n.textContent),
    controls: [...(root?.querySelectorAll('button, input, textarea, select') ?? [])].filter(shown).map((c) => [
      c.dataset.command ?? c.name ?? c.textContent.trim(), c.disabled,
      c.getAttribute('aria-pressed') ?? c.getAttribute('aria-checked') ?? (c.type === 'checkbox' ? String(c.checked) + (c.indeterminate ? '-' : '') : null),
      'value' in c && c.type !== 'checkbox' && c.localName !== 'button' ? c.value : null,
    ]),
  };
})()`;
const pane = async (page) => { await frames(page); return page.evaluate(PANE); };

// the pane built again for the same selection, i.e. the Format tab shown again without its panes
async function fresh(page) {
  await page.evaluate(`document.querySelector('${PANEL} .ed-panes')?.remove()`);
  await exec(page, 'shell.format');
  await exec(page, 'shell.format');
  return pane(page);
}

// the kept pane, which must be the pane built fresh for the same selection
async function same(page, what) {
  const kept = await pane(page);
  const built = await fresh(page);
  assert.deepEqual(kept, built, what);
  return built;
}

const current = (page) => page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].indexOf(Reveal.getCurrentSlide()) + 1`);

async function chooseLayout(page, layout) {
  await click(page, `${PANEL} .ed-chooser`);
  await page.waitFor(`!!document.querySelector('.beeson-edit-layouts')`);
  await click(page, `.beeson-edit-layouts .tile[data-layout="${layout}"]`);
  await sleep(200);
  await frames(page);
}

for (const platform of PLATFORMS) {
  test(`the Slide pane after Mod+A in the navigator is the pane built for every slide (${platform})`, async () => {
    const page = await open(platform);
    for (const n of [4, 13, 5]) {
      await row(page, n);
      await press(page, 'Mod+A');
      await sleep(100);
      assert.equal(await page.evaluate(`document.querySelectorAll('.beeson-edit-nav .row[aria-selected="true"]').length`), 13, `Mod+A on slide ${n} selects every slide`);
      assert.equal(await current(page), n);
      const built = await same(page, `Mod+A on slide ${n}`);
      assert.deepEqual(built.sections, ['Appearance'], `Mod+A on slide ${n}`);
      assert.equal(built.card, 'Multiple Layouts');
    }
  });

  test(`the Slide pane after Mod+click takes a slide off the selection is the pane built for the slide left (${platform})`, async () => {
    const page = await open(platform);
    // [first, then with Mod, then with Mod again, the slide left, its sections]
    for (const [a, b, c, left, sections] of [
      [3, 1, 3, 1, ['Backdrop', 'Appearance']],
      [3, 2, 3, 2, ['Backdrop', 'Appearance', '(untitled)']],
      [2, 3, 2, 3, ['Text Column', 'Backdrop', 'Appearance', 'Running Head']],
    ]) {
      await row(page, a);
      await row(page, b, 'Mod');
      await row(page, c, 'Mod');
      assert.equal(await current(page), left);
      const built = await same(page, `slides ${a} and ${b}, then ${c} taken off`);
      assert.deepEqual(built.sections, sections, `slide ${left} alone`);
    }
  });

  test(`the Slide pane after a change of the layout of several slides that keeps the current slide, its undo, and its redo is the pane built fresh (${platform})`, async () => {
    const page = await open(platform);
    for (const [a, b, layout, sections] of [
      [6, 7, 'section', ['Backdrop', 'Appearance', '(untitled)']],
      [12, 13, 'closing', ['Backdrop', 'Appearance']],
    ]) {
      await row(page, a);
      await row(page, b, 'Mod');
      await page.evaluate(`window.__kept = Reveal.getCurrentSlide()`);
      const before = await same(page, `slides ${a} and ${b}`);
      assert.equal(before.card, 'Multiple Layouts');
      await chooseLayout(page, layout);
      assert.equal(await page.evaluate(`Reveal.getCurrentSlide() === window.__kept`), true, `slide ${b} stays current`);
      const built = await same(page, `slides ${a} and ${b} after ${layout}`);
      assert.deepEqual(built.sections, sections);
      await exec(page, 'edit.undo');
      await sleep(200);
      assert.equal(await page.evaluate(`Reveal.getCurrentSlide() === window.__kept`), true, `slide ${b} stays current at the undo`);
      assert.deepEqual((await same(page, `slides ${a} and ${b} after the undo of ${layout}`)).sections, ['Appearance']);
      assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
      await exec(page, 'edit.redo');
      await sleep(200);
      assert.deepEqual((await same(page, `slides ${a} and ${b} after the redo of ${layout}`)).sections, sections);
      await exec(page, 'edit.undo');
      await sleep(200);
    }
  });

  test(`the Image pane and the Video pane name the twin that a flip of the mode shows, and act on it (${platform})`, async () => {
    const page = await open(platform);
    for (const [tag, kind] of [['img', 'image'], ['video', 'video']]) {
      const h = await page.evaluate(`Reveal.getIndices(document.querySelector('${tag}.for-dark').closest('section')).h`);
      await page.evaluate(`Reveal.slide(${h})`);
      await frames(page);
      await click(page, `section.present ${tag}.for-dark`);
      await frames(page);
      const read = () => page.evaluate(`(() => {
        const root = document.querySelector('${PANEL} .ed-panes');
        const shown = [...document.querySelectorAll('section.present ${tag}')].find((m) => m.getClientRects().length > 0);
        return { pane: root?.dataset.pane, file: root?.querySelector('.ed-well .name')?.textContent, alt: root?.querySelector('textarea[name="alt"]')?.value ?? null,
          shown: shown?.getAttribute('src').split('/').pop(), shownAlt: shown?.getAttribute('alt') ?? null };
      })()`);
      let was = await read();
      assert.equal(was.pane, kind);
      assert.equal(was.file, was.shown);
      for (const flip of ['key', 'menu']) {
        if (flip === 'key') await press(page, 'D');
        else await exec(page, 'view.slideDark');
        await frames(page);
        await sleep(100);
        const now = await read();
        assert.equal(now.pane, kind);
        assert.notEqual(now.shown, was.shown, 'the flip shows the other twin');
        assert.equal(now.file, now.shown, `the ${kind} pane names the twin shown after the flip (${flip})`);
        if (kind === 'image') assert.equal(now.alt, now.shownAlt, `the description is that of the twin shown (${flip})`);
        was = now;
      }
      // the Description field acts on the twin that the flip shows
      if (kind === 'image') {
        await press(page, 'D');
        await frames(page);
        await sleep(100);
        assert.equal((await read()).shown, 'figure-light.png');
        await click(page, `${PANEL} textarea[name="alt"]`);
        await page.evaluate(`document.querySelector('${PANEL} textarea[name="alt"]').select()`);
        await type(page, 'Light curves');
        await page.evaluate(`document.querySelector('${PANEL} textarea[name="alt"]').blur()`);
        await frames(page);
        assert.deepEqual(await page.evaluate(`['dark', 'light'].map((m) => document.querySelector('section.present img.for-' + m).getAttribute('alt'))`),
          ['Zero-velocity curves of the Earth–Moon system, dark version', 'Light curves']);
        await exec(page, 'edit.undo');
        assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
        await press(page, 'D');
        await frames(page);
      }
    }
  });

  test(`the Poster Frame slider is on once the video is loaded after an undo and a redo of Replace… (${platform})`, async () => {
    const page = await open(platform);
    await page.send('Page.setInterceptFileChooserDialog', { enabled: true });
    const h = await page.evaluate(`Reveal.getIndices(document.querySelector('video.for-dark').closest('section')).h`);
    await page.evaluate(`Reveal.slide(${h})`);
    await frames(page);
    await click(page, 'section.present video.for-dark');
    const loaded = `document.querySelector('section.present video.for-dark').readyState >= 1`;
    await page.waitFor(loaded);
    await sleep(300);
    const slider = () => page.evaluate(`(() => {
      const input = document.querySelector('${PANEL} input[name="poster-frame"]');
      const play = document.querySelector('${PANEL} .ed-frame .ed-play');
      const v = document.querySelector('section.present video.for-dark');
      return { off: input.disabled, play: play.disabled, max: Number(input.max).toFixed(2), length: v.duration.toFixed(2), file: document.querySelector('${PANEL} .ed-well .name').textContent };
    })()`);
    const on = await slider();
    assert.deepEqual(on, { off: false, play: false, max: on.length, length: on.length, file: 'clip-dark.mp4' });
    const at = await page.evaluate(`(() => { const b = [...document.querySelectorAll('${PANEL} button')].find((b) => b.textContent.trim() === 'Replace…'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await click(page, at);
    await page.waitFor(`!!document.querySelector('input.beeson-media-input')`);
    const { result } = await page.send('Runtime.evaluate', { expression: `document.querySelector('input.beeson-media-input')` });
    await page.send('DOM.setFileInputFiles', { files: [fileURLToPath(new URL('../demo/clip-light.mp4', import.meta.url))], objectId: result.objectId });
    await page.waitFor(`document.querySelector('section.present video.for-dark').getAttribute('src') !== 'demo/clip-dark.mp4'`);
    await page.waitFor(loaded);
    await sleep(300);
    assert.deepEqual(await slider(), { ...on, file: 'clip-light.mp4' }, 'after Replace…');
    for (const [step, file] of [['edit.undo', 'clip-dark.mp4'], ['edit.redo', 'clip-light.mp4']]) {
      await exec(page, step);
      await frames(page);
      await page.waitFor(loaded);
      await sleep(500);
      assert.deepEqual(await slider(), { ...on, file }, `after ${step} of Replace…`);
    }
    await exec(page, 'edit.undo');
    assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
  });
}
