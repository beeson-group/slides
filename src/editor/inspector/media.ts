// the Image, Video, and QR panes of the Format tab. the Image pane has the file, the description
// read by a screen reader, i.e. the alt of the image, the classes paper and invert, its mask, and
// the mode in which the image is shown, as the Image tab of Keynote. the Video pane has the file, the poster,
// and the switches of playback, and the QR pane the text of the code with the count of its bytes.
// the file of an image or a video is shown in a well with Replace…, and the poster of a video in a
// well with Capture Poster, as the Replace button of the Image tab of Keynote. the Poster Frame
// slider of the Movie tab of Keynote chooses the time of the frame: a move of it shows the frame on
// the slide, and its release captures the frame as the poster

import type { App } from '../app.ts';
import { QR_MAX, bytesOf, imageOf, qrOf, videoOf } from '../commands/figure.ts';
import { posterTime, setPosterTime, unreadable } from '../media/actions.ts';
import { media } from '../media/store.ts';
import { make, injectStyle } from '../ui/dom.ts';
import { button, checkbox, note, row, section, segmented, textField, type Control, type Run } from './controls.ts';

const CSS = `
.beeson-edit-inspector .ed-well { display: grid; grid-template-columns: 56px 1fr; gap: 4px 10px; align-items: center; }
.beeson-edit-inspector .ed-well .thumb { grid-row: span 2; width: 56px; height: 40px; border-radius: 5px; background: var(--ed-pressed) center / contain no-repeat; box-shadow: inset 0 0 0 1px var(--ed-line); }
.beeson-edit-inspector .ed-well .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12px/1.3 var(--ed-font); color: var(--ed-text); }
.beeson-edit-inspector .ed-well .ed-btn { flex: 0 0 auto; justify-self: start; }
.beeson-edit-inspector .ed-frame { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; font: 12px/1.3 var(--ed-font); color: var(--ed-text); }
.beeson-edit-inspector .ed-frame input { width: 100%; min-width: 0; margin: 0; accent-color: var(--ed-select); }
.beeson-edit-inspector .ed-frame output { min-width: 4.5em; text-align: right; color: var(--ed-muted); font-variant-numeric: tabular-nums; }
.beeson-edit-inspector .ed-frame.off { opacity: 0.45; }
`;

// the path in the deck of a src or a poster, which the page shows from an object URL for a new file
const pathOf = (value: string | null) => media.pathOf(value);
const fileName = (src: string | null) => {
  const path = pathOf(src);
  return path ? decodeURIComponent(path.split(/[?#]/)[0].split('/').pop() ?? path) : '';
};
const unsaved = (value: string | null) => {
  const f = media.get(pathOf(value));
  return !!f && !f.saved;
};

// a thumbnail of the picture at url, the name of its file, and a button
// label gives the text and the title of the button at each sync, in place of text
type Label = () => { text: string; title: string };
function well(app: App, run: Run, url: () => string | null, name: () => string, command: string, arg: unknown, text: string, labelOf?: Label): Control {
  const el = make('div', 'ed-well');
  const thumb = make('div', 'thumb');
  const label = make('div', 'name');
  const b = button(app, run, { command, arg, text });
  el.append(thumb, label, b.el);
  const sync = () => {
    // a new file is shown from its object URL, also while the page still has its path
    const raw = url();
    const u = media.get(raw)?.url ?? raw;
    thumb.style.backgroundImage = u ? `url("${u.replace(/"/g, '%22')}")` : '';
    label.textContent = name() || 'None';
    label.title = label.textContent;
    b.sync();
    if (labelOf) {
      const { text: t, title } = labelOf();
      const span = b.el.querySelector('span');
      if (span) span.textContent = t;
      b.el.title = title;
    }
  };
  sync();
  return { el, sync };
}

const keptNote = (value: () => string | null) =>
  note(() => (unsaved(value()) ? `${fileName(value())} is kept in this browser until a save writes it into media/ next to the deck.` : ''));

const modes = (app: App, run: Run, what: string): Control =>
  section(`Shown in`, [
    row([segmented(app, run, [
      { command: 'figure.mode.both', icon: 'mode-both', text: 'Both' },
      { command: 'figure.mode.dark', icon: 'mode-dark', text: 'Dark' },
      { command: 'figure.mode.light', icon: 'mode-light', text: 'Light' },
    ], 'Shown in')]),
    note(() => `A pair of ${what}s, one for each mode of the deck, is marked Dark and Light. On a pair, Dark or Light swaps the two, and Both keeps this ${what} alone.`),
  ]);

export function imagePane(app: App, run: Run): Control[] {
  injectStyle('inspector-media', CSS);
  const img = imageOf(app);
  const alt = textField(app, {
    label: 'Description',
    name: 'alt',
    multiline: true,
    placeholder: 'Describe the image for a screen reader',
    value: () => img?.getAttribute('alt') ?? '',
    enabled: () => !!img?.isConnected && img.getAttribute('alt') !== '',
    commit: (value) => run('figure.alt', { value, el: img }),
    hint: (text) => (img?.getAttribute('alt') === '' ? { text: 'A decorative image is skipped by a screen reader.', warn: false } : text.trim() ? null : { text: 'The image does not have a description.', warn: true }),
  });
  return [
    section('File', [
      well(app, run, () => img?.currentSrc || img?.src || '', () => fileName(img?.getAttribute('src') ?? null), 'media.replace', { el: img }, 'Replace…'),
      keptNote(() => img?.getAttribute('src') ?? null),
    ]),
    section(null, [alt, checkbox(app, run, 'figure.decorative', 'Decorative')]),
    section('Appearance', [
      checkbox(app, run, 'figure.paper', 'Paper, framed as a white raster figure'),
      checkbox(app, run, 'figure.invert', 'Invert in dark mode, for a black-on-white plot'),
    ]),
    section('Mask', [
      row([
        button(app, run, { command: 'image.editMask', text: 'Edit Mask' }),
        button(app, run, { command: 'image.resetMask', icon: 'reset', text: 'Reset Mask' }),
      ]),
      note(() => 'Drag the image inside its box and scale it, or double-click the image.'),
    ]),
    modes(app, run, 'image'),
  ];
}

// a time in s as minutes, seconds, and tenths, e.g. 0:03.4
export const clock = (s: number): string => {
  const t = Math.max(0, Math.round(s * 10) / 10);
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
};

// the Poster Frame slider over the length of the video, with the time of the frame. a move seeks
// the video on the slide to the frame, and a release captures it as the poster
function frameSlider(app: App, run: Run, video: HTMLVideoElement | null): Control {
  const el = make('label', 'ed-frame');
  const input = make('input');
  input.type = 'range';
  input.min = '0';
  input.step = 'any';
  input.name = 'poster-frame';
  input.setAttribute('aria-label', 'Poster Frame');
  const time = make('output');
  el.append(make('span', '', 'Frame'), input, time);
  const length = () => (video && Number.isFinite(video.duration) ? video.duration : 0);
  const sync = () => {
    const d = length();
    const enabled = !!video?.isConnected && d > 0 && !!app.commands.get('media.poster') && app.commands.state('media.poster').enabled;
    input.disabled = !enabled;
    el.classList.toggle('off', !enabled);
    input.max = String(d || 1);
    if (document.activeElement !== input && video) input.value = String(Math.min(posterTime(video), d));
    time.textContent = clock(Number(input.value));
  };
  input.addEventListener('input', () => {
    if (!video) return;
    const t = Number(input.value);
    setPosterTime(video, t);
    video.pause();
    video.currentTime = t;
    time.textContent = clock(t);
  });
  input.addEventListener('change', () => {
    if (video) void run('media.poster', { el: video });
  });
  // the length of a video is known once its metadata is loaded
  if (video && !(length() > 0)) video.addEventListener('loadedmetadata', sync, { once: true });
  sync();
  return { el, sync };
}

export function videoPane(app: App, run: Run): Control[] {
  injectStyle('inspector-media', CSS);
  const video = videoOf(app);
  const poster = () => video?.getAttribute('poster') ?? null;
  return [
    section('File', [
      well(app, run, poster, () => fileName(video?.getAttribute('src') ?? null), 'media.replace', { el: video }, 'Replace…'),
      keptNote(() => video?.getAttribute('src') ?? null),
    ]),
    section('Poster', [
      well(app, run, poster, () => fileName(poster()), 'media.poster', { el: video }, 'Capture Poster', () => (video && unreadable(video)
        ? { text: 'Capture Poster…', title: 'Capture the frame of the slider as the poster. In a deck opened from a file, it asks once for the file of the video, whose frames the browser keeps from the page' }
        : { text: 'Capture Poster', title: 'Capture the frame of the slider as the poster' })),
      frameSlider(app, run, video),
      note(() => (poster() ? 'The frame shown before the video plays and printed in the PDF. Drag the slider to choose another one.' : 'The video does not have a poster, which the PDF prints.'), () => !poster()),
      note(() => (video && unreadable(video) ? `In a deck opened from a file, the browser keeps the frames of ${fileName(video.getAttribute('src'))} from the page, hence Capture Poster asks once for the file.` : '')),
      keptNote(poster),
    ]),
    section('Playback', [
      checkbox(app, run, 'figure.autoplay', 'Play while the slide is shown'),
      checkbox(app, run, 'figure.loop', 'Loop'),
      checkbox(app, run, 'figure.muted', 'Muted'),
    ]),
    modes(app, run, 'video'),
  ];
}

export function qrPane(app: App, run: Run): Control[] {
  const qr = qrOf(app);
  return [
    section(null, [textField(app, {
      label: 'Text',
      name: 'qr',
      multiline: true,
      placeholder: 'https://example.com',
      value: () => qr?.getAttribute('data-qr') ?? '',
      enabled: () => !!qr?.isConnected,
      commit: (value) => run('figure.qr', { value, el: qr }),
      hint: (text) => {
        const n = bytesOf(text);
        return { text: !text.trim() ? 'The text cannot be empty.' : `${n} of ${QR_MAX} bytes`, warn: !text.trim() || n > QR_MAX };
      },
    })]),
    section(null, [note(() => 'A shorter text is drawn with fewer and larger modules, which are read from farther back in the room.')]),
  ];
}
