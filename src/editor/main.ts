import { App } from './app.ts';
import { installKeys } from './commands.ts';
import { mathReady, mathLookup } from './math.ts';
import { Navigator } from './navigator/navigator.ts';
import { Steps } from './steps.ts';
import { ShownSteps } from './shown-steps.ts';
import { canWrite, fetchSource, install as installFiles } from './file/files.ts';
import { install as installDrafts } from './file/drafts.ts';
import { install as installFollow } from './file/follow.ts';
import { install as installNotes } from './notes.ts';
import { install as installOverflow } from './overflow.ts';
import { install as installTyping } from './text/typing.ts';
import { install as installMathPop } from './text/mathpop.ts';
import { install as installShownTex } from './text/shown-tex.ts';
import { install as installPlotTexts } from './text/plot-texts.ts';
import { install as installCanvas } from './shell/canvas.ts';
import { install as installToolbar } from './shell/toolbar.ts';
import { install as installStatusbar } from './shell/statusbar.ts';
import { install as installShell } from './shell/shell.ts';
import { install as installMenubar } from './shell/menubar.ts';
import { install as installKeysSheet } from './shell/keys-sheet.ts';
import { install as installMenu } from './ui/menu.ts';
import { install as installDialog } from './ui/dialog.ts';
import { install as installSelection } from './selection.ts';
import { twinOf } from './canvas/hit.ts';
import { install as installFrames } from './canvas/frames.ts';
import { install as installDrag } from './canvas/drag.ts';
import { install as installNavigator } from './navigator/navigator.ts';
import { install as installThumbs } from './navigator/thumbs.ts';
import { install as installFileCommands } from './commands/file.ts';
import { install as installEditCommands } from './commands/edit.ts';
import { install as installViewCommands } from './commands/view.ts';
import { install as installNavigateCommands } from './commands/navigate.ts';
import { install as installArrangeCommands } from './commands/arrange.ts';
import { install as installSlideCommands } from './commands/slide.ts';
import { install as installDeleteCommands } from './commands/delete.ts';
import { install as installTextElements } from './text/elements.ts';
import { install as installLink } from './text/link.ts';
import { install as installTextCommands } from './commands/text.ts';
import { install as installSubstitute } from './text/substitute.ts';
import { install as installClipboardCommands } from './commands/clipboard.ts';
import { install as installInsertCommands } from './commands/insert.ts';
import { install as installTableCommands } from './commands/table.ts';
import { install as installMediaCommands } from './commands/media.ts';
import { install as installTex } from './tex/install.ts';
import { install as installFindCommands } from './commands/find.ts';
import { install as installStepsCommands } from './commands/steps.ts';
import { install as installStackCommands } from './commands/stack.ts';
import { install as installCodeCommands } from './commands/code.ts';
import { install as installMathCommands } from './commands/math.ts';
import { install as installSpeechCommands } from './commands/speech.ts';
import { install as installInspector } from './inspector/inspector.ts';
import { install as installZoomCommands } from './commands/zoom.ts';
import { install as installLayoutCommands } from './commands/layout.ts';
import { install as installReviewCommands } from './commands/review.ts';
import { install as installPreviewCommands, timing as previewTiming } from './commands/preview.ts';
import { install as installSurfaceCommands } from './inspector/surface.ts';
import { install as installLineCommands } from './commands/line.ts';
import { install as installShapeCommands } from './commands/shape.ts';
import { install as installRulers } from './canvas/rulers.ts';
import { install as installGuides } from './canvas/guides.ts';
import { install as installGrid } from './canvas/grid.ts';
import { install as installMaskCommands } from './commands/mask.ts';
import { install as installFlipCommands } from './commands/flip.ts';
import { install as installSession, loadEngine } from './session/port.ts';
import { load as loadSession } from './session/load.ts';
import { install as installObjects } from './navigator/objects.ts';
import { Doc } from './model/doc.ts';
import { locateEditor } from './ui/script.ts';

locateEditor((document.currentScript as HTMLScriptElement | null)?.src ?? '');

const app = new App();

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
  twin: (el) => twinOf(app, el),
});
app.doc = doc;

const nav = new Navigator(app);
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
const shownSteps = new ShownSteps(() => app.current(), () => {
  app.selection.clear();
  app.invalidate('slide');
});
app.nav = nav;
app.steps = steps;
app.shownSteps = shownSteps;
app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], () => {
  shownSteps.refresh();
  steps.refresh();
  nav.refresh();
});

installCanvas(app);
installToolbar(app);
installNotes(app);
installStatusbar(app);
installFiles(app);
installDrafts(app);
installFollow(app);
installOverflow(app);
installTyping(app);
installMathPop(app);
installShownTex(app);
installTex(app);
installSelection(app);
installPlotTexts(app);
installFileCommands(app);
installEditCommands(app);
installViewCommands(app);
installNavigateCommands(app);
installKeys(app);
installMenu(app);
installDialog(app);
installShell(app);
installMenubar(app);
installKeysSheet(app);
installFrames(app);
installDrag(app);
installArrangeCommands(app);
installNavigator(app);
installThumbs(app);
installSlideCommands(app);
installDeleteCommands(app);
installTextElements(app);
installLink(app);
installTextCommands(app);
installSubstitute(app);
installClipboardCommands(app);
installInsertCommands(app);
installTableCommands(app);
installMediaCommands(app);
installFindCommands(app);
installStepsCommands(app);
installStackCommands(app);
installCodeCommands(app);
installMathCommands(app);
installSpeechCommands(app);
installInspector(app);
installZoomCommands(app);
installLayoutCommands(app);
installReviewCommands(app);
installPreviewCommands(app);
installSurfaceCommands(app);
installLineCommands(app);
installShapeCommands(app);
installRulers(app);
installGuides(app);
installGrid(app);
installMaskCommands(app);
installFlipCommands(app);
installObjects(app);
const session = installSession(app);
if (/[?&]session(=|&|$)/.test(location.search) && /[?&]edit(=|&|$)/.test(location.search)) session.begin();
const startSession = loadSession(app, session);

const revealReady = (): Promise<void> =>
  new Promise((done) => {
    const tick = () => (app.deck()?.isReady() ? done() : setTimeout(tick, 50));
    tick();
  });

async function init(): Promise<void> {
  document.body.append(nav.pane, steps.pane, steps.badges);
  document.documentElement.classList.add('beeson-editor');
  app.report();
  await revealReady();
  const d = app.deck();
  if (d) {
    d.configure({ transition: 'none', backgroundTransition: 'none', fragments: false, autoPlayMedia: false, keyboard: false });
    for (const v of document.querySelectorAll<HTMLVideoElement>('.reveal .slides video')) {
      if (v.paused) continue;
      v.pause();
      v.load();
    }
    d.on('slidechanged', () => {
      app.emit('slide');
      app.invalidate();
    });
    d.on('resize', () => {
      if (app.stage?.zooming) return;
      app.emit('resize');
      app.invalidate();
    });
    app.relayout();
  }
  await mathReady();
  const joined = await startSession();
  if (!joined) session.end();
  if (!joined && !(await fetchSource(app))) {
    app.state = 'waiting';
    app.report();
  }
  await app.follow.start();
}

function status() {
  app.flush();
  return {
    state: app.state,
    supported: canWrite(),
    dirty: app.dirty,
    file: app.handle?.name ?? null,
    texts: app.pairing?.texts.length ?? 0,
    sections: app.pairing?.sections.length ?? 0,
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
    ...app.follow.status(),
  };
}

const BeesonEditor = {
  ready: init(),
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
  attach: (h: FileSystemFileHandle) => {
    app.handle = h;
  },
  exec: (id: string, arg?: unknown) => app.commands.run(id, arg),
  state: (id: string) => app.commands.state(id),
  selection: () => app.selection.elements(),
  doc,
  session,
  apply: (text: string) => session.apply(text),
  loadSession: () => loadEngine(),
  preview: previewTiming,
  version: __VERSION__,
};

declare global {
  interface Window {
    BeesonEditor: typeof BeesonEditor;
  }
}

window.BeesonEditor = BeesonEditor;
