// the commands of the selection on the canvas and of the Arrange menu: Select All, Deselect, the
// ladder of Esc from a text to its block to nothing, Return into the text of a block, Tab between
// the elements, the nudges by 1 and 10 slide pixels, and the reset of a place or a width. their keys
// are run by the one keyboard dispatch of commands.ts

import type { App } from '../app.ts';
import { HOST } from '../app.ts';
import type { Command } from '../commands.ts';
import { CONTAINER, RESIZABLE, containerOf, frameRect, linesOf, mediaIn, movableOf, movablesOf, objectsOf, pictureOf, turnable } from '../canvas/hit.ts';
import type { Place } from '../canvas/drag.ts';
import { placeOf, record, withCorners, writePlace } from '../canvas/drag.ts';
import { followAgain } from '../model/glue.ts';
import { view, xy } from '../canvas/frames.ts';
import { angleOf, drawnUnder, fieldOf, groupAngle, groupOf, leaveGroup, selectIn } from './order.ts';
import { cornerBoxOf } from './align.ts';
import { nudgeBackdrop, slideBackdrop } from './backdrop.ts';
import { groupsOf } from '../model/groups.ts';
import { onSlides } from './slide.ts';
import { injectStyle } from '../ui/dom.ts';

// a ghosted step is drawn ghosted while every step is shown at full opacity, as in theme/beeson.css
const CSS = `html.beeson-editing .reveal .slides section .fragment.ghost { opacity: 0.25 !important; }`;

// the objects that Ghosted acts on: the figure of a picture selected inside it, a block, a line
const ghostEls = (app: App): Element[] => movedEls(app).filter((el) => el.localName !== 'section' && !!app.pairing?.elements.get(el)?.open);
const ghosted = (app: App): boolean => {
  const els = ghostEls(app);
  return els.length > 0 && els.every((el) => el.classList.contains('ghost'));
};

// the nudges of the same elements closer than this, in ms, are one entry of the history
const PAUSE = 1000;

// whether the focus is on the canvas itself, i.e. on nothing, on a figure, or on the handle of a
// block, and not on a button of the chrome
function onCanvas(): boolean {
  const a = document.activeElement;
  return !a || a === document.body || a.classList.contains('beeson-handle') || (!!a.closest('.reveal .slides') && !a.closest(HOST));
}

// the elements that Reset Position and Reset Size act on, without the shapes, whose place and size
// are set in their style alone, and the backdrops, whose box Reset Slide puts back
const resettable = (els: Element[]) => els.filter((el) => !el.matches('.shape, .backdrop'));

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
  // a selected backdrop is not moved, and its drawing is panned instead
  if (nudgeBackdrop(app, dx, dy)) return;
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
    followAgain(app);
  } else run = { at: now, changes: record(app, 'move', changes) };
  // the upper left corner of the elements on the slide that the fields X and Y give, at the lower
  // right of the frames
  const boxes = els.map(frameRect);
  const c = cornerBoxOf(app, els, els[0]);
  view.readout = { text: xy(c.left, c.top), x: Math.max(...boxes.map((b) => b.left + b.width)) + 6, y: Math.max(...boxes.map((b) => b.top + b.height)) + 10, at: 'frame' };
  app.invalidate('content');
}

// the objects of the current slide as the rows of the Object List of navigator/objects.ts, from
// front to back: a group as one row at the place of its member in front, and the backdrop last
function rowsOf(app: App): Element[][] {
  const found = [...movablesOf(app), ...linesOf(app)];
  const els = found.filter((el) => !found.some((o) => o !== el && o.contains(el))).sort((a, b) => (drawnUnder(a, b) ? 1 : -1));
  const rows: Element[][] = [];
  const done = new Set<string>();
  for (const el of els) {
    const g = groupsOf(el)[0];
    const members = g ? els.filter((m) => groupsOf(m)[0] === g) : [];
    if (members.length < 2) rows.push([el]);
    else if (!done.has(g)) {
      done.add(g);
      rows.push(members);
    }
  }
  const ground = slideBackdrop(app);
  return ground ? [...rows, [ground]] : rows;
}

// the row of the Object List in front of the selected one, or behind it with back, around both
// ends, as Tab and Shift+Tab walk the objects from back to front in Keynote and PowerPoint. a
// locked object is selected as by a click
function step(app: App, back: boolean): void {
  const rows = rowsOf(app).reverse();
  if (!rows.length) return;
  const sel = objectsOf(app, app.selection.elements());
  const at = rows.flatMap((r, i) => (r.some((el) => sel.includes(el)) ? [i] : []));
  const i = at.length ? (back ? at[0] - 1 : at[at.length - 1] + 1) : back ? -1 : 0;
  const next = rows[(i + rows.length) % rows.length];
  selectIn(app, [], next);
  if (next[0].classList.contains('beeson-movable')) (next[0] as HTMLElement).focus({ preventScroll: true });
  else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
}

const ARROWS: [string, string, number, number][] = [['left', 'ArrowLeft', -1, 0], ['right', 'ArrowRight', 1, 0], ['up', 'ArrowUp', 0, -1], ['down', 'ArrowDown', 0, 1]];

// each selected object turned by a quarter turn about its own center, a whole group about the
// center of its frame, as Rotate Left 90° and Rotate Right 90° of PowerPoint
async function quarter(app: App, by: number): Promise<void> {
  const els = app.selection.elements().filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
  const units = new Map<Element | string, Element[]>();
  for (const el of els) units.set(groupOf(el) ?? el, [...(units.get(groupOf(el) ?? el) ?? []), el]);
  for (const unit of units.values()) {
    const deg = unit.length > 1 ? groupAngle(app, unit) : turnable(unit[0]) ? angleOf(unit[0]) : null;
    if (deg !== null) await app.commands.run('arrange.setRotation', { deg: deg + by, els: unit });
  }
}

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
        // in a field of a pane, the text of the field
        const field = fieldOf(app);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return field.select();
        if (field) return void getSelection()?.selectAllChildren(field);
        app.selection.selectAll();
      },
    },
    {
      // Esc on an image selected inside its figure selects the figure, inside an entered group the
      // group, and else clears
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
        else if (!leaveGroup(app)) app.selection.clear();
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
      label: 'Select Next Object',
      keys: { mac: ['Tab'], other: ['Tab'] },
      in: ['canvas'],
      enabled: (app) => onCanvas() && rowsOf(app).length > 0,
      run: (app) => step(app, false),
    },
    {
      id: 'selection.previous',
      label: 'Select Previous Object',
      keys: { mac: ['Shift+Tab'], other: ['Shift+Tab'] },
      in: ['canvas'],
      enabled: (app) => onCanvas() && rowsOf(app).length > 0,
      run: (app) => step(app, true),
    },
    {
      // the opacity of Keynote and PowerPoint as one token of the theme, the class ghost, on every
      // selected object, or off every one when each is ghosted
      id: 'arrange.ghost',
      label: 'Ghosted',
      in: ['canvas'],
      undoable: true,
      enabled: (app) => ghostEls(app).length > 0,
      checked: ghosted,
      run: (app) => {
        const on = !ghosted(app);
        for (const el of ghostEls(app)) if (el.classList.contains('ghost') !== on) app.doc.setTag(el, { classes: { ghost: on } }, 'ghost');
        app.markDirty();
        app.invalidate('content');
      },
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
      undoable: true,
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
        // object-fit contain, which a typed size writes with the box of a letterboxed picture, does
        // not change a picture without a width and a height, hence it is taken off with them
        for (const el of els) if ((el as HTMLElement).style.objectFit === 'contain') app.doc.setTag(el, { style: { 'object-fit': null } }, 'resize');
        app.invalidate('content');
      },
    },
    ...([['Left', -90], ['Right', 90]] as const).map(([side, by], i): Command => ({
      id: `arrange.rotate${side}`,
      label: `Rotate ${side} 90°`,
      menu: { bar: 'Arrange', group: 'rotate', order: 13 + i / 2 },
      context: ['element'],
      undoable: true,
      enabled: (app) => app.commands.enabled('arrange.setRotation'),
      run: (app) => quarter(app, by),
    })),
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
  injectStyle('arrange', CSS);
  for (const c of commands()) app.commands.define(c);
  app.selection.listen(() => (run = null));
}
