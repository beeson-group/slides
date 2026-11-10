// the entry point of editor.js, which beeson.js loads with the URL parameter edit. the text, the
// formulas, the speaker notes, the steps, and the places of the figures of the slides are edited
// on the page, and a save writes each edit into its place in the file of the deck, so that every
// other byte of the file stays as it was. the edits are also kept in the storage of the browser
// until they are saved, and offered again when the deck is opened after a crash or a closed tab.
//
// this file creates the App of app.ts, installs the modules in their order, and defines
// window.BeesonEditor, the interface of the tests. a module is added with one import and one line
// in the list of installs below

import { App } from './app.ts';
import { installKeys } from './commands.ts';
import { mathReady, mathLookup } from './math.ts';
import { Nav } from './nav.ts';
import { Steps } from './steps.ts';
import { Move } from './move.ts';
import { Layers } from './layers.ts';
import { canWrite, fetchSource, install as installFiles } from './file/files.ts';
import { install as installDrafts } from './file/drafts.ts';
import { install as installNotes } from './notes.ts';
import { install as installOverflow } from './overflow.ts';
import { install as installTyping } from './text/typing.ts';
import { install as installMathPop } from './text/mathpop.ts';
import { install as installCanvas } from './shell/canvas.ts';
import { install as installToolbar } from './shell/toolbar.ts';
import { install as installStatusbar } from './shell/statusbar.ts';
import { install as installShell } from './shell/shell.ts';
import { install as installMenubar } from './shell/menubar.ts';
import { install as installKeysSheet } from './shell/keys-sheet.ts';
import { install as installMenu } from './ui/menu.ts';
import { install as installDialog } from './ui/dialog.ts';
import { install as installIcons } from './ui/icons.ts';
import { install as installKeymap } from './keymap.ts';
import { install as installSelection } from './selection.ts';
import { install as installHit } from './canvas/hit.ts';
import { install as installFrames } from './canvas/frames.ts';
import { install as installDrag } from './canvas/drag.ts';
import { install as installSnap } from './canvas/snap.ts';
import { install as installNavigator } from './navigator/navigator.ts';
import { install as installThumbs } from './navigator/thumbs.ts';
import { install as installFileCommands } from './commands/file.ts';
import { install as installEditCommands } from './commands/edit.ts';
import { install as installViewCommands } from './commands/view.ts';
import { install as installNavigateCommands } from './commands/navigate.ts';
import { install as installArrangeCommands } from './commands/arrange.ts';
import { install as installSlideCommands } from './commands/slide.ts';
import { install as installDeleteCommands } from './commands/delete.ts';
import { Doc } from './model/doc.ts';

const app = new App();

// the document model, through which a command inserts, removes, moves, and retags the slides and
// their elements, and writes the start tags
const doc = new Doc({
  source: () => app.source,
  pairing: () => app.pairing,
  tags: app.tagEdits,
  math: mathLookup,
  record: (e) => app.history.push(e),
  changed: () => {
    app.typing.attach();
    app.markDirty();
    app.invalidate('structure');
  },
  restore: (host, content) => app.typing.restoreHost(host, content),
});

// the modules of today that are classes with a context: the slide list at the left, the steps of
// the current slide in a pane at the right, the moving of the figures and blocks, and the layer
// switch. each is replaced by a module of the plan
const nav = new Nav({ slides: () => [...app.slides().querySelectorAll(':scope > section')], current: () => app.current(), go: (el) => app.showSlide(el), layout: () => app.relayout() });
const steps = new Steps({
  pairing: () => app.pairing,
  slide: () => app.current(),
  edits: app.tagEdits,
  markDirty: () => app.markDirty(),
  layout: () => app.relayout(),
  show: (el) => app.showSlide(el),
  record: (e) => app.history.push(e),
  tex: (el) => mathLookup()(el)?.tex ?? null,
  changed: () => app.invalidate('content'),
});
const move = new Move({
  pairing: () => app.pairing,
  slide: () => app.current(),
  scale: () => app.deck()?.getScale() ?? 1,
  edits: app.tagEdits,
  markDirty: () => app.markDirty(),
  onChange: () => steps.refresh(),
  show: (el) => app.showSlide(el),
  record: (e) => app.history.push(e),
});
// a block of another layer is hidden, hence the selection is dropped at a change of the layer
const layers = new Layers(() => app.current(), () => {
  move.select(null);
  app.invalidate('slide');
});
app.nav = nav;
app.steps = steps;
app.move = move;
app.layers = layers;
// the refresh of today, of every part after any change, in this order
app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], () => {
  layers.refresh();
  steps.refresh();
  move.refresh();
  nav.refresh();
});
app.listen('slide', () => move.select(null));

// the order of the installs is the order of the stylesheets, of the listeners of an event, and of
// the refreshes in a frame
installCanvas(app);
installToolbar(app);
installNotes(app);
installStatusbar(app, layers.box);
installFiles(app);
installDrafts(app);
installOverflow(app);
installTyping(app);
installMathPop(app);
installSelection(app);
installFileCommands(app);
installEditCommands(app);
installViewCommands(app);
installNavigateCommands(app);
installKeys(app);
// the stubs of the next modules, which do nothing yet
installIcons(app);
installMenu(app);
installDialog(app);
installShell(app);
installMenubar(app);
installKeymap(app);
installKeysSheet(app);
installHit(app);
installSnap(app);
installFrames(app);
installDrag(app);
installArrangeCommands(app);
installNavigator(app);
installThumbs(app);
installSlideCommands(app);
installDeleteCommands(app);

const revealReady = (): Promise<void> =>
  new Promise((done) => {
    const tick = () => (app.deck()?.isReady() ? done() : setTimeout(tick, 50));
    tick();
  });

async function init(): Promise<void> {
  document.body.append(nav.pane, steps.pane, steps.badges, move.frame, move.selectedFrame, move.handle, move.guideV, move.guideH, move.offset);
  document.documentElement.classList.add('beeson-editor');
  app.report();
  await revealReady();
  const d = app.deck();
  if (d) {
    // the slides change without a transition and with every step shown, as in the editing view
    // of PowerPoint, and the keys of reveal.js for the overview (Esc, O), the black and the white
    // screen (B, V, the period), fullscreen (F), the help (the question mark), and the speaker view
    // (S) are off. the viewport of reveal.js is laid out again between the bars
    d.configure({ transition: 'none', backgroundTransition: 'none', fragments: false, keyboard: { 27: null, 79: null, 66: null, 86: null, 190: null, 70: null, 191: null, 83: null } });
    d.on('slidechanged', () => {
      app.emit('slide');
      app.invalidate();
    });
    d.on('resize', () => {
      app.emit('resize');
      app.invalidate();
    });
    app.relayout();
  }
  await mathReady();
  if (!(await fetchSource(app))) {
    app.state = 'waiting';
    app.report();
  }
}

// a call of a test sees the state after every refresh that is due
function status() {
  app.flush();
  return {
    state: app.state,
    // true where the file is written in place, false where a save is a download
    supported: canWrite(),
    dirty: app.dirty,
    file: app.handle?.name ?? null,
    blocks: app.pairing?.blocks.length ?? 0,
    sections: app.pairing?.sections.length ?? 0,
    // the elements whose step or place was changed since the last save
    tags: app.tagEdits.size,
    problems: (app.pairing?.problems ?? []).map((p) => ({ slide: app.slideNumber(p.slide), tag: p.tag, reason: p.reason })),
    message: app.line.text,
    undo: app.history.canUndo,
    redo: app.history.canRedo,
    autosave: app.autosave,
    overflow: app.overflow,
    draft: app.drafts.hasDraft(),
    recover: app.drafts.offered(),
    pane: app.notes.height(),
  };
}

const BeesonEditor = {
  ready: init(),
  // a fresh text starts the history anew, and false opens it as the text of a save
  open: (text: string, fresh = true) => {
    app.files.open(text, fresh);
    return status();
  },
  render: () => app.files.render(),
  status,
  save: () => app.files.save(),
  saveAs: () => app.files.saveAs(),
  setMath: (container: Element, tex: string) => app.math.setMath(container, tex),
  undo: () => app.history.undo(),
  redo: () => app.history.redo(),
  toggleAutosave: () => app.files.toggleAutosave(),
  restoreDraft: () => app.drafts.restore(),
  setPane: (height: number) => app.notes.setPane(height),
  // the file written by save, for a test with a handle of the origin private file system
  attach: (h: FileSystemFileHandle) => {
    app.handle = h;
  },
  // a command of the registry run by its id, and its label, switch, and enabled state
  exec: (id: string, arg?: unknown) => app.commands.run(id, arg),
  state: (id: string) => app.commands.state(id),
  doc,
  version: __VERSION__,
};

declare global {
  interface Window {
    BeesonEditor: typeof BeesonEditor;
  }
}

window.BeesonEditor = BeesonEditor;
