// the commands of the selection on the canvas and of the Arrange menu: Select All, Deselect, the
// ladder of Esc from a text to its block to nothing, Return into the text of a block, Tab between
// the elements, the nudges by 1 and 10 slide pixels, and the reset of a place or a width. their keys
// are run by the one keyboard dispatch of commands.ts

import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import type { Command } from '../commands.ts';
import { CONTAINER, RESIZABLE, containerOf, frameRect, mediaIn, movableOf, movablesOf, objectsOf, pictureOf } from '../canvas/hit.ts';
import type { Place } from '../canvas/drag.ts';
import { placeOf, record, withCorners, writePlace } from '../canvas/drag.ts';
import { view, xy } from '../canvas/frames.ts';
import { fieldOf } from './order.ts';
import { cornerBoxOf } from './align.ts';
import { onSlides } from './slide.ts';

// the nudges of the same elements closer than this, in ms, are one entry of the history
const PAUSE = 1000;

// whether the focus is on the canvas itself, i.e. on nothing, on a figure, or on the handle of a
// block, and not on a button of the chrome
function onCanvas(): boolean {
  const a = document.activeElement;
  return !a || a === document.body || a.classList.contains('beeson-handle') || (!!a.closest('.reveal .slides') && !a.closest(HOST));
}

// the elements that Reset Position and Reset Size act on, without the shapes, whose place and size
// are set in their style alone
const resettable = (els: Element[]) => els.filter((el) => !el.matches('.shape'));

// the caret at the end of the text of el
function caretAtEnd(el: Element): void {
  (el as HTMLElement).focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const s = getSelection();
  s?.removeAllRanges();
  s?.addRange(range);
}

// the run of nudges in progress: the time of its last nudge, and its changes, whose destinations
// each nudge of the run moves. a run ends at a pause, at another selection, and when an element is
// no longer where the run put it, e.g. after a drag or an undo
let run: { at: number; changes: { el: Element; from: Place; to: Place }[] } | null = null;

const samePlace = (a: Place, b: Place) => (a.translate?.x ?? 0) === (b.translate?.x ?? 0) && (a.translate?.y ?? 0) === (b.translate?.y ?? 0) && a.width === b.width;

// the elements that a move acts on, i.e. the figure of a picture selected inside it, and the pictures
// that a size acts on, i.e. the shown picture of a figure
const movedEls = (app: App): Element[] => objectsOf(app, app.selection.elements());
const sizedEls = (app: App): Element[] => movedEls(app).map((el) => (el.matches(CONTAINER) ? pictureOf(el) : el));

function nudge(app: App, dx: number, dy: number): void {
  const els = movedEls(app);
  if (!els.length) return;
  const now = performance.now();
  const same = !!run && now - run.at < PAUSE && run.changes.length === els.length && run.changes.every((c, i) => c.el === els[i] && samePlace(placeOf(c.el), c.to));
  const changes = els.map((el) => {
    const from = placeOf(el);
    writePlace(app, el, { ...from, translate: { x: (from.translate?.x ?? 0) + dx, y: (from.translate?.y ?? 0) + dy } });
    return { el, from, to: placeOf(el) };
  });
  if (same && run) {
    run.at = now;
    run.changes.forEach((c, i) => (c.to = changes[i].to));
  } else run = { at: now, changes: record(app, 'move', changes) };
  // the upper left corner of the elements on the slide that the fields X and Y give, at the lower
  // right of the frames
  const boxes = els.map(frameRect);
  const c = cornerBoxOf(app, els, els[0]);
  view.readout = { text: xy(c.left, c.top), x: Math.max(...boxes.map((b) => b.left + b.width)) + 6, y: Math.max(...boxes.map((b) => b.top + b.height)) + 10, at: 'frame' };
  app.invalidate('content');
}

// the next movable element of the slide after the one selected, or before it with back
function step(app: App, back: boolean): void {
  const list = movablesOf(app);
  if (!list.length) return;
  const sel = app.selection.elements();
  const at = sel.length ? list.indexOf(sel[back ? 0 : sel.length - 1]) : -1;
  const next = at < 0 ? list[back ? list.length - 1 : 0] : list[(at + (back ? -1 : 1) + list.length) % list.length];
  app.selection.set('elements', [next]);
  if (next.classList.contains('beeson-movable')) (next as HTMLElement).focus({ preventScroll: true });
  else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
}

const ARROWS: [string, string, number, number][] = [['left', 'ArrowLeft', -1, 0], ['right', 'ArrowRight', 1, 0], ['up', 'ArrowUp', 0, -1], ['down', 'ArrowDown', 0, 1]];

export function commands(): Command[] {
  const list: Command[] = [
    {
      id: 'selection.all',
      label: 'Select All',
      keys: { mac: ['Mod+A'], other: ['Mod+A'] },
      // in a text, the first one selects the text of the block and the next one every element
      in: ['canvas', 'text'],
      menu: { bar: 'Edit', group: 'select', order: 31 },
      context: ['canvas'],
      enabled: (app) => (onSlides(app) ? app.commands.enabled('slide.selectAll') : !!fieldOf(app) || (!!app.current() && (onCanvas() || app.selection.kind === 'text'))),
      listedAs: (app) => (onSlides(app) ? 'slide.selectAll' : 'selection.all'),
      runsAs: (app) => (onSlides(app) ? 'slide.selectAll' : 'selection.all'),
      run: (app) => {
        if (onSlides(app)) return app.commands.run('slide.selectAll');
        // in a line of the outline or a field of a pane, the text of the line or of the field
        const field = fieldOf(app);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return field.select();
        if (field) return void getSelection()?.selectAllChildren(field);
        app.selection.selectAll();
      },
    },
    {
      // Esc on an image selected inside its figure selects the figure, and else clears
      id: 'selection.clear',
      label: 'Deselect',
      // ⇧⌘A is Deselect All of Keynote
      keys: { mac: ['Mod+Shift+A', 'Escape'], other: ['Mod+Shift+A', 'Escape'] },
      in: ['canvas'],
      menu: { bar: 'Edit', group: 'select', order: 32 },
      enabled: (app) => app.selection.kind === 'elements' || app.selection.kind === 'text',
      run: (app) => {
        const only = app.selection.only();
        const up = only?.matches(RESIZABLE) ? containerOf(app, only) : null;
        const a = document.activeElement;
        if (a instanceof HTMLElement && (app.selection.items.some((el) => el.contains(a)) || a.classList.contains('beeson-handle'))) a.blur();
        if (up) app.selection.set('elements', [up]);
        else app.selection.clear();
      },
    },
    {
      // ⇧⌘A of Deselect in a text, as the item of the menu, which leaves the text with nothing
      // selected. Esc in a text is Select Block
      id: 'selection.clearText',
      label: 'Deselect',
      keys: { mac: ['Mod+Shift+A'], other: ['Mod+Shift+A'] },
      in: ['text'],
      enabled: (app) => app.commands.enabled('selection.clear'),
      run: (app) => app.commands.run('selection.clear'),
    },
    {
      // the figure around an image, a video, or a QR code selected by a second click on it, as Esc
      // selects it
      id: 'selection.container',
      label: 'Select Figure',
      menu: { bar: 'Edit', group: 'select', order: 33 },
      context: ['element'],
      enabled: (app) => {
        const only = app.selection.only();
        return !!only && only.matches(RESIZABLE) && !!containerOf(app, only);
      },
      run: (app) => {
        const only = app.selection.only();
        const up = only ? containerOf(app, only) : null;
        if (up) app.selection.set('elements', [up]);
      },
    },
    {
      id: 'selection.leaveText',
      label: 'Select Block',
      keys: { mac: ['Escape'], other: ['Escape'] },
      in: ['text'],
      enabled: (app) => !!app.hostOf(document.activeElement),
      run: (app) => {
        const host = app.hostOf(document.activeElement) as HTMLElement;
        host.blur();
        app.selection.set('elements', [movableOf(app, host) ?? host]);
      },
    },
    {
      // Return puts the caret at the end of the text of a block. the command is enabled only on an
      // element that holds a block, since Keynote offers Edit Text only on an element with text
      id: 'selection.editText',
      label: 'Edit Text',
      keys: { mac: ['Enter'], other: ['Enter'] },
      in: ['canvas'],
      context: ['element'],
      enabled: (app) => {
        const el = app.selection.only();
        if (!el || document.activeElement?.classList.contains('beeson-handle')) return false;
        return el.matches(HOST) || !!el.querySelector(HOST);
      },
      run: (app) => {
        const el = app.selection.only() as Element;
        const host = el.matches(HOST) ? el : [...el.querySelectorAll(HOST)].at(-1);
        if (host) caretAtEnd(host);
      },
    },
    {
      // Return on a figure without text selects its image or video, unless the figure is locked
      id: 'selection.selectMedia',
      label: 'Select Image',
      keys: { mac: ['Enter'], other: ['Enter'] },
      in: ['canvas'],
      enabled: (app) => {
        const el = app.selection.only();
        if (!el || document.activeElement?.classList.contains('beeson-handle') || el.querySelector(HOST) || el.hasAttribute('data-locked')) return false;
        return !!mediaIn(el, el.querySelector('img, video'));
      },
      run: (app) => {
        const el = app.selection.only() as Element;
        const media = [...el.querySelectorAll('img, video')].find((m) => m.getBoundingClientRect().width > 0);
        if (media) app.selection.set('elements', [media]);
      },
    },
    {
      id: 'selection.next',
      label: 'Select Next Element',
      keys: { mac: ['Tab'], other: ['Tab'] },
      in: ['canvas'],
      enabled: (app) => onCanvas() && movablesOf(app).length > 0,
      run: (app) => step(app, false),
    },
    {
      id: 'selection.previous',
      label: 'Select Previous Element',
      keys: { mac: ['Shift+Tab'], other: ['Shift+Tab'] },
      in: ['canvas'],
      enabled: (app) => onCanvas() && movablesOf(app).length > 0,
      run: (app) => step(app, true),
    },
    {
      id: 'arrange.resetPosition',
      label: 'Reset Position',
      menu: { bar: 'Arrange', group: 'reset', order: 10 },
      context: ['element'],
      enabled: (app) => resettable(movedEls(app)).some((el) => placeOf(el).translate),
      run: (app) => {
        const els = resettable(movedEls(app));
        const changes = els.map((el) => {
          const from = placeOf(el);
          const to = { ...from, translate: null };
          writePlace(app, el, to);
          return { el, from, to };
        });
        record(app, 'move', changes);
      },
    },
    {
      id: 'arrange.resetSize',
      label: 'Reset Size',
      menu: { bar: 'Arrange', group: 'reset', order: 11 },
      context: ['element'],
      enabled: (app) => resettable(sizedEls(app)).some((el) => placeOf(el).width !== null || (placeOf(el).height ?? null) !== null),
      run: (app) => {
        const els = resettable(sizedEls(app));
        const changes = withCorners(app, els, () => els.map((el) => {
          const from = placeOf(el);
          const to = { ...from, width: null, ...(from.height !== undefined ? { height: null } : {}) };
          writePlace(app, el, to);
          return { el, from, to };
        }));
        record(app, 'resize', changes);
      },
    },
  ];
  for (const [name, key, x, y] of ARROWS) {
    for (const far of [false, true]) {
      list.push({
        id: `arrange.nudge.${name}${far ? '.far' : ''}`,
        label: `Nudge ${name[0].toUpperCase()}${name.slice(1)}${far ? ' by 10' : ''}`,
        keys: { mac: [`${far ? 'Shift+' : ''}${key}`], other: [`${far ? 'Shift+' : ''}${key}`] },
        in: ['canvas'],
        enabled: (app) => app.selection.elements().length > 0,
        run: (app) => nudge(app, x * (far ? 10 : 1), y * (far ? 10 : 1)),
      });
    }
  }
  return list;
}

export function install(app: App): void {
  for (const c of commands()) app.commands.define(c);
  app.selection.listen(() => (run = null));
}
