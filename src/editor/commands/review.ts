// the commands of the show and of the review of a deck, after the Play menu of Keynote and the
// Slide Show and Review tabs of PowerPoint, and the transition at the head of the Steps tab. the
// Play menu holds Present and Present from Start, moved from the File menu, the presenter view,
// Customize Presenter Display…, the rehearsal of timings, Use Rehearsed Timings, and Clear
// Timings. the Slide menu holds the transition of a slide, Magic Move, and Preview Transition, and
// the View menu the Slide Sorter. Present keeps the keys of PowerPoint, since F5 reloads the
// page, and the presenter view takes Alt+Enter, the key of PowerPoint on a Mac. the Slide Sorter
// is not given a key, since Chrome takes Mod+1 to Mod+9 for its tabs

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS } from '../commands.ts';
import type { Navigator } from '../navigator/navigator.ts';
import { Sorter } from '../navigator/sorter.ts';
import { Presenter, useTimings, usingTimings } from '../present.ts';
import { presentAt } from './file.ts';
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

export function install(app: App): void {
  const c = app.commands;
  const presenter = new Presenter(app);
  const sorter = new Sorter(app);
  const play = (order: number) => ({ bar: 'Play', group: 'play', order });
  for (const [id, order] of [['file.present', 10], ['file.presentStart', 11]] as const) {
    const command = c.get(id);
    if (command) command.menu = play(order);
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
      // the show is played in a tab of its own, which is moved to the screen of the audience
      const from = a.current();
      const shown = await presentAt(a, false, true);
      if (shown) void presenter.open('present', from, shown.win);
    },
  });
  // the display without the show, with the popover of its parts open, as in Keynote
  c.define({
    id: 'play.customizePresenter',
    label: 'Customize Presenter Display…',
    menu: play(21),
    enabled: (a) => ready(a) && !showing(),
    run: (a) => {
      void presenter.open('present', a.current(), null, true);
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
  // the switch is shown on only while the deck has timings, as in Keynote, and kept in the storage
  const timed = (a: App) => slidesOf(a).some((s) => s.hasAttribute('data-timing') && paired(a, s));
  c.define({
    id: 'play.useTimings',
    label: 'Use Rehearsed Timings',
    menu: { bar: 'Play', group: 'timing', order: 31 },
    enabled: (a) => ready(a) && timed(a),
    checked: (a) => usingTimings() && timed(a),
    run: (a) => {
      useTimings(!usingTimings());
      a.invalidate('content');
    },
  });
  c.define({
    id: 'play.clearTimings',
    label: 'Clear Timings',
    menu: { bar: 'Play', group: 'timing', order: 32 },
    enabled: (a) => ready(a) && timed(a),
    undoable: true,
    run: (a) => {
      for (const s of slidesOf(a)) if (s.hasAttribute('data-timing') && paired(a, s)) a.doc.setTag(s, { attrs: { 'data-timing': null } }, 'timing');
      a.invalidate('content');
    },
  });

  // the transition of the selected slides, as a submenu of the Slide menu with a check at the
  // transition of the current slide
  const names: [Transition, string][] = [['none', 'None'], ['fade', 'Fade'], ['magic', 'Magic Move'], ['push', 'Push']];
  names.forEach(([t, label], i) => {
    c.define({
      id: `slide.transition.${t}`,
      label,
      menu: { bar: 'Slide', group: 'transition', order: 60 + i, submenu: 'Transition' },
      enabled: (a) => targets(a).some((s) => !!nextShown(a, s)),
      checked: (a) => {
        const s = a.current();
        return !!s && !!nextShown(a, s) && transitionOf(a, s) === t;
      },
      undoable: true,
      undo: 'Transition',
      run: (a) => {
        const list = targets(a).filter((s) => nextShown(a, s));
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
    enabled: (a) => {
      const s = a.current();
      return ready(a) && !!s && !!nextShown(a, s);
    },
    run: (a) => {
      const s = a.current();
      if (s) void preview(a, s).catch((e) => a.fail(e));
    },
  });

  c.define({
    id: 'view.lightTable',
    label: 'Slide Sorter',
    menu: { bar: 'View', group: 'panes', order: 10.3 },
    enabled: (a) => ready(a),
    checked: () => sorter.shown,
    run: () => sorter.toggle(),
  });
  installAnimate(app);
}
