// the Image, Video, and QR panes of the Format tab. the Image pane has the file, the description
// read by a screen reader, i.e. the alt of the image, the classes paper and invert, and the mode in
// which the image is shown, as the Image tab of Keynote. the Video pane has the file, the poster,
// and the switches of playback, and the QR pane the text of the code with the count of its bytes

import type { App } from '../app.ts';
import { QR_MAX, bytesOf, imageOf, qrOf, videoOf } from '../commands/figure.ts';
import { checkbox, note, row, section, segmented, textField, type Control, type Run } from './controls.ts';

const fileName = (src: string | null) => (src ? decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() ?? src) : '');

const modes = (app: App, run: Run, what: string): Control =>
  section(`Shown in`, [
    row([segmented(app, run, [
      { command: 'figure.mode.both', icon: 'mode-both', text: 'Both' },
      { command: 'figure.mode.dark', icon: 'mode-dark', text: 'Dark' },
      { command: 'figure.mode.light', icon: 'mode-light', text: 'Light' },
    ], 'Shown in')]),
    note(() => `A pair of ${what}s, one for each mode of the deck, is marked Dark and Light.`),
  ]);

export function imagePane(app: App, run: Run): Control[] {
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
    section('File', [note(() => fileName(img?.getAttribute('src') ?? null))]),
    section(null, [alt, checkbox(app, run, 'figure.decorative', 'Decorative')]),
    section('Appearance', [
      checkbox(app, run, 'figure.paper', 'Paper, framed as a white raster figure'),
      checkbox(app, run, 'figure.invert', 'Invert in dark mode, for a black-on-white plot'),
    ]),
    modes(app, run, 'image'),
  ];
}

export function videoPane(app: App, run: Run): Control[] {
  const video = videoOf(app);
  return [
    section('File', [
      note(() => fileName(video?.getAttribute('src') ?? null)),
      note(() => (video?.getAttribute('poster') ? `Poster: ${fileName(video.getAttribute('poster'))}` : 'The video does not have a poster, which the PDF prints.'), () => !video?.getAttribute('poster')),
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
