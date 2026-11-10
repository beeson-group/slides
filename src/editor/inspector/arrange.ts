// the Arrange pane of the Format tab, as the Arrange tab of Keynote: Align with its reference,
// Distribute, the size in W and H, and the position in X and Y, each with its reset. X and Y are
// the offset of an element from its place in the file, and W and H its size, in slide pixels. W
// and H are set only on an image, a video, a QR code, and a tycho viewer, since the size of every
// other element is set by its layout

import type { App } from '../app.ts';
import { offsetOf, resizable, sizeOf, targetsOf } from '../commands/align.ts';
import { button, note, numberField, row, section, segmented, type Control, type Run } from './controls.ts';

// the value shared by every element, or null when they differ
const shared = (values: number[]): number | null => (values.length && values.every((v) => Math.round(v) === Math.round(values[0])) ? values[0] : null);

export function arrangePane(app: App, run: Run): Control[] {
  // the fields act on the elements selected when the pane was built
  const els = targetsOf(app);
  const live = () => els.filter((el) => el.isConnected);
  const sized = () => resizable(live());
  const field = (label: string, value: () => number | null, commit: (v: number) => unknown, enabled: () => boolean, min?: number) =>
    numberField(app, { label, value, commit, enabled, min });
  return [
    section('Align', [
      row([
        segmented(app, run, [
          { command: 'arrange.align.left', icon: 'align-left' },
          { command: 'arrange.align.center', icon: 'align-center' },
          { command: 'arrange.align.right', icon: 'align-right' },
        ], 'Align horizontally'),
        segmented(app, run, [
          { command: 'arrange.align.top', icon: 'align-top' },
          { command: 'arrange.align.middle', icon: 'align-middle' },
          { command: 'arrange.align.bottom', icon: 'align-bottom' },
        ], 'Align vertically'),
      ]),
      row([segmented(app, run, [
        { command: 'arrange.alignTo.slide', text: 'Slide' },
        { command: 'arrange.alignTo.selection', text: 'Selection' },
      ], 'Align to')], 'Align to'),
    ]),
    section('Distribute', [
      row([
        button(app, run, { command: 'arrange.distribute.horizontal', icon: 'distribute-h', text: 'Horizontally' }),
        button(app, run, { command: 'arrange.distribute.vertical', icon: 'distribute-v', text: 'Vertically' }),
      ]),
    ]),
    section('Size', [
      row([
        field('Width', () => shared(live().map((el) => sizeOf(el).w)), (w) => run('arrange.setSize', { w, els: live() }), sized, 1),
        field('Height', () => shared(live().map((el) => sizeOf(el).h)), (h) => run('arrange.setSize', { h, els: live() }), sized, 1),
      ]),
      note(() => (!els.length || sized() ? '' : els.length === 1 && els[0].querySelector('img, video') ? 'Set by the layout of the slide. Click the image again to size it.' : 'Set by the layout of the slide.')),
      row([button(app, run, { command: 'arrange.resetSize', icon: 'reset', text: 'Reset Size' })]),
    ]),
    section('Position', [
      row([
        field('X', () => shared(live().map((el) => offsetOf(el).x)), (x) => run('arrange.setPosition', { x, els: live() }), () => live().length > 0),
        field('Y', () => shared(live().map((el) => offsetOf(el).y)), (y) => run('arrange.setPosition', { y, els: live() }), () => live().length > 0),
      ]),
      note(() => 'The offset from the place of the element in the layout.'),
      row([button(app, run, { command: 'arrange.resetPosition', icon: 'reset', text: 'Reset Position' })]),
    ]),
  ];
}
