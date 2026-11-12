// regression tests of R20.5 on both platforms with trusted input: a drag of the rotate handle is
// held at a multiple of 45 degrees while its absolute angle is within 4 degrees of it, with an
// angle guide through the center of the turn, and follows the pointer to the degree beyond. the
// free modifier turns the hold off, a group is held by its first member and a multiple selection by
// its first object, and Esc puts a held drag back. the file is checked byte for byte

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { deckSettled, launch } from '../scripts/chrome.mjs';
import { serve } from '../scripts/webdriver.mjs';
import { byteExact, center, click, press } from './helpers/editor.mjs';

const PLATFORMS = ['mac', 'other'];
const DECK = 'test/pages/editor-r20-5.html';
// the bit masks of the modifiers of Input.dispatchMouseEvent: Shift, and the free modifier, ⌘ on a
// Mac and Alt elsewhere
const SHIFT = 8;
const FREE = { mac: 4, other: 1 };
const QR = 'section.present > .qr';
const P = 'section.present > p';

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
const render = (page) => page.evaluate('window.BeesonEditor.render()');
const frames = (page) => page.evaluate('new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(() => d(true))))');
const errors = (page) => page.errors.filter((e) => !e.includes('/favicon.ico'));
const exec = (page, id, args) => page.evaluate(`Promise.resolve(window.BeesonEditor.exec(${js(id)}${args ? `, ${js(args)}` : ''})).then(() => true)`);
const state = (page, id) => page.evaluate(`window.BeesonEditor.state(${js(id)})`);
const undo = (page) => page.evaluate('Promise.resolve(window.BeesonEditor.undo()).then(() => true)');
const angle = (page, selector) => page.evaluate(`document.querySelector(${js(`.reveal .slides ${selector}`)}).style.rotate`);

async function load(t, platform, slide) {
  const page = await browser.newPage({ width: 1600, height: 1000 });
  t.after(() => page.close().catch(() => {}));
  const url = `${server.origin}/${DECK}?edit&still&edit-platform=${platform}`;
  await page.goto(url);
  await page.evaluate('localStorage.clear()');
  await page.goto(url);
  await page.waitFor(deckSettled);
  await page.waitFor('window.BeesonEditor && window.BeesonEditor.ready.then(() => true)');
  page.source = readFileSync(DECK, 'utf8');
  const s = await page.evaluate(`window.BeesonEditor.open(${js(page.source)})`);
  assert.deepEqual(s.problems, []);
  await page.evaluate(`Reveal.slide(${slide})`);
  await frames(page);
  return page;
}

// the text of the readout and the angle guide shown during a drag, the guide with its center on
// the screen and its angle
const shown = (page) => page.evaluate(`(() => {
  const out = document.querySelector('.beeson-offset');
  const spoke = document.querySelector('.beeson-guide.spoke');
  const on = spoke && !spoke.hidden && spoke.getClientRects().length > 0;
  const r = on ? spoke.getBoundingClientRect() : null;
  return { readout: out && !out.hidden ? out.textContent : null, spoke: on ? { x: r.left + r.width / 2, y: r.top + r.height / 2, deg: spoke.style.rotate } : null };
})()`);

// a drag of the rotate handle that turns the pointer by deg degrees about the screen point c, with
// the modifiers of the bit mask mods. the button is held, and the function returned releases it.
// its method to turns the pointer on to deg2 degrees from the press, with the modifiers mods2
async function turnBy(page, c, deg, mods = 0) {
  const r = await center(page, '.beeson-rotor');
  const mouse = (type, x, y, extra) => page.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const radius = Math.hypot(r.x - c.x, r.y - c.y), from = Math.atan2(r.y - c.y, r.x - c.x);
  let at = r, was = 0, held = mods;
  const to = async (d, m = held) => {
    held = m;
    for (let i = 1; i <= 10; i++) {
      const a = from + ((was + (d - was) * (i / 10)) * Math.PI) / 180;
      at = { x: c.x + radius * Math.cos(a), y: c.y + radius * Math.sin(a) };
      await mouse('mouseMoved', at.x, at.y, { button: 'left', buttons: 1, modifiers: m });
    }
    was = d;
    await frames(page);
  };
  await mouse('mouseMoved', r.x, r.y, { modifiers: mods });
  await mouse('mousePressed', r.x, r.y, { button: 'left', buttons: 1, clickCount: 1, modifiers: mods });
  await to(deg);
  const release = () => mouse('mouseReleased', at.x, at.y, { button: 'left', buttons: 0, clickCount: 1, modifiers: held }).then(() => frames(page));
  release.to = to;
  return release;
}

const near = (a, b, d = 2) => Math.abs(a.x - b.x) <= d && Math.abs(a.y - b.y) <= d;

for (const platform of PLATFORMS) {
  test(`a turn by 43 degrees is held at 45 with an angle guide through the center (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    await click(page, `.reveal ${QR}`);
    await frames(page);
    assert.equal(await page.evaluate(`document.querySelector('.beeson-rotor').title`), 'Drag to rotate, held at multiples of 45°, with Shift in steps of 15°');
    const c = await center(page, `.reveal ${QR}`);
    const release = await turnBy(page, c, 43);
    const during = await shown(page);
    assert.equal(during.readout, '45°');
    assert.ok(during.spoke, 'the angle guide is not drawn');
    assert.ok(near(during.spoke, c), `the angle guide at ${js(during.spoke)} does not run through the center ${js(c)}`);
    assert.equal(during.spoke.deg, '45deg');
    await release();
    assert.equal((await shown(page)).spoke, null, 'the angle guide is kept after the release');
    await byteExact(page, [['style="width: 300px"', 'style="width: 300px; rotate: 45deg"']]);
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a turn on from 43 to 50 degrees leaves the hold and follows the pointer to the degree (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    await click(page, `.reveal ${QR}`);
    const release = await turnBy(page, await center(page, `.reveal ${QR}`), 43);
    assert.equal((await shown(page)).readout, '45°');
    await release.to(50);
    assert.deepEqual(await shown(page), { readout: '50°', spoke: null });
    await release();
    await byteExact(page, [['style="width: 300px"', 'style="width: 300px; rotate: 50deg"']]);
    assert.deepEqual(errors(page), []);
  });

  test(`the free modifier turns the hold off, and Shift keeps its steps of 15 degrees (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    await click(page, `.reveal ${QR}`);
    const c = await center(page, `.reveal ${QR}`);
    let release = await turnBy(page, c, 42);
    assert.equal((await shown(page)).readout, '45°');
    await release.to(43, FREE[platform]);
    assert.deepEqual(await shown(page), { readout: '43°', spoke: null });
    await release();
    await byteExact(page, [['style="width: 300px"', 'style="width: 300px; rotate: 43deg"']]);
    await undo(page);
    release = await turnBy(page, c, 37, SHIFT);
    assert.deepEqual(await shown(page), { readout: '30°', spoke: null });
    await release();
    await byteExact(page, [['style="width: 300px"', 'style="width: 300px; rotate: 30deg"']]);
    assert.deepEqual(errors(page), []);
  });

  test(`the hold acts on the absolute angle, and a turn back to 0 gives back the file (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    await click(page, `.reveal ${QR}`);
    if (!(await state(page, 'shell.format')).checked) await exec(page, 'shell.format');
    await exec(page, 'arrange.setRotation', { deg: 20 });
    await frames(page);
    const c = await center(page, `.reveal ${QR}`);
    // a turn by 23 from 20 degrees reaches 43 and is held at 45. a hold of the delta would write 43
    let release = await turnBy(page, c, 23);
    assert.equal((await shown(page)).readout, '45°');
    await release();
    await byteExact(page, [['style="width: 300px"', 'style="width: 300px; rotate: 45deg"']]);
    // a turn by -42 from 45 degrees reaches 3 and is held at 0, which takes the declaration off
    release = await turnBy(page, c, -42);
    assert.equal((await shown(page)).readout, '0°');
    await release();
    await byteExact(page);
    assert.equal(await angle(page, QR), '');
    assert.deepEqual(errors(page), []);
  });

  test(`a group is held by the angle of its first member, and its other member keeps its angle to it (${platform})`, async (t) => {
    const page = await load(t, platform, 1);
    await click(page, `.reveal ${P}`);
    await frames(page);
    assert.equal(await page.evaluate('window.BeesonEditor.selection().length'), 2, 'the group is not selected');
    const c = await center(page, '.beeson-frame.union');
    const release = await turnBy(page, c, 88);
    const during = await shown(page);
    assert.equal(during.readout, '90°');
    assert.ok(during.spoke && near(during.spoke, c), `the angle guide at ${js(during.spoke)} does not run through the center of the group ${js(c)}`);
    await release();
    assert.deepEqual([await angle(page, P), await angle(page, QR)], ['90deg', '100deg']);
    const edited = await render(page);
    assert.match(edited, /<p data-group="g1" style="rotate: 90deg; translate: -?\d+px -?\d+px">Export/);
    assert.match(edited, /<div class="qr" data-qr="two" style="width: 240px; rotate: 100deg; translate: -?\d+px -?\d+px" data-group="g1"><\/div>/);
    await undo(page);
    await byteExact(page);
    assert.deepEqual(errors(page), []);
  });

  test(`a multiple selection is held by its first object, and the other object turns by the same delta (${platform})`, async (t) => {
    const page = await load(t, platform, 2);
    await click(page, `.reveal ${P}`);
    await press(page, 'Escape');
    await click(page, `.reveal ${QR}`, { modifiers: 'Shift' });
    await frames(page);
    assert.deepEqual(await page.evaluate('window.BeesonEditor.selection().map((el) => el.localName)'), ['p', 'div']);
    const p0 = await center(page, `.reveal ${P}`), q0 = await center(page, `.reveal ${QR}`);
    const release = await turnBy(page, p0, 43);
    const during = await shown(page);
    assert.equal(during.readout, '45°');
    assert.ok(during.spoke && near(during.spoke, p0), `the angle guide at ${js(during.spoke)} does not run through the center of the paragraph ${js(p0)}`);
    await release();
    assert.deepEqual([await angle(page, P), await angle(page, QR)], ['45deg', '65deg']);
    assert.ok(near(await center(page, `.reveal ${P}`), p0) && near(await center(page, `.reveal ${QR}`), q0), 'an object is not turned about its own center');
    assert.match(await render(page), /<p style="rotate: 45deg">Export[\s\S]*<div class="qr" data-qr="three" style="width: 240px; rotate: 65deg"><\/div>/);
    assert.deepEqual(errors(page), []);
  });

  test(`Esc during a drag held at 45 degrees puts the page and the file back (${platform})`, async (t) => {
    const page = await load(t, platform, 0);
    await click(page, `.reveal ${QR}`);
    const release = await turnBy(page, await center(page, `.reveal ${QR}`), 43);
    assert.equal((await shown(page)).readout, '45°');
    assert.equal(await angle(page, QR), '45deg');
    await press(page, 'Escape');
    await release();
    assert.deepEqual(await shown(page), { readout: null, spoke: null });
    assert.equal(await angle(page, QR), '');
    assert.equal(await render(page), page.source);
    assert.equal((await state(page, 'edit.undo')).enabled, false, 'the cancelled drag is in the history');
    assert.deepEqual(errors(page), []);
  });
}
