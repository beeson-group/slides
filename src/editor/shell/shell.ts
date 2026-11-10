// the grid of the window: the menu bar and the toolbar in the header, the navigator at the left,
// the canvas with the notes under it, the inspector at the right, and the status bar. the chrome
// is painted in tokens of its own, which follow prefers-color-scheme and not the mode of the deck,
// hence D flips only the slide. the regions are put into the order of the DOM in which Tab and F6
// reach them, and the shell also holds the inspector with its tabs Format and Steps, the edge
// between the navigator and the canvas, and the context menu

import type { App } from '../app.ts';
import type { Command, Context } from '../commands.ts';
import { ask, type DialogOptions } from '../ui/dialog.ts';
import { injectStyle, make, store, stored } from '../ui/dom.ts';
import { closeMenus, openContextMenu, openMenu, menuItems, type MenuItem } from '../ui/menu.ts';

const NAV_KEY = 'beeson-nav-w';
const NAV_MIN = 140;
const NAV_MAX = 360;
const NAV_DEFAULT = 200;

const TOKENS_LIGHT = `--ed-bg: #ececec; --ed-panel: #f6f6f6; --ed-text: #1d1d1f; --ed-muted: #6e6e73; --ed-faint: #a9a9ae; --ed-line: #d4d4d6; --ed-canvas: #e1e1e3; --ed-select: #8a2be2; --ed-on-select: #fff; --ed-guide: #e0651f; --ed-menu: rgba(248, 248, 248, 0.94); --ed-menu-line: rgba(0, 0, 0, 0.14); --ed-control: #fff; --ed-control-line: #c6c6ca; --ed-segment: #fff; --ed-focus: rgba(138, 43, 226, 0.5); --ed-hover: rgba(0, 0, 0, 0.06); --ed-pressed: rgba(0, 0, 0, 0.11); --ed-edge: rgba(0, 0, 0, 0.16); color-scheme: light;`;
const TOKENS_DARK = `--ed-bg: #2b2b2d; --ed-panel: #232325; --ed-text: #ececee; --ed-muted: #9a9a9f; --ed-faint: #5e5e63; --ed-line: #3b3b3e; --ed-canvas: #1a1a1c; --ed-select: #9d47d8; --ed-on-select: #fff; --ed-guide: #f08050; --ed-menu: rgba(44, 44, 46, 0.94); --ed-menu-line: rgba(255, 255, 255, 0.12); --ed-control: #3a3a3c; --ed-control-line: #4a4a4e; --ed-segment: #636366; --ed-focus: rgba(201, 79, 230, 0.6); --ed-hover: rgba(255, 255, 255, 0.07); --ed-pressed: rgba(255, 255, 255, 0.13); --ed-edge: rgba(255, 255, 255, 0.14); color-scheme: dark;`;

// the panes of today read the tokens of the deck, which are given the values of the chrome inside
// them
const CHROME = 'html.beeson-editor .beeson-edit-header, html.beeson-editor .beeson-edit-inspector, html.beeson-editor .beeson-edit-bottom, html.beeson-editor .beeson-edit-pane, html.beeson-editor dialog.beeson-edit-card, html.beeson-editor .beeson-edit-menus';

const CSS = `
html.beeson-editor { ${TOKENS_LIGHT} --ed-nav-col: 0px; --ed-insp-col: 0px; --ed-notes-row: 0px; --ed-font: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif; }
@media (prefers-color-scheme: dark) { html.beeson-editor { ${TOKENS_DARK} } }
html.beeson-editor.beeson-nav { --ed-nav-col: var(--ed-nav-w, ${NAV_DEFAULT}px); }
html.beeson-editor.beeson-steps, html.beeson-editor.beeson-format { --ed-insp-col: 288px; }
html.beeson-editor.beeson-notes { --ed-notes-row: var(--beeson-pane, 200px); }
${CHROME} { --bg: var(--ed-panel); --text: var(--ed-text); --subtle: var(--ed-muted); --muted: var(--ed-muted); --line: var(--ed-line); --violet: var(--ed-select); --accent: var(--ed-guide); }
html.beeson-editor body.reveal-viewport { display: grid !important; grid-template-columns: var(--ed-nav-col) minmax(0, 1fr) var(--ed-insp-col); grid-template-rows: auto minmax(0, 1fr) var(--ed-notes-row) 28px; grid-template-areas: "top top top" "nav canvas insp" "nav notes insp" "status status status"; width: 100vw; height: 100vh; height: 100dvh; margin: 0; overflow: hidden; color: var(--ed-text); font: 12px/1.35 var(--ed-font); }
html.beeson-editor body > * { grid-area: canvas; }
html.beeson-editor body > .beeson-edit-bottom { grid-area: status; }
html.beeson-editor body > .beeson-edit-header { grid-area: top; position: relative; z-index: 60; display: flex; flex-direction: column; background: var(--ed-bg); border-bottom: 1px solid var(--ed-line); }
html.beeson-editor body > .beeson-edit-nav { grid-area: nav; position: relative; inset: auto; width: auto; min-width: 0; min-height: 0; z-index: 50; background: var(--ed-panel); border-right: 1px solid var(--ed-line); color: var(--ed-text); font: 12px/1.4 var(--ed-font); }
html.beeson-editor body > .beeson-edit-nav-edge { grid-area: nav; justify-self: end; position: relative; z-index: 55; width: 7px; margin-right: -4px; display: none; cursor: ew-resize; touch-action: none; }
html.beeson-editor.beeson-nav body > .beeson-edit-nav-edge { display: block; }
html.beeson-editor body > .beeson-edit-nav-edge:hover, html.beeson-editor body > .beeson-edit-nav-edge:focus-visible { outline: none; background: color-mix(in srgb, var(--ed-select) 45%, transparent); }
html.beeson-editor .beeson-edit-peek { left: calc(var(--ed-nav-col) + 8px); }
html.beeson-editor body > .beeson-edit-pane { grid-area: notes; position: relative; inset: auto; height: auto; min-height: 0; z-index: 0; background: var(--ed-panel); border-top: 1px solid var(--ed-line); color: var(--ed-faint); font: 11px/1.4 var(--ed-font); padding: 6px 12px; }
html.beeson-editor body > .beeson-edit-resize { left: var(--ed-nav-col); right: var(--ed-insp-col); bottom: calc(28px + var(--beeson-pane, 200px) - 4px); }
html.beeson-editor.beeson-notes body .reveal .slides section.present { clip-path: inset(0 calc(-1 * var(--ed-room-r, 0px)) calc(-1 * (var(--beeson-pane, 200px) / var(--beeson-scale, 1) + var(--beeson-gap, 0px))) calc(-1 * var(--ed-room-l, 0px))); }
html.beeson-editor.beeson-notes body .reveal .slides section.present > aside.notes { left: calc(-1 * var(--ed-room-l, 0px)); right: calc(-1 * var(--ed-room-r, 0px)); padding: calc(28px / var(--beeson-scale, 1)) calc(14px / var(--beeson-scale, 1)) calc(10px / var(--beeson-scale, 1)); font: calc(13px / var(--beeson-scale, 1)) / 1.5 var(--ed-font); background: var(--ed-panel); color: var(--ed-text); }
html.beeson-editor.beeson-notes body .reveal .slides section.present > aside.notes:empty::before { color: var(--ed-faint); }
html.beeson-editor body > .beeson-edit-inspector { grid-area: insp; position: relative; z-index: 50; min-width: 0; min-height: 0; display: none; flex-direction: column; background: var(--ed-panel); border-left: 1px solid var(--ed-line); color: var(--ed-text); font: 12px/1.4 var(--ed-font); }
html.beeson-editor.beeson-steps body > .beeson-edit-inspector, html.beeson-editor.beeson-format body > .beeson-edit-inspector { display: flex; }
.beeson-edit-inspector .tabs { display: flex; margin: 10px 12px 6px; padding: 2px; border-radius: 7px; background: var(--ed-pressed); }
.beeson-edit-inspector .tabs button { flex: 1; padding: 3px 0; border: 0; border-radius: 5px; background: transparent; color: var(--ed-text); font: 500 12px/1.3 var(--ed-font); cursor: default; }
.beeson-edit-inspector .tabs button[aria-selected="true"] { background: var(--ed-segment); box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.2); }
.beeson-edit-inspector .tabs button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-inspector > .panel { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; }
.beeson-edit-inspector > .panel[hidden] { display: none; }
.beeson-edit-inspector .format { padding: 4px 16px 16px; }
.beeson-edit-inspector .format h4 { margin: 12px 0 6px; font: 600 12px/1.3 var(--ed-font); }
.beeson-edit-inspector .format dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; }
.beeson-edit-inspector .format dt { color: var(--ed-muted); }
.beeson-edit-inspector .format dd { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
html.beeson-editor .beeson-edit-inspector .beeson-edit-side { position: static; inset: auto; width: auto; flex: 1; min-height: 0; border: 0; background: transparent; color: var(--ed-text); font: 12px/1.4 var(--ed-font); }
html.beeson-editor .beeson-edit-inspector .beeson-edit-side .row { grid-template-columns: minmax(0, 8.5em) auto minmax(0, 1fr); }
html.beeson-editor .beeson-edit-inspector .beeson-edit-side .row select { width: 100%; min-width: 0; }
`;

// the label of a command on the toolbar, which is short and does not change, e.g. Undo for
// Undo Typing. a package may name it with toolbar.label
const SHORT: Record<string, string> = { 'edit.undo': 'Undo', 'edit.redo': 'Redo' };
export function toolbarLabel(app: App, c: Command): string {
  const own = (c.toolbar as { label?: string } | undefined)?.label ?? SHORT[c.id];
  if (own) return own;
  return typeof c.label === 'string' ? c.label : app.commands.label(c.id);
}

declare global {
  interface Window {
    // the interface of the shell for the tests and the screenshots: commands defined in a page
    // before their package exists, the stage, the menus, and the dialogs
    BeesonEditorShell?: unknown;
  }
}

export function install(app: App): void {
  injectStyle('shell', CSS);
  const html = document.documentElement;

  const header = make('header', 'beeson-edit-header beeson-edit-region');
  const inspector = make('div', 'beeson-edit-inspector beeson-edit-region');
  inspector.setAttribute('role', 'complementary');
  inspector.setAttribute('aria-label', 'Inspector');
  const tabs = make('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Inspector');
  const formatTab = make('button', '', 'Format');
  const stepsTab = make('button', '', 'Steps');
  const formatPanel = make('div', 'panel format');
  const stepsPanel = make('div', 'panel steps');
  for (const [tab, panel, id] of [[formatTab, formatPanel, 'format'], [stepsTab, stepsPanel, 'steps']] as const) {
    tab.type = 'button';
    tab.id = `beeson-edit-tab-${id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `beeson-edit-panel-${id}`);
    panel.id = `beeson-edit-panel-${id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
  }
  tabs.append(formatTab, stepsTab);
  inspector.append(tabs, formatPanel, stepsPanel);

  // the edge between the navigator and the canvas, dragged or moved with the arrow keys
  const edge = make('div', 'beeson-edit-nav-edge beeson-edit-region');
  edge.tabIndex = 0;
  edge.title = 'Drag to change the width of the slide list, or focus it and press the left and right arrows';
  edge.setAttribute('role', 'separator');
  edge.setAttribute('aria-orientation', 'vertical');
  edge.setAttribute('aria-label', 'Width of the slide list');
  edge.setAttribute('aria-valuemin', String(NAV_MIN));
  edge.setAttribute('aria-valuemax', String(NAV_MAX));
  let navWidth = NAV_DEFAULT;
  const setNavWidth = (w: number, keep = true) => {
    navWidth = Math.round(Math.min(NAV_MAX, Math.max(NAV_MIN, w)));
    html.style.setProperty('--ed-nav-w', `${navWidth}px`);
    edge.setAttribute('aria-valuenow', String(navWidth));
    if (keep) store(NAV_KEY, String(navWidth));
    app.relayout();
  };
  const kept = Number(stored(NAV_KEY));
  navWidth = Number.isFinite(kept) && kept >= NAV_MIN && kept <= NAV_MAX ? kept : NAV_DEFAULT;
  html.style.setProperty('--ed-nav-w', `${navWidth}px`);
  edge.setAttribute('aria-valuenow', String(navWidth));
  edge.addEventListener('keydown', (ev) => {
    const step = ev.key === 'ArrowLeft' ? -10 : ev.key === 'ArrowRight' ? 10 : 0;
    if (!step) return;
    ev.preventDefault();
    ev.stopPropagation();
    setNavWidth(navWidth + step);
  });
  edge.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX;
    const start = navWidth;
    const onMove = (e: PointerEvent) => setNavWidth(start + e.clientX - startX, false);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      store(NAV_KEY, String(navWidth));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  // the inspector shows one tab, Format or Steps, and is hidden when neither is on. Steps is the
  // pane of steps.ts, hence its tab is on while that pane is shown
  let format = false;
  let stepsBefore = false;
  const setFormat = (on: boolean) => {
    format = on;
    html.classList.toggle('beeson-format', on);
    if (on && app.steps.shown) app.steps.toggle();
    syncInspector();
    app.relayout();
  };
  function syncInspector(): void {
    const steps = app.steps.shown;
    if (steps && !stepsBefore && format) {
      format = false;
      html.classList.remove('beeson-format');
    }
    stepsBefore = steps;
    const tab = steps ? 'steps' : format ? 'format' : null;
    formatTab.setAttribute('aria-selected', String(tab === 'format'));
    stepsTab.setAttribute('aria-selected', String(tab === 'steps'));
    formatTab.tabIndex = tab === 'format' ? 0 : -1;
    stepsTab.tabIndex = tab === 'steps' ? 0 : -1;
    formatPanel.hidden = tab !== 'format';
    stepsPanel.hidden = tab !== 'steps';
    if (tab === 'format') fillFormat();
  }
  const fail = (e: unknown) => app.fail(e);
  formatTab.addEventListener('click', () => {
    if (!format) setFormat(true);
  });
  stepsTab.addEventListener('click', () => {
    if (!app.steps.shown) void app.commands.run('view.steps').catch(fail);
  });
  tabs.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    ev.stopPropagation();
    const next = document.activeElement === formatTab ? stepsTab : formatTab;
    next.click();
    next.focus();
  });

  // the Format tab: the facts of the slide and of the selection, until the panes of R2 fill it
  function fillFormat(): void {
    const slide = app.current();
    const layout = ['title', 'section', 'closing', 'figure', 'split'].find((c) => slide?.classList.contains(c)) ?? 'content';
    const width = ['narrow', 'wide'].find((c) => slide?.classList.contains(c)) ?? 'standard';
    const steps = new Set([...(slide?.querySelectorAll('.fragment') ?? [])].map((f) => f.getAttribute('data-fragment-index') ?? '')).size;
    const notes = slide?.querySelector('aside.notes')?.textContent?.trim() ? 'yes' : 'none';
    const sel = app.selection;
    const what = sel.kind === 'none' ? 'nothing' : sel.kind === 'text' ? 'a text' : `${sel.items.length} ${sel.kind === 'slides' ? 'slide' : 'element'}${sel.items.length === 1 ? '' : 's'}`;
    const list = (rows: [string, string][]) => {
      const dl = make('dl');
      for (const [k, v] of rows) dl.append(make('dt', '', k), make('dd', '', v));
      return dl;
    };
    formatPanel.replaceChildren(
      make('h4', '', 'Slide'),
      list([['Layout', layout], ['Width', width], ['Steps', String(steps)], ['Notes', notes]]),
      make('h4', '', 'Selection'),
      list([['Selected', what]]),
    );
  }

  app.commands.define({
    id: 'shell.format',
    label: 'Format',
    checked: () => format,
    run: () => setFormat(!format),
    menu: { bar: 'View', group: 'panes', order: 13 },
    toolbar: { group: 'inspector', order: 60, icon: 'format' },
  });

  // the zoom of the canvas, in View > Zoom and in the status bar
  const zoom = (id: string, label: string, order: number, run: () => void, keys?: Command['keys']) =>
    app.commands.define({ id, label, run, keys, menu: { bar: 'View', group: 'zoom', order, submenu: 'Zoom' } });
  zoom('shell.zoomFit', 'Fit', 20, () => app.stage.setZoom(null), { mac: ['Mod+0'], other: ['Mod+0'] });
  zoom('shell.zoomActual', 'Actual Size', 21, () => app.stage.setZoom(1));
  zoom('shell.zoomIn', 'Zoom In', 22, () => app.stage.zoomIn(), { mac: ['Mod+='], other: ['Mod+='] });
  zoom('shell.zoomOut', 'Zoom Out', 23, () => app.stage.zoomOut(), { mac: ['Mod+-'], other: ['Mod+-'] });

  queueMicrotask(() => {
    arrange();
    app.invalidate();
  });

  // the regions in the order of Tab: the header and the navigator before the slide, and the
  // notes, the inspector, and the status bar after it. init() of main.ts appends the panes, hence
  // this is run after it
  function arrange(): void {
    const reveal = document.querySelector('.reveal:not(.beeson-peek)');
    if (!reveal) return;
    const top = document.querySelector('.beeson-edit-top');
    if (top && top.parentElement !== header) header.append(top);
    stepsPanel.append(app.steps.pane);
    const canvas = document.querySelector('.beeson-edit-canvas');
    reveal.before(...[header, app.nav.pane, edge, canvas].filter((el): el is Element => !!el));
    const after = [document.querySelector('.beeson-edit-pane'), document.querySelector('.beeson-edit-resize'), inspector, document.querySelector('.beeson-edit-bottom')];
    reveal.after(...after.filter((el): el is Element => !!el));
    // the peek of a slide holds a copy of .reveal, which is put after the slide, since the editor,
    // the theme, and the tests find the slide as the first .reveal of the page
    const peek = document.querySelector('.beeson-edit-peek');
    if (peek) document.body.append(peek);
    syncInspector();
  }

  document.body.append(header, inspector, edge);
  app.listen('resize', syncInspector);
  app.listen('slide', () => format && fillFormat());
  app.onRefresh(['selection', 'content', 'structure'], () => format && fillFormat());

  // the context menu of the place of a right-click, of a Control-click on a Mac, of Shift+F10,
  // or of the Menu key. where no command is declared for the place, the menu of the browser is kept
  function placeOf(target: Element | null): { kind: Context; target: Element | null } | null {
    if (!target || target.closest('.beeson-edit-menu, dialog, input, textarea, select, aside.notes')) return null;
    const row = target.closest('.beeson-edit-nav .row');
    if (row) {
      const rows = [...document.querySelectorAll('.beeson-edit-nav .row')];
      const slide = app.slides().querySelectorAll(':scope > section')[rows.indexOf(row)] ?? null;
      if (slide && !app.selection.has(slide)) app.selection.set('slides', [slide]);
      return { kind: 'slide', target: slide };
    }
    if (target.closest('.beeson-edit-nav')) return { kind: 'navigator', target: null };
    if (target.closest('.beeson-edit-canvas')) return { kind: 'canvas', target: app.current() };
    if (!target.closest('.reveal:not(.beeson-peek)')) return null;
    const host = app.hostOf(target);
    if (host) return { kind: 'text', target: host };
    const el = app.move.movableOf(target);
    if (el) {
      if (!app.selection.has(el)) app.selection.set('elements', [el]);
      return { kind: 'element', target: el };
    }
    return { kind: 'canvas', target: app.current() };
  }

  document.addEventListener('contextmenu', (ev) => {
    const place = placeOf(ev.target instanceof Element ? ev.target : null);
    if (!place) return;
    if (openContextMenu(app, place.kind, place.target, { x: ev.clientX, y: ev.clientY })) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  });
  window.addEventListener('keydown', (ev) => {
    if (!(ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey && !ev.metaKey && !ev.ctrlKey && !ev.altKey))) return;
    const sel = app.selection.only();
    const at = sel ?? (document.activeElement instanceof Element && document.activeElement !== document.body ? document.activeElement : app.current());
    const place = placeOf(at);
    if (!place || !at) return;
    const r = at.getBoundingClientRect();
    const v = app.stage.viewport;
    const x = Math.min(Math.max(r.left + 8, v.left), v.right);
    const y = Math.min(Math.max(r.top + Math.min(r.height, 24), v.top), v.bottom);
    if (openContextMenu(app, place.kind, place.target, { x, y })) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }, true);

  window.BeesonEditorShell = {
    define: (c: Command) => {
      app.commands.define(c);
      app.invalidate();
      app.flush();
    },
    stage: app.stage,
    openMenu: (items: MenuItem[], at: { x: number; y: number }) => openMenu(app, items, { anchor: at, placement: 'point' }),
    menuItems: (bar: string, submenu?: string) => menuItems(app, bar, submenu),
    context: (kind: Context, x: number, y: number) => !!openContextMenu(app, kind, null, { x, y }),
    closeMenus,
    ask: (options: DialogOptions, focus?: string) => ask(options, focus),
  };
}
