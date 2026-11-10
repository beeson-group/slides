// the Slide pane of the Format tab, shown with nothing selected, as the Slide pane of Keynote: the
// layout of the slide in a card, the width of the text column of a content slide as the class
// narrow or wide of its section, whether the slide is hidden and has a footnote, and the running
// head, i.e. the data-run of a section slide. the commands of the width, the footnote, and the
// running head are defined here, the width also in Slide > Text Column

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { button, card, checkbox, note, row, section, segmented, textField, type Control, type Run } from './controls.ts';

const SVG = 'http://www.w3.org/2000/svg';

export type Width = 'narrow' | 'normal' | 'wide';
const WIDTHS: Width[] = ['narrow', 'normal', 'wide'];
const LAYOUT_CLASSES = ['title', 'section', 'closing', 'figure', 'split'];
const LAYOUT_NAMES: Record<string, string> = { title: 'Title', section: 'Section', closing: 'Closing', figure: 'Figure', split: 'Split', content: 'Content' };

export const layoutOf = (slide: Element | null): string => LAYOUT_CLASSES.find((c) => slide?.classList.contains(c)) ?? 'content';
export const widthOf = (slide: Element): Width => (slide.classList.contains('narrow') ? 'narrow' : slide.classList.contains('wide') ? 'wide' : 'normal');

// the slides of the commands: those selected in the navigator, else the current one
function slidesOf(app: App): Element[] {
  const picked = app.selection.kind === 'slides' ? [...app.selection.items] : [app.current()].filter((s): s is Element => !!s);
  return picked.filter((s) => !!app.pairing?.elements.get(s)?.open);
}

const contentSlides = (app: App) => {
  const list = slidesOf(app);
  return list.length && list.every((s) => layoutOf(s) === 'content') ? list : [];
};

const footOf = (slide: Element | null) => slide?.querySelector('.foot:not([data-generated])') ?? null;

export function commands(): Command[] {
  const list: Command[] = WIDTHS.map((w, i) => ({
    id: `slide.width.${w}`,
    label: w === 'narrow' ? 'Narrow' : w === 'wide' ? 'Wide' : 'Normal',
    menu: { bar: 'Slide', group: 'width', order: 60 + i, submenu: 'Text Column' },
    undoable: true,
    enabled: (app) => contentSlides(app).length > 0,
    checked: (app) => {
      const list = contentSlides(app);
      return list.length > 0 && list.every((s) => widthOf(s) === w);
    },
    run: (app) => {
      for (const s of contentSlides(app)) {
        if (widthOf(s) === w) continue;
        const classes: Record<string, boolean> = {};
        if (s.classList.contains('narrow') !== (w === 'narrow')) classes.narrow = w === 'narrow';
        if (s.classList.contains('wide') !== (w === 'wide')) classes.wide = w === 'wide';
        app.doc.setTag(s, { classes }, 'width');
      }
      app.relayout();
    },
  }));
  list.push({
    // arg is { value, el }. an empty text takes data-run off, and the heading is the running head
    id: 'slide.runningHead',
    label: 'Running Head',
    undoable: true,
    enabled: (app) => layoutOf(app.current()) === 'section' && slidesOf(app).length > 0,
    run: (app, arg) => {
      const a = (arg ?? {}) as { value?: string; el?: Element };
      const slide = a.el?.isConnected ? a.el : app.current();
      if (!slide || typeof a.value !== 'string') return;
      const value = a.value.trim() ? a.value : null;
      if (slide.getAttribute('data-run') !== value) app.doc.setTag(slide, { attrs: { 'data-run': value } }, 'running head');
    },
  });
  list.push({
    // the footnote of the slide is added by insert.footnote of the Insert menu, with the caret in it,
    // and taken off with its text
    id: 'slide.footnote',
    label: 'Footnote',
    undoable: true,
    enabled: (app) => !!app.pairing && (!!footOf(app.current()) || !!app.commands.get('insert.footnote')),
    checked: (app) => !!footOf(app.current()),
    run: async (app) => {
      const foot = footOf(app.current());
      if (foot && app.pairing?.elements.get(foot)?.open) await app.doc.remove(foot, 'remove footnote');
      else if (!foot) await app.commands.run('insert.footnote');
    },
  });
  return list;
}

// a sketch of a layout, in the tokens of the chrome: the slide, its words, and its figure
function sketch(layout: string, width: Width): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 64 36');
  svg.setAttribute('width', '64');
  svg.setAttribute('height', '36');
  svg.setAttribute('aria-hidden', 'true');
  const rect = (x: number, y: number, w: number, h: number, fill: string, r = 0.75) => {
    const el = document.createElementNS(SVG, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: w, height: h, rx: r, fill })) el.setAttribute(k, String(v));
    svg.append(el);
  };
  rect(0.5, 0.5, 63, 35, 'var(--ed-panel)', 3);
  const frame = document.createElementNS(SVG, 'rect');
  for (const [k, v] of Object.entries({ x: 0.5, y: 0.5, width: 63, height: 35, rx: 3, fill: 'none', stroke: 'var(--ed-line)' })) frame.setAttribute(k, String(v));
  const ink = 'var(--ed-muted)', faint = 'var(--ed-faint)';
  const words = (x: number, y: number, w: number, lines: number) => {
    rect(x, y, w * 0.8, 2.6, ink);
    for (let i = 0; i < lines; i++) rect(x, y + 5 + i * 3.2, i === lines - 1 ? w * 0.6 : w, 1.4, faint);
  };
  switch (layout) {
    case 'title':
    case 'closing':
      rect(30, 4, 30, 24, faint, 10);
      words(5, 20, 22, 2);
      break;
    case 'section':
      rect(34, 3, 26, 30, faint, 13);
      words(5, 8, 22, 3);
      break;
    case 'figure':
      rect(4, 4, 56, 21, faint);
      rect(4, 28, 30, 1.4, ink);
      rect(4, 31, 20, 1.4, faint);
      break;
    case 'split':
      rect(0.5, 0.5, 26, 35, ink, 3);
      rect(31, 6, 29, 24, faint);
      break;
    default: {
      const w = width === 'narrow' ? 22 : width === 'wide' ? 40 : 30;
      words(5, 5, w, 5);
      rect(w + 9, 6, 59 - (w + 9), 24, faint);
    }
  }
  svg.append(frame);
  return svg;
}

// the Slide pane for the current slide
export function slidePane(app: App, run: Run): Control[] {
  const slide = app.current();
  const layout = layoutOf(slide);
  const parts: Control[] = [card(() => sketch(layoutOf(app.current()), slide ? widthOf(slide) : 'normal'), 'Slide Layout', () => {
    const s = app.current();
    const name = LAYOUT_NAMES[layoutOf(s)];
    return s && layoutOf(s) === 'content' && widthOf(s) !== 'normal' ? `${name}, ${widthOf(s) === 'narrow' ? 'Narrow' : 'Wide'}` : name;
  })];
  if (layout === 'content') {
    parts.push(section('Text Column', [
      row([segmented(app, run, WIDTHS.map((w) => ({ command: `slide.width.${w}`, icon: `column-${w}`, text: w === 'narrow' ? 'Narrow' : w === 'wide' ? 'Wide' : 'Normal' })), 'Width of the text column')]),
      note(() => 'The width of the column of words, 1000 px when normal.'),
    ]));
  }
  parts.push(section('Appearance', [
    checkbox(app, run, 'slide.hide', 'Hidden in the show', () => app.current()?.getAttribute('data-visibility') === 'hidden'),
    checkbox(app, run, 'slide.footnote', 'Footnote'),
  ]));
  // the transition of the slide and its time in a rehearsal, defined in commands/review.ts
  if (app.commands.get('slide.transition.fade')) {
    const kinds = [['none', 'None'], ['fade', 'Fade'], ['magic', 'Magic Move']];
    parts.push(section('Transition', [
      row([segmented(app, run, kinds.map(([t, text]) => ({ command: `slide.transition.${t}`, text })), 'Transition to the next slide')]),
      button(app, run, { command: 'slide.magicMove', text: 'Magic Move to Copy' }),
      note(() => {
        const t = app.current()?.getAttribute('data-timing');
        return t ? `Rehearsed time ${t} s` : '';
      }),
    ]));
  }
  if (layout === 'section') {
    parts.push(section(null, [textField(app, {
      label: 'Running Head',
      name: 'running-head',
      placeholder: () => app.current()?.querySelector('h2')?.textContent?.trim() ?? '',
      value: () => app.current()?.getAttribute('data-run') ?? '',
      enabled: () => app.commands.enabled('slide.runningHead'),
      commit: (value) => run('slide.runningHead', { value, el: slide }),
      hint: () => ({ text: 'Shown at the top of the slides of this section. Leave it empty to show the heading.', warn: false }),
    })]));
  } else if (!['title', 'closing'].includes(layout)) {
    parts.push(section('Running Head', [note(() => {
      const run = app.current()?.querySelector(':scope > .run[data-generated]')?.textContent?.trim();
      return run ? `“${run}”, from the last section slide` : 'None before the first section slide';
    })]));
  }
  return parts;
}
