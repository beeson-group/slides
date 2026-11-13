// Records the animated backdrops of a deck for scripts/export-pptx.mjs, in the print view of the
// export, where each step of a slide is a .pdf-page. A recording is the layer of a PowerPoint slide
// under the words: the ground of the slide, the elements painted under the backdrop, and the
// canvases of the backdrop, traced on a clock that is stepped from here, hence each frame is drawn
// at its time whatever it costs. The frames are composed on a canvas in the page and encoded there
// with the H.264 encoder of Chrome, the WebCodecs VideoEncoder, and the MP4 file is written by
// scripts/mp4.mjs. Everything painted over the backdrop is in the picture of the words of each step,
// a screenshot with a transparent ground.
import { mp4 } from './mp4.mjs';

const DESIGN = { width: 1920, height: 1080 };

// High profile at level 5.2, for 3840 by 2160 px at 60 frames per second
const config = (fps, scale, hardwareAcceleration) => ({
  codec: 'avc1.640034',
  width: DESIGN.width * scale,
  height: DESIGN.height * scale,
  bitrate: 30e6,
  framerate: fps,
  latencyMode: 'quality',
  hardwareAcceleration,
  avc: { format: 'avc' },
});

// the software encoder of Chrome gave a mean PSNR of 41.5 dB in a trial on a Mac, against 40.2 dB
// for the encoder of macOS, at about the same time and size, and it gives the same kind of file on
// every system
const ACCELERATIONS = ['prefer-software', 'no-preference'];

const refused = (reason) => new Error(`${reason}. Export with the option --still to keep the backdrops as stills.`);

// the part of the recorder in the page, installed once in the print view. the elements of a step
// are marked with data-rec as under or over the canvases of the recorded backdrops, by their order
// in a hit test, and the classes rec-under and rec-words on the root show one of the two layers
const HELPER = `window.__record ??= (() => {
  const style = document.createElement('style');
  // :root outranks the rule of reveal.js that shows every section of the print view, which would
  // keep the lockup, a ::before of the section, in both layers
  style.textContent = \`
    :root.rec-probe .pdf-page * { pointer-events: auto !important; }
    :root.rec-under :is(.rec-page[data-rec="over"], .rec-page [data-rec="over"], .rec-page .rec-canvas),
    :root.rec-under .rec-page [data-rec-after]::after,
    :root.rec-words :is(.rec-page[data-rec="under"], .rec-page [data-rec="under"], .rec-page .rec-canvas) { visibility: hidden !important; }
    :root.rec-under :is(.rec-page[data-rec="under"], .rec-page [data-rec="under"]),
    :root.rec-words .rec-page [data-rec="over"],
    :root.rec-words .rec-page [data-rec-after]::after { visibility: visible !important; }
    :root.rec-words, :root.rec-words body, :root.rec-words .reveal-viewport, :root.rec-words .reveal { background: transparent !important; }
    :root.rec-words .pdf-page:not(.rec-page) { opacity: 0 !important; }
  \`;
  document.head.append(style);
  const pages = () => [...document.querySelectorAll('.pdf-page')];
  const backdropsOf = (page) => [...page.querySelectorAll('.backdrop')];
  const orbitsOf = (el) => Beeson.backdrops.find((o) => o.el === el);
  const opacity = (el, page) => {
    let a = 1;
    for (let e = el; e && e !== page.parentElement; e = e.parentElement) a *= Number(getComputedStyle(e).opacity);
    return a;
  };
  const drawn = (el, page) => getComputedStyle(el).visibility === 'visible' && el.getClientRects().length > 0 && opacity(el, page) > 0;
  // a trace of a backdrop without a box, e.g. of the class for-light in the dark mode, is not
  // finished, since its frames are not drawn
  const live = (page) => backdropsOf(page).flatMap((el, i) => (orbitsOf(el) && Beeson.animated(orbitsOf(el))
    && drawn(el, page) && el.offsetWidth > 0 && el.offsetHeight > 0 ? [i] : []));
  // an element of its own layer, whose order against the canvases is not the one of its parent
  const own = (cs) => cs.position !== 'static' || cs.zIndex !== 'auto' || cs.opacity !== '1' || cs.transform !== 'none'
    || cs.translate !== 'none' || cs.rotate !== 'none' || cs.scale !== 'none' || cs.filter !== 'none' || cs.isolation === 'isolate'
    || cs.mixBlendMode !== 'normal' || cs.float !== 'none';
  const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  // true when el is painted over the canvases, by the order of el and the canvases at points of
  // their overlap, or null when el is not hit there, e.g. at the gaps between the lines of a text
  function over(el, canvases) {
    const box = el.getBoundingClientRect();
    for (const c of canvases) {
      const r = c.getBoundingClientRect();
      if (!meets(box, r)) continue;
      const left = Math.max(box.left, r.left, 0), right = Math.min(box.right, r.right, innerWidth);
      const top = Math.max(box.top, r.top, 0), bottom = Math.min(box.bottom, r.bottom, innerHeight);
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const hits = document.elementsFromPoint(left + fx * (right - left), top + fy * (bottom - top));
        const at = hits.indexOf(el), below = hits.findIndex((h) => canvases.includes(h));
        if (at >= 0 && below >= 0) return at < below;
      }
    }
    return null;
  }

  // the element of the page first at the place of el in page, by the index of each ancestor among
  // its siblings, hence a step that adds an element moves only the places of its later siblings
  function counterpart(el, page, first) {
    const path = [];
    for (let e = el; e !== page; e = e.parentElement) path.unshift([...e.parentElement.children].indexOf(e));
    let c = first;
    for (const i of path) c = c?.children[i];
    return c?.tagName === el.tagName ? c : null;
  }

  // marks each element of page as under or over the canvases. an element under the canvases whose
  // counterpart at the first step, where the layer under them is taken, is missing or not drawn
  // is put over them
  function classify(page, canvases, first) {
    const rects = canvases.map((c) => c.getBoundingClientRect());
    const all = [page, ...page.querySelectorAll('*')];
    const later = first && first !== page;
    const layer = new Map();
    const inherited = (el) => {
      for (let e = el.parentElement; e; e = e.parentElement) if (layer.has(e)) return layer.get(e);
      return 'over';
    };
    all.forEach((el) => {
      if (canvases.includes(el)) { el.classList.add('rec-canvas'); return; }
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible') return;
      let side;
      if (canvases.some((c) => el.contains(c))) {
        side = 'under';
        // a pseudo-element is not hit in a hit test. the ::after of an ancestor of the canvases, e.g.
        // the group logo of a slide, is painted over them when it is positioned, as the last child
        const after = getComputedStyle(el, '::after');
        if (after.content !== 'none' && after.position !== 'static') el.dataset.recAfter = '';
      } else {
        const parent = el.parentElement;
        const probed = own(cs) || canvases.some((c) => parent?.contains(c));
        if (!probed) side = inherited(el);
        else {
          const box = el.getBoundingClientRect();
          if (!rects.some((r) => meets(box, r))) side = 'over';
          else {
            const hit = over(el, canvases);
            side = hit === null ? inherited(el) : hit ? 'over' : 'under';
          }
        }
        if (side === 'under' && later) {
          const c = counterpart(el, page, first);
          if (!c || !drawn(c, first)) side = 'over';
        }
      }
      layer.set(el, side);
      el.dataset.rec = side;
    });
  }

  function unmark() {
    document.documentElement.classList.remove('rec-probe', 'rec-under', 'rec-words');
    for (const el of document.querySelectorAll('[data-rec]')) delete el.dataset.rec;
    for (const el of document.querySelectorAll('[data-rec-after]')) delete el.dataset.recAfter;
    for (const el of document.querySelectorAll('.rec-canvas, .rec-page')) el.classList.remove('rec-canvas', 'rec-page');
  }

  const toBase64 = (u) => {
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const png = async (canvas) => toBase64(new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()));

  // a clock that is stepped from Node in place of performance.now and requestAnimationFrame
  const clock = {
    install() {
      this.real = { raf: window.requestAnimationFrame, caf: window.cancelAnimationFrame };
      // a whole number of seconds ahead of the real clock, so that a time of a frame is summed exactly
      this.base = Math.ceil(performance.now() / 1000) * 1000 + 1000;
      this.now = this.base;
      this.queue = new Map();
      let id = 0;
      performance.now = () => this.now;
      window.requestAnimationFrame = (f) => { this.queue.set(++id, f); return id; };
      window.cancelAnimationFrame = (i) => { this.queue.delete(i); };
    },
    at(ms) {
      this.now = this.base + ms;
      const q = this.queue;
      this.queue = new Map();
      for (const f of q.values()) f(this.now);
    },
    remove() {
      if (!this.real) return;
      delete performance.now;
      window.requestAnimationFrame = this.real.raf;
      window.cancelAnimationFrame = this.real.caf;
      for (const f of this.queue.values()) this.real.raf(f);
      this.real = null;
    },
  };

  let state = null;

  return {
    live: () => pages().map(live),
    // scrolls to the page of index i, and returns its box in the document
    scrollTo(i) {
      const y = window.scrollY + pages()[i].getBoundingClientRect().top;
      window.scrollTo(0, y);
      const box = { x: 0, y, width: innerWidth, height: innerHeight, scale: 1 };
      return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(box))));
    },
    // marks the pages of the steps, and returns what the recording needs to know of its backdrops
    prepare(steps) {
      const all = pages(), group = steps.map((i) => all[i]);
      const keys = live(group[0]);
      if (!keys.length) throw new Error(\`step \${steps[0]} does not trace a backdrop\`);
      const orbits = keys.map((k) => orbitsOf(backdropsOf(group[0])[k]));
      state = { group, keys, orbits, scroll: window.scrollY };
      return { periods: orbits.map((o) => o.period), span: Math.max(...orbits.map((o) => o.span)) };
    },
    // marks the elements of the step of index k of the group, and shows the layer of mode, under or
    // words. the page is scrolled to the step first, since a hit test is made in the viewport
    show(k, mode) {
      const { group, keys } = state;
      unmark();
      const page = group[k];
      page.classList.add('rec-page');
      const canvases = keys.flatMap((key) => [...backdropsOf(page)[key].querySelectorAll(':scope > canvas')]);
      document.documentElement.classList.add('rec-probe');
      classify(page, canvases, group[0]);
      document.documentElement.classList.remove('rec-probe');
      document.documentElement.classList.add(\`rec-\${mode}\`);
      return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))));
    },
    // starts the traces on the clock and the encoder, over the picture of the layer under the canvases
    async begin(under, fps, scale, config) {
      unmark();
      const { group, orbits } = state;
      const page = group[0], origin = page.getBoundingClientRect();
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(under), (c) => c.charCodeAt(0))], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(config.width, config.height);
      const ctx = canvas.getContext('2d', { alpha: false });
      // the canvases in the order of the page, clipped to the page as in the print view
      const layers = orbits.flatMap((o) => o.canvases).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        .map((c) => ({ c, r: c.getBoundingClientRect(), alpha: opacity(c, page) }));
      const draw = () => {
        ctx.globalAlpha = 1;
        ctx.drawImage(bitmap, 0, 0);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, origin.width * scale, origin.height * scale);
        ctx.clip();
        for (const { c, r, alpha } of layers) {
          ctx.globalAlpha = alpha;
          ctx.drawImage(c, (r.left - origin.left) * scale, (r.top - origin.top) * scale, r.width * scale, r.height * scale);
        }
        ctx.restore();
      };
      const chunks = [];
      let error = null, decoder = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          chunks.push({ data, key: chunk.type === 'key', ts: chunk.timestamp });
          if (meta?.decoderConfig && !decoder) decoder = meta.decoderConfig;
        },
        error: (e) => { error = String(e); },
      });
      encoder.configure(config);
      clock.install();
      for (const o of orbits) { o.reset(); o.start(true); }
      state = { ...state, canvas, draw, encoder, chunks, fps, frame: 0, failed: () => error, decoder: () => decoder };
      return true;
    },
    // draws the frames from the next one up to frame to, and encodes those before stop. with
    // untilDone, the frames end at the first one at which every trace is finished, whose index is
    // returned as last, or else -1. saved holds the PNGs of the frames of keep, of the first frame,
    // and of the last one
    async frames(to, stop, keep, untilDone) {
      const s = state, saved = {};
      for (; s.frame <= to; s.frame++) {
        const k = s.frame;
        clock.at((k * 1000) / s.fps);
        s.draw();
        if (k < stop) {
          // an encoder that failed is closed, and its reason would be lost in the error of encode()
          if (s.failed()) throw new Error(s.failed());
          if (s.encoder.state === 'closed') throw new Error('the encoder was closed');
          const frame = new VideoFrame(s.canvas, { timestamp: Math.round((k * 1e6) / s.fps), duration: Math.round(1e6 / s.fps) });
          s.encoder.encode(frame, { keyFrame: k === 0 });
          frame.close();
          while (s.encoder.encodeQueueSize > 2) await new Promise((done) => setTimeout(done, 0));
          if (s.failed()) throw new Error(s.failed());
        }
        const last = untilDone && s.orbits.every((o) => o.done);
        if (k === 0 || k === stop - 1 || last || keep.includes(k)) saved[k] = await png(s.canvas);
        if (last) {
          s.frame++;
          return { last: k, saved };
        }
      }
      return { last: -1, saved };
    },
    async finish() {
      const s = state;
      if (s.failed()) throw new Error(s.failed());
      await s.encoder.flush();
      s.encoder.close();
      if (s.failed()) throw new Error(s.failed());
      const ordered = s.chunks.every((c, i) => i === 0 || c.ts > s.chunks[i - 1].ts);
      const d = s.decoder()?.description;
      return {
        count: s.chunks.length,
        ordered,
        avcC: d ? toBase64(new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer)) : null,
        color: s.decoder()?.colorSpace ?? null,
      };
    },
    // the chunks from index a to b, as their sizes, their key flags, and the base64 of their bytes
    take(a, b) {
      const part = state.chunks.slice(a, b);
      const all = new Uint8Array(part.reduce((n, c) => n + c.data.length, 0));
      let at = 0;
      for (const c of part) { all.set(c.data, at); at += c.data.length; }
      return { sizes: part.map((c) => c.data.length), keys: part.map((c) => c.key), b64: toBase64(all) };
    },
    // puts the page back as the print view shows it, with the backdrops drawn complete
    // the traces are completed before the clock is removed, so that a frame queued on the clock is
    // not handed to the real requestAnimationFrame, where a loop would go on
    end() {
      if (state?.encoder && state.encoder.state !== 'closed') state.encoder.close();
      for (const o of state?.orbits ?? []) o.complete();
      clock.remove();
      unmark();
      if (state) window.scrollTo(0, state.scroll);
      state = null;
      return true;
    },
  };
})(), true`;

// the first of ACCELERATIONS at which browser encodes the recordings, or throws the reason why it
// does not
async function check(browser, fps, scale) {
  const probe = await browser.newPage();
  try {
    // WebCodecs is defined in a secure context alone, e.g. a page of a file URL, and not in about:blank
    await probe.goto(import.meta.url);
    const configs = ACCELERATIONS.map((a) => config(fps, scale, a));
    const found = await probe.evaluate(`(async () => {
      if (typeof VideoEncoder !== 'function') return null;
      for (const c of ${JSON.stringify(configs)}) if ((await VideoEncoder.isConfigSupported(c)).supported) return c.hardwareAcceleration;
      return '';
    })()`);
    if (found) return found;
    const c = configs[0];
    throw refused(found === null ? 'this browser does not have the WebCodecs VideoEncoder'
      : `this browser does not encode H.264 (${c.codec}) at ${c.width} by ${c.height} px and ${fps} frames per second`);
  } finally {
    await probe.close();
  }
}

/**
 * Returns a recorder for the print view of a deck at the pixel ratio scale, opened with
 * printView() of scripts/chrome.mjs in a page of browser, which is launched with wholeFrames, since
 * a layer may be missing from a picture otherwise. The print view is opened with
 * pdfPageHeightOffset=0, so that a page is the whole slide. Throws, with the reason and the option
 * --still, when browser does not encode H.264 at the size of the recordings.
 */
export async function recorder(browser, { fps = 60, scale = 2 } = {}) {
  const acceleration = await check(browser, fps, scale);

  // a page behind another one, e.g. behind the page of check(), is not given animation frames, and
  // its timers are slowed down
  const ready = async (page) => {
    await page.send('Page.bringToFront');
    await page.evaluate(HELPER);
    const ratio = await page.evaluate('devicePixelRatio');
    if (ratio !== scale) throw new Error(`the print view is at a pixel ratio of ${ratio}, and the recorder at ${scale}`);
  };

  return {
    /** The hardwareAcceleration of the VideoEncoder, 'prefer-software' or else 'no-preference'. */
    acceleration,

    /** For each .pdf-page, the indices among the backdrops of its slide of those that are traced or looped at its step. */
    async live(page) {
      await ready(page);
      return page.evaluate('__record.live()');
    },

    /**
     * Records the backdrops traced at the first of steps, the indices of the .pdf-pages that are
     * stacked on one PowerPoint slide. Returns the recording, the still, i.e. its last frame, and
     * tops, the picture of the words of each step. keep lists frames whose PNG is returned in kept,
     * by index, or as 'last' for the last frame and 'end' for the frame after it.
     */
    async record(page, steps, { keep = [] } = {}) {
      await ready(page);
      try {
        const { periods, span } = await page.evaluate(`__record.prepare(${JSON.stringify(steps)})`);
        // a recording of loops alone covers one period, and with a trace it ends with the trace
        const loop = periods.every((p) => p > 0);
        const transparent = { color: { r: 0, g: 0, b: 0, a: 0 } };
        // the pictures are clipped to the box of the page in the document
        const box = await page.evaluate(`__record.scrollTo(${steps[0]})`);
        await page.evaluate(`__record.show(0, 'under')`);
        const under = await page.screenshot(box);
        const tops = [];
        await page.send('Emulation.setDefaultBackgroundColorOverride', transparent);
        try {
          for (const [k, i] of steps.entries()) {
            const box = await page.evaluate(`__record.scrollTo(${i})`);
            await page.evaluate(`__record.show(${k}, 'words')`);
            tops.push(await page.screenshot(box));
          }
        } finally {
          await page.send('Emulation.setDefaultBackgroundColorOverride', {});
        }
        await page.evaluate(`__record.scrollTo(${steps[0]})`);
        const c = config(fps, scale, acceleration);
        await page.evaluate(`__record.begin(${JSON.stringify(under.toString('base64'))}, ${fps}, ${scale}, ${JSON.stringify(c)})`);

        // the frames are drawn a second per round trip. a trace ends with the frame at which every
        // trace is finished, and it fails a second past its span
        const kept = {};
        const asked = JSON.stringify(keep.filter((k) => typeof k === 'number'));
        let frames = loop ? Math.round(Math.max(...periods) * fps) : 0;
        for (let from = 0; loop ? from < frames : !frames; from += fps) {
          if (!loop && from > (span + 1) * fps) throw new Error(`the trace of step ${steps[0]} did not finish ${span + 1} s after its start`);
          const to = loop ? Math.min(from + fps, frames) - 1 : from + fps - 1;
          const { last, saved } = await page.evaluate(`__record.frames(${to}, ${loop ? frames : 'Infinity'}, ${asked}, ${!loop})`);
          Object.assign(kept, saved);
          if (last >= 0) frames = last + 1;
        }
        const index = (k) => (k === 'last' ? frames - 1 : k === 'end' ? frames : k);
        // the frames of keep past the recording are drawn without being encoded
        const past = Math.max(-1, ...keep.map(index));
        if (past >= frames) Object.assign(kept, (await page.evaluate(`__record.frames(${past}, ${frames}, ${JSON.stringify(keep.map(index))}, false)`)).saved);
        const done = await page.evaluate(`__record.finish()`);
        if (!done.ordered) throw new Error('the encoder reordered the frames, which the MP4 writer does not support');
        const samples = [];
        for (let a = 0; a < done.count; a += 120) {
          const part = await page.evaluate(`__record.take(${a}, ${a + 120})`);
          const bytes = Buffer.from(part.b64, 'base64');
          let at = 0;
          part.sizes.forEach((size, i) => { samples.push({ data: bytes.subarray(at, at + size), key: part.keys[i] }); at += size; });
        }
        if (samples.length !== frames) throw new Error(`the encoder gave ${samples.length} chunks for ${frames} frames`);
        const data = mp4({ width: c.width, height: c.height, fps, samples, avcC: Buffer.from(done.avcC, 'base64'), color: done.color ?? undefined });
        const png = (k) => Buffer.from(kept[k], 'base64');
        return {
          recording: { data, poster: png(0), duration: (frames * 1000) / fps, loop, frames },
          still: png(frames - 1),
          tops,
          kept: Object.fromEntries(keep.map((k) => [k, png(index(k))])),
        };
      } catch (error) {
        if (/EncodingError|NotSupportedError/.test(error.message)) throw refused(error.message);
        throw error;
      } finally {
        await page.evaluate(`__record.end()`);
      }
    },
  };
}
