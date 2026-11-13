// the work of R13.7 on both platforms and in both appearances: the contrast of the muted labels of
// the chrome and of the placeholders of its fields, the focus ring of the presenter display, and
// the toolbar while Customize Toolbar is open in a window that is made narrow

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { contrast, GROUND, INK, press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const SCHEMES = ['light', 'dark'];

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
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const exec = (page, id) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)})).then(() => true)`);
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const errors = (page) => page.errors.filter((e) => !e.includes('favicon.ico'));

// the editor on index.html in the appearance scheme, with the local storage cleared
async function load(t, platform, scheme, { width = 1600, height = 1000 } = {}) {
  const page = await browser.newPage({ width, height });
  t.after(() => page.close().catch(() => {}));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await page.send('Storage.clearDataForOrigin', { origin: server.origin, storageTypes: 'local_storage' });
  await page.goto(`${server.origin}/test-deck.html?edit&still&theme=${scheme}&edit-platform=${platform}`);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync('test-deck.html', 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await frames(page);
  return page;
}

const below = (rows, min) => rows.filter((r) => contrast(r.fg, r.bg) < min).map((r) => `${r.what}: ${r.fg} on ${r.bg} is ${contrast(r.fg, r.bg).toFixed(2)}:1`);

// every visible text of the chrome drawn in --ed-muted, with its ground and the opacity of its
// ancestors. a disabled control is left out, since WCAG does not ask a contrast of it
const MUTED = `(() => {
  const probe = document.createElement('i');
  probe.style.color = 'var(--ed-muted)';
  document.querySelector('.beeson-edit-header').append(probe);
  const muted = getComputedStyle(probe).color;
  probe.remove();
  const ground = ${GROUND};
  const out = [];
  for (const el of document.querySelectorAll('.beeson-edit-header *, .beeson-edit-nav *, .beeson-edit-inspector *, .beeson-edit-bottom *, .beeson-edit-notes-zoom *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!el.getClientRects().length || el.closest(':disabled, [aria-disabled="true"], [hidden]')) continue;
    const cs = getComputedStyle(el);
    if (cs.color !== muted || cs.visibility !== 'visible') continue;
    out.push({ what: el.textContent.trim().slice(0, 30), fg: ${INK}(el), bg: ground(el) });
  }
  return out;
})()`;

// tour-dark-narrow-other n 2: the number of the selected row of the navigator, the label Slide
// Layout of the Format pane, and the save state of the title bar were drawn under 4.5:1
for (const platform of PLATFORMS) {
  for (const scheme of SCHEMES) {
    test(`every muted label of the chrome has a contrast of 4.5:1 on its ground (${platform}, ${scheme})`, async (t) => {
      const page = await load(t, platform, scheme);
      if (!(await page.evaluate(`document.documentElement.classList.contains('beeson-format')`))) await exec(page, 'shell.format');
      await exec(page, 'view.notes');
      await frames(page);
      const rows = await page.evaluate(MUTED);
      const texts = rows.map((r) => r.what);
      for (const want of ['1', 'Slide Layout', '100%']) assert.ok(texts.includes(want), `${want} is not among ${js(texts)}`);
      assert.ok(texts.some((x) => /unsaved|saved/i.test(x)), `the save state is not among ${js(texts)}`);
      assert.deepEqual(below(rows, 4.5), []);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the placeholder of every visible empty field of the editor, with the ground of its field
const PLACEHOLDERS = `(() => {
  const ground = ${GROUND};
  return [...document.querySelectorAll('input[placeholder], textarea[placeholder]')]
    .filter((f) => f.placeholder && !f.value && f.getClientRects().length && !f.closest('.reveal .slides'))
    .map((f) => ({ what: f.placeholder, fg: getComputedStyle(f, '::placeholder').color, bg: ground(f) }));
})()`;

// tour-dark-narrow-other n 1: in the dark appearance, the placeholder Find measured 1.76:1 and the
// placeholder Search of the Object List 2.46:1
for (const platform of PLATFORMS) {
  for (const scheme of SCHEMES) {
    test(`the placeholders of Find and of the Object List have a contrast of 4.5:1 (${platform}, ${scheme})`, async (t) => {
      const page = await load(t, platform, scheme);
      const seen = [];
      await exec(page, 'find.open');
      await frames(page);
      seen.push(...(await page.evaluate(PLACEHOLDERS)));
      await exec(page, 'find.close');
      await exec(page, 'view.objects');
      await frames(page);
      seen.push(...(await page.evaluate(PLACEHOLDERS)));
      const names = seen.map((r) => r.what);
      assert.ok(names.includes('Find') && names.includes('Search'), js(names));
      assert.deepEqual(below(seen, 4.5), []);
      assert.equal(await render(page), page.source);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the prompts of empty notes, i.e. Click to add notes in the notes pane and the line of the notes of
// the presenter display, are the placeholders of the notes, and were drawn in --ed-faint
for (const platform of PLATFORMS) {
  for (const scheme of SCHEMES) {
    test(`the prompts of empty notes have a contrast of 4.5:1 (${platform}, ${scheme})`, async (t) => {
      const page = await load(t, platform, scheme);
      const n = await page.evaluate(`Reveal.getSlides().findIndex((s) => !s.querySelector(':scope > aside.notes'))`);
      assert.ok(n >= 0);
      await page.evaluate(`Reveal.slide(${n})`);
      await exec(page, 'view.notes');
      await frames(page);
      const seen = [await page.evaluate(`(() => {
        const a = document.querySelector('.reveal .slides section.present > aside.notes');
        return { what: getComputedStyle(a, '::before').content, fg: getComputedStyle(a, '::before').color, bg: ${GROUND}(a) };
      })()`)];
      await page.evaluate(`(() => { window.open = () => null; return true; })()`);
      await exec(page, 'play.customizePresenter');
      await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open] .notes .text.empty')`);
      seen.push(await page.evaluate(`(() => {
        const e = document.querySelector('dialog.beeson-edit-presenter .notes .text.empty');
        return { what: e.textContent, fg: getComputedStyle(e).color, bg: ${GROUND}(e) };
      })()`));
      assert.match(seen[0].what, /Click to add notes/);
      assert.deepEqual(below(seen, 4.5), []);
      assert.deepEqual(errors(page), []);
    });
  }
}

// the ring of the focused element of the presenter display and the ground of its control
const RING = `(() => {
  const a = document.activeElement;
  if (!a || !a.closest('dialog.beeson-edit-presenter') || !a.matches(':focus-visible')) return null;
  const cs = getComputedStyle(a);
  return { what: (a.getAttribute('aria-label') || a.title || a.textContent).trim().slice(0, 30), fg: cs.outlineColor, width: parseFloat(cs.outlineWidth), bg: ${GROUND}(a.parentElement) };
})()`;

// r12-1-contrast-focus n 1: the ring of the presenter display and of its Display Options was a
// translucent violet, at about 2.5:1 on its black bars
for (const platform of PLATFORMS) {
  for (const scheme of SCHEMES) {
    test(`the focus ring of the presenter display has a contrast of 3:1 on each of its grounds (${platform}, ${scheme})`, async (t) => {
      const page = await load(t, platform, scheme);
      await page.evaluate(`(() => { window.open = () => null; return true; })()`);
      await exec(page, 'play.customizePresenter');
      await page.waitFor(`!!document.querySelector('dialog.beeson-edit-presenter[open] .parts:not([hidden])')`);
      const seen = [];
      for (let i = 0; i < 16; i++) {
        await press(page, 'Tab');
        const at = await page.evaluate(RING);
        if (at && at.width > 0) seen.push(at);
      }
      assert.ok(seen.length >= 6, js(seen));
      assert.deepEqual(below(seen, 3), []);
      assert.deepEqual(errors(page), []);
    });
  }
}

async function resize(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(150);
  await frames(page);
}

const OUTSIDE = `[...document.querySelectorAll('.beeson-edit-top [data-at]')].filter((el) => { const r = el.getBoundingClientRect(); return r.left < -0.5 || r.right > innerWidth + 0.5 || !r.width; }).map((el) => el.dataset.command ?? el.className)`;

// r12-2-shell-inspector n 1: a window made narrow while Customize Toolbar was open kept the labels
// of the toolbar, and Present, Save, Format, and Steps lay past its right edge
for (const platform of PLATFORMS) {
  test(`while Customize Toolbar is open, every toolbar item stays inside a window made narrow (${platform})`, async (t) => {
    const page = await load(t, platform, 'light', { width: 1600, height: 800 });
    await exec(page, 'view.customizeToolbar');
    await page.waitFor(`!document.querySelector('.beeson-edit-customize').hidden`);
    await frames(page);
    for (const width of [900, 760]) {
      await resize(page, width, 700);
      assert.deepEqual(await page.evaluate(OUTSIDE), [], `toolbar items lie past the window at ${width} px`);
    }
    await resize(page, 1600, 800);
    assert.ok(!(await page.evaluate(`document.querySelector('.beeson-edit-top').classList.contains('compact')`)), 'the labels are not drawn again at 1600 px');
    assert.deepEqual(await page.evaluate(OUTSIDE), []);
    await exec(page, 'view.customizeToolbar');
    assert.equal(await render(page), page.source);
    assert.deepEqual(errors(page), []);
  });
}
