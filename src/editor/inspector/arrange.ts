// the Arrange pane of the Format tab, as the Arrange tab of Keynote: Align with its reference,
// Distribute, the size in W and H, the position in X and Y, and the angle, each with its reset,
// with Flip Horizontal and Flip Vertical for an image, then the order of the elements, Group and
// Ungroup, and Lock and Unlock. X and Y are the offset of an element from its place in the file,
// and W and H its size, in slide pixels. W and H are set on an image, a video, a QR code, and a
// tycho viewer, and W alone on a text block, whose height follows its wrapped text. the size of
// every other element is set by its layout

import type { App } from '../app.ts';
import { boxOf, heightSet, offsetOf, resizable, sizeOf, targetsOf } from '../commands/align.ts';
import { angleOf, groupOf } from '../commands/order.ts';
import { imageOf } from '../commands/figure.ts';
import { locked } from '../canvas/drag.ts';
import { GLYPHS, button, checkbox, note, numberField, row, section, segmented, type Control, type Run } from './controls.ts';

// the glyphs of the order, the groups, and the locks, on the grid of GLYPHS
Object.assign(GLYPHS, {
  'order-front': ['M3.5 7.5h9v9h-9z', 'F7.5 3.5h9v9h-9z'],
  'order-forward': ['M5 9.5h10v7H5z', 'M10 7V2.5', 'M8 4.5l2-2 2 2'],
  'order-backward': ['M5 3.5h10v7H5z', 'M10 13v4.5', 'M8 15.5l2 2 2-2'],
  'order-back': ['M7.5 3.5h9v9h-9z', 'F3.5 7.5h4v9h-4zM7.5 12.5h5v4h-5z'],
  group: ['M5 5h5.5v5.5H5z', 'M9.5 9.5H15V15H9.5z', 'M2.5 4.5v-2h2', 'M15.5 2.5h2v2', 'M17.5 15.5v2h-2', 'M4.5 17.5h-2v-2'],
  ungroup: ['M3.5 3.5H9V9H3.5z', 'M11 11h5.5v5.5H11z'],
  lock: ['M5.5 9h9v7.5h-9z', 'M7.5 9V6.5a2.5 2.5 0 0 1 5 0V9'],
  unlock: ['M5.5 9h9v7.5h-9z', 'M7.5 9V6.5a2.5 2.5 0 0 1 4.9-.7'],
  'flip-h': ['M10 2.5v15', 'M8 5.5 3 14.5h5z', 'F12 5.5l5 9h-5z'],
  'flip-v': ['M2.5 10h15', 'M5.5 8 14.5 3v5z', 'F5.5 12l9 5v-5z'],
});

// the value shared by every element, or null when they differ
const shared = (values: number[]): number | null => (values.length && values.every((v) => Math.round(v) === Math.round(values[0])) ? values[0] : null);

// the box of a selection that is one whole group, in slide pixels, or null
function groupBox(app: App, els: Element[]): { w: number; h: number } | null {
  const id = els.length > 1 ? groupOf(els[0]) : null;
  if (!id || !els.every((el) => groupOf(el) === id)) return null;
  const boxes = els.map((el) => boxOf(app, el));
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  return { w: Math.max(...boxes.map((b) => b.left + b.width)) - left, h: Math.max(...boxes.map((b) => b.top + b.height)) - top };
}

export function arrangePane(app: App, run: Run): Control[] {
  // the fields act on the elements selected when the pane was built
  const els = targetsOf(app);
  const live = () => els.filter((el) => el.isConnected);
  // W and H of a group are the size of its box, as in Keynote, which its corner grips scale
  const group = () => groupBox(app, live());
  const sized = () => !group() && resizable(live());
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
        field('Width', () => group()?.w ?? shared(live().map((el) => sizeOf(el).w)), (w) => run('arrange.setSize', { w, els: live() }), sized, 1),
        field('Height', () => group()?.h ?? shared(live().map((el) => sizeOf(el).h)), (h) => run('arrange.setSize', { h, els: live() }), () => !group() && heightSet(live()), 1),
      ]),
      note(() => (!els.length || sized() ? '' : group() ? 'The size of the group. Drag a corner grip to scale it.' : els.length === 1 && els[0].querySelector('img, video') ? 'Set by the layout of the slide. Click the image again to size it.' : 'Set by the layout of the slide.')),
      row([checkbox(app, run, 'arrange.constrainProportions', 'Constrain Proportions')]),
      note(() => (sized() && !app.commands.state('arrange.constrainProportions').enabled ? 'Only the width is written, and the height follows the aspect or the layout.' : '')),
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
    section('Rotate', [
      row([
        numberField(app, {
          label: 'Angle',
          unit: '°',
          value: () => shared(live().map(angleOf)),
          commit: (deg) => run('arrange.setRotation', { deg, els: live() }),
          enabled: () => live().some((el) => !locked(el)),
        }),
      ]),
      row([button(app, run, { command: 'arrange.resetRotation', icon: 'reset', text: 'Reset Rotation' })]),
      // a flip is offered for an image only
      ...(imageOf(app) ? [row([
        button(app, run, { command: 'arrange.flipHorizontal', icon: 'flip-h', text: 'Flip Horizontal' }),
        button(app, run, { command: 'arrange.flipVertical', icon: 'flip-v', text: 'Flip Vertical' }),
      ])] : []),
    ]),
    section('Arrange', [
      row([segmented(app, run, [
        { command: 'arrange.order.back', icon: 'order-back' },
        { command: 'arrange.order.backward', icon: 'order-backward' },
        { command: 'arrange.order.forward', icon: 'order-forward' },
        { command: 'arrange.order.front', icon: 'order-front' },
      ], 'Order')], 'Order'),
      row([
        button(app, run, { command: 'arrange.group', icon: 'group', text: 'Group' }),
        button(app, run, { command: 'arrange.ungroup', icon: 'ungroup', text: 'Ungroup' }),
      ]),
      row([
        button(app, run, { command: 'arrange.lock', icon: 'lock', text: 'Lock' }),
        button(app, run, { command: 'arrange.unlock', icon: 'unlock', text: 'Unlock' }),
      ]),
    ]),
  ];
}
