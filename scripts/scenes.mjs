// Records the tycho scenes of a deck for scripts/export-pptx.mjs. A recording is an MP4 of H.264,
// encoded by exportVideo of the tycho runtime in a page of the live deck, since in the print view
// each viewer is replaced by its still, see src/print.ts. Each frame is the picture of a kiosk
// viewer of the size of the box of the viewer in the print view, drawn at twice this size in px,
// and a recording holds one loop of its scene at 60 frames per second, with its first frame as its
// one key frame. The labels are set in the face of --tycho-font in theme/beeson.css.
import { setTimeout as sleep } from 'node:timers/promises';
import { deckSettled, deckUrl } from './chrome.mjs';

const FPS = 60;
// a recording of a long scene is tens of MB, hence it is read out of the page in parts
const PART = 4 * 1024 * 1024;

// the time in ms within which the next frame of a recording is finished, or the recording fails.
// a frame of the scene of the demo deck is finished in under 20 ms on a Mac
const STALL = 120000;

// runs in the page, and starts the export without awaiting it, since an export of minutes would
// outlast the time limit of a DevTools call in launch() of scripts/chrome.mjs. The frames done and
// in total, then the result, are kept in window.beesonRecording, and the bytes as well for read.
// The software encoder is asked for first, since it gave a smaller file than the encoder of the
// GPU, and the same kind of file on every machine
function record(viewer, size, fps) {
  const state = { done: 0, total: 0, result: null };
  window.beesonRecording = state;
  let poster = '';
  let frames = 0;
  const options = (hardwareAcceleration) => ({
    size,
    fps,
    kiosk: true,
    keyFrameInterval: Infinity,
    hardwareAcceleration,
    // the length of an export is bounded in the controls of a viewer, and a scene of a deck is
    // recorded whole
    limits: { frames: Infinity, seconds: Infinity },
    onFrame: (canvas, k) => {
      if (k === 0) poster = canvas.toDataURL('image/png');
    },
    // called by tycho once each frame is drawn and queued in the encoder
    onProgress: (done, total) => {
      frames = total;
      Object.assign(state, { done, total });
    },
  });
  (async () => {
    let blob;
    try {
      blob = await viewer.exportVideo(options('prefer-software')).catch((error) => {
        if (!/H\.264 encoder/.test(error?.message)) throw error;
        return viewer.exportVideo(options('no-preference'));
      });
    } catch (error) {
      state.result = { error: String(error?.message ?? error) };
      return;
    }
    state.read = (from, to) => new Promise((done, fail) => {
      const reader = new FileReader();
      reader.onload = () => done(reader.result.slice(reader.result.indexOf(',') + 1));
      reader.onerror = () => fail(reader.error);
      reader.readAsDataURL(blob.slice(from, to));
    });
    state.result = {
      bytes: blob.size,
      poster: poster.slice(poster.indexOf(',') + 1),
      duration: (frames / fps) * 1000,
      // a clock that ends with a stop holds its last frame, and is not looped
      loop: viewer.scene?.clock?.end !== 'stop',
    };
  })();
}

// waits for the recording started by record, and fails once a frame is not finished within STALL
async function finished(page, name) {
  let last = -1;
  let since = Date.now();
  for (;;) {
    const { done, total, result } = await page.evaluate(`(({ done, total, result }) => ({ done, total, result }))(window.beesonRecording)`);
    if (result) return result;
    if (done !== last) {
      last = done;
      since = Date.now();
    } else if (Date.now() - since > STALL) {
      throw new Error(`the scene on the slide "${name}" was not recorded: no frame was finished within ${STALL / 1000} s, after ${done} of ${total} frames. Export with --still to show each scene as a still of its first frame`);
    }
    await sleep(50);
  }
}

/**
 * Shows the first frame of each recording in the print view on page in place of the still of its
 * viewer, which is the canvas alone, without the labels that the viewer sets in HTML. A frame
 * fills the box of its viewer, as a recording does in PowerPoint.
 */
export async function showFirstFrames(page, recordings) {
  const frames = [...recordings].map(([id, { poster }]) => [id, `data:image/png;base64,${poster.toString('base64')}`]);
  await page.evaluate(`Promise.all(${JSON.stringify(frames)}.flatMap(([id, src]) =>
    [...document.querySelectorAll('.viewer-still[data-still="' + id + '"] > img')].map((image) => {
      image.src = src;
      image.style.cssText = 'position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: fill';
      return image.decode();
    })))`);
}

/**
 * Records each scene of a deck once, in a new page of browser. boxes is a map of the number of a
 * viewer, its data-still, to { width, height, name }, the box of the viewer in px of the slide and
 * the name of its slide. Returns a map of the same numbers to { data, poster, duration, loop }, the
 * MP4 and a PNG of its first frame as Buffers, its duration in ms, and whether it is looped.
 * Throws with the reason when a scene is not recorded, e.g. in a browser without an H.264 encoder.
 */
export async function recordScenes(browser, deck, boxes) {
  const recordings = new Map();
  if (!boxes.size) return recordings;
  const page = await browser.newPage();
  try {
    await page.goto(deckUrl(deck));
    await page.waitFor(deckSettled);
    for (const [id, { width, height, name }] of boxes) {
      const viewer = `document.querySelector('tycho-viewer[data-still="${id}"]')`;
      // a viewer of a slide that is not shown is not laid out, and its export would be empty
      await page.evaluate(`(() => {
        const { h, v } = Reveal.getIndices(${viewer}.closest('.slides section'));
        Reveal.slide(h, v);
      })()`);
      await page.waitFor(`!!(${viewer}.state || ${viewer}.shadowRoot?.querySelector('.status.error'))`, 60000);
      const size = { width: 2 * Math.round(width), height: 2 * Math.round(height), pixelRatio: 2 };
      await page.evaluate(`(${record})(${viewer}, ${JSON.stringify(size)}, ${FPS})`);
      const result = await finished(page, name);
      if (result.error) {
        throw new Error(`the scene on the slide "${name}" was not recorded: ${result.error}. Export with --still to show each scene as a still of its first frame`);
      }
      const parts = [];
      for (let from = 0; from < result.bytes; from += PART) {
        parts.push(Buffer.from(await page.evaluate(`window.beesonRecording.read(${from}, ${from + PART})`), 'base64'));
      }
      recordings.set(id, { data: Buffer.concat(parts), poster: Buffer.from(result.poster, 'base64'), duration: result.duration, loop: result.loop });
    }
    if (page.errors.length) throw new Error(`the page of the recordings has errors:\n${page.errors.join('\n')}`);
  } finally {
    await page.close();
  }
  return recordings;
}
