import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { parseBundle } from '../src/bundle.ts';
import { drag, editorPage } from './helpers/editor.mjs';

const DECK = 'test/pages/bundle.html';
const STATES = ['', 'a', 'a b'];
const bundle = `Beeson.surfaces.find((s) => s.el.matches('[data-bundle]'))`;

test('a bundle that cannot be drawn is reported with the reason', () => {
  assert.match(parseBundle('{'), /malformed/);
  assert.match(parseBundle('{"orbit": [[0, 0, 0]], "strips": []}'), /fewer than three/);
  const orbit = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  assert.match(parseBundle(JSON.stringify({ orbit, strips: [{ id: 'a', half_width: 1, ribs: [0], directions: [[0, 0, 1]] }] })), /1 directions for 3 points/);
  assert.match(parseBundle(JSON.stringify({ orbit, strips: [{ id: 'a', half_width: 0, ribs: [0], directions: orbit }] })), /positive half_width/);
  assert.match(parseBundle(JSON.stringify({ orbit, strips: [{ id: 'a', half_width: 1, ribs: [3], directions: orbit }] })), /not a point of the orbit/);
  assert.match(parseBundle(JSON.stringify({ orbit, strips: [], arrows: [{ id: 'Sun', toward: [0, 0] }] })), /arrow Sun/);
  assert.equal(typeof parseBundle(JSON.stringify({ orbit, strips: [] })), 'object');
});

test('a bundle without strips, or with a strip without ribs or with a malformed point, is reported with the reason', () => {
  const orbit = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  assert.match(parseBundle(JSON.stringify({ orbit })), /strips/);
  assert.match(parseBundle(JSON.stringify({ orbit, strips: [{ id: 'a', half_width: 1, directions: orbit }] })), /ribs of the strip a/);
  assert.match(parseBundle(JSON.stringify({ orbit, strips: [{ id: 'a', half_width: 1, ribs: [0], directions: [[0, 0, 1], [0, 0], [0, 0, 1]] }] })), /direction 1 of the strip a/);
  assert.match(parseBundle(JSON.stringify({ orbit: [[0, 0, 0], [1, 0], [0, 1, 0]], strips: [] })), /point 1 of the orbit/);
  assert.match(parseBundle(JSON.stringify({ orbit, libration_point: [0, 0], strips: [] })), /libration_point/);
  assert.match(parseBundle(JSON.stringify({ orbit, strips: [], arrows: { id: 'Sun' } })), /arrows/);
});

for (const motion of ['no-preference', 'reduce']) test(`a deck with malformed bundles is started, and each bundle is reported once and left blank (${motion})`, { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion }] });
  await page.goto(deckUrl('test/pages/bundle-malformed.html'));
  await page.waitFor(deckSettled);
  const mode = await page.evaluate('document.documentElement.dataset.theme');
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', keyCode: 68, which: 68, bubbles: true }))`);
  await page.waitFor(`document.documentElement.dataset.theme !== '${mode}'`, 5000);
  assert.equal(await page.evaluate(`document.querySelectorAll('.surface[data-bundle] canvas').length`), 0);
  assert.deepEqual(page.errors.map((e) => e.replace(/, since .*/, '')), ['console.error: beeson: the bundle bare is not drawn', 'console.error: beeson: the bundle ribless is not drawn']);
  await page.evaluate(`(document.getElementById('bare').textContent = '{"orbit":[[1,0,0],[0,1,0],[-1,0,0]],"strips":[]}', Beeson.mount(document.body), true)`);
  assert.equal(await page.evaluate(`document.querySelectorAll('.surface[data-bundle="bare"] canvas').length`), 1, 'the corrected bundle bare is not drawn');
  assert.equal(page.errors.length, 2);
});

const shown = `Promise.all([...document.querySelectorAll('.surface[data-bundle]')].filter((s) => s.getClientRects().length).map(async (s) => {
  const canvas = s.querySelector('canvas'), ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let drawn = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const label = Number(s.querySelector('.label[data-at="a"]').style.opacity);
  const sun = Number(s.querySelector('.label[data-at="Sun"]').style.opacity);
  return { state: s.dataset.shown, drawn: drawn / (data.length / 4), digest: [...digest.slice(0, 8)].join('.'), label, sun };
}))`;

const compass = (az) => `(() => {
  const b = ${bundle};
  b.azimuth = ${az} * Math.PI / 180;
  b.draw();
  const { needle: [m, t], scene: [a, c] } = b.probe().arrows.find((r) => r.id === 'Sun');
  const turn = Math.atan2(t[1] - m[1], t[0] - m[0]) - Math.atan2(c[1] - a[1], c[0] - a[0]);
  const canvas = b.el.querySelector('canvas'), k = canvas.width / b.el.offsetWidth;
  const px = canvas.getContext('2d').getImageData(Math.round((k * (m[0] + t[0])) / 2) - 1, Math.round((k * (m[1] + t[1])) / 2) - 1, 3, 3).data;
  const lab = b.el.querySelector('.label[data-at="Sun"]');
  return {
    length: Math.hypot(t[0] - m[0], t[1] - m[1]),
    angle: (Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) * 180) / Math.PI,
    drawn: px.some((v, i) => i % 4 === 3 && v > 0),
    label: Math.hypot(parseFloat(lab.style.left) - m[0], parseFloat(lab.style.top) - m[1]),
  };
})()`;

const KEEP_GL = `const get = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
  const c = get.call(this, type, ...rest);
  if (c && /webgl/.test(type)) window.gl = c;
  return c;
};`;

const share = `(() => {
  const canvas = document.querySelector('.surface[data-bundle] canvas');
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
  return n / (data.length / 4);
})()`;

const webgl = `(() => {
  ${bundle}.draw();
  const gl = window.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4 * w * h);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++;
  return n / (w * h);
})()`;

const live = (page) => page.evaluate(`new Promise((done) => {
  if (!window.gl || !window.gl.isContextLost()) return done();
  window.gl.canvas.addEventListener('webglcontextrestored', () => requestAnimationFrame(() => done()), { once: true });
})`);

test('a bundle is drawn at each of its states, live and in the print view, with its compass toward its arrow', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: KEEP_GL });
  await page.goto(deckUrl(DECK, 'still'));
  await page.waitFor(deckSettled);
  const states = [];
  for (let f = -1; f <= 1; f++) {
    await page.evaluate(`Reveal.slide(0, 0, ${f})`);
    await live(page);
    const [s] = await page.evaluate(shown);
    states.push({ ...s, webgl: await page.evaluate(webgl) });
  }
  assert.deepEqual(page.errors, []);
  assert.deepEqual(states.map((s) => s.state), STATES);
  const at = (state) => states.find((s) => s.state === state);
  assert.ok(at('').webgl > 0.002, `${(100 * at('').webgl).toFixed(2)}% of the image of WebGL is drawn without a strip`);
  assert.ok(at('a').webgl > at('').webgl + 0.01 && at('a b').webgl > at('a').webgl, JSON.stringify(states));
  assert.ok(at('a').drawn > at('').drawn + 0.01 && at('a b').drawn > at('a').drawn, JSON.stringify(states));
  assert.equal(new Set(states.map((s) => s.digest)).size, STATES.length);
  assert.deepEqual(states.map((s) => s.label), [0, 1, 1]);
  assert.ok(states.every((s) => s.sun === 1), 'the label of the Sun is shown at every step');

  for (const az of [-60, 30, 120, 210]) {
    const c = await page.evaluate(compass(az));
    assert.ok(c.length > 20 && c.angle < 5 && c.drawn, `at the azimuth ${az}, the needle is ${JSON.stringify(c)}`);
    assert.ok(c.label > c.length, `at the azimuth ${az}, the label is ${c.label} from the middle of the compass, and the tip ${c.length}`);
  }

  const print = await browser.newPage();
  await print.send('Page.addScriptToEvaluateOnNewDocument', { source: KEEP_GL });
  await printView(print, deckUrl(DECK, 'print-pdf&still'));
  await live(print);
  const pages = await print.evaluate(shown);
  assert.deepEqual(print.errors, []);
  assert.deepEqual(pages.map((s) => s.state).filter((state, i, all) => state !== all[i - 1]), STATES);
  for (const s of pages) {
    assert.ok(Math.abs(s.drawn - at(s.state).drawn) < 0.002, `a page at the state "${s.state}" is drawn over ${s.drawn}, and the slide over ${at(s.state).drawn}`);
  }
});

const sample = (step) => `new Promise((done) => {
  const b = ${bundle}, seen = [];
  ${step};
  const frame = () => {
    const p = b.probe();
    seen.push(p.strips[0]);
    if (p.settled) done({ seen, last: p });
    else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})`;

test('a bundle is drawn again when the context of WebGL is restored, at the state of a step taken while it was lost', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: KEEP_GL });
  await page.goto(deckUrl(DECK, 'still'));
  await page.waitFor(deckSettled);
  const base = await page.evaluate(share);
  await page.evaluate(`new Promise((done) => {
    window.gl.canvas.addEventListener('webglcontextlost', () => done(), { once: true });
    window.lose = window.gl.getExtension('WEBGL_lose_context');
    window.lose.loseContext();
  })`);
  await page.evaluate('Reveal.slide(0, 0, 0)');
  await page.evaluate(`new Promise((done) => {
    window.gl.canvas.addEventListener('webglcontextrestored', () => requestAnimationFrame(() => done()), { once: true });
    window.lose.restoreContext();
  })`);
  const restored = await page.evaluate(share);
  assert.equal(await page.evaluate(`${bundle}.el.dataset.shown`), 'a');
  assert.ok(restored > base + 0.01, `${(100 * restored).toFixed(2)}% of the canvas is drawn at the strip a after the restore, and ${(100 * base).toFixed(2)}% without a strip`);
  assert.deepEqual(page.errors, []);
});

test('a bundle is drawn after a crash of the GPU process, at a step taken once the context is restored', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: KEEP_GL });
  await page.goto(deckUrl(DECK, 'still'));
  await page.waitFor(deckSettled);
  const base = await page.evaluate(share);
  await page.evaluate(`window.gl.canvas.addEventListener('webglcontextrestored', () => { window.restored = true; }, { once: true })`);
  await page.send('Browser.crashGpuProcess');
  await page.waitFor('window.restored === true');
  await page.evaluate('Reveal.slide(0, 0, 0)');
  await page.evaluate('new Promise((done) => requestAnimationFrame(() => done()))');
  const drawn = await page.evaluate(share);
  assert.equal(await page.evaluate(`${bundle}.el.dataset.shown`), 'a');
  assert.ok(drawn > base + 0.01, `${(100 * drawn).toFixed(2)}% of the canvas is drawn at the strip a after the crash, and ${(100 * base).toFixed(2)}% without a strip before it`);
  assert.deepEqual(page.errors, []);
});

test('a strip is grown from its first segment to its last and then as a sheet, and shrunk back', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl(DECK));
  await page.waitFor(deckSettled);

  const grown = await page.evaluate(sample('Reveal.next()'));
  assert.equal(grown.last.state, 'a');
  const growing = grown.seen.filter((r) => r.grow > 0 && r.grow < 1);
  assert.ok(growing.length >= 5, `the growth was seen at ${growing.length} frames`);
  for (const r of growing) {
    r.ribs.forEach((g, k) => k && assert.ok(g <= r.ribs[k - 1] + 1e-12, `the segment ${k} is at ${g} and the one before at ${r.ribs[k - 1]}`));
    if (r.sheet > 0) assert.equal(r.ribs.at(-1), 1);
  }
  assert.ok(growing.some((r) => r.ribs[0] === 1 && r.ribs.at(-1) < 1), 'the segments are grown one after another');
  assert.deepEqual(grown.last.strips.map((r) => r.grow), [1, 0]);

  const shrunk = await page.evaluate(sample('Reveal.prev()'));
  assert.equal(shrunk.last.state, '');
  assert.ok(shrunk.seen.some((r) => r.grow > 0 && r.grow < 1), 'the strip is shrunk over several frames');
  assert.deepEqual(shrunk.last.strips.map((r) => r.grow), [0, 0]);
  assert.deepEqual(page.errors, []);
});

test('a bundle is turned by a drag in the editor, shown in the Surface pane without heights, and its camera is written by Use Current View', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await editorPage(browser, { deck: DECK });
  if (!(await page.evaluate(`window.BeesonEditor.state('shell.format')`)).checked) await page.evaluate(`window.BeesonEditor.exec('shell.format')`);
  const camera = () => page.evaluate(`${bundle}.view()`);
  assert.deepEqual((await camera()).written, { azimuth: -60, elevation: 32, zoom: 1, turn: 90, zscale: 1 });
  await drag(page, '.surface[data-bundle]', { dx: 80, dy: 30 });
  const turned = await camera();
  assert.ok(Math.abs(turned.azimuth + 60) > 10, `the azimuth is ${turned.azimuth}`);
  assert.ok(turned.elevation > 32, `the elevation is ${turned.elevation}`);
  const PANES = '#beeson-edit-panel-format .ed-panes';
  await page.waitFor(`document.querySelector('${PANES}')?.dataset.pane === 'surface'`);
  const sections = await page.evaluate(`[...document.querySelectorAll('${PANES} .ed-sec > h5')].map((h) => h.textContent)`);
  assert.ok(sections.includes('Camera') && !sections.includes('Heights'), JSON.stringify(sections));
  await page.evaluate(`window.BeesonEditor.exec('surface.useView')`);
  const az = Math.round(turned.azimuth), el = Math.round(turned.elevation);
  await page.waitFor(`window.BeesonEditor.render().includes('<div class="surface" data-bundle="ring" data-azimuth="${az}" data-elevation="${el}">')`);
  assert.deepEqual(page.errors, []);
});

const POINT = 'test/pages/bundle-point.html';
const POINT_STATES = ['', 'start', 'nudge', 'flow', 'flow a'];

test('a bundle is reported when its times are not increasing fractions of the period, one for each point of the orbit', () => {
  const orbit = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  for (const times of [[0, 0.5], [0, 0.5, 0.5], [0, 0.5, 1], [0.1, 0.05, 0.5], [-0.1, 0.2, 0.5], 'a']) {
    assert.match(parseBundle(JSON.stringify({ orbit, strips: [], times })), /times/, JSON.stringify(times));
  }
  assert.equal(typeof parseBundle(JSON.stringify({ orbit, strips: [], times: [0, 0.3, 0.6] })), 'object');
});

const point = `Promise.all([...document.querySelectorAll('.surface[data-bundle]')].filter((s) => s.getClientRects().length).map(async (s) => {
  const canvas = s.querySelector('canvas'), ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let drawn = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const label = (at) => s.querySelector('.label[data-at="' + at + '"]');
  const place = (at) => [parseFloat(label(at).style.left), parseFloat(label(at).style.top)];
  const [x0, y0] = place('start'), [x1, y1] = place('nudge');
  return {
    state: s.dataset.shown,
    drawn: drawn / (data.length / 4),
    digest: [...digest.slice(0, 8)].join('.'),
    start: Number(label('start').style.opacity),
    nudge: Number(label('nudge').style.opacity),
    a: Number(label('a').style.opacity),
    lap: Number(s.closest('section').querySelector('[data-surface-lap]').style.opacity),
    reach: Math.hypot(x1 - x0, y1 - y0),
  };
}))`;

test('a moving point is drawn at each of its states, live and in the print view, with its labels at its start and past its arrow', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.goto(deckUrl(POINT, 'still'));
  await page.waitFor(deckSettled);
  const live = [];
  for (let f = -1; f <= 3; f++) {
    await page.evaluate(`Reveal.slide(0, 0, ${f})`);
    live.push(...(await page.evaluate(point)));
  }
  assert.deepEqual(page.errors, []);
  assert.deepEqual(live.map((s) => s.state), POINT_STATES);
  const at = (state) => live.find((s) => s.state === state);
  assert.equal(new Set(live.map((s) => s.digest)).size, POINT_STATES.length);
  assert.ok(at('flow a').drawn > at('flow').drawn + 0.01, JSON.stringify(live));
  assert.deepEqual(live.map((s) => s.start), [0, 1, 1, 1, 1]);
  assert.deepEqual(live.map((s) => s.nudge), [0, 0, 1, 0, 0]);
  assert.deepEqual(live.map((s) => s.a), [0, 0, 0, 0, 1]);
  assert.deepEqual(live.map((s) => s.lap), [0, 0, 0, 1, 1]);
  assert.ok(at('nudge').reach > 90, `the label of the nudge is ${at('nudge').reach} px from the start, and the arrow is 90 px long`);

  const print = await browser.newPage();
  await printView(print, deckUrl(POINT, 'print-pdf&still'));
  const pages = await print.evaluate(point);
  assert.deepEqual(print.errors, []);
  assert.deepEqual(pages.map((s) => s.state).filter((state, i, all) => state !== all[i - 1]), POINT_STATES);
  for (const s of pages) {
    const l = at(s.state);
    assert.deepEqual([s.start, s.nudge, s.a, s.lap], [l.start, l.nudge, l.a, l.lap], `a page at the state "${s.state}"`);
    assert.ok(Math.abs(s.drawn - l.drawn) < 0.002, `a page at the state "${s.state}" is drawn over ${s.drawn}, and the slide over ${l.drawn}`);
  }
});

const watch = (step, done) => `new Promise((resolve) => {
  const s = document.querySelector('.surface[data-bundle]'), section = s.closest('section');
  const lab = s.querySelector('.label[data-at="nudge"]'), lap = section.querySelector('[data-surface-lap]');
  const canvas = s.querySelector('canvas'), ctx = canvas.getContext('2d');
  const seen = [];
  const t0 = performance.now();
  ${step};
  const frame = (now) => {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) hash = (hash * 31 + data[i] + 7 * data[i + 1] + 13 * data[i + 2]) | 0;
    seen.push({ t: now - t0, nudge: Number(lab.style.opacity), lap: Number(lap.style.opacity), hash });
    if (${done}) resolve(seen);
    else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})`;

test('a moving point flows around its orbit once per lap, and the elements with data-surface-lap are faded in after the first', { timeout: 120000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ motion: true });
  await page.goto(deckUrl(POINT));
  await page.waitFor(deckSettled);
  await page.evaluate('Reveal.slide(0, 0, 0)');

  const nudged = await page.evaluate(watch('Reveal.next()', 'seen.at(-1).nudge === 1'));
  assert.ok(nudged.filter((f) => f.nudge > 0 && f.nudge < 1).length >= 2, `the arrow is faded in over ${JSON.stringify(nudged.map((f) => f.nudge))}`);

  const flowed = await page.evaluate(watch('Reveal.next()', 'seen.at(-1).lap === 1'));
  const first = flowed.find((f) => f.lap > 0);
  assert.ok(first.t >= 6000, `the elements with data-surface-lap are faded in ${first.t} ms after the step, before the end of the first lap`);
  assert.ok(flowed.some((f) => f.lap > 0 && f.lap < 1), 'the elements with data-surface-lap are faded in over several frames');
  assert.ok(flowed.every((f, i) => i === 0 || f.nudge <= flowed[i - 1].nudge) && flowed.at(-1).nudge === 0, `the label of the nudge is faded out while the point flows, over ${JSON.stringify(flowed.map((f) => f.nudge))}`);
  const hashes = new Set(flowed.filter((f) => f.t < 6000).map((f) => f.hash));
  assert.ok(hashes.size >= 3, `the point is drawn at ${hashes.size} places in its first lap`);
  assert.deepEqual(page.errors, []);
});

test('a bundle without a moving point leaves the elements with data-surface-lap of its slide alone', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(DECK, 'still'));
  await page.waitFor(deckSettled);
  const opacity = await page.evaluate(`(() => {
    const lap = document.querySelector('[data-surface-lap]');
    ${bundle}.draw();
    return lap && getComputedStyle(lap).opacity;
  })()`);
  assert.equal(opacity, '1');
  assert.deepEqual(page.errors, []);
});
