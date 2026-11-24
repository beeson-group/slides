import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { declarationProblem, textProblems, themeClasses } from '../src/editor/model/scope.ts';
import { click, clickText, drag, editorPage, press, saveAndReopen, type } from './helpers/editor.mjs';

describe('a backdrop selected, moved, and deleted', () => {
  const DECK = 'test/pages/editor-r20-6.html';
  const PLATFORMS = ['mac', 'other'];
  const THEME = new Set(themeClasses(readFileSync('theme/beeson.css', 'utf8')));
  const PANEL = '#beeson-edit-panel-format';
  const TUBES = '<div class="backdrop" data-backdrop="tubes" data-cx="0.97" data-cy="0" data-half="0.5">';
  const TUBES_UNIT = `\n  ${TUBES}</div>`;
  const BACK = 'section.present .backdrop';
  const BARE = '<section>\n  <h2>A content slide without a backdrop</h2>';
  const GROUND = `<section>\n  ${TUBES}</div>\n  <h2>A content slide without a backdrop</h2>`;
  const tubesTag = (text) => text.match(/<h2>A content slide with a backdrop<\/h2>[\s\S]*?(<div class="backdrop" data-backdrop="tubes"[^>]*>)/)[1];

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

  const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
  const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
  const undoLabel = (page) => state(page, 'edit.undo').then((s) => s.label);
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
  const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.matches('.backdrop') ? 'backdrop' : el.localName)`);
  const live = (page) => page.evaluate(`(() => {
  const el = document.querySelector('${BACK}');
  const o = el && Beeson.backdrops.find((b) => b.el === el);
  return o ? { ...o.view, trajectories: o.trajectories.length, raf: o.raf, done: o.done, canvases: el.querySelectorAll(':scope > canvas').length, count: Beeson.backdrops.filter((b) => b.el === el).length } : null;
})()`);
  const at = (page, u, v) => page.evaluate(`(() => { const r = document.querySelector('${BACK}').getBoundingClientRect(); return { x: r.left + r.width * ${u}, y: r.top + r.height * ${v} }; })()`);
  const scale = (page) => page.evaluate(`document.querySelector('section.present').getBoundingClientRect().width / 1920`);

  async function backdropPage(platform, n, motion = false) {
    await last?.close().catch(() => {});
    const page = await browser.newPage(motion ? { motion: true } : undefined);
    last = page;
    await page.goto(`${server.origin}/${DECK}?edit${motion ? '' : '&still'}&edit-platform=${platform}`);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(DECK, 'utf8');
    Object.assign(page, { platform, n, motion });
    const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
    assert.deepEqual(s.problems, []);
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    return page;
  }

  async function tap(page, name) {
    const point = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('${PANEL} button, ${PANEL} label.ed-check')].find((b) => b.textContent.trim() === ${JSON.stringify(name)} || b.title === ${JSON.stringify(name)} || b.getAttribute('aria-label') === ${JSON.stringify(name)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
    assert.ok(point, `the inspector does not have a button ${name}`);
    await click(page, point);
    await frames(page);
  }

  async function showFormat(page) {
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await frames(page);
  }

  async function leave(page) {
    await click(page, 'section.present h2');
    await press(page, 'Escape');
    await press(page, 'Escape');
  }

  function replaced(text, before, after) {
    assert.equal(text.split(before).length, 2, `${before} does not occur once`);
    return text.replace(before, () => after);
  }

  async function reopen(page) {
    const fresh = await backdropPage(page.platform, page.n, page.motion);
    await showFormat(fresh);
    return fresh;
  }

  async function checkEdit(page, edited) {
    assert.deepEqual(textProblems(edited, THEME), textProblems(page.source, THEME));
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), edited);
    const { text } = await saveAndReopen(page);
    assert.equal(text, edited);
  }

  test('the scope rule takes a width and a height in px on a backdrop', () => {
    assert.equal(declarationProblem('div', ['backdrop'], 'width', '920px'), null);
    assert.equal(declarationProblem('div', ['backdrop'], 'height', '1080px'), null);
    assert.match(declarationProblem('div', ['backdrop'], 'width', '50%'), /width/);
    assert.match(declarationProblem('div', ['figure-box'], 'height', '300px'), /height/);
  });

  for (const platform of PLATFORMS) {
    test(`a click selects a backdrop with a frame and grips, and a drag from it draws a marquee (${platform})`, async () => {
      const page = await backdropPage(platform, 1);
      await click(page, await at(page, 0.7, 0.6));
      assert.deepEqual(await selected(page), ['backdrop']);
      const shown = await page.evaluate(`(() => {
      const r = document.querySelector('${BACK}').getBoundingClientRect();
      const f = [...document.querySelectorAll('.beeson-frame.selected')].find((f) => !f.hidden).getBoundingClientRect();
      const grips = [...document.querySelectorAll('.beeson-grip')].filter((g) => !g.hidden).length;
      return { off: Math.abs(f.left - r.left) + Math.abs(f.width - r.width), grips, handle: !document.querySelector('.beeson-handle').hidden, rotor: !document.querySelector('.beeson-rotor').hidden };
    })()`);
      assert.ok(shown.off < 2, `the frame is ${shown.off} px off the box`);
      assert.equal(shown.grips, 8);
      assert.equal(shown.handle, false);
      assert.equal(shown.rotor, false);
      assert.equal((await state(page, 'element.delete')).enabled, true);
      await click(page, await at(page, -0.3, 0.95));
      assert.deepEqual(await selected(page), []);
      const k = await scale(page);
      await drag(page, await at(page, 0.2, 0.3), { dx: -700 * k, dy: -200 * k });
      const marquee = await selected(page);
      assert.ok(marquee.length > 0 && !marquee.includes('backdrop'), `the marquee selected ${marquee}`);
      await click(page, await at(page, 0.7, 0.6), { button: 'right' });
      assert.deepEqual(await selected(page), ['backdrop']);
      const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu')].map((m) => m.textContent).join(' ')`);
      for (const label of ['Delete', 'Copy', 'Edit Window', 'Fit Window', 'Preview']) assert.ok(items.includes(label), `the menu does not have ${label}`);
      await press(page, 'Escape');
      assert.equal(await render(page), page.source);
    });

    test(`Delete removes a backdrop, an undo draws it again, and a lock turns Delete off (${platform})`, async () => {
      const page = await backdropPage(platform, 1);
      await click(page, await at(page, 0.7, 0.6));
      await exec(page, 'element.delete');
      const edited = await render(page);
      assert.equal(edited, replaced(page.source, TUBES_UNIT, ''));
      await undo(page);
      await frames(page);
      assert.equal(await render(page), page.source);
      assert.equal((await live(page)).canvases, 2);
      await redo(page);
      assert.equal(await render(page), edited);
      await undo(page);
      await click(page, await at(page, 0.7, 0.6));
      await exec(page, 'arrange.lock');
      assert.equal((await state(page, 'element.delete')).enabled, false);
    });

    test(`a backdrop pasted onto a slide without one goes to the ground of the slide (${platform})`, async () => {
      const page = await backdropPage(platform, 1);
      await click(page, await at(page, 0.7, 0.6));
      await exec(page, 'edit.copy');
      await page.evaluate('Reveal.slide(2)');
      await frames(page);
      await leave(page);
      await exec(page, 'edit.paste');
      await frames(page);
      const edited = await render(page);
      assert.equal(edited, replaced(page.source, BARE, GROUND));
      assert.deepEqual(await selected(page), ['backdrop']);
      assert.equal((await live(page)).canvases, 2);
      await checkEdit(page, edited);
    });

    test(`a drag on a selected backdrop and the arrow keys pan its window as one entry (${platform})`, async () => {
      let page = await backdropPage(platform, 1);
      await click(page, await at(page, 0.7, 0.6));
      const k = await scale(page);
      await drag(page, await at(page, 0.5, 0.5), { dx: -108 * k, dy: 54 * k });
      assert.equal(await undoLabel(page), 'Undo Move Backdrop');
      let edited = await render(page);
      const panned = '<div class="backdrop" data-backdrop="tubes" data-cx="1.07" data-cy="0.05" data-half="0.5">';
      assert.equal(edited, replaced(page.source, TUBES, panned));
      assert.deepEqual(await selected(page), ['backdrop']);
      const v = await live(page);
      assert.ok(Math.abs(v.cx - 1.07) < 1e-9 && Math.abs(v.cy - 0.05) < 1e-9, JSON.stringify(v));
      await checkEdit(page, edited);
      page = await reopen(page);
      await click(page, await at(page, 0.7, 0.6));
      await press(page, 'ArrowLeft');
      await press(page, 'Shift+ArrowUp');
      await press(page, 'Shift+ArrowUp');
      edited = await render(page);
      assert.doesNotMatch(edited, /translate/);
      const tag = tubesTag(edited);
      const cx = Number(tag.match(/data-cx="([^"]+)"/)[1]), cy = Number(tag.match(/data-cy="([^"]+)"/)[1]);
      assert.ok(Math.abs(cx - (0.97 + 1 / 1080)) < 2e-3 && Math.abs(cy + 20 / 1080) < 2e-3, tag);
      await undo(page);
      assert.equal(await render(page), page.source);
    });

    test(`the pane Backdrop writes the window, the drawing, the labels, and the motion (${platform})`, async () => {
      let page = await backdropPage(platform, 1);
      await showFormat(page);
      await click(page, await at(page, 0.7, 0.6));
      await frames(page);
      const tabs = await page.evaluate(`[...document.querySelectorAll('${PANEL} button')].map((b) => b.textContent.trim())`);
      assert.ok(!tabs.includes('Arrange'), `the pane has the tab Arrange`);
      const titles = await page.evaluate(`[...document.querySelectorAll('${PANEL} h5')].map((h) => h.textContent)`);
      for (const t of ['Backdrop', 'Window', 'Labels', 'Motion']) assert.ok(titles.includes(t), `the pane does not have ${t}`);
      const field = await page.evaluate(`(() => { const i = document.querySelector('${PANEL} input[name="Half Height"]'); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await click(page, field, { count: 3 });
      await type(page, '0.4');
      await press(page, 'Enter');
      await frames(page);
      let edited = await render(page);
      assert.equal(edited, replaced(page.source, TUBES, TUBES.replace('data-half="0.5"', 'data-half="0.4"')));
      assert.equal((await live(page)).half, 0.4);
      await checkEdit(page, edited);
      page = await reopen(page);
      await click(page, await at(page, 0.7, 0.6));
      await exec(page, 'backdrop.builtIn', { value: 'wideRibbon' });
      await frames(page);
      edited = await render(page);
      assert.equal(edited, replaced(page.source, TUBES, TUBES.replace('tubes', 'wideRibbon')));
      const ribbon = await live(page);
      assert.equal(ribbon.count, 1);
      assert.equal(ribbon.canvases, 2);
      await undo(page);
      await frames(page);
      const tubes = await live(page);
      assert.ok(tubes.trajectories < ribbon.trajectories, `tubes has ${tubes.trajectories} trajectories and wideRibbon ${ribbon.trajectories}`);
      assert.equal(tubes.count, 1);
      await redo(page);
      await checkEdit(page, edited);
      page = await reopen(page);
      await click(page, await at(page, 0.7, 0.6));
      await frames(page);
      await tap(page, 'L1');
      await tap(page, 'Moon');
      edited = await render(page);
      assert.equal(edited, replaced(page.source, TUBES_UNIT, `\n  ${TUBES}\n    <span class="label" data-at="L1" data-dy="-34">\\(\\mathcal{L}_{1}\\)</span>\n    <span class="label" data-at="moon" data-dy="36">Moon</span>\n  </div>`));
      const labs = await page.evaluate(`[...document.querySelectorAll('${BACK} .label')].map((l) => l.style.left)`);
      assert.equal(labs.length, 2);
      assert.ok(labs.every((l) => l && l !== '0px'), `the labels are at ${labs}`);
      await tap(page, 'L1');
      await tap(page, 'Moon');
      assert.equal(await render(page), page.source);
      await tap(page, 'Live');
      assert.equal(await render(page), replaced(page.source, TUBES, TUBES.replace('>', ' data-live>')));
      await undo(page);
      await tap(page, 'Edit Window…');
      assert.equal(await page.evaluate(`!!document.querySelector('dialog.beeson-mask-bar[open]')`), true);
      await press(page, 'Escape');
      assert.equal(await render(page), page.source);
    });

    test(`Preview traces a backdrop, and an edit leaves it complete (${platform})`, async () => {
      const page = await backdropPage(platform, 1, true);
      await click(page, await at(page, 0.7, 0.6));
      await exec(page, 'backdrop.preview');
      await frames(page);
      let v = await live(page);
      assert.ok(v.raf > 0 && !v.done, 'the backdrop is not traced');
      await exec(page, 'backdrop.half', { value: 0.45 });
      await frames(page);
      v = await live(page);
      assert.equal(v.raf, 0);
      assert.equal(v.done, true);
      assert.equal(await page.evaluate('Beeson.backdrops.every((b) => !b.raf)'), true);
    });

    test(`Media > Backdrop… adds a backdrop from the gallery, or replaces the drawing in its start tag (${platform})`, async () => {
      let page = await backdropPage(platform, 2);
      await leave(page);
      assert.equal((await state(page, 'insert.backdrop')).label, 'Backdrop…');
      await exec(page, 'insert.backdrop');
      await page.waitFor(`document.querySelectorAll('.beeson-backdrop-gallery [data-tile]').length >= 3`);
      const tiles = await page.evaluate(`[...document.querySelectorAll('.beeson-backdrop-gallery [data-tile]')].map((t) => t.dataset.tile)`);
      for (const name of ['tubes', 'wideRibbon']) assert.ok(tiles.includes(name), `the gallery does not have ${name}`);
      assert.ok((await page.evaluate(`document.querySelectorAll('.beeson-backdrop-gallery [data-tile] canvas').length`)) >= 6);
      const count = await page.evaluate('Beeson.backdrops.length');
      await click(page, '.beeson-backdrop-gallery [data-tile="wideRibbon"]');
      await frames(page);
      const edited = await render(page);
      const added = edited.match(/<section>\n  (<div class="backdrop" data-backdrop="wideRibbon"[^>]*>)<\/div>\n  <h2>A content slide without a backdrop<\/h2>/)[1];
      assert.match(added, /^<div class="backdrop" data-backdrop="wideRibbon" data-cx="[-\d.]+" data-cy="[-\d.]+" data-half="[\d.]+">$/);
      assert.equal(edited, replaced(page.source, BARE, `<section>\n  ${added}</div>\n  <h2>A content slide without a backdrop</h2>`));
      assert.deepEqual(await selected(page), ['backdrop']);
      assert.equal(await page.evaluate('Beeson.backdrops.length'), count + 1);
      assert.equal(await undoLabel(page), 'Undo Add Backdrop');
      await checkEdit(page, edited);
      page = await reopen(page);
      await page.evaluate('Reveal.slide(1)');
      await frames(page);
      await click(page, await at(page, 0.7, 0.6));
      await exec(page, 'insert.backdrop');
      await page.waitFor(`!!document.querySelector('.beeson-backdrop-gallery [data-tile="wideRibbon"]')`);
      await click(page, '.beeson-backdrop-gallery [data-tile="wideRibbon"]');
      await frames(page);
      const tag = (await render(page)).match(/<h2>A content slide with a backdrop<\/h2>[\s\S]*?(<div class="backdrop"[^>]*>)/)[1];
      assert.match(tag, /^<div class="backdrop" data-backdrop="wideRibbon" data-cx="[-\d.]+" data-cy="[-\d.]+" data-half="[\d.]+">$/);
      assert.equal(await undoLabel(page), 'Undo Replace Backdrop');
      assert.equal((await live(page)).count, 1);
    });

    test(`a grip resizes the box of a backdrop and keeps the drawing in place (${platform})`, async () => {
      const page = await backdropPage(platform, 1);
      await click(page, await at(page, 0.7, 0.6));
      const moon = `(() => {
      const el = document.querySelector('${BACK}'), o = Beeson.backdrops.find((b) => b.el === el);
      const s = document.querySelector('section.present').getBoundingClientRect(), r = el.getBoundingClientRect(), k = s.width / 1920;
      const per = r.height / 2 / o.view.half;
      return { x: (r.left - s.left + r.width / 2 + (0.98785 - o.view.cx) * per) / k, y: (r.top - s.top + r.height / 2 + o.view.cy * per) / k };
    })()`;
      const before = await page.evaluate(moon);
      const grip = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="w"]')].find((g) => !g.hidden); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await drag(page, grip, { dx: -200 * (await scale(page)), dy: 0 });
      await frames(page);
      const edited = await render(page);
      const tag = tubesTag(edited);
      assert.match(tag, /^<div class="backdrop" data-backdrop="tubes" data-cx="[\d.]+" data-cy="0" data-half="0\.5" style="translate: -200px 0px; width: 920px; height: 1080px">$/);
      assert.ok(Math.abs(Number(tag.match(/data-cx="([^"]+)"/)[1]) - (0.97 - 100 / 1080)) < 1e-3, tag);
      assert.equal(edited, replaced(page.source, TUBES, tag));
      const now = await page.evaluate(moon);
      assert.ok(Math.abs(now.x - before.x) < 1 && Math.abs(now.y - before.y) < 1, `the Moon moved from ${JSON.stringify(before)} to ${JSON.stringify(now)}`);
      assert.equal(await undoLabel(page), 'Undo Resize Backdrop');
      await checkEdit(page, edited);
      await exec(page, 'slide.reset');
      assert.doesNotMatch(tubesTag((await render(page))), /style=/);
    });

    test(`the Slide pane and the Format menu reach the backdrop of a slide (${platform})`, async () => {
      const page = await backdropPage(platform, 1);
      await showFormat(page);
      await leave(page);
      await frames(page);
      const titles = await page.evaluate(`[...document.querySelectorAll('${PANEL} h5')].map((h) => h.textContent)`);
      assert.ok(titles.includes('Backdrop'), `the Slide pane has ${titles}`);
      assert.ok((await page.evaluate(`document.querySelector('${PANEL}').textContent`)).includes('Cislunar Manifolds'));
      await tap(page, 'Select');
      assert.deepEqual(await selected(page), ['backdrop']);
      for (const [id, label] of [['backdrop.edit', 'Edit Window'], ['backdrop.fitWindow', 'Fit Window'], ['backdrop.preview', 'Preview']]) {
        const s = await state(page, id);
        assert.ok(s.label.startsWith(label), `${id} is labeled ${s.label}`);
        assert.equal(s.enabled, true);
      }
      await page.evaluate('Reveal.slide(2)');
      await frames(page);
      await tap(page, 'Backdrop…');
      await page.waitFor(`!!document.querySelector('.beeson-backdrop-gallery')`);
      await press(page, 'Escape');
      assert.equal(await render(page), page.source);
    });

    test(`the object list shows the backdrop as its last row, which selects and locks it and is not dragged (${platform})`, async () => {
      const page = await backdropPage(platform, 1);
      if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
      await frames(page);
      const ROWS = '.beeson-edit-objects .row';
      const rowsOf = () => page.evaluate(`[...document.querySelectorAll('${ROWS}')].map((r) => [r.dataset.kind, r.querySelector('.name').textContent, r.getAttribute('aria-selected')])`);
      const names = await rowsOf();
      assert.deepEqual(names.at(-1).slice(0, 2), ['Backdrop', 'Backdrop: Cislunar Manifolds']);
      assert.equal(names.filter((r) => r[0] === 'Backdrop').length, 1);
      const rowAt = (i) => page.evaluate(`(() => { const r = [...document.querySelectorAll('${ROWS}')].at(${i}).getBoundingClientRect(); return { x: r.left + r.width / 3, y: r.top + r.height / 2 }; })()`);
      await click(page, await rowAt(-1));
      assert.deepEqual(await selected(page), ['backdrop']);
      assert.equal((await rowsOf()).at(-1)[2], 'true');
      const top = await rowAt(0);
      const from = await rowAt(-1);
      await drag(page, from, { dy: top.y - from.y - 10 });
      await frames(page);
      assert.equal(await render(page), page.source);
      assert.equal((await rowsOf()).at(-1)[0], 'Backdrop');
      await drag(page, await rowAt(0), { dy: from.y - top.y + 30 });
      await frames(page);
      assert.equal((await rowsOf()).at(-1)[0], 'Backdrop');
      assert.ok(!(await render(page)).includes(`${TUBES}</div>\n  <h2>`), 'the heading was written behind the backdrop');
      await page.evaluate(`[...document.querySelectorAll('${ROWS}')].at(-1).querySelector('.lock').click()`);
      await frames(page);
      const edited = await render(page);
      assert.equal(tubesTag(edited), TUBES.replace('>', ' data-locked>'));
      assert.equal(await undoLabel(page), 'Undo Lock');
    });

    test(`Zoom In, Zoom Out, Fit Window, the marks of a cut edge, and Duplicate act on a selected backdrop (${platform})`, async () => {
      const page = await backdropPage(platform, 1);
      await click(page, await at(page, 0.7, 0.6));
      const half = (h) => replaced(page.source, TUBES, TUBES.replace('data-half="0.5"', `data-half="${h}"`));
      await exec(page, 'backdrop.zoomIn');
      assert.equal(await render(page), half('0.4'));
      assert.equal(await undoLabel(page), 'Undo Zoom In');
      await undo(page);
      await exec(page, 'backdrop.zoomOut');
      assert.equal(await render(page), half('0.625'));
      await undo(page);
      assert.equal(await render(page), page.source);
      const marks = () => page.evaluate(`document.querySelectorAll('.beeson-backdrop-cuts .beeson-mask-cut').length`);
      await exec(page, 'backdrop.half', { value: 0.1 });
      await frames(page);
      assert.ok((await marks()) > 0, 'a cut edge is not marked');
      const grips = await page.evaluate(`[...document.querySelectorAll('.beeson-backdrop-cuts .beeson-mask-cut')].map((m) => {
        const g = document.querySelector('.beeson-overlay .beeson-grip[data-handle=' + { left: 'w', right: 'e', top: 'n', bottom: 's' }[m.dataset.edge] + ']');
        const r = g.getBoundingClientRect();
        const n = m.querySelector('span').getBoundingClientRect();
        const apart = r.right < n.left || n.right < r.left || r.bottom < n.top || n.bottom < r.top;
        const z = (el) => Number(getComputedStyle(el).zIndex);
        return { edge: m.dataset.edge, top: z(g.closest('.beeson-overlay')) > z(m.closest('.beeson-backdrop-cuts')), long: Math.max(r.width, r.height), apart };
      })`);
      for (const g of grips) assert.deepEqual({ top: g.top, long: g.long >= 24, apart: g.apart }, { top: true, long: true, apart: true }, `the grip of the cut edge is hard to see or to grab: ${JSON.stringify(g)}`);
      await leave(page);
      await frames(page);
      assert.equal(await marks(), 0, 'a cut edge is marked without the backdrop selected');
      await undo(page);
      await click(page, await at(page, 0.7, 0.6));
      await exec(page, 'backdrop.fitWindow');
      await frames(page);
      const fit = await render(page);
      const tag = tubesTag(fit);
      assert.match(tag, /^<div class="backdrop" data-backdrop="tubes" data-cx="[-\d.]+" data-cy="[-\d.]+" data-half="[\d.]+">$/);
      assert.notEqual(tag, TUBES);
      assert.equal(fit, replaced(page.source, TUBES, tag));
      assert.equal(await undoLabel(page), 'Undo Fit Window');
      await undo(page);
      assert.equal(await render(page), page.source);
      await exec(page, 'edit.duplicate');
      await frames(page);
      const dup = await render(page);
      assert.equal(dup, replaced(page.source, TUBES_UNIT, TUBES_UNIT + TUBES_UNIT));
      assert.deepEqual(await selected(page), ['backdrop']);
      assert.equal(await page.evaluate(`document.querySelectorAll('${BACK}').length`), 2);
      await checkEdit(page, dup);
    });
  }
});

describe('turns, Align, and fields leave a backdrop', () => {
  const DECK = 'test/pages/editor-r21-2.html';
  const PLATFORMS = ['mac', 'other'];
  const BACK = 'section.present .backdrop';
  const TUBES = '<div class="backdrop" data-backdrop="tubes" data-cx="0.97" data-cy="0" data-half="0.5">';

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

  const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
  const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
  const wait = (page, ms) => page.evaluate(`new Promise((d) => setTimeout(() => d(true), ${ms}))`);
  const selected = (page) => page.evaluate(`window.BeesonEditor.selection().map((el) => el.matches('.backdrop') ? 'backdrop' : el.localName)`);
  const at = (page, u, v) => page.evaluate(`(() => { const r = document.querySelector('${BACK}').getBoundingClientRect(); return { x: r.left + r.width * ${u}, y: r.top + r.height * ${v} }; })()`);
  const scale = (page) => page.evaluate(`document.querySelector('section.present').getBoundingClientRect().width / 1920`);
  const backTag = (text) => text.match(/<div class="backdrop" data-backdrop="tubes"[^>]*>/)[0];

  async function backdropPage(platform, n, motion = false) {
    await last?.close().catch(() => {});
    const page = await browser.newPage(motion ? { motion: true } : undefined);
    last = page;
    await page.goto(`${server.origin}/${DECK}?edit${motion ? '' : '&still'}&edit-platform=${platform}`);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(DECK, 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
    assert.deepEqual(s.problems, []);
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    return page;
  }

  async function leave(page) {
    await clickText(page, 'section.present h2');
    await press(page, 'Escape');
    await press(page, 'Escape');
  }

  const ARRANGE = [
    'arrange.rotateLeft', 'arrange.rotateRight', 'arrange.setRotation', 'arrange.flipHorizontal', 'arrange.flipVertical',
    'arrange.align.left', 'arrange.align.center', 'arrange.align.right', 'arrange.align.top', 'arrange.align.middle', 'arrange.align.bottom',
    'arrange.distribute.horizontal', 'arrange.distribute.vertical', 'arrange.distribute.evenly',
    'arrange.setPosition', 'arrange.setSize', 'arrange.sizeAndPosition', 'arrange.resetPosition', 'arrange.resetSize',
  ];
  const ARGS = { 'arrange.setRotation': { deg: 90 }, 'arrange.setPosition': { x: 100, y: 40 }, 'arrange.setSize': { w: 500 } };

  for (const platform of PLATFORMS) {
    test(`the turns, the flips, Align, Distribute, and the fields of a position are disabled on a backdrop and leave it as it is (${platform})`, async () => {
      const page = await backdropPage(platform, 0);
      await clickText(page, await at(page, 0.7, 0.6));
      assert.deepEqual(await selected(page), ['backdrop']);
      for (const id of ARRANGE) assert.equal((await state(page, id)).enabled, false, `${id} is enabled on a backdrop`);
      for (const id of ARRANGE) {
        if (id === 'arrange.sizeAndPosition') continue;
        await exec(page, id, ARGS[id]);
        assert.equal(await render(page), page.source, `${id} changed the file`);
      }
      await click(page, await at(page, 0.7, 0.6), { button: 'right' });
      const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu .item')].map((i) => [i.textContent.trim(), i.getAttribute('aria-disabled') === 'true'])`);
      for (const label of ['Rotate Left 90°', 'Rotate Right 90°', 'Align', 'Distribute', 'Size and Position…', 'Flip Horizontal', 'Flip Vertical']) {
        const item = items.find(([text]) => text.startsWith(label));
        assert.ok(!item || item[1], `the element menu offers ${label}`);
      }
      await press(page, 'Escape');
      await clickText(page, 'section.present p');
      await press(page, 'Escape');
      assert.deepEqual(await selected(page), ['p']);
      for (const [id, arg] of [['arrange.setPosition', '{ x: 300, y: 600 }'], ['arrange.setRotation', '{ deg: 90 }']]) {
        await page.evaluate(`window.BeesonEditor.exec('${id}', { ...${arg}, els: [document.querySelector('section.present p'), document.querySelector('${BACK}')] })`);
        const text = await render(page);
        assert.notEqual(text, page.source, `${id} did not write the paragraph`);
        assert.equal(backTag(text), TUBES, `${id} wrote the backdrop`);
        await undo(page);
        assert.equal(await render(page), page.source);
      }
    });

    test(`a backdrop does not join other elements in a selection, from the object list or the canvas (${platform})`, async () => {
      const page = await backdropPage(platform, 0);
      if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
      await frames(page);
      const ROWS = '.beeson-edit-objects .row';
      const rowAt = (name) => page.evaluate(`(() => { const r = [...document.querySelectorAll('${ROWS}')].find((r) => r.querySelector('.name').textContent.startsWith(${JSON.stringify(name)})).getBoundingClientRect(); return { x: r.left + r.width / 3, y: r.top + r.height / 2 }; })()`);
      const P = 'Text: A paragraph';
      const B = 'Backdrop: Cislunar Manifolds';
      for (const modifiers of ['Mod', 'Shift']) {
        await clickText(page, await rowAt(P));
        assert.deepEqual(await selected(page), ['p']);
        await clickText(page, await rowAt(B), { modifiers });
        assert.deepEqual(await selected(page), ['backdrop'], `a ${modifiers}-click on the backdrop row`);
        assert.equal((await state(page, 'arrange.group')).enabled, false);
        await clickText(page, await rowAt(P), { modifiers });
        assert.deepEqual(await selected(page), ['p'], `a ${modifiers}-click on a row with the backdrop selected`);
      }
      await clickText(page, await rowAt(P));
      await press(page, 'Shift+End');
      assert.deepEqual(await selected(page), ['backdrop']);
      await clickText(page, await at(page, 0.7, 0.6));
      assert.deepEqual(await selected(page), ['backdrop']);
      await click(page, 'section.present p', { modifiers: 'Shift' });
      assert.deepEqual(await selected(page), ['p']);
      await click(page, 'section.present h2', { modifiers: 'Shift' });
      assert.deepEqual(await selected(page), ['h2', 'p']);
      await drag(page, 'section.present p', { dx: 40 * (await scale(page)), dy: 0 });
      await frames(page);
      assert.equal(backTag(await render(page)), TUBES);
    });

    test(`Reset Slide draws a resized backdrop again at the size of its box, and so do its undo and redo (${platform})`, async () => {
      const page = await backdropPage(platform, 0);
      await clickText(page, await at(page, 0.7, 0.6));
      const fit = () => page.evaluate(`(() => { const el = document.querySelector('${BACK}'); return { box: Math.round(el.getBoundingClientRect().width * devicePixelRatio), canvas: el.querySelector(':scope > canvas').width }; })()`);
      const grip = await page.evaluate(`(() => { const g = [...document.querySelectorAll('.beeson-grip[data-handle="w"]')].find((g) => !g.hidden); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      const first = await fit();
      await drag(page, grip, { dx: -400 * (await scale(page)), dy: 0 });
      await frames(page);
      const wide = await fit();
      assert.ok(wide.box > first.box + 100, `the box was not resized: ${JSON.stringify([first, wide])}`);
      assert.equal(wide.canvas, wide.box);
      await leave(page);
      await exec(page, 'slide.reset');
      await frames(page);
      assert.doesNotMatch(backTag(await render(page)), /style=/);
      let now = await fit();
      assert.equal(now.box, first.box);
      assert.equal(now.canvas, now.box, 'the drawing is not fitted to the box put back by Reset Slide');
      await undo(page);
      await frames(page);
      now = await fit();
      assert.equal(now.box, wide.box);
      assert.equal(now.canvas, now.box, 'the drawing is not fitted to the box given back by the undo');
      await redo(page);
      await frames(page);
      now = await fit();
      assert.equal(now.canvas, first.box);
    });

    test(`Preview of a looping backdrop ends when the selection is left or the slide is changed (${platform})`, async () => {
      const page = await backdropPage(platform, 1, true);
      const rafs = () => page.evaluate('Beeson.backdrops.filter((b) => b.raf).length');
      await clickText(page, await at(page, 0.7, 0.6));
      assert.deepEqual(await selected(page), ['backdrop']);
      await exec(page, 'backdrop.preview');
      await frames(page);
      assert.ok((await rafs()) > 0, 'the backdrop is not traced');
      await leave(page);
      await wait(page, 300);
      assert.equal(await rafs(), 0, 'the loop is drawn after the selection is left');
      await clickText(page, await at(page, 0.7, 0.6));
      await exec(page, 'backdrop.preview');
      await frames(page);
      assert.ok((await rafs()) > 0);
      await page.evaluate('Reveal.slide(2)');
      await wait(page, 300);
      assert.equal(await rafs(), 0, 'the loop is drawn after the slide is changed');
      assert.equal(await render(page), page.source);
    });
  }
});

describe('the section Backdrop of the Slide pane', () => {
  const PLATFORMS = ['mac', 'other'];

  let browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  let last = null;
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
  const exec = (page, id) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}).then(() => true)`);

  async function slidePage(platform) {
    await last?.close().catch(() => {});
    const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}`, page: { width: 1600, height: 1000 } });
    last = page;
    if (!(await page.evaluate(`window.BeesonEditor.state('shell.format').checked`))) await exec(page, 'shell.format');
    await frames(page);
    return page;
  }

  const SECTION = `(() => {
  const pane = document.querySelector('#beeson-edit-panel-format .ed-panes');
  const sec = [...(pane?.querySelectorAll('.ed-sec') ?? [])].find((s) => s.querySelector('h5')?.textContent === 'Backdrop');
  const shown = (el) => !el.hidden && el.getClientRects().length > 0;
  return {
    pane: pane?.dataset.pane ?? null,
    name: sec ? [...sec.querySelectorAll('.ed-note')].filter(shown).map((n) => n.textContent).join(' ') : null,
    buttons: sec ? [...sec.querySelectorAll('button')].filter(shown).map((b) => b.textContent) : null,
    backdrop: !!document.querySelector('section.present > .backdrop'),
  };
})()`;
  const section = async (page) => { await frames(page); return page.evaluate(SECTION); };
  const WITH = (name) => ({ pane: 'slide', name, buttons: ['Select'], backdrop: true });
  const WITHOUT = { pane: 'slide', name: '', buttons: ['Backdrop…'], backdrop: false };

  for (const platform of PLATFORMS) {
    test(`the Slide pane names the backdrop of the first slide once the file is opened (${platform})`, async () => {
      const page = await slidePage(platform);
      assert.deepEqual(await section(page), WITH('Beeson Logo'));
      await click(page, '#beeson-edit-panel-format .ed-sec button[data-command="backdrop.select"]');
      assert.equal((await section(page)).pane, 'backdrop');
      await press(page, 'Escape');
      assert.deepEqual(await section(page), WITH('Beeson Logo'));
      assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
    });

    test(`the section Backdrop of the Slide pane follows an undo and a redo of Add Backdrop and of Delete (${platform})`, async () => {
      const page = await slidePage(platform);
      const index = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((s) => !/\\b(title|section|closing|figure|split)\\b/.test(s.className) && !s.querySelector(':scope > .backdrop'))`);
      assert.ok(index > 0, 'the deck does not have a content slide without a backdrop');
      await page.evaluate(`Reveal.slide(${index})`);
      assert.deepEqual(await section(page), WITHOUT);
      await click(page, '#beeson-edit-panel-format .ed-sec button[data-command="insert.backdrop"]');
      await page.waitFor(`!!document.querySelector('.beeson-backdrop-gallery [data-tile="tubes"]')`);
      await click(page, '.beeson-backdrop-gallery [data-tile="tubes"]');
      assert.equal((await section(page)).pane, 'backdrop');
      await press(page, 'Escape');
      assert.deepEqual(await section(page), WITH('Cislunar Manifolds'));
      await exec(page, 'edit.undo');
      assert.deepEqual(await section(page), WITHOUT, 'after the undo of Add Backdrop');
      assert.equal(await page.evaluate('window.BeesonEditor.render()'), page.source);
      await exec(page, 'edit.redo');
      await press(page, 'Escape');
      assert.deepEqual(await section(page), WITH('Cislunar Manifolds'), 'after the redo of Add Backdrop');
      await click(page, '#beeson-edit-panel-format .ed-sec button[data-command="backdrop.select"]');
      await press(page, 'Delete');
      assert.deepEqual(await section(page), WITHOUT, 'after Delete of the backdrop');
      await exec(page, 'edit.undo');
      await press(page, 'Escape');
      assert.deepEqual(await section(page), WITH('Cislunar Manifolds'), 'after the undo of Delete');
    });
  }
});

describe('the list of backdrops of Media > Backdrop…', () => {
  const DEMO = 'test-deck.html';
  const DECK = 'test/pages/editor-r22-5.html';
  const PLATFORMS = ['mac', 'other'];
  const PANEL = '#beeson-edit-panel-format';
  const TILES = '.beeson-backdrop-gallery [data-tile]';
  const LIST = [
    'Beeson Logo',
    'Cislunar Manifolds',
    'Earth Manifolds',
    'Poincaré Sections',
    'Invariant Tori',
    'Saddle Manifolds',
    'Normal Form',
    'Broucke Families',
  ];
  const LOGO = '<div class="backdrop" data-trajectories="brand/transfer.js" data-duration="20" data-cx="-0.84" data-cy="0" data-half="1.128">';
  const BROUCKE = '<div class="backdrop" data-trajectories="demo/broucke-sample.js" data-trajectories-select="frame=pulsating" data-trajectories-color="family" data-trajectories-ramp="e" data-trajectories-colormap="viridis" data-duration="3" data-stagger="0.6">';
  const TUBES = '<div class="backdrop" data-backdrop="tubes" data-cx="0.97" data-cy="0" data-half="0.5">';

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

  const exec = (page, id, arg) => page.evaluate(`window.BeesonEditor.exec(${JSON.stringify(id)}${arg ? `, ${JSON.stringify(arg)}` : ''})`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${JSON.stringify(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('window.BeesonEditor.undo()');
  const redo = (page) => page.evaluate('window.BeesonEditor.redo()');
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
  const trajectories = (page) => page.evaluate(`(async () => {
  const el = document.querySelector('section.present .backdrop');
  const o = el && Beeson.backdrops.find((b) => b.el === el);
  if (!o) return -1;
  await o.ready;
  return o.trajectories.length;
})()`);

  async function deckPage(platform, deck, n, size) {
    await last?.close().catch(() => {});
    const page = await browser.newPage(size);
    last = page;
    await page.goto(`${server.origin}/${deck}?edit&still&edit-platform=${platform}`);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(deck, 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${JSON.stringify(page.source)})`);
    assert.deepEqual(s.problems, []);
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    return page;
  }

  async function openList(page, count) {
    await exec(page, 'insert.backdrop');
    await page.waitFor(`document.querySelectorAll('${TILES}').length >= ${count}`);
    await frames(page);
    return page.evaluate(`[...document.querySelectorAll('${TILES}')].map((b) => [b.dataset.tile, b.querySelector('.name').textContent, b.disabled, b.title, b.textContent])`);
  }

  async function pick(page, key, text) {
    await click(page, `${TILES}[data-tile="${key}"]`);
    await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(text)}`);
    await frames(page);
  }

  async function rowNames(page, ns) {
    if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
    const out = [];
    for (const n of ns) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      out.push(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].filter((r) => r.dataset.kind === 'Backdrop').map((r) => r.querySelector('.name').textContent).join()`));
    }
    return out;
  }

  async function paneName(page) {
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await frames(page);
    return page.evaluate(`document.querySelector('${PANEL} [aria-label="Backdrop"]').textContent`);
  }

  const familyName = (page) => page.evaluate(`['Family', 'Frame'].map((l) => document.querySelector('${PANEL} [aria-label="' + l + '"]').textContent).join(' ')`);

  const tagOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];

  for (const platform of PLATFORMS) {
    test(`the list names the drawings as the owner asked, with Beeson Logo and one entry Broucke Families (${platform})`, async () => {
      const page = await deckPage(platform, DEMO, 1);
      const list = await openList(page, LIST.length);
      assert.deepEqual(list.map((e) => e[1]), LIST);
      for (const key of ['logo', 'tubes', 'wideRibbon', 'broucke']) assert.ok(list.some((e) => e[0] === key), `the list does not have ${key}`);
      assert.ok(list.every((e) => !e[2]), 'an entry of the demo deck is dimmed');
      assert.ok(list.every((e) => !/broucke-sample|transfer|Nest|Tubes|Ribbon/.test(e[1] + e[3])), 'an entry is named after its file or by its old name');
      await page.waitFor(`[...document.querySelectorAll('${TILES}')].every((b) => b.querySelector('.tile canvas'))`);
      await press(page, 'Escape');
      assert.deepEqual(await rowNames(page, [0, 1, 2, 6, 12]), [
        'Backdrop: Beeson Logo',
        'Backdrop: Broucke 7/11 (Rotating)',
        'Backdrop: Cislunar Manifolds',
        'Backdrop: Earth Manifolds',
        'Backdrop: Cislunar Manifolds',
      ]);
      await page.evaluate('Reveal.slide(2)');
      assert.equal(await paneName(page), 'Cislunar Manifolds');
      assert.equal(await render(page), page.source);
    });

    test(`Beeson Logo adds the backdrop of the title slide with its attributes and its window (${platform})`, async () => {
      const page = await deckPage(platform, DEMO, 0);
      assert.ok(page.source.includes(`${LOGO}</div>`));
      await exec(page, 'backdrop.select');
      await exec(page, 'element.delete');
      const bare = await render(page);
      assert.ok(!bare.includes(LOGO));
      await openList(page, LIST.length - 1);
      await pick(page, 'logo', bare);
      assert.equal(await render(page), page.source);
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Add Backdrop');
      assert.ok((await trajectories(page)) > 100, 'the logo is not drawn');
      await undo(page);
      assert.equal(await render(page), bare);
      await redo(page);
      assert.equal(await render(page), page.source);
    });

    test(`a Broucke entry puts 7P with the frame, the colors, and the window of the demo deck (${platform})`, async () => {
      const page = await deckPage(platform, DEMO, 1);
      assert.equal(await paneName(page), 'Broucke Families');
      assert.equal(await familyName(page), '7/11 Rotating');
      assert.equal(tagOf(page.source, '<section class="section">'), BROUCKE);
      await openList(page, LIST.length);
      await pick(page, 'broucke', page.source);
      assert.equal(tagOf(await render(page), '<section class="section">'), BROUCKE.replace('frame=pulsating', 'family=7,branch=periapsis,frame=pulsating'));
      assert.equal(await trajectories(page), 8);
      assert.equal(await paneName(page), 'Broucke Families');
      assert.equal(await familyName(page), '7 Rotating');
      await undo(page);
      assert.equal(await render(page), page.source);
      await exec(page, 'backdrop.frame', { value: 'Inertial' });
      await page.waitFor(`window.BeesonEditor.render() !== ${JSON.stringify(page.source)}`);
      assert.equal(tagOf(await render(page), '<section class="section">'), BROUCKE.replace('frame=pulsating', 'frame=inertial'));
      assert.equal(await trajectories(page), 16);
      assert.equal(await paneName(page), 'Broucke Families');
      assert.equal(await familyName(page), '7/11 Inertial');
      await undo(page);
      await page.evaluate('Reveal.slide(2)');
      await frames(page);
      const before = await render(page);
      assert.equal(before, page.source);
      assert.equal(tagOf(before, '<h2>Show your steps one at a time'), TUBES);
      await openList(page, LIST.length);
      await pick(page, 'broucke', before);
      const text = await render(page);
      assert.equal(tagOf(text, '<h2>Show your steps one at a time'), '<div class="backdrop" data-trajectories="demo/broucke-sample.js" data-trajectories-select="family=7,branch=periapsis,frame=pulsating" data-trajectories-color="family" data-trajectories-ramp="e" data-trajectories-colormap="viridis" data-duration="3" data-stagger="0.6">');
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Replace Backdrop');
      assert.equal(await trajectories(page), 8);
      await undo(page);
      assert.equal(await render(page), before);
      await redo(page);
      assert.equal(await render(page), text);
      assert.equal((await saveAndReopen(page)).text, text);
    });

    test(`a drawing of a deck is named by its scene, its file, and the pick of its selection (${platform})`, async () => {
      const page = await deckPage(platform, DECK, 0);
      assert.deepEqual(await rowNames(page, [0, 1, 2, 3, 4, 5]), [
        'Backdrop: Cislunar Manifolds',
        'Backdrop: Broucke 7/11 (Rotating)',
        'Backdrop: Broucke 11 (Inertial)',
        'Backdrop: Broucke 7 (Rotating, Periapsis)',
        'Backdrop: Beeson Logo',
        'Backdrop: missing',
      ]);
    });

    test(`an entry whose file is not next to the deck is left out, and a drawing of the deck with a missing file is dimmed with the reason (${platform})`, async () => {
      const page = await deckPage(platform, DECK, 6);
      const list = await openList(page, 8);
      assert.deepEqual(list.map((e) => e[1]), [
        'Cislunar Manifolds',
        'Earth Manifolds',
        'Poincaré Sections',
        'Invariant Tori',
        'Saddle Manifolds',
        'Normal Form',
        'Broucke Families',
        'Beeson Logo',
        'missing',
      ]);
      assert.deepEqual(list.map((e) => e[2]), [false, false, false, false, false, false, false, false, true]);
      assert.match(list.at(-1)[3], /missing\.js is not found next to the deck/);
      assert.match(list.at(-1)[4], /File not found/);
      await click(page, `${TILES}:disabled`);
      await frames(page);
      assert.equal(await render(page), page.source);
      await press(page, 'Escape');
      await page.evaluate('Reveal.slide(1)');
      await frames(page);
      await paneName(page);
      await click(page, `${PANEL} [aria-label="Backdrop"]`);
      await page.waitFor(`!!document.querySelector('.beeson-edit-menu.select')`);
      const items = await page.evaluate(`[...document.querySelectorAll('.beeson-edit-menu.select .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-disabled') === 'true'])`);
      assert.deepEqual(items.map((i) => i[0]), list.map((e) => e[1]));
      assert.deepEqual(items.map((i) => i[1]), list.map((e) => e[2]));
    });

    test(`the list is read in one screen at 1280 by 720 px (${platform})`, async () => {
      const page = await deckPage(platform, DEMO, 1, { width: 1280, height: 720 });
      await openList(page, LIST.length);
      const box = await page.evaluate(`(() => {
      const g = document.querySelector('.beeson-backdrop-gallery');
      const r = g.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, scroll: g.scrollHeight - g.clientHeight };
    })()`);
      assert.ok(box.top >= 0 && box.bottom <= 720 && box.left >= 0 && box.right <= 1280, JSON.stringify(box));
      assert.ok(box.scroll <= 1, `the list scrolls by ${box.scroll} px`);
    });
  }
});

describe('Broucke Families and the names of colormaps', () => {
  const DEMO = 'test-deck.html';
  const DECK = 'test/pages/editor-r22-5.html';
  const SELECTIONS = 'test/pages/editor-r26-2.html';
  const PLATFORMS = ['mac', 'other'];
  const PANEL = '#beeson-edit-panel-format';
  const TILES = '.beeson-backdrop-gallery [data-tile]';
  const MENU = '.beeson-edit-menu.select';
  const LIST = ['Beeson Logo', 'Cislunar Manifolds', 'Earth Manifolds', 'Poincaré Sections', 'Invariant Tori', 'Saddle Manifolds', 'Normal Form', 'Broucke Families'];
  const FAMILIES = ['7', '11', '7/11'];
  const BROUCKE = '<div class="backdrop" data-trajectories="demo/broucke-sample.js" data-trajectories-select="frame=pulsating" data-trajectories-color="family" data-trajectories-ramp="e" data-trajectories-colormap="viridis" data-duration="3" data-stagger="0.6">';
  const STEPS = '<h2>Show your steps one at a time';

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
  const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

  async function load(t, platform, deck, n) {
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
    await page.goto(url);
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(deck, 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
    assert.deepEqual(s.problems, []);
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    return page;
  }

  async function selectBackdrop(page) {
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await frames(page);
  }

  const popupText = (page, label) => page.evaluate(`(() => {
  const b = document.querySelector('${PANEL} [aria-label="${label}"]');
  return b && b.getClientRects().length ? b.textContent : null;
})()`);

  async function popupItems(page, label) {
    await click(page, `${PANEL} [aria-label="${label}"]`);
    await page.waitFor(`!!document.querySelector('${MENU}')`);
    return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-checked') === 'true'])`);
  }

  async function choose(page, name, text) {
    await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
    await click(page, `${MENU} .item[data-pick]`);
    if (text !== undefined) await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await frames(page);
  }

  async function openList(page, count) {
    await exec(page, 'insert.backdrop');
    await page.waitFor(`document.querySelectorAll('${TILES}').length >= ${count}`);
    await frames(page);
    return page.evaluate(`[...document.querySelectorAll('${TILES}')].map((b) => [b.dataset.tile, b.querySelector('.name').textContent])`);
  }

  async function pick(page, name, text) {
    await page.evaluate(`[...document.querySelectorAll('${TILES}')].find((b) => b.querySelector('.name').textContent === ${js(name)}).setAttribute('data-pick', '')`);
    await click(page, `${TILES}[data-pick]`);
    await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await frames(page);
  }

  const tagOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];
  const backdropOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[\\s\\S]*?</div>)`))[1];

  const sections = (page) => page.evaluate(`(() => {
  const shown = (el) => !!el && el.getClientRects().length > 0;
  const secs = [...document.querySelectorAll('${PANEL} .ed-sec')].filter(shown).map((s) => s.querySelector(':scope > h5')?.textContent ?? '').filter(Boolean);
  const note = [...document.querySelectorAll('${PANEL} .ed-note')].some((n) => shown(n) && /data-trajectories/.test(n.textContent));
  return { secs, colormap: shown(document.querySelector('${PANEL} [aria-label="Colormap"]')), family: shown(document.querySelector('${PANEL} [aria-label="Family"]')), note };
})()`);

  for (const platform of PLATFORMS) {
    test(`the list and the Drawing popup have one entry Broucke Families, checked for a backdrop of any family (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 1);
      const list = await openList(page, LIST.length);
      assert.deepEqual(list.map((e) => e[1]), LIST);
      await press(page, 'Escape');
      await selectBackdrop(page);
      assert.equal(await popupText(page, 'Backdrop'), 'Broucke Families');
      const items = await popupItems(page, 'Backdrop');
      assert.deepEqual(items.map((i) => i[0]), LIST);
      assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), ['Broucke Families']);
      await press(page, 'Escape');
      const deck = await load(t, platform, DECK, 6);
      const names = (await openList(deck, 8)).map((e) => e[1]);
      assert.deepEqual(names, ['Cislunar Manifolds', 'Earth Manifolds', 'Poincaré Sections', 'Invariant Tori', 'Saddle Manifolds', 'Normal Form', 'Broucke Families', 'Beeson Logo', 'missing']);
      await press(deck, 'Escape');
      await deck.evaluate('Reveal.slide(3)');
      await frames(deck);
      await selectBackdrop(deck);
      assert.equal(await popupText(deck, 'Backdrop'), 'Broucke Families');
      assert.equal(await popupText(deck, 'Family'), '7');
      assert.deepEqual((await popupItems(deck, 'Backdrop')).filter((i) => i[1]).map((i) => i[0]), ['Broucke Families']);
    });

    test(`the Family popup beside Colormap lists the families with the family of the backdrop checked, and a pick is one entry of the history (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 1);
      await selectBackdrop(page);
      assert.equal(await popupText(page, 'Family'), '7/11');
      const items = await popupItems(page, 'Family');
      assert.deepEqual(items.map((i) => i[0]), FAMILIES);
      assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), ['7/11']);
      await choose(page, '11', page.source);
      const text = await render(page);
      assert.equal(tagOf(text, '<section class="section">'), BROUCKE.replace('frame=pulsating', 'family=11,frame=pulsating'));
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Family');
      assert.equal(await popupText(page, 'Family'), '11');
      assert.equal(await popupText(page, 'Backdrop'), 'Broucke Families');
      assert.deepEqual((await popupItems(page, 'Family')).filter((i) => i[1]).map((i) => i[0]), ['11']);
      await press(page, 'Escape');
      await undo(page);
      assert.equal(await render(page), page.source);
      await redo(page);
      assert.equal(await render(page), text);
      assert.equal((await saveAndReopen(page)).text, text);
    });

    test(`Broucke Families put on a scene draws 7P, and on a Broucke backdrop keeps its selection (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 2);
      await selectBackdrop(page);
      await popupItems(page, 'Backdrop');
      await choose(page, 'Broucke Families', page.source);
      const text = await render(page);
      assert.match(tagOf(text, STEPS), /data-trajectories="demo\/broucke-sample\.js" data-trajectories-select="family=7,branch=periapsis,frame=pulsating"/);
      assert.doesNotMatch(backdropOf(text, STEPS), /class="label"/);
      assert.equal(await popupText(page, 'Family'), '7');
      assert.equal(await popupText(page, 'Colormap'), 'Viridis');
      await undo(page);
      assert.equal(await render(page), page.source);
      await openList(page, LIST.length);
      await pick(page, 'Broucke Families', page.source);
      assert.equal(tagOf(await render(page), STEPS), BROUCKE.replace('frame=pulsating', 'family=7,branch=periapsis,frame=pulsating'));
      await undo(page);
      await page.evaluate('Reveal.slide(1)');
      await frames(page);
      await selectBackdrop(page);
      await popupItems(page, 'Backdrop');
      await choose(page, 'Broucke Families');
      assert.equal(await render(page), page.source);
    });

    test(`the Colormap popup names the colormaps in title case and writes their values (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 1);
      await selectBackdrop(page);
      assert.equal(await popupText(page, 'Colormap'), 'Viridis');
      const items = await popupItems(page, 'Colormap');
      assert.deepEqual(items.map((i) => i[0]), ['Palette', 'Viridis', 'Plasma', 'Magma', 'Blues (Reversed)']);
      assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), ['Viridis']);
      await choose(page, 'Blues (Reversed)', page.source);
      const text = await render(page);
      assert.equal(tagOf(text, '<section class="section">'), BROUCKE.replace('"viridis"', '"Blues_r"'));
      assert.equal(await popupText(page, 'Colormap'), 'Blues (Reversed)');
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Colormap');
      await popupItems(page, 'Colormap');
      await choose(page, 'Palette', text);
      assert.ok(!tagOf(await render(page), '<section class="section">').includes('data-trajectories-colormap'));
      assert.equal(await popupText(page, 'Colormap'), 'Palette');
      await undo(page);
      await undo(page);
      assert.equal(await render(page), page.source);
    });

    test(`a drawing of a file put in place of a scene takes off the labels of the scene in the same entry (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 2);
      const LOGO = /^<div class="backdrop"[^>]*data-trajectories="brand\/transfer\.js"[^>]*>\s*<\/div>$/;
      assert.match(backdropOf(page.source, STEPS), /class="label"/);
      await selectBackdrop(page);
      await popupItems(page, 'Backdrop');
      await choose(page, 'Earth Manifolds', page.source);
      assert.equal((backdropOf(await render(page), STEPS).match(/class="label"/g) ?? []).length, 3);
      await undo(page);
      assert.equal(await render(page), page.source);
      await popupItems(page, 'Backdrop');
      await choose(page, 'Beeson Logo', page.source);
      assert.match(backdropOf(await render(page), STEPS), LOGO);
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Change Backdrop');
      await undo(page);
      assert.equal(await render(page), page.source);
      await openList(page, LIST.length);
      await pick(page, 'Beeson Logo', page.source);
      const text = await render(page);
      assert.match(backdropOf(text, STEPS), LOGO);
      assert.equal(await page.evaluate(`document.querySelectorAll('section.present .backdrop .label').length`), 0);
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Replace Backdrop');
      await undo(page);
      assert.equal(await render(page), page.source);
      await redo(page);
      assert.equal(await render(page), text);
      assert.equal((await saveAndReopen(page)).text, text);
    });

    test(`the Backdrop pane is built again when the drawing changes between a scene and a file (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 2);
      await selectBackdrop(page);
      const builtIn = { secs: ['Backdrop', 'Window', 'Labels', 'Motion'], colormap: false, family: false, note: false };
      const file = { secs: ['Backdrop', 'Window', 'Labels', 'Motion'], colormap: true, family: false, note: true };
      assert.deepEqual(await sections(page), builtIn);
      await openList(page, LIST.length);
      await pick(page, 'Beeson Logo', page.source);
      assert.deepEqual(await sections(page), file);
      assert.equal(await popupText(page, 'Colormap'), 'Palette');
      await undo(page);
      await frames(page);
      assert.deepEqual(await sections(page), builtIn);
      await redo(page);
      await frames(page);
      assert.deepEqual(await sections(page), file);
      await undo(page);
      await frames(page);
      await popupItems(page, 'Backdrop');
      await choose(page, 'Beeson Logo', page.source);
      assert.deepEqual(await sections(page), file);
      await popupItems(page, 'Backdrop');
      await choose(page, 'Cislunar Manifolds', await render(page));
      assert.deepEqual(await sections(page), builtIn);
      assert.deepEqual(page.errors, []);
    });
  }

  for (const platform of PLATFORMS) {
    test(`the Family popup shows the family of the backdrop whatever the order of its terms, and Custom for every record (${platform})`, async (t) => {
      const page = await load(t, platform, SELECTIONS, 1);
      await selectBackdrop(page);
      assert.deepEqual([await popupText(page, 'Family'), await popupText(page, 'Frame'), await popupText(page, 'Branch')], ['7', 'Rotating', 'Periapsis']);
      const items = await popupItems(page, 'Family');
      assert.deepEqual(items.map((i) => i[0]), FAMILIES);
      assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), ['7']);
      await choose(page, '7');
      assert.equal(await render(page), page.source);
      await page.evaluate('Reveal.slide(0)');
      await frames(page);
      await selectBackdrop(page);
      assert.equal(await popupText(page, 'Family'), 'Custom');
      assert.deepEqual((await popupItems(page, 'Family')).filter((i) => i[1]).map((i) => i[0]), []);
      await choose(page, '7/11', page.source);
      assert.match(tagOf(await render(page), '<h2>Every record'), /data-trajectories-select="frame=pulsating"/);
      await undo(page);
      assert.equal(await render(page), page.source);
    });

    test(`an entry of the Drawing popup chosen on a backdrop with more drawing attributes than the entry draws the entry (${platform})`, async (t) => {
      const page = await load(t, platform, SELECTIONS, 4);
      await selectBackdrop(page);
      await popupItems(page, 'Backdrop');
      await choose(page, 'Beeson Logo', page.source);
      assert.equal(tagOf(await render(page), '<h2>A part of the logo'), '<div class="backdrop" data-trajectories="../../brand/transfer.js">');
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Change Backdrop');
      await undo(page);
      assert.equal(await render(page), page.source);
      await page.evaluate('Reveal.slide(5)');
      await frames(page);
      await selectBackdrop(page);
      await popupItems(page, 'Backdrop');
      await choose(page, 'Earth Manifolds', page.source);
      const tag = tagOf(await render(page), '<h2>A scene with heads');
      assert.match(tag, /data-backdrop="wideRibbon"/);
      assert.doesNotMatch(tag, /data-heads/);
    });
  }
});

describe('the Family, Frame, and Branch popups', () => {
  const PICKS = 'test/pages/editor-r28-2.html';
  const MISSING = 'test/pages/editor-r28-2-missing.html';
  const PLATFORMS = ['mac', 'other'];
  const PANEL = '#beeson-edit-panel-format';
  const TILES = '.beeson-backdrop-gallery [data-tile]';
  const MENU = '.beeson-edit-menu.select';
  const SHOWN = [
    ['7', 'Rotating', 'Periapsis'],
    ['7', 'Rotating', 'Apoapsis'],
    ['7', 'Inertial', 'Periapsis'],
    ['7', 'Inertial', 'Apoapsis'],
    ['11', 'Rotating', null],
    ['11', 'Inertial', null],
    ['7/11', 'Rotating', null],
    ['7/11', 'Inertial', null],
    ['Custom', 'Custom', null],
    ['Custom', 'Custom', null],
    ['Custom', 'Custom', null],
  ];
  const ROWS = [
    'Broucke 7 (Rotating, Periapsis)',
    'Broucke 7 (Rotating, Apoapsis)',
    'Broucke 7 (Inertial, Periapsis)',
    'Broucke 7 (Inertial, Apoapsis)',
    'Broucke 11 (Rotating)',
    'Broucke 11 (Inertial)',
    'Broucke 7/11 (Rotating)',
    'Broucke 7/11 (Inertial)',
    'Broucke (Custom)',
    'Broucke (Custom)',
    'Broucke (Custom)',
  ].map((name) => `Backdrop: ${name}`);
  const ITEMS = { Family: ['7', '11', '7/11'], Frame: ['Rotating', 'Inertial'], Branch: ['Periapsis', 'Apoapsis'] };

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
  const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

  async function load(t, platform, deck, n) {
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
    await page.goto(url);
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(deck, 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
    assert.deepEqual(s.problems, []);
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    return page;
  }

  async function selectBackdrop(page) {
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await frames(page);
  }

  const popupText = (page, label) => page.evaluate(`(() => {
  const b = document.querySelector('${PANEL} [aria-label="${label}"]');
  return b && b.getClientRects().length ? b.textContent : null;
})()`);
  const popupDisabled = (page, label) => page.evaluate(`document.querySelector('${PANEL} [aria-label="${label}"]').disabled`);

  async function popupItems(page, label) {
    await click(page, `${PANEL} [aria-label="${label}"]`);
    await page.waitFor(`!!document.querySelector('${MENU}')`);
    return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-checked') === 'true'])`);
  }

  async function choose(page, name, text) {
    await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
    await click(page, `${MENU} .item[data-pick]`);
    if (text !== undefined) await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await frames(page);
  }

  async function pickItem(page, label, name, text) {
    await popupItems(page, label);
    await choose(page, name, text);
  }

  async function openList(page, count) {
    await exec(page, 'insert.backdrop');
    await page.waitFor(`document.querySelectorAll('${TILES}').length >= ${count}`);
    await frames(page);
    return page.evaluate(`[...document.querySelectorAll('${TILES}')].map((b) => [b.dataset.tile, b.querySelector('.name').textContent])`);
  }

  async function pick(page, name, text) {
    await page.evaluate(`[...document.querySelectorAll('${TILES}')].find((b) => b.querySelector('.name').textContent === ${js(name)}).setAttribute('data-pick', '')`);
    await click(page, `${TILES}[data-pick]`);
    await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await frames(page);
  }

  async function rowNames(page, ns) {
    if (!(await state(page, 'view.objects')).checked) await exec(page, 'view.objects');
    const out = [];
    for (const n of ns) {
      await page.evaluate(`Reveal.slide(${n})`);
      await frames(page);
      out.push(await page.evaluate(`[...document.querySelectorAll('.beeson-edit-objects .row')].filter((r) => r.dataset.kind === 'Backdrop').map((r) => r.querySelector('.name').textContent).join()`));
    }
    return out;
  }

  const tagOf = (text, heading) => text.match(new RegExp(`${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];

  for (const platform of PLATFORMS) {
    test(`the Family, Frame, and Branch popups show the pick of each drawing by the records it draws, and Custom for any other selection (${platform})`, async (t) => {
      const page = await load(t, platform, PICKS, 0);
      for (const [n, shown] of SHOWN.entries()) {
        await page.evaluate(`Reveal.slide(${n})`);
        await frames(page);
        await selectBackdrop(page);
        for (const [i, label] of ['Family', 'Frame', 'Branch'].entries()) {
          assert.equal(await popupText(page, label), shown[i], `${label} on slide ${n}`);
          if (shown[i] === null) continue;
          if (shown[i] === 'Custom' && label === 'Frame') {
            assert.equal(await popupDisabled(page, label), true, `Frame on slide ${n}`);
            continue;
          }
          const items = await popupItems(page, label);
          assert.deepEqual(items.map((x) => x[0]), ITEMS[label], `${label} on slide ${n}`);
          assert.deepEqual(items.filter((x) => x[1]).map((x) => x[0]), shown[i] === 'Custom' ? [] : [shown[i]], `${label} on slide ${n}`);
          await press(page, 'Escape');
        }
      }
      assert.deepEqual(await rowNames(page, SHOWN.map((_, n) => n)), ROWS);
    });

    test(`each pick replaces the whole selection with one of the eight as one entry of the history, keeping the frame, and keeping the branch in Frame (${platform})`, async (t) => {
      const page = await load(t, platform, PICKS, 0);
      await selectBackdrop(page);
      const tag = (select) => `<div class="backdrop" data-trajectories="../../demo/broucke-sample.js" data-trajectories-select="${select}" data-trajectories-color="family" data-trajectories-ramp="e">`;
      await pickItem(page, 'Family', '7');
      assert.equal(await render(page), page.source);
      const steps = [
        ['Branch', 'Apoapsis', 'family=7,branch=apoapsis,frame=rotating', ['7', 'Rotating', 'Apoapsis']],
        ['Frame', 'Inertial', 'family=7,branch=apoapsis,frame=inertial-m2', ['7', 'Inertial', 'Apoapsis']],
        ['Branch', 'Periapsis', 'family=7,branch=periapsis,frame=inertial-m2', ['7', 'Inertial', 'Periapsis']],
        ['Family', '11', 'family=11,frame=inertial', ['11', 'Inertial', null]],
        ['Frame', 'Rotating', 'family=11,frame=pulsating', ['11', 'Rotating', null]],
        ['Family', '7/11', 'frame=pulsating', ['7/11', 'Rotating', null]],
        ['Frame', 'Inertial', 'frame=inertial', ['7/11', 'Inertial', null]],
        ['Family', '7', 'family=7,branch=periapsis,frame=inertial-m2', ['7', 'Inertial', 'Periapsis']],
        ['Branch', 'Apoapsis', 'family=7,branch=apoapsis,frame=inertial-m2', ['7', 'Inertial', 'Apoapsis']],
        ['Family', '7/11', 'frame=inertial', ['7/11', 'Inertial', null]],
        ['Frame', 'Rotating', 'frame=pulsating', ['7/11', 'Rotating', null]],
        ['Family', '7', 'family=7,branch=periapsis,frame=pulsating', ['7', 'Rotating', 'Periapsis']],
      ];
      const texts = [page.source];
      for (const [label, name, select, shown] of steps) {
        await pickItem(page, label, name, texts.at(-1));
        const text = await render(page);
        assert.equal(tagOf(text, '<h2>Seven rotating periapsis'), tag(select), `${label} ${name}`);
        assert.equal(text.replace(tag(select), ''), page.source.replace(tag('family=7,branch=periapsis,frame=pulsating'), ''), `${label} ${name}`);
        assert.equal((await state(page, 'edit.undo')).label, `Undo ${label}`);
        for (const [i, l] of ['Family', 'Frame', 'Branch'].entries()) assert.equal(await popupText(page, l), shown[i], `${l} after ${label} ${name}`);
        texts.push(text);
      }
      for (let i = texts.length - 2; i >= 0; i--) {
        await undo(page);
        assert.equal(await render(page), texts[i], `undo ${i}`);
      }
      await redo(page);
      assert.equal(await render(page), texts[1]);
      assert.equal((await saveAndReopen(page)).text, texts[1]);
    });

    test(`on a Custom selection Frame and Branch are not picked, and a family replaces the selection in the rotating frame (${platform})`, async (t) => {
      const page = await load(t, platform, PICKS, 9);
      await selectBackdrop(page);
      assert.equal(await popupText(page, 'Family'), 'Custom');
      assert.equal(await popupText(page, 'Branch'), null);
      await exec(page, 'backdrop.frame', { value: 'Rotating' });
      await exec(page, 'backdrop.branch', { value: 'Apoapsis' });
      assert.equal(await render(page), page.source);
      await pickItem(page, 'Family', '7', page.source);
      const text = await render(page);
      assert.equal(tagOf(text, '<h2>Seven about the barycenter'), '<div class="backdrop" data-trajectories="../../demo/broucke-sample.js" data-trajectories-select="family=7,branch=periapsis,frame=pulsating" data-trajectories-color="family" data-trajectories-ramp="e">');
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Family');
      assert.deepEqual([await popupText(page, 'Family'), await popupText(page, 'Frame'), await popupText(page, 'Branch')], ['7', 'Rotating', 'Periapsis']);
      await undo(page);
      assert.equal(await render(page), page.source);
      assert.equal(await popupText(page, 'Frame'), 'Custom');
      await page.evaluate('Reveal.slide(8)');
      await frames(page);
      await selectBackdrop(page);
      await pickItem(page, 'Family', '11', page.source);
      assert.equal(tagOf(await render(page), '<h2>Every record'), '<div class="backdrop" data-trajectories="../../demo/broucke-sample.js" data-trajectories-color="family" data-trajectories-ramp="e" data-trajectories-select="family=11,frame=pulsating">');
    });

    test(`Broucke Families is listed when the first drawing of its file in the deck is missing and a later one is found (${platform})`, async (t) => {
      const page = await load(t, platform, MISSING, 2);
      await selectBackdrop(page);
      const items = (await popupItems(page, 'Backdrop')).map((i) => i[0]);
      assert.ok(items.includes('Broucke Families'), items.join(', '));
      await press(page, 'Escape');
      const list = (await openList(page, 3)).map((e) => e[1]);
      assert.ok(list.includes('Broucke Families'), list.join(', '));
      await pick(page, 'Broucke Families', page.source);
      const tag = tagOf(await render(page), '<h2>A scene');
      assert.match(tag, /data-trajectories="\.\.\/\.\.\/demo\/broucke-sample\.js"/);
      assert.match(tag, /data-trajectories-select="family=7,branch=periapsis,frame=pulsating"/);
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Replace Backdrop');
      await undo(page);
      assert.equal(await render(page), page.source);
    });
  }
});

describe('the window kept at a change of drawing', () => {
  const DEMO = 'test-deck.html';
  const PLATFORMS = ['mac', 'other'];
  const PANEL = '#beeson-edit-panel-format';
  const MENU = '.beeson-edit-menu.select';
  const TITLE = '<section class="title">';
  const SECTION = '<section class="section">';
  const STEPS = '<h2>Show your steps one at a time';
  const TUBES = '<div class="backdrop" data-backdrop="tubes" data-cx="0.97" data-cy="0" data-half="0.5">';

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
  const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

  async function load(t, platform, n) {
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    const url = `${server.origin}/${DEMO}?edit&still&edit-platform=${platform}`;
    await page.goto(url);
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(DEMO, 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
    assert.deepEqual(s.problems, []);
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    return page;
  }

  async function selectBackdrop(page) {
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await frames(page);
  }

  async function choosePopup(page, label, name, text) {
    await click(page, `${PANEL} [aria-label="${label}"]`);
    await page.waitFor(`!!document.querySelector('${MENU}')`);
    await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
    await click(page, `${MENU} .item[data-pick]`);
    await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await settle(page);
  }
  const chooseDrawing = (page, name, text) => choosePopup(page, 'Backdrop', name, text);

  async function settle(page) {
    await frames(page);
    await page.waitFor(`(() => {
    const el = window.BeesonEditor.selection()[0];
    const o = el && window.Beeson.backdrops.find((b) => b.el === el);
    return o ? o.ready.then(() => true) : false;
  })()`);
    await press(page, 'Escape');
    await frames(page);
    await exec(page, 'backdrop.select');
    await frames(page);
  }

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];
  const backdropOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[\\s\\S]*?</div>)`))[1];
  const attr = (tag, name) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1] ?? null;

  const cuts = (page) => page.evaluate(`[...document.querySelectorAll('.beeson-backdrop-cuts .beeson-mask-cut')].map((m) => m.dataset.edge)`);

  const fit = (page) => page.evaluate('window.Beeson.fitWindow(window.BeesonEditor.selection()[0])');
  const drawnView = (page) => page.evaluate(`(() => {
  const el = window.BeesonEditor.selection()[0];
  const v = window.Beeson.backdrops.find((b) => b.el === el).view;
  return { cx: v.cx, cy: v.cy, half: v.half };
})()`);

  const fields = (page) => page.evaluate(`Object.fromEntries(['Center X', 'Center Y', 'Half Height'].map((n) => [n, Number(document.querySelector('${PANEL} input[name="' + n + '"]').value)]))`);
  function assertFields(shown, tag) {
    for (const [name, key] of [['Center X', 'data-cx'], ['Center Y', 'data-cy'], ['Half Height', 'data-half']]) {
      assert.ok(Math.abs(shown[name] - Number(attr(tag, key))) < 0.0051, `${name} reads ${shown[name]} for ${key}="${attr(tag, key)}"`);
    }
  }

  async function checkHistory(page, text) {
    assert.equal((await state(page, 'edit.undo')).label, 'Undo Change Backdrop');
    await undo(page);
    assert.equal(await render(page), page.source);
    await redo(page);
    assert.equal(await render(page), text);
    assert.equal((await saveAndReopen(page)).text, text);
  }

  for (const platform of PLATFORMS) {
    test(`Broucke Families chosen on the Cislunar Manifolds of slide 3 takes off the window, writes the motion of the entry, and is whole in its box (${platform})`, async (t) => {
      const page = await load(t, platform, 2);
      await selectBackdrop(page);
      await chooseDrawing(page, 'Broucke Families', page.source);
      const text = await render(page);
      const tag = tagOf(text, STEPS);
      for (const name of ['data-cx', 'data-cy', 'data-half', 'data-backdrop']) assert.equal(attr(tag, name), null, `${name} is kept in ${tag}`);
      assert.equal(attr(tag, 'data-trajectories-select'), 'family=7,branch=periapsis,frame=pulsating');
      assert.equal(attr(tag, 'data-duration'), '3');
      assert.equal(attr(tag, 'data-stagger'), '0.6');
      assert.doesNotMatch(backdropOf(text, STEPS), /class="label"/);
      assert.deepEqual(await cuts(page), []);
      const v = await fit(page);
      const drawn = await drawnView(page);
      for (const k of ['cx', 'cy', 'half']) assert.ok(Math.abs(drawn[k] - v[k]) < 1e-6, `${k} is drawn at ${drawn[k]}, not at the fitted ${v[k]}`);
      const shown = await fields(page);
      assert.ok(Math.abs(shown['Center X'] - v.cx) < 0.0051 && Math.abs(shown['Half Height'] - v.half) < 0.0051, `the fields read ${js(shown)} for ${js(v)}`);
      await checkHistory(page, text);
    });

    test(`Beeson Logo chosen on the Cislunar Manifolds of slide 3 writes the fitted window and the 20 s of the entry (${platform})`, async (t) => {
      const page = await load(t, platform, 2);
      await selectBackdrop(page);
      await chooseDrawing(page, 'Beeson Logo', page.source);
      const text = await render(page);
      const tag = tagOf(text, STEPS);
      assert.equal(attr(tag, 'data-trajectories'), 'brand/transfer.js');
      assert.equal(attr(tag, 'data-duration'), '20');
      assert.equal(attr(tag, 'data-stagger'), null);
      const v = await fit(page);
      assert.ok(Math.abs(v.cx - 0.093) < 0.01 && Math.abs(v.half - 1.473) < 0.01, `the fitted window is ${js(v)}`);
      for (const [k, name] of [['cx', 'data-cx'], ['cy', 'data-cy'], ['half', 'data-half']]) {
        assert.ok(Math.abs(Number(attr(tag, name)) - v[k]) < 0.001, `${name}="${attr(tag, name)}" for the fitted ${v[k]}`);
      }
      assert.deepEqual(await cuts(page), []);
      assertFields(await fields(page), tag);
      await checkHistory(page, text);
    });

    test(`Cislunar Manifolds chosen on the Broucke backdrop of slide 2 writes the fitted window and takes off the motion of the file (${platform})`, async (t) => {
      const page = await load(t, platform, 1);
      await selectBackdrop(page);
      await chooseDrawing(page, 'Cislunar Manifolds', page.source);
      const text = await render(page);
      const tag = tagOf(text, SECTION);
      assert.equal(attr(tag, 'data-backdrop'), 'tubes');
      for (const name of ['data-trajectories', 'data-trajectories-select', 'data-duration', 'data-stagger']) assert.equal(attr(tag, name), null, `${name} is kept in ${tag}`);
      const v = await fit(page);
      assert.ok(Math.abs(v.cx - 0.276) < 0.01 && Math.abs(v.half - 1.418) < 0.01, `the fitted window is ${js(v)}`);
      for (const [k, name] of [['cx', 'data-cx'], ['cy', 'data-cy'], ['half', 'data-half']]) {
        assert.ok(Math.abs(Number(attr(tag, name)) - v[k]) < 0.001, `${name}="${attr(tag, name)}" for the fitted ${v[k]}`);
      }
      assert.deepEqual(await cuts(page), []);
      assertFields(await fields(page), tag);
      await checkHistory(page, text);
    });

    test(`a scene chosen on a drawing of a file in a box of the size of the box of its entry writes the window of the entry (${platform})`, async (t) => {
      const page = await load(t, platform, 0);
      await selectBackdrop(page);
      assert.deepEqual(await page.evaluate('[window.BeesonEditor.selection()[0].offsetWidth, window.BeesonEditor.selection()[0].offsetHeight]'), [1920, 1080]);
      await chooseDrawing(page, 'Cislunar Manifolds', page.source);
      const text = await render(page);
      const tag = tagOf(text, TITLE);
      assert.equal(tag, '<div class="backdrop" data-cx="0.42" data-cy="0" data-half="0.6" data-backdrop="tubes">');
      assertFields(await fields(page), tag);
      await checkHistory(page, text);
    });

    test(`after Broucke Families is chosen in the Drawing popup, the Family and Colormap popups write only their attribute (${platform})`, async (t) => {
      const page = await load(t, platform, 2);
      await selectBackdrop(page);
      await chooseDrawing(page, 'Broucke Families', page.source);
      const drawing = await render(page);
      await choosePopup(page, 'Family', '11', drawing);
      const family = await render(page);
      assert.equal(tagOf(family, STEPS), tagOf(drawing, STEPS).replace('family=7,branch=periapsis,frame=pulsating', 'family=11,frame=pulsating'));
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Family');
      await choosePopup(page, 'Colormap', 'Plasma', family);
      const colormap = await render(page);
      assert.equal(tagOf(colormap, STEPS), tagOf(family, STEPS).replace('data-trajectories-colormap="viridis"', 'data-trajectories-colormap="plasma"'));
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Colormap');
      assert.deepEqual(await cuts(page), []);
      await undo(page);
      await undo(page);
      assert.equal(await render(page), drawing);
      await undo(page);
      assert.equal(await render(page), page.source);
    });

    test(`between two named scenes the Drawing popup keeps the window, the labels, and the motion (${platform})`, async (t) => {
      const page = await load(t, platform, 2);
      await selectBackdrop(page);
      await chooseDrawing(page, 'Earth Manifolds', page.source);
      const text = await render(page);
      assert.equal(text, page.source.replace(TUBES, TUBES.replace('tubes', 'wideRibbon')));
      assertFields(await fields(page), tagOf(text, STEPS));
      await checkHistory(page, text);
    });
  }
});

describe('picks in the popups give back the bytes', () => {
  const DEMO = 'test-deck.html';
  const DECK = 'test/pages/editor-r22-5.html';
  const PLATFORMS = ['mac', 'other'];
  const PANEL = '#beeson-edit-panel-format';
  const MENU = '.beeson-edit-menu.select';
  const SECTION = '<section class="section">';
  const STEPS = '<h2>Show your steps one at a time';

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
  const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

  async function load(t, platform, deck, n) {
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
    await page.goto(url);
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(deck, 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
    assert.deepEqual(s.problems, []);
    await go(page, n);
    return page;
  }

  async function go(page, n) {
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await frames(page);
  }

  const popupText = (page, label) => page.evaluate(`document.querySelector('${PANEL} [aria-label="${label}"]').textContent`);

  async function popupItems(page, label) {
    await click(page, `${PANEL} [aria-label="${label}"]`);
    await page.waitFor(`!!document.querySelector('${MENU}')`);
    return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-checked') === 'true', i.getAttribute('aria-disabled') === 'true'])`);
  }

  async function choose(page, name, text) {
    await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
    await click(page, `${MENU} .item[data-pick]`);
    if (text !== undefined) await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await frames(page);
  }

  async function pick(page, label, name, undoLabel) {
    const text = await render(page);
    await popupItems(page, label);
    await choose(page, name, text);
    assert.equal((await state(page, 'edit.undo')).label, undoLabel);
    return render(page);
  }

  async function assertFamily(page, checked) {
    assert.equal(await popupText(page, 'Family'), checked);
    const items = await popupItems(page, 'Family');
    assert.deepEqual(items.map((i) => i[0]), ['7', '11', '7/11']);
    assert.deepEqual(items.filter((i) => i[1]).map((i) => i[0]), [checked]);
    await press(page, 'Escape');
  }

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];

  for (const platform of PLATFORMS) {
    test(`Family 7 chosen on slide 2 writes 7P, and 7/11 gives back the bytes of the demo deck (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 1);
      const seven = await pick(page, 'Family', '7', 'Undo Family');
      assert.equal(seven, page.source.replace('data-trajectories-select="frame=pulsating"', 'data-trajectories-select="family=7,branch=periapsis,frame=pulsating"'));
      await assertFamily(page, '7');
      const both = await pick(page, 'Family', '7/11', 'Undo Family');
      assert.equal(both, page.source);
      await assertFamily(page, '7/11');
      await undo(page);
      assert.equal(await render(page), seven);
      await undo(page);
      assert.equal(await render(page), page.source);
      await redo(page);
      assert.equal(await render(page), seven);
      await redo(page);
      assert.equal(await render(page), page.source);
      assert.equal((await saveAndReopen(page)).text, page.source);
    });

    test(`Broucke Families chosen on slide 3 while slide 2 draws family 7 writes 7P, and Inertial writes 7P about m2 there alone (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 1);
      const seven = await pick(page, 'Family', '7', 'Undo Family');
      await go(page, 2);
      const drawing = await pick(page, 'Backdrop', 'Broucke Families', 'Undo Change Backdrop');
      assert.match(tagOf(drawing, STEPS), /data-trajectories-select="family=7,branch=periapsis,frame=pulsating"/);
      await assertFamily(page, '7');
      const inertial = await pick(page, 'Frame', 'Inertial', 'Undo Frame');
      assert.equal(tagOf(inertial, STEPS), tagOf(drawing, STEPS).replace('frame=pulsating', 'frame=inertial-m2'));
      assert.equal(tagOf(inertial, SECTION), tagOf(seven, SECTION));
      assert.equal(await popupText(page, 'Frame'), 'Inertial');
      await go(page, 1);
      await assertFamily(page, '7');
      assert.equal(await popupText(page, 'Frame'), 'Rotating');
      await go(page, 2);
      await undo(page);
      assert.equal(await render(page), drawing);
      await redo(page);
      assert.equal(await render(page), inertial);
      assert.equal((await saveAndReopen(page)).text, inertial);
    });

    test(`Broucke Families stays in the Drawing popup of a deck in another folder once every drawing of the file is replaced, and draws the file of the deck (${platform})`, async (t) => {
      const page = await load(t, platform, DECK, 1);
      for (const n of [1, 2, 3]) {
        await go(page, n);
        await pick(page, 'Backdrop', 'Cislunar Manifolds', 'Undo Change Backdrop');
      }
      const items = await popupItems(page, 'Backdrop');
      assert.deepEqual(items.find((i) => i[0] === 'Broucke Families'), ['Broucke Families', false, false], js(items));
      await press(page, 'Escape');
      const text = await pick(page, 'Backdrop', 'Broucke Families', 'Undo Change Backdrop');
      assert.match(tagOf(text, '<h2>One family</h2>'), /data-trajectories="\.\.\/\.\.\/demo\/broucke-sample\.js" data-trajectories-select="family=7,branch=periapsis,frame=pulsating"/);
      assert.equal(await popupText(page, 'Backdrop'), 'Broucke Families');
    });
  }
});

describe('built-in backdrops whose file is not found', () => {
  const TALK = 'test/pages/editor-r36-4.html';
  const OWN = 'test/pages/editor-r36-4-own.html';
  const DEMO = 'test-deck.html';
  const PLATFORMS = ['mac', 'other'];
  const PANEL = '#beeson-edit-panel-format';
  const TILES = '.beeson-backdrop-gallery [data-tile]';
  const MENU = '.beeson-edit-menu.select';
  const KEYS = ['logo', 'tubes', 'wideRibbon', 'poincare', 'tori', 'saddle', 'normalForm', 'broucke'];
  const LIST = ['Beeson Logo', 'Cislunar Manifolds', 'Earth Manifolds', 'Poincaré Sections', 'Invariant Tori', 'Saddle Manifolds', 'Normal Form', 'Broucke Families'];
  const LOGO_TITLE = 'brand/transfer.js is not found next to the deck';
  const BROUCKE_TITLE = 'demo/broucke-sample.js is not found next to the deck';

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
  const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  const redo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.redo()).then(() => true)');
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');

  async function load(t, platform, deck, n) {
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    const url = `${server.origin}/${deck}?edit&still&edit-platform=${platform}`;
    await page.goto(url);
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(deck, 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
    assert.deepEqual(s.problems, []);
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    return page;
  }

  const failures = (page, path) => page.errors.filter((e) => e.includes(`/test/pages/${path}`)).length;

  async function openList(page) {
    await exec(page, 'insert.backdrop');
    await page.waitFor(`!!document.querySelector('.beeson-backdrop-gallery')`);
    await frames(page);
    return page.evaluate(`[...document.querySelectorAll('${TILES}')].map((b) => ({ key: b.dataset.tile, name: b.querySelector('.name').textContent, disabled: b.disabled, title: b.title, text: b.textContent }))`);
  }

  async function selectBackdrop(page) {
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await frames(page);
  }

  async function popupItems(page, label) {
    await click(page, `${PANEL} [aria-label="${label}"]`);
    await page.waitFor(`!!document.querySelector('${MENU}')`);
    return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-disabled') === 'true'])`);
  }

  const highlighted = (page) => page.evaluate(`(() => { const i = document.querySelector('${MENU} .item.hi'); return i ? (i.querySelector('.label')?.textContent ?? i.textContent) : null; })()`);

  for (const platform of PLATFORMS) {
    test(`in a talk without the files, Beeson Logo and Broucke Families are tiles at their places, dimmed with the reason, and a click on them adds nothing (${platform})`, async (t) => {
      const page = await load(t, platform, TALK, 1);
      const list = await openList(page);
      assert.deepEqual(list.map((e) => e.key), KEYS);
      assert.deepEqual(list.map((e) => e.name), LIST);
      assert.deepEqual(list.map((e) => e.disabled), [true, false, false, false, false, false, false, true]);
      assert.equal(list[0].title, LOGO_TITLE);
      assert.equal(list[7].title, BROUCKE_TITLE);
      assert.match(list[0].text, /File not found/);
      assert.match(list[7].text, /File not found/);
      assert.ok(list.slice(1, 7).every((e) => e.title === e.name && !/File not found/.test(e.text)));
      assert.equal(await page.evaluate(`(() => { const b = document.querySelector('${TILES}[data-tile="broucke"]'); b.focus(); return document.activeElement === b; })()`), false);
      for (const key of ['broucke', 'logo']) {
        await click(page, `${TILES}[data-tile="${key}"]`);
        await frames(page);
        assert.equal(await render(page), page.source, key);
      }
      await press(page, 'Escape');
      await openList(page);
      await press(page, 'Escape');
      assert.equal(failures(page, 'demo/broucke-sample.js'), 1, page.errors.join('\n'));
      assert.equal(failures(page, 'brand/transfer.js'), 1, page.errors.join('\n'));
    });

    test(`in a talk without the files, the Drawing popup lists Beeson Logo and Broucke Families disabled, and neither is chosen by the pointer, a key, or the command (${platform})`, async (t) => {
      const page = await load(t, platform, TALK, 0);
      await selectBackdrop(page);
      const items = await popupItems(page, 'Backdrop');
      assert.deepEqual(items, LIST.map((name, i) => [name, i === 0 || i === 7]));
      await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => i.textContent.includes('Broucke')).setAttribute('data-pick', '')`);
      await click(page, `${MENU} .item[data-pick]`);
      await frames(page);
      assert.equal(await render(page), page.source);
      if (await page.evaluate(`!!document.querySelector('${MENU}')`)) await press(page, 'Escape');
      await frames(page);
      await page.evaluate(`document.querySelector('${PANEL} [aria-label="Backdrop"]').focus()`);
      await press(page, 'Space');
      await page.waitFor(`!!document.querySelector('${MENU}')`);
      await press(page, 'Home');
      assert.equal(await highlighted(page), 'Cislunar Manifolds');
      await press(page, 'End');
      assert.equal(await highlighted(page), 'Normal Form');
      const seen = [];
      for (let i = 0; i < 8; i++) {
        await press(page, 'ArrowDown');
        seen.push(await highlighted(page));
      }
      assert.ok(seen.every((n) => n !== 'Beeson Logo' && n !== 'Broucke Families'), seen.join(', '));
      await press(page, 'Home');
      await press(page, 'b');
      assert.equal(await highlighted(page), 'Cislunar Manifolds');
      await press(page, 'Enter');
      await frames(page);
      assert.equal(await render(page), page.source);
      for (const value of ['broucke', 'logo']) {
        await exec(page, 'backdrop.builtIn', { value });
        await frames(page);
        assert.equal(await render(page), page.source, value);
      }
      await openList(page);
      await press(page, 'Escape');
      assert.equal(failures(page, 'demo/broucke-sample.js'), 1, page.errors.join('\n'));
    });

    test(`a talk with a Broucke drawing of its own file offers Broucke Families from this file, with the popups of the drawing of the deck as they were (${platform})`, async (t) => {
      const page = await load(t, platform, OWN, 1);
      const list = await openList(page);
      assert.deepEqual(list.map((e) => e.name), LIST);
      assert.deepEqual(list.map((e) => e.disabled), [true, false, false, false, false, false, false, false]);
      assert.equal(list[0].title, LOGO_TITLE);
      assert.equal(list[7].title, 'Broucke Families');
      await click(page, `${TILES}[data-tile="broucke"]`);
      await page.waitFor(`window.BeesonEditor.render() !== ${js(page.source)}`);
      await frames(page);
      const text = await render(page);
      assert.match(text, /<div class="backdrop" data-trajectories="\.\.\/\.\.\/demo\/broucke-sample\.js" data-trajectories-select="family=7,branch=periapsis,frame=pulsating"[^>]*><\/div>\s*<h2>A content slide without a backdrop/);
      assert.equal((await state(page, 'edit.undo')).label, 'Undo Add Backdrop');
      await undo(page);
      assert.equal(await render(page), page.source);
      await redo(page);
      assert.equal(await render(page), text);
      assert.equal((await saveAndReopen(page)).text, text);
      assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`)).problems, []);
      await page.evaluate('Reveal.slide(0)');
      await frames(page);
      await selectBackdrop(page);
      assert.deepEqual(await popupItems(page, 'Backdrop'), LIST.map((name, i) => [name, i === 0]));
      await press(page, 'Escape');
      await page.evaluate('Reveal.slide(2)');
      await frames(page);
      await selectBackdrop(page);
      assert.deepEqual((await popupItems(page, 'Family')).map((i) => i[0]), ['7', '11', '7/11']);
      await press(page, 'Escape');
      assert.equal(await render(page), page.source);
    });

    test(`the demo deck offers every entry, none dimmed, in the gallery and in the Drawing popup (${platform})`, async (t) => {
      const page = await load(t, platform, DEMO, 2);
      const list = await openList(page);
      assert.deepEqual(list.map((e) => e.key), KEYS);
      assert.deepEqual(list.map((e) => e.name), LIST);
      assert.ok(list.every((e) => !e.disabled && e.title === e.name && !/File not found/.test(e.text)));
      await press(page, 'Escape');
      await selectBackdrop(page);
      assert.deepEqual(await popupItems(page, 'Backdrop'), LIST.map((name) => [name, false]));
      await press(page, 'Escape');
      assert.equal(await render(page), page.source);
    });
  }
});

describe('Poincaré Sections and Invariant Tori', () => {
  const DEMO = 'test-deck.html';
  const PLATFORMS = ['mac', 'other'];
  const PANEL = '#beeson-edit-panel-format';
  const MENU = '.beeson-edit-menu.select';
  const TILES = '.beeson-backdrop-gallery [data-tile]';
  const CHAPTER = '<h2>Chapter two</h2>';
  const ALPHAS = ['0.02', '0.04', '0.06', '0.08', '0.10', '0.12', '0.14', '0.16', '0.18', '0.20'];

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
  const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
  const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  const undoLabel = (page) => state(page, 'edit.undo').then((s) => s.label);
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
  const esc = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[^>]*>)`))[1];
  const backdropOf = (text, heading) => text.match(new RegExp(`${esc(heading)}[\\s\\S]*?(<div class="backdrop"[\\s\\S]*?</div>)`))[1];

  async function load(t, platform) {
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    const url = `${server.origin}/${DEMO}?edit&still&edit-platform=${platform}`;
    await page.goto(url);
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    page.source = readFileSync(DEMO, 'utf8');
    const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
    assert.deepEqual(s.problems, []);
    const n = await page.evaluate(`[...document.querySelectorAll('.reveal .slides > section')].findIndex((slide) => slide.querySelector('.backdrop[data-backdrop="wideRibbon"]'))`);
    assert.ok(n > 0, 'the slide of the Earth Manifolds is not found');
    await page.evaluate(`Reveal.slide(${n})`);
    await frames(page);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await frames(page);
    return page;
  }

  const popupText = (page, label) => page.evaluate(`(() => {
  const b = document.querySelector('${PANEL} [aria-label="${label}"]');
  return b && b.getClientRects().length ? b.textContent : null;
})()`);

  async function popupItems(page, label) {
    await click(page, `${PANEL} [aria-label="${label}"]`);
    await page.waitFor(`!!document.querySelector('${MENU}')`);
    return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-checked') === 'true'])`);
  }

  async function choose(page, label, name) {
    const text = await render(page);
    await popupItems(page, label);
    await page.evaluate(`[...document.querySelectorAll('${MENU} .item')].find((i) => (i.querySelector('.label')?.textContent ?? i.textContent) === ${js(name)}).setAttribute('data-pick', '')`);
    await click(page, `${MENU} .item[data-pick]`);
    await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await frames(page);
    return render(page);
  }

  const ticks = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} label.ed-check')].filter((l) => l.getClientRects().length && /^backdrop\\.tor/.test(l.querySelector('input').dataset.command)).map((l) => [l.textContent, l.querySelector('input').checked])`);

  async function tick(page, name) {
    const text = await render(page);
    await page.evaluate(`(() => {
      for (const l of document.querySelectorAll('${PANEL} label.ed-check')) l.toggleAttribute('data-pick', l.textContent === ${js(name)});
    })()`);
    await click(page, `${PANEL} label.ed-check[data-pick]`);
    await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await frames(page);
    return render(page);
  }

  const drawn = (page) => page.evaluate(`(async () => {
    const el = window.BeesonEditor.selection()[0];
    const all = Beeson.backdrops.filter((b) => b.el === el);
    await all[0]?.ready;
    const c = all[0]?.canvases[0];
    const d = c ? c.getContext('2d').getImageData(0, 0, c.width, c.height).data : [];
    let inked = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) inked++;
    return { count: all.length, canvases: [...el.querySelectorAll(':scope > canvas')].map((x) => x.className), labels: el.querySelectorAll('.label').length, inked, fitted: all[0]?.fittedToDrawing };
  })()`);

  const sections = (page) => page.evaluate(`[...document.querySelectorAll('${PANEL} .ed-sec')].filter((s) => s.getClientRects().length).map((s) => s.querySelector(':scope > h5')?.textContent ?? '').filter(Boolean)`);

  for (const platform of PLATFORMS) {
    test(`the Saddle Manifolds put on the Earth Manifolds takes off the window and the labels, and its pane offers Add Label without the labels of named points (${platform})`, async (t) => {
      const page = await load(t, platform);
      const named = () => page.evaluate(`[...document.querySelectorAll('${PANEL} label.ed-check')].filter((l) => l.getClientRects().length && l.querySelector('input').dataset.command === 'backdrop.label').length`);
      assert.equal(await named(), 4);
      const saddle = await choose(page, 'Backdrop', 'Saddle Manifolds');
      assert.equal(tagOf(saddle, CHAPTER), '<div class="backdrop" data-backdrop="saddle">');
      assert.ok(!/class="label"/.test(backdropOf(saddle, CHAPTER)), backdropOf(saddle, CHAPTER));
      assert.equal(await undoLabel(page), 'Undo Change Backdrop');
      assert.equal(await popupText(page, 'Backdrop'), 'Saddle Manifolds');
      assert.deepEqual(await sections(page), ['Backdrop', 'Window', 'Labels', 'Motion']);
      assert.equal(await named(), 0);
      assert.equal(await popupText(page, 'Colormap'), null);
      const out = await drawn(page);
      assert.deepEqual({ ...out, inked: out.inked > 1000 }, { count: 1, canvases: ['orbits-base', 'orbits-head'], labels: 0, inked: true, fitted: true });
      assert.equal(await page.evaluate(`document.querySelectorAll('script[src*="/backdrops/saddle.js"]').length`), 1);
      await undo(page);
      assert.equal(await render(page), page.source);
      assert.deepEqual(page.errors, []);
    });

    test(`the Normal Form put on the Earth Manifolds is drawn without a file or labels (${platform})`, async (t) => {
      const page = await load(t, platform);
      const normal = await choose(page, 'Backdrop', 'Normal Form');
      assert.equal(tagOf(normal, CHAPTER), '<div class="backdrop" data-backdrop="normalForm">');
      assert.ok(!/class="label"/.test(backdropOf(normal, CHAPTER)), backdropOf(normal, CHAPTER));
      assert.equal(await popupText(page, 'Backdrop'), 'Normal Form');
      assert.deepEqual(await sections(page), ['Backdrop', 'Window', 'Motion']);
      const out = await drawn(page);
      assert.deepEqual({ ...out, inked: out.inked > 1000 }, { count: 1, canvases: ['dots'], labels: 0, inked: true, fitted: true });
      assert.equal(await page.evaluate(`document.querySelectorAll('script[src*="/backdrops/"]').length`), 0);
      assert.deepEqual(page.errors, []);
    });

    test(`Poincaré Sections put on the Earth Manifolds takes off the window and the labels, and the System popup writes data-system (${platform})`, async (t) => {
      const page = await load(t, platform);
      assert.deepEqual(await sections(page), ['Backdrop', 'Window', 'Labels', 'Motion']);
      const items = await popupItems(page, 'Backdrop');
      await press(page, 'Escape');
      assert.deepEqual(items.map((i) => i[0]).slice(0, 8), ['Beeson Logo', 'Cislunar Manifolds', 'Earth Manifolds', 'Poincaré Sections', 'Invariant Tori', 'Saddle Manifolds', 'Normal Form', 'Broucke Families']);
      const section = await choose(page, 'Backdrop', 'Poincaré Sections');
      assert.equal(tagOf(section, CHAPTER), '<div class="backdrop" data-backdrop="poincare">');
      assert.ok(!/class="label"/.test(backdropOf(section, CHAPTER)), backdropOf(section, CHAPTER));
      assert.equal(await undoLabel(page), 'Undo Change Backdrop');
      assert.deepEqual(await sections(page), ['Backdrop', 'Window', 'Motion']);
      const first = await drawn(page);
      assert.deepEqual({ ...first, inked: first.inked > 1000 }, { count: 1, canvases: ['dots'], labels: 0, inked: true, fitted: true });
      assert.equal(await popupText(page, 'System'), 'Earth–Moon L2');
      assert.equal(await popupText(page, 'Plane'), null);
      assert.deepEqual(await ticks(page), []);
      assert.deepEqual(await popupItems(page, 'System'), [['Earth–Moon L2', true], ['Sun–Earth L1', false], ['Bicircular L1 (Horizontal)', false], ['Bicircular L1 (Vertical)', false]]);
      await press(page, 'Escape');
      const sun = await choose(page, 'System', 'Sun–Earth L1');
      assert.equal(tagOf(sun, CHAPTER), '<div class="backdrop" data-backdrop="poincare" data-system="sun-earth-l1">');
      assert.equal(await undoLabel(page), 'Undo System');
      assert.equal(await popupText(page, 'System'), 'Sun–Earth L1');
      const second = await drawn(page);
      assert.ok(second.count === 1 && second.inked > 1000 && second.inked !== first.inked, js(second));
      assert.equal(await page.evaluate(`document.querySelectorAll('script[src*="/backdrops/poincare-"]').length`), 2);
      assert.equal(await choose(page, 'System', 'Earth–Moon L2'), section);
      await undo(page);
      await undo(page);
      await undo(page);
      assert.equal(await render(page), page.source);
      assert.deepEqual(await sections(page), ['Backdrop', 'Window', 'Labels', 'Motion']);
      assert.deepEqual((await drawn(page)).canvases, ['orbits-base', 'orbits-head']);
      assert.deepEqual(page.errors, []);
    });

    test(`the ticks of the Invariant Tori write data-tori, All Tori ticks every torus or none, and the Plane popup writes data-plane (${platform})`, async (t) => {
      const page = await load(t, platform);
      const all = await choose(page, 'Backdrop', 'Invariant Tori');
      assert.equal(tagOf(all, CHAPTER), '<div class="backdrop" data-backdrop="tori">');
      assert.deepEqual(await sections(page), ['Backdrop', 'Window', 'Motion']);
      assert.equal(await popupText(page, 'System'), null);
      assert.equal(await popupText(page, 'Plane'), 'x, y');
      assert.deepEqual(await ticks(page), [['All Tori', true], ...ALPHAS.map((a) => [`α = ${a}`, true])]);
      const ten = await drawn(page);
      const nine = await tick(page, 'α = 0.04');
      assert.equal(tagOf(nine, CHAPTER), `<div class="backdrop" data-backdrop="tori" data-tori="${ALPHAS.filter((a) => a !== '0.04').join(' ')}">`);
      assert.equal(await undoLabel(page), 'Undo Torus');
      assert.deepEqual(await ticks(page), [['All Tori', false], ...ALPHAS.map((a) => [`α = ${a}`, a !== '0.04'])]);
      assert.equal(await tick(page, 'All Tori'), all);
      assert.equal(await undoLabel(page), 'Undo All Tori');
      const none = await tick(page, 'All Tori');
      assert.equal(tagOf(none, CHAPTER), '<div class="backdrop" data-backdrop="tori" data-tori="none">');
      assert.deepEqual(await ticks(page), [['All Tori', false], ...ALPHAS.map((a) => [`α = ${a}`, false])]);
      const empty = await drawn(page);
      const one = await tick(page, 'α = 0.18');
      assert.equal(tagOf(one, CHAPTER), '<div class="backdrop" data-backdrop="tori" data-tori="0.18">');
      const lone = await drawn(page);
      assert.ok(ten.inked > 3 * empty.inked && lone.inked > 3 * empty.inked && lone.inked !== ten.inked, `${ten.inked} pixels of ten tori, ${lone.inked} of one, ${empty.inked} of none`);
      assert.deepEqual(await popupItems(page, 'Plane'), [['x, y', true], ['x, z', false]]);
      await press(page, 'Escape');
      const plane = await choose(page, 'Plane', 'x, z');
      assert.equal(tagOf(plane, CHAPTER), '<div class="backdrop" data-backdrop="tori" data-tori="0.18" data-plane="xz">');
      assert.equal(await undoLabel(page), 'Undo Plane');
      assert.equal(await choose(page, 'Plane', 'x, y'), one);
      const tubes = await choose(page, 'Backdrop', 'Cislunar Manifolds');
      assert.ok(/^<div class="backdrop" data-backdrop="tubes" data-cx="[^"]+" data-cy="[^"]+" data-half="[^"]+">$/.test(tagOf(tubes, CHAPTER)), tagOf(tubes, CHAPTER));
      assert.deepEqual(await ticks(page), []);
      assert.deepEqual(page.errors, []);
    });

    test(`the tiles Poincaré Sections, Invariant Tori, Saddle Manifolds, and Normal Form are drawn in the gallery, and a tile adds its backdrop fitted to its box (${platform})`, async (t) => {
      const page = await load(t, platform);
      await press(page, 'Delete');
      const bare = await render(page);
      await exec(page, 'insert.backdrop');
      await page.waitFor(`document.querySelectorAll('${TILES}').length >= 7`);
      const inked = `(async (key) => {
        const c = document.querySelector('${TILES}[data-tile="' + key + '"] canvas');
        for (let n = 0; n < 200; n++) {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let count = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i]) count++;
          if (count > 50) return count;
          await new Promise((done) => setTimeout(done, 50));
        }
        return 0;
      })`;
      assert.ok((await page.evaluate(`${inked}('poincare')`)) > 50, 'the tile Poincaré Sections is empty');
      assert.ok((await page.evaluate(`${inked}('tori')`)) > 50, 'the tile Invariant Tori is empty');
      assert.ok((await page.evaluate(`${inked}('saddle')`)) > 50, 'the tile Saddle Manifolds is empty');
      assert.ok((await page.evaluate(`${inked}('normalForm')`)) > 50, 'the tile Normal Form is empty');
      const stable = await page.evaluate(`(() => {
        const c = document.querySelector('${TILES}[data-tile="normalForm"] canvas'), g = c.getContext('2d');
        g.fillStyle = getComputedStyle(c).getPropertyValue('--violet').trim();
        const v = String(g.fillStyle).match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16));
        const d = g.getImageData(0, 0, c.width, c.height).data, out = { rising: 0, falling: 0 };
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 250 || Math.abs(d[i] - v[0]) + Math.abs(d[i + 1] - v[1]) + Math.abs(d[i + 2] - v[2]) > 24) continue;
          const x = (i / 4) % c.width - c.width / 2, y = Math.floor(i / 4 / c.width) - c.height / 2;
          if (x * y < 0) out.rising++;
          else out.falling++;
        }
        return out;
      })()`);
      assert.ok(stable.falling > 100 && stable.falling > 20 * stable.rising, `the stable manifold of the tile Normal Form is not drawn from the upper left to the lower right, ${js(stable)}`);
      await click(page, `${TILES}[data-tile="tori"]`);
      await page.waitFor(`window.BeesonEditor.render() !== ${js(bare)}`);
      await frames(page);
      assert.ok((await render(page)).includes('<div class="backdrop" data-backdrop="tori"></div>'), 'the backdrop of the tile is not written');
      assert.equal(await undoLabel(page), 'Undo Add Backdrop');
      const added = await drawn(page);
      assert.ok(added.count === 1 && added.fitted && added.inked > 1000, js(added));
      assert.deepEqual(page.errors, []);
    });
  }
});

describe('the step at which a backdrop starts', () => {
  const DECK = 'test/pages/backdrop-play.html';
  const PANEL = '#beeson-edit-panel-format';
  const MENU = '.beeson-edit-menu.select';
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
  const exec = (page, id, arg) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${arg ? `, ${js(arg)}` : ''})).then(() => true)`);
  const render = (page) => page.evaluate('window.BeesonEditor.render()');
  const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
  const undoLabel = (page) => page.evaluate(`window.BeesonEditor.state('edit.undo')`).then((s) => s.label);
  const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
  const items = async (page) => {
    await click(page, `${PANEL} [aria-label="Start"]`);
    await page.waitFor(`!!document.querySelector('${MENU}')`);
    return page.evaluate(`[...document.querySelectorAll('${MENU} .item')].map((i) => [i.querySelector('.label')?.textContent ?? i.textContent, i.getAttribute('aria-checked') === 'true'])`);
  };
  async function choose(page, n) {
    const text = await render(page);
    await items(page);
    await page.evaluate(`document.querySelectorAll('${MENU} .item')[${n}].setAttribute('data-pick', '')`);
    await click(page, `${MENU} .item[data-pick]`);
    await page.waitFor(`window.BeesonEditor.render() !== ${js(text)}`);
    await frames(page);
    return render(page);
  }

  test('the Start menu of the Backdrop pane shows the step of a long text as Step 2, on one line', async (t) => {
    const long = 'Why is it useful? It enables you to describe the dynamics around an invariant object analytically, with a normal form of the vector field';
    const source = readFileSync(DECK, 'utf8').replace('data-backdrop-play>Second<', `data-backdrop-play>${long}<`);
    const file = 'test/pages/.backdrop-play-long.html';
    writeFileSync(file, source);
    t.after(() => rmSync(file, { force: true }));
    const page = await browser.newPage({ width: 1600, height: 1000 });
    t.after(() => page.close().catch(() => {}));
    const url = `${server.origin}/${file}?edit&still`;
    await page.goto(url);
    await page.evaluate('localStorage.clear()');
    await page.goto(url);
    await page.waitFor(deckSettled);
    await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
    assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(source)})`)).problems, []);
    await page.evaluate('Reveal.slide(1)');
    await frames(page);
    if (!(await page.evaluate(`window.BeesonEditor.state('shell.format')`)).checked) await exec(page, 'shell.format');
    await exec(page, 'backdrop.select');
    await page.waitFor(`!!document.querySelector('${PANEL} [aria-label="Start"]')`);
    await frames(page);
    const start = await page.evaluate(`(() => {
      const b = document.querySelector('${PANEL} [aria-label="Start"]'), text = b.querySelector('span');
      const range = document.createRange();
      range.selectNodeContents(text);
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      return { text: text.textContent, lines: lines.size, inside: text.scrollWidth <= text.clientWidth && b.scrollHeight <= b.clientHeight };
    })()`);
    assert.deepEqual(start, { text: 'Step 2', lines: 1, inside: true });
    assert.deepEqual(page.errors, []);
  });

  for (const platform of ['mac', 'other']) {
    test(`the Start menu of the Backdrop pane writes data-backdrop-play on the first element of the chosen step, and With the Slide takes it off (${platform})`, async (t) => {
      const page = await browser.newPage({ width: 1600, height: 1000 });
      t.after(() => page.close().catch(() => {}));
      const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
      await page.goto(url);
      await page.evaluate('localStorage.clear()');
      await page.goto(url);
      await page.waitFor(deckSettled);
      await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
      const source = readFileSync(DECK, 'utf8');
      assert.deepEqual((await page.evaluate(`window.BeesonEditor.open(${js(source)})`)).problems, []);
      await page.evaluate('Reveal.slide(1)');
      await frames(page);
      if (!(await page.evaluate(`window.BeesonEditor.state('shell.format')`)).checked) await exec(page, 'shell.format');
      await exec(page, 'backdrop.select');
      await frames(page);
      assert.equal(await page.evaluate('Beeson.backdrops.find((b) => b.el.closest("section") === Reveal.getCurrentSlide()).done'), true, 'the backdrop is not complete in the editor');
      const listed = await items(page);
      await press(page, 'Escape');
      assert.deepEqual(listed.map(([, on]) => on), [false, false, true]);
      assert.deepEqual(listed.map(([text]) => text), ['With the Slide', 'Step 1', 'Step 2'], 'the steps are not named as in the step menu of the Steps pane');
      const first = await choose(page, 1);
      assert.match(first, /<p class="fragment" data-fragment-index="0" data-backdrop-play(="")?>First<\/p>\s*<p class="fragment" data-fragment-index="1">Second<\/p>/);
      assert.equal(await undoLabel(page), 'Undo Start');
      await undo(page);
      assert.equal(await render(page), source);
      const none = await choose(page, 0);
      assert.ok(!none.includes('data-backdrop-play'), none);
      assert.equal(none, source.replace(' data-backdrop-play>', '>'));
      await undo(page);
      assert.equal(await render(page), source);
      assert.deepEqual(page.errors, []);
    });
  }
});
