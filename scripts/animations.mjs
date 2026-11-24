import { mp4 } from './mp4.mjs';
import { CLOCK, FULL_RANGE, refused } from './record.mjs';

export const SURFACE = { fps: 24, scale: 1, bitrate: 450e3 };
export const PLOT = { fps: 30, scale: 2, bitrate: 4e6 };

const SETTLE = 10;

const STILLS = 'the surfaces and the plots';

const ACCELERATIONS = ['prefer-software', 'no-preference'];

const HELPER = `window.__animate ??= (() => {
  const style = document.createElement('style');
  style.textContent = \`
    :root.anim-under .anim-el > canvas, :root.anim-under .anim-el .label { visibility: hidden !important; }
    :root.anim-label * { visibility: hidden !important; }
    :root.anim-label .anim-one, :root.anim-label .anim-one * { visibility: visible !important; }
    :root.anim-label .anim-one { opacity: 1 !important; }
    :root.anim-label, :root.anim-label body, :root.anim-label .reveal-viewport, :root.anim-label .reveal { background: transparent !important; }
    :root.anim-alone .pdf-page:not(.anim-page) { content-visibility: hidden; }
  \`;
  document.head.append(style);
  const clock = ${CLOCK};
  ${FULL_RANGE}
  const all = () => [...document.querySelectorAll('.pdf-page :is(.surface:not([data-bundle]), .plot)')];
  const plotOf = (el) => Beeson.plots.find((p) => p.el === el);
  const surfaceOf = (el) => Beeson.surfaces.find((s) => s.el === el);
  const toBase64 = (u) => {
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const fromBase64 = (b64) => createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/png' }));
  const png = async (canvas) => toBase64(new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()));
  const frame = () => new Promise((done) => (clock.real?.raf ?? requestAnimationFrame)(() => (clock.real?.raf ?? requestAnimationFrame)(() => done(true))));
  let state = null;

  const fragments = (el) => [...(el.closest('section')?.querySelectorAll('.fragment') ?? [])];

  function key(el) {
    const visible = fragments(el).filter((f) => f.classList.contains('visible'));
    if (el.matches('.surface')) {
      let best = null, index = -Infinity;
      for (const f of visible) {
        if (!f.hasAttribute('data-surface-state')) continue;
        const i = Number(f.dataset.fragmentIndex ?? 0);
        if (i >= index) { best = f; index = i; }
      }
      const { fragmentIndex, ...data } = best?.dataset ?? {};
      return 'surface ' + (el.dataset.shown ?? '') + ' ' + JSON.stringify(data);
    }
    const html = el.innerHTML;
    let h = 0;
    for (let i = 0; i < html.length; i++) h = (h * 31 + html.charCodeAt(i)) | 0;
    return 'plot ' + html.length + ' ' + h;
  }

  const encoderFor = (config) => {
    const out = { chunks: [], error: null, decoder: null };
    out.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        out.chunks.push({ data, key: chunk.type === 'key', ts: chunk.timestamp });
        if (meta?.decoderConfig && !out.decoder) out.decoder = meta.decoderConfig;
      },
      error: (e) => { out.error = String(e); },
    });
    out.encoder.configure(config);
    return out;
  };

  return {
    list() {
      const every = all();
      return [...document.querySelectorAll('.pdf-page')].map((page) => {
        const own = [...page.querySelectorAll('.surface:not([data-bundle]), .plot')];
        return own.filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.fragment:not(.visible)'))
          .map((el) => {
            const r = el.getBoundingClientRect(), p = page.getBoundingClientRect();
            return { index: every.indexOf(el), place: own.indexOf(el), key: key(el), x: r.x - p.x, y: r.y - p.y, width: r.width, height: r.height };
          });
      });
    },

    async encodes(config) {
      if (typeof VideoEncoder !== 'function') return null;
      for (const a of ${JSON.stringify(ACCELERATIONS)}) if ((await VideoEncoder.isConfigSupported({ ...config, hardwareAcceleration: a })).supported) return a;
      return null;
    },

    async box(i) {
      const el = all()[i];
      el.scrollIntoView({ block: 'center' });
      await frame();
      const r = el.getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, surface: el.matches('.surface') };
    },

    show(i, mode, n = -1) {
      const el = all()[i];
      document.documentElement.classList.remove('anim-under', 'anim-label');
      for (const e of document.querySelectorAll('.anim-el, .anim-one')) e.classList.remove('anim-el', 'anim-one');
      if (mode) {
        el.classList.add('anim-el');
        if (n >= 0) el.querySelectorAll('.label')[n].classList.add('anim-one');
        document.documentElement.classList.add('anim-' + mode);
      }
      return frame();
    },

    labels(i) {
      return [...all()[i].querySelectorAll('.label')].map((lab) => {
        const r = lab.getBoundingClientRect();
        return { x: r.x + scrollX - 8, y: r.y + scrollY - 8, width: r.width + 16, height: r.height + 16 };
      });
    },

    async begin(i, config, from, under, labels) {
      const el = all()[i];
      el.closest('.pdf-page').classList.add('anim-page');
      document.documentElement.classList.add('anim-alone');
      const surface = el.matches('.surface') ? surfaceOf(el) : null, plot = surface ? null : plotOf(el);
      if (!surface && !plot) throw new Error('the element is not drawn');
      const canvas = new OffscreenCanvas(config.width, config.height);
      const ctx = canvas.getContext('2d', { alpha: false });
      const box = el.getBoundingClientRect(), k = config.width / box.width;
      let draw = null;
      if (surface) {
        const ground = await fromBase64(under);
        const image = el.querySelector(':scope > canvas');
        const tags = [...el.querySelectorAll('.label')];
        const s = box.width / el.offsetWidth;
        const marks = await Promise.all(labels.map(async ({ png: b64, x, y, width, height }, n) => ({
          lab: tags[n], bitmap: await fromBase64(b64), x: x - scrollX - box.x, y: y - scrollY - box.y, width, height,
          left: parseFloat(tags[n].style.left) || 0, top: parseFloat(tags[n].style.top) || 0,
        })));
        draw = () => {
          ctx.globalAlpha = 1;
          ctx.drawImage(ground, 0, 0, config.width, config.height);
          const r = image.getBoundingClientRect();
          ctx.drawImage(image, (r.x - box.x) * k, (r.y - box.y) * k, r.width * k, r.height * k);
          for (const m of marks) {
            const alpha = Number(m.lab.style.opacity || 0);
            if (!(alpha > 0)) continue;
            ctx.globalAlpha = Math.min(1, alpha);
            const dx = ((parseFloat(m.lab.style.left) || 0) - m.left) * s, dy = ((parseFloat(m.lab.style.top) || 0) - m.top) * s;
            ctx.drawImage(m.bitmap, (m.x + dx) * k, (m.y + dy) * k, m.width * k, m.height * k);
          }
        };
      }
      clock.install();
      let turn = 0, period = 0, once = false, offset = 0;
      if (surface) {
        surface.fit(config.width / box.width, devicePixelRatio);
        turn = surface.view().written.turn;
        if (from !== null) {
          const before = fragments(all()[from]).map((f) => f.classList.contains('visible'));
          const own = fragments(el), now = own.map((f) => f.classList.contains('visible'));
          own.forEach((f, n) => f.classList.toggle('visible', !!before[n]));
          surface.sync(false);
          own.forEach((f, n) => f.classList.toggle('visible', now[n]));
          surface.start();
          surface.sync(true);
        } else surface.start();
      } else {
        const { pass, hold, fade } = plot.timing;
        const top = fragments(el).filter((f) => f.classList.contains('visible') && f.dataset.plotTab)
          .sort((a, b) => Number(a.dataset.fragmentIndex ?? 0) - Number(b.dataset.fragmentIndex ?? 0)).at(-1);
        once = !!top?.hasAttribute('data-plot-once') && top.classList.contains('current-fragment');
        plot.start();
        period = !plot.playing ? 0 : once ? pass : pass + hold;
        if (!once && fade > 0) offset = 1000 * period;
      }
      state = { surface, plot, canvas, ctx, draw, offset, fps: config.framerate, frame: 0, video: encoderFor(config), config };
      return { turn, period, once };
    },

    step(k) {
      const s = state;
      clock.at(s.offset + (k * 1000) / s.fps);
      if (!s.surface) return true;
      s.draw();
      const probe = s.surface.probe();
      const lit = probe.points.map((p) => p.lit);
      const settled = probe.settled && (s.lit ?? lit).every((v, n) => Math.abs(v - lit[n]) < 1e-4);
      s.lit = lit;
      return settled;
    },

    async encode(b64, keep) {
      const s = state, v = s.video;
      if (b64) {
        const bitmap = await fromBase64(b64);
        s.ctx.drawImage(bitmap, 0, 0, s.canvas.width, s.canvas.height);
        bitmap.close();
      }
      if (v.error) throw new Error(v.error);
      if (v.encoder.state === 'closed') throw new Error('the encoder was closed');
      const k = s.frame++;
      const frame = new VideoFrame(s.canvas, { timestamp: Math.round((k * 1e6) / s.fps), duration: Math.round(1e6 / s.fps) });
      v.encoder.encode(frame, { keyFrame: k === 0 });
      frame.close();
      while (v.encoder.encodeQueueSize > 2) await new Promise((done) => setTimeout(done, 0));
      if (v.error) throw new Error(v.error);
      return keep ? png(s.canvas) : null;
    },

    async clip(a, b) {
      let poster = null;
      for (let k = a; k < b; k++) {
        if (this.step(k) && k > 0) return { end: k, poster };
        const png = await this.encode(null, k === 0);
        if (k === 0) poster = png;
      }
      return { end: -1, poster };
    },

    async turn(start, a, b, drawn) {
      let poster = null;
      for (let n = a; n < b; n++) {
        if (n > 0 || !drawn) this.step(start + n);
        const png = await this.encode(null, n === 0);
        if (n === 0) poster = png;
      }
      return poster;
    },

    async finish() {
      const s = state, v = s.video;
      if (v.error) throw new Error(v.error);
      await v.encoder.flush();
      v.encoder.close();
      if (v.error) throw new Error(v.error);
      const d = v.decoder?.description;
      s.done = v;
      s.video = encoderFor(s.config);
      s.frame = 0;
      return {
        count: v.chunks.length,
        ordered: v.chunks.every((c, i) => i === 0 || c.ts > v.chunks[i - 1].ts),
        avcC: d ? toBase64(new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer)) : null,
        color: v.decoder?.colorSpace ?? null,
      };
    },

    take(a, b) {
      const part = state.done.chunks.slice(a, b);
      const bytes = new Uint8Array(part.reduce((n, c) => n + c.data.length, 0));
      let at = 0;
      for (const c of part) { bytes.set(c.data, at); at += c.data.length; }
      return { sizes: part.map((c) => c.data.length), keys: part.map((c) => c.key), b64: toBase64(bytes) };
    },

    end() {
      const s = state;
      for (const v of [s?.video, s?.done]) if (v && v.encoder.state !== 'closed') v.encoder.close();
      if (s?.surface) { s.surface.fit(); s.surface.stop(); s.surface.sync(false); s.surface.configure(); }
      if (s?.plot) { s.plot.leave(); s.plot.still(); }
      clock.remove();
      document.documentElement.classList.remove('anim-alone');
      for (const e of document.querySelectorAll('.anim-page')) e.classList.remove('anim-page');
      state = null;
      return true;
    },
  };
})(), true`;

const H264_HIGH_5_2 = 'avc1.640034';
const config = ({ fps, bitrate }, width, height, hardwareAcceleration) => ({
  codec: H264_HIGH_5_2,
  width,
  height,
  bitrate,
  framerate: fps,
  latencyMode: 'quality',
  hardwareAcceleration,
  avc: { format: 'avc' },
});

const evenFor420 = (px) => Math.max(2, 2 * Math.round(px / 2));

async function video(page, c, poster, loop) {
  const done = await page.evaluate('__animate.finish()');
  if (!done.ordered) throw new Error('the encoder reordered the frames, which the MP4 writer does not support');
  const samples = [];
  for (let a = 0; a < done.count; a += 120) {
    const part = await page.evaluate(`__animate.take(${a}, ${a + 120})`);
    const bytes = Buffer.from(part.b64, 'base64');
    let at = 0;
    part.sizes.forEach((size, i) => { samples.push({ data: bytes.subarray(at, at + size), key: part.keys[i] }); at += size; });
  }
  const data = mp4({ width: c.width, height: c.height, fps: c.framerate, samples, avcC: Buffer.from(done.avcC, 'base64'), color: done.color ?? undefined });
  return { data, poster: Buffer.from(poster, 'base64'), duration: (done.count * 1000) / c.framerate, loop, frames: done.count };
}

export async function listAnimations(page) {
  await page.evaluate(HELPER);
  return page.evaluate('__animate.list()');
}

export async function recordAnimation(page, i, from = null) {
  await page.evaluate(HELPER);
  await page.send('Page.bringToFront');
  const { surface, ...box } = await page.evaluate(`__animate.box(${i})`);
  const kind = surface ? SURFACE : PLOT;
  const c0 = config(kind, evenFor420(box.width * kind.scale), evenFor420(box.height * kind.scale));
  const acceleration = await page.evaluate(`__animate.encodes(${JSON.stringify(c0)})`);
  if (!acceleration) {
    throw refused(`this browser does not encode H.264 (${c0.codec}) at ${c0.width} by ${c0.height} px and ${kind.fps} frames per second`, STILLS);
  }
  const c = { ...c0, hardwareAcceleration: acceleration };
  const shot = async (clip) => (await page.screenshot({ ...clip, scale: 1 })).toString('base64');
  try {
    let under = null;
    const labels = [];
    if (surface) {
      await page.evaluate(`__animate.show(${i}, 'under')`);
      under = await shot(box);
      const boxes = await page.evaluate(`__animate.labels(${i})`);
      await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
      try {
        for (const [n, b] of boxes.entries()) {
          await page.evaluate(`__animate.show(${i}, 'label', ${n})`);
          labels.push({ ...b, png: await shot(b) });
        }
      } finally {
        await page.send('Emulation.setDefaultBackgroundColorOverride', {});
        await page.evaluate(`__animate.show(${i}, '')`);
      }
    }
    const { turn, period, once } = await page.evaluate(`__animate.begin(${i}, ${JSON.stringify(c)}, ${from ?? 'null'}, ${JSON.stringify(under)}, ${JSON.stringify(labels)})`);
    const fps = kind.fps;
    const result = { clip: null, loop: null };
    if (surface) {
      let k = 0;
      if (from !== null) {
        let poster = null;
        for (let end = -1; end < 0; k += fps) {
          if (k > SETTLE * fps) throw new Error(`the change of state of a surface did not end within ${SETTLE} s`);
          const part = await page.evaluate(`__animate.clip(${k}, ${k + fps})`);
          poster ??= part.poster;
          end = part.end;
          if (end >= 0) k = end - fps;
        }
        result.clip = await video(page, c, poster, false);
      }
      const frames = turn > 0 ? Math.round(turn * fps) : 0;
      if (frames > 0) {
        let poster = null;
        for (let n = 0; n < frames; n += fps) {
          const first = await page.evaluate(`__animate.turn(${k}, ${n}, ${Math.min(n + fps, frames)}, ${from !== null})`);
          poster ??= first;
        }
        result.loop = await video(page, c, poster, true);
      }
    } else if (period > 0) {
      const frames = Math.max(1, Math.round(period * fps));
      let poster = null;
      for (let n = 0; n < frames; n++) {
        await page.evaluate(`__animate.step(${n})`);
        const png = await page.evaluate(`__animate.encode(${JSON.stringify(await shot(box))}, ${n === 0})`);
        if (n === 0) poster = png;
      }
      result.loop = await video(page, c, poster, !once);
    }
    return result;
  } catch (error) {
    if (/EncodingError|NotSupportedError/.test(error.message)) throw refused(error.message, STILLS);
    throw error;
  } finally {
    await page.evaluate('window.__animate?.end()').catch(() => {});
  }
}
