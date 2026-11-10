// the commands of the show and of the review of a deck, after the Play menu of Keynote and the
// Slide Show and Review tabs of PowerPoint, and the transition at the head of the Steps tab. the
// Play menu holds Present and Present from Start, moved from the File menu, the presenter view,
// the rehearsal of timings, Use Rehearsed Timings, and Clear Timings. the Slide menu holds the
// transition of a slide, Magic Move, and Preview Transition, and the View menu the light table and
// the accessibility checker. Present keeps the keys of PowerPoint, since F5 reloads the page, and
// the presenter view takes Alt+Enter, the key of PowerPoint on a Mac. the light table is not given
// a key, since Chrome takes Mod+1 to Mod+9 for its tabs

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS } from '../commands.ts';
import type { Navigator } from '../navigator/navigator.ts';
import { Sorter } from '../navigator/sorter.ts';
import { playTimings, Presenter, useTimings, usingTimings } from '../present.ts';
import { Checker, useHeaderRow } from '../review/accessibility.ts';
import { install as installAnimate } from '../review/animate.ts';
import { magicMoveCopy, nextShown, paired, preview, setTransition, transitionOf, type Transition } from '../review/transitions.ts';
import { MENUS } from '../shell/menubar.ts';

// the Play menu after the View menu, as in Keynote, added before the menu bar is built at its
// install
if (!MENUS.includes('Play')) MENUS.splice(MENUS.indexOf('View') + 1, 0, 'Play');

const navOf = (app: App): Navigator => app.nav as Navigator;
const ready = (app: App): boolean => !!app.pairing?.root;
const slidesOf = (app: App): Element[] => [...app.slides().querySelectorAll(':scope > section')];
const targets = (app: App): Element[] => (ready(app) ? navOf(app).selected().filter((s) => paired(app, s)) : []);

// the window of the show that fn opens, if any. window.open is wrapped for the time of the call,
// and a show that was not opened, e.g. after Cancel on the card of the unsaved changes, is
// returned as not opened
async function capture(fn: () => unknown): Promise<{ opened: boolean; win: Window | null }> {
  const real = window.open;
  let opened = false;
  let win: Window | null = null;
  window.open = (...args: Parameters<typeof window.open>) => {
    opened = true;
    win = real.apply(window, args);
    return win;
  };
  try {
    await fn();
  } finally {
    window.open = real;
  }
  return { opened, win };
}

// the show opened through Present or Present from Start, with the window of its tab
const openShow = (app: App, fromStart: boolean) => capture(() => app.commands.run(fromStart ? 'file.presentStart' : 'file.present'));

export function install(app: App): void {
  const c = app.commands;
  const presenter = new Presenter(app);
  const sorter = new Sorter(app);
  const checker = new Checker(app);
  const play = (order: number) => ({ bar: 'Play', group: 'play', order });
  // with Use Rehearsed Timings on, the show opened by Present or Present from Start, also under
  // the presenter view, is moved on after the timings of its slides
  for (const [id, order] of [['file.present', 10], ['file.presentStart', 11]] as const) {
    const command = c.get(id);
    if (!command) continue;
    command.menu = play(order);
    const run = command.run;
    command.run = async (a, arg) => {
      const { win } = await capture(() => run(a, arg));
      if (win && usingTimings()) void playTimings(win);
    };
  }
  const showing = () => presenter.isOpen;

  c.define({
    id: 'play.presenter',
    label: 'Presenter View',
    keys: { mac: ['Alt+Enter'], other: ['Alt+Enter'] },
    in: OUTSIDE_DIALOGS,
    menu: play(20),
    enabled: (a) => ready(a) && !showing(),
    run: async (a) => {
      const from = a.current();
      const { opened, win } = await openShow(a, false);
      if (opened) void presenter.open('present', from, win);
    },
  });
  c.define({
    id: 'play.rehearse',
    label: 'Rehearse Timings',
    menu: { bar: 'Play', group: 'timing', order: 30 },
    enabled: (a) => ready(a) && !showing(),
    run: (a) => {
      void presenter.open('rehearse', a.current());
    },
  });
  c.define({
    id: 'play.useTimings',
    label: 'Use Rehearsed Timings',
    menu: { bar: 'Play', group: 'timing', order: 31 },
    enabled: (a) => ready(a),
    checked: () => usingTimings(),
    run: (a) => {
      useTimings(!usingTimings());
      a.invalidate('content');
    },
  });
  c.define({
    id: 'play.clearTimings',
    label: 'Clear Timings',
    menu: { bar: 'Play', group: 'timing', order: 32 },
    enabled: (a) => ready(a) && slidesOf(a).some((s) => s.hasAttribute('data-timing') && paired(a, s)),
    undoable: true,
    run: (a) => {
      for (const s of slidesOf(a)) if (s.hasAttribute('data-timing') && paired(a, s)) a.doc.setTag(s, { attrs: { 'data-timing': null } }, 'timing');
      a.invalidate('content');
    },
  });

  // the transition of the selected slides, as a submenu of the Slide menu with a check at the
  // transition of the current slide
  const names: [Transition, string][] = [['none', 'None'], ['fade', 'Fade'], ['magic', 'Magic Move']];
  names.forEach(([t, label], i) => {
    c.define({
      id: `slide.transition.${t}`,
      label,
      menu: { bar: 'Slide', group: 'transition', order: 60 + i, submenu: 'Transition' },
      enabled: (a) => targets(a).length > 0 && (t !== 'magic' || targets(a).some((s) => !!nextShown(a, s))),
      checked: (a) => {
        const s = a.current();
        return !!s && transitionOf(a, s) === t;
      },
      undoable: true,
      run: (a) => {
        const list = targets(a).filter((s) => t !== 'magic' || nextShown(a, s));
        for (const s of list) setTransition(a, s, t);
        a.invalidate('content');
      },
    });
  });
  c.define({
    id: 'slide.magicMove',
    label: 'Magic Move to Copy of Slide',
    menu: { bar: 'Slide', group: 'transition', order: 65 },
    context: ['slide'],
    enabled: (a) => {
      const s = a.current();
      return ready(a) && !!s && paired(a, s);
    },
    undoable: true,
    run: async (a) => {
      const s = a.current();
      if (!s) return;
      const copy = await magicMoveCopy(a, s);
      navOf(a).select([copy], copy);
    },
  });

  c.define({
    id: 'slide.previewTransition',
    label: 'Preview Transition',
    menu: { bar: 'Slide', group: 'transition', order: 66 },
    enabled: (a) => ready(a) && !!a.current(),
    run: (a) => {
      const s = a.current();
      if (s) void preview(a, s).catch((e) => a.fail(e));
    },
  });

  c.define({
    id: 'view.lightTable',
    label: 'Light Table',
    menu: { bar: 'View', group: 'panes', order: 9 },
    enabled: (a) => ready(a),
    checked: () => sorter.shown,
    run: () => sorter.toggle(),
  });
  c.define({
    id: 'view.accessibility',
    label: 'Check Accessibility',
    menu: { bar: 'View', group: 'review', order: 40 },
    enabled: (a) => ready(a),
    checked: () => checker.shown,
    run: () => checker.toggle(),
  });

  // the fixes of the checker, each one entry of the history
  c.define({
    id: 'review.altText',
    label: 'Add Alt Text',
    enabled: () => true,
    undoable: true,
    run: (a, arg) => {
      const { el, value } = (arg ?? {}) as { el?: Element; value?: string };
      if (!el || value === undefined || !paired(a, el)) return;
      a.doc.setTag(el, { attrs: { alt: value } }, 'alt');
      a.invalidate('content');
    },
  });
  c.define({
    id: 'review.tableHeader',
    label: 'Use First Row as Header',
    enabled: () => true,
    undoable: true,
    run: async (a, arg) => {
      const { el } = (arg ?? {}) as { el?: Element };
      if (el) await useHeaderRow(a, el);
      a.invalidate('content');
    },
  });
  installAnimate(app);
}
