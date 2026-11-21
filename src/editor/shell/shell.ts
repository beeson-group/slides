import type { App } from '../app.ts';
import type { Command, Context } from '../commands.ts';
import { ask, type DialogOptions } from '../ui/dialog.ts';
import { injectStyle, make, store, stored } from '../ui/dom.ts';
import { fillFormat as fillPanes } from '../inspector/inspector.ts';
import { closeMenus, openContextMenu, openMenu, menuItems, type MenuItem } from '../ui/menu.ts';
import { keyClashes, sheetClashes } from './keys-sheet.ts';
import { overlay } from '../canvas/frames.ts';
import { lineAt, onCanvas, stackAt } from '../canvas/hit.ts';
import { selectIn } from '../commands/order.ts';
import { groupsOf } from '../model/groups.ts';
import { describeObject } from '../navigator/objects.ts';
import { backdropAt } from '../commands/backdrop.ts';
import { PANE_KEYS } from '../commands/view.ts';
import { tileSlide } from '../navigator/sorter.ts';

const NAV_KEY = 'beeson-nav-w';
const NAV_MIN = 140;
const NAV_MAX = 360;
const NAV_DEFAULT = 200;
const INSPECTOR_KEY = 'beeson-inspector';
const INSPECTOR_W = 288;
const SOLO_BELOW = 2 * (NAV_MIN + INSPECTOR_W);

const TOKENS_LIGHT = `--ed-bg: #ececec; --ed-panel: #f6f6f6; --ed-text: #1d1d1f; --ed-muted: #636368; --ed-faint: #a9a9ae; --ed-line: #d4d4d6; --ed-canvas: #e1e1e3; --ed-select: #8a2be2; --ed-on-select: #fff; --ed-guide: #e0651f; --ed-error: #d70015; --ed-menu: rgba(248, 248, 248, 0.94); --ed-menu-line: rgba(0, 0, 0, 0.14); --ed-control: #fff; --ed-control-line: #c6c6ca; --ed-segment: #fff; --ed-focus: #8a2be2; --ed-hover: rgba(0, 0, 0, 0.06); --ed-pressed: rgba(0, 0, 0, 0.11); --ed-edge: rgba(0, 0, 0, 0.16); color-scheme: light;`;
const TOKENS_DARK = `--ed-bg: #2b2b2d; --ed-panel: #232325; --ed-text: #ececee; --ed-muted: #a6a6ab; --ed-faint: #5e5e63; --ed-line: #3b3b3e; --ed-canvas: #1a1a1c; --ed-select: #9d47d8; --ed-on-select: #fff; --ed-guide: #f08050; --ed-error: #ff6961; --ed-menu: rgba(44, 44, 46, 0.94); --ed-menu-line: rgba(255, 255, 255, 0.12); --ed-control: #3a3a3c; --ed-control-line: #4a4a4e; --ed-segment: #636366; --ed-focus: #c94fe6; --ed-hover: rgba(255, 255, 255, 0.07); --ed-pressed: rgba(255, 255, 255, 0.13); --ed-edge: rgba(255, 255, 255, 0.14); color-scheme: dark;`;

const CHROME = 'html.beeson-editor .beeson-edit-header, html.beeson-editor .beeson-edit-inspector, html.beeson-editor .beeson-edit-bottom, html.beeson-editor .beeson-edit-pane, html.beeson-editor dialog.beeson-edit-dialog, html.beeson-editor .beeson-edit-menus';

const CSS = `
html.beeson-editor { ${TOKENS_LIGHT} --ed-nav-col: 0px; --ed-insp-col: 0px; --ed-notes-row: 0px; --ed-font: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif; }
@media (prefers-color-scheme: dark) { html.beeson-editor { ${TOKENS_DARK} } }
html.beeson-editor.beeson-nav { --ed-nav-col: clamp(${NAV_MIN}px, calc(50vw - var(--ed-insp-col)), var(--ed-nav-w, ${NAV_DEFAULT}px)); }
html.beeson-editor:is(.beeson-steps, .beeson-format, .beeson-comments) { --ed-insp-col: ${INSPECTOR_W}px; }
html.beeson-editor.beeson-notes { --ed-notes-row: var(--beeson-pane, 200px); }
${CHROME} { --bg: var(--ed-panel); --text: var(--ed-text); --subtle: var(--ed-muted); --muted: var(--ed-muted); --line: var(--ed-line); --violet: var(--ed-select); --accent: var(--ed-guide); }
html.beeson-editor body.reveal-viewport { display: grid !important; grid-template-columns: var(--ed-nav-col) minmax(0, 1fr) var(--ed-insp-col); grid-template-rows: auto minmax(0, 1fr) var(--ed-notes-row) 28px; grid-template-areas: "top top top" "nav canvas insp" "nav notes insp" "status status status"; width: 100vw; height: 100vh; height: 100dvh; margin: 0; overflow: hidden; color: var(--ed-text); font: 12px/1.35 var(--ed-font); }
html.beeson-editor body > * { grid-area: canvas; }
html.beeson-editor ::placeholder { color: var(--ed-muted); opacity: 1; }
html.beeson-editor body > .beeson-edit-bottom { grid-area: status; }
html.beeson-editor body > .beeson-edit-header { grid-area: top; position: relative; z-index: 60; display: flex; flex-direction: column; background: var(--ed-bg); border-bottom: 1px solid var(--ed-line); }
html.beeson-editor body > .beeson-edit-nav { grid-area: nav; position: relative; inset: auto; width: auto; min-width: 0; min-height: 0; z-index: 50; background: var(--ed-panel); border-right: 1px solid var(--ed-line); color: var(--ed-text); font: 12px/1.4 var(--ed-font); }
html.beeson-editor body > .beeson-edit-nav-edge { grid-area: nav; justify-self: end; position: relative; z-index: 55; width: 7px; margin-right: -4px; display: none; cursor: ew-resize; touch-action: none; }
html.beeson-editor.beeson-nav body > .beeson-edit-nav-edge { display: block; }
html.beeson-resizing, html.beeson-resizing * { cursor: ew-resize !important; user-select: none !important; }
html.beeson-editor body > .beeson-edit-nav-edge:hover, html.beeson-editor body > .beeson-edit-nav-edge:focus-visible { outline: none; background: color-mix(in srgb, var(--ed-select) 45%, transparent); }
html.beeson-editor .beeson-edit-peek { left: calc(var(--ed-nav-col) + 8px); }
html.beeson-editor body > .beeson-edit-pane { grid-area: notes; position: relative; inset: auto; height: auto; min-height: 0; z-index: 0; background: var(--ed-panel); border-top: 1px solid var(--ed-line); color: var(--ed-faint); font: 11px/1.4 var(--ed-font); padding: 6px 12px; }
html.beeson-editor body > .beeson-edit-inspector { grid-area: insp; position: relative; z-index: 50; min-width: 0; min-height: 0; display: none; flex-direction: column; background: var(--ed-panel); border-left: 1px solid var(--ed-line); color: var(--ed-text); font: 12px/1.4 var(--ed-font); }
html.beeson-editor:is(.beeson-steps, .beeson-format, .beeson-comments) body > .beeson-edit-inspector { display: flex; }
@media (max-width: ${SOLO_BELOW - 0.02}px) {
  html.beeson-editor.beeson-nav { --ed-nav-col: ${NAV_MIN}px; }
  html.beeson-editor.beeson-nav:is(.beeson-steps, .beeson-format, .beeson-comments) { --ed-nav-col: 0px; }
  html.beeson-editor.beeson-nav:is(.beeson-steps, .beeson-format, .beeson-comments) body > :is(.beeson-edit-nav, .beeson-edit-nav-edge) { display: none; }
}
.beeson-edit-inspector .tabs { display: flex; margin: 10px 12px 6px; padding: 2px; border-radius: 7px; background: var(--ed-pressed); }
.beeson-edit-inspector .tabs button[hidden] { display: none; }
.beeson-edit-inspector .tabs button { position: relative; flex: 1; padding: 3px 0; border: 0; border-radius: 5px; background: transparent; color: var(--ed-text); font: 500 12px/1.3 var(--ed-font); cursor: default; }
.beeson-edit-inspector .tabs button::after { content: ''; position: absolute; inset: -6px 0; }
.beeson-edit-inspector .tabs button[aria-selected="true"] { background: var(--ed-segment); box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.2); }
.beeson-edit-inspector .tabs button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-inspector > .panel { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; }
.beeson-edit-inspector > .panel[hidden] { display: none; }
html.beeson-editor .beeson-edit-inspector .beeson-edit-side { position: static; inset: auto; width: auto; flex: 1; min-height: 0; border: 0; background: transparent; color: var(--ed-text); font: 12px/1.4 var(--ed-font); }
html.beeson-editor .beeson-edit-inspector .beeson-edit-side .row { grid-template-columns: minmax(0, 8.5em) auto minmax(0, 1fr); }
html.beeson-editor .beeson-edit-inspector .beeson-edit-side .row select { width: 100%; min-width: 0; }
`;

declare global {
  interface Window {
    BeesonEditorShell?: unknown;
  }
}

export type CommentsTab = { panel: HTMLElement; enable(): void; shown(): boolean; set(on: boolean): void; onShown(fn: () => void): void };
export let commentsTab: CommentsTab | null = null;

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
  const commentsButton = make('button', '', 'Comments');
  const formatPanel = make('div', 'panel format');
  const stepsPanel = make('div', 'panel steps');
  const commentsPanel = make('div', 'panel comments');
  commentsButton.hidden = true;
  const ids = ['format', 'steps', 'comments'] as const;
  const buttons = [formatTab, stepsTab, commentsButton];
  const panels = [formatPanel, stepsPanel, commentsPanel];
  for (const [tab, panel, id] of ids.map((id, i) => [buttons[i], panels[i], id] as const)) {
    tab.type = 'button';
    tab.id = `beeson-edit-tab-${id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `beeson-edit-panel-${id}`);
    panel.id = `beeson-edit-panel-${id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
  }
  tabs.append(...buttons);
  inspector.append(tabs, ...panels);

  const edge = make('div', 'beeson-edit-nav-edge beeson-edit-region');
  edge.tabIndex = 0;
  edge.title = 'Drag to change the width of the slide list, double-click to reset it, or focus it and press the left and right arrows';
  edge.setAttribute('role', 'separator');
  edge.setAttribute('aria-orientation', 'vertical');
  edge.setAttribute('aria-label', 'Width of the slide list');
  edge.setAttribute('aria-valuemin', String(NAV_MIN));
  edge.setAttribute('aria-valuemax', String(NAV_MAX));
  let navWidth = NAV_DEFAULT;
  const setNavWidth = (w: number, keep = true) => {
    navWidth = Math.round(Math.min(NAV_MAX, Math.max(NAV_MIN, w)));
    html.style.setProperty('--ed-nav-w', `${navWidth}px`);
    const drawn = Math.round(document.querySelector('.beeson-edit-nav')?.getBoundingClientRect().width ?? 0);
    if (drawn > 0 && drawn < navWidth - 1) {
      navWidth = Math.max(NAV_MIN, drawn);
      html.style.setProperty('--ed-nav-w', `${navWidth}px`);
    }
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
    edge.setPointerCapture(ev.pointerId);
    html.classList.add('beeson-resizing');
    const onMove = (e: PointerEvent) => setNavWidth(start + e.clientX - startX, false);
    const onUp = () => {
      html.classList.remove('beeson-resizing');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      store(NAV_KEY, String(navWidth));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  edge.addEventListener('dblclick', () => setNavWidth(NAV_DEFAULT));

  let format = false;
  let comments = false;
  const onComments: (() => void)[] = [];
  let stepsBefore = false;
  let started = false;
  let shownTab: string | null = null;
  let yielded: string | null = null;
  let forNav = false;
  const navToggle = app.nav.toggle.bind(app.nav);
  app.nav.toggle = () => {
    forNav = true;
    try {
      navToggle();
    } finally {
      forNav = false;
    }
  };
  const narrow = () => matchMedia(`(max-width: ${SOLO_BELOW - 0.02}px)`).matches;
  const commandOf = (tab: string | null) => (tab === 'steps' ? 'view.steps' : tab === 'comments' ? 'view.comments' : 'shell.format');
  const setTab = (tab: 'format' | 'comments', on: boolean) => {
    format = tab === 'format' ? on : on ? false : format;
    comments = tab === 'comments' ? on : on ? false : comments;
    if (on && app.steps.shown) app.steps.toggle();
    syncInspector();
    app.relayout();
  };
  const setFormat = (on: boolean) => setTab('format', on);
  function syncInspector(): void {
    const steps = app.steps.shown;
    if (steps && !stepsBefore) format = comments = false;
    stepsBefore = steps;
    html.classList.toggle('beeson-format', format);
    html.classList.toggle('beeson-comments', comments);
    const tab = steps ? 'steps' : format ? 'format' : comments ? 'comments' : null;
    ids.forEach((id, i) => {
      buttons[i].setAttribute('aria-selected', String(tab === id));
      buttons[i].tabIndex = tab === id ? 0 : -1;
      panels[i].hidden = tab !== id;
    });
    if (tab === 'format') fillFormat();
    const was = shownTab;
    shownTab = tab;
    if ((was === 'comments') !== (tab === 'comments')) for (const fn of onComments) fn();
    let reopen: string | null = null;
    if (tab) yielded = null;
    else if (was && forNav && app.nav.shown && narrow()) yielded = commandOf(was);
    else if (yielded && (!app.nav.shown || !narrow())) {
      reopen = yielded;
      yielded = null;
    }
    if (started) store(INSPECTOR_KEY, tab || yielded || reopen ? '1' : '0');
    if (reopen) void app.commands.run(reopen).catch(fail);
  }
  const fail = (e: unknown) => app.fail(e);
  formatTab.addEventListener('click', () => {
    if (!format) setFormat(true);
  });
  stepsTab.addEventListener('click', () => {
    if (!app.steps.shown) void app.commands.run('view.steps').catch(fail);
  });
  commentsButton.addEventListener('click', () => {
    if (!comments) setTab('comments', true);
  });
  tabs.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    ev.stopPropagation();
    const shown = buttons.filter((b) => !b.hidden);
    const at = shown.indexOf(document.activeElement as HTMLButtonElement);
    const next = shown[(at + (ev.key === 'ArrowRight' ? 1 : shown.length - 1)) % shown.length];
    next.click();
    next.focus();
  });
  commentsTab = {
    panel: commentsPanel,
    enable: () => void (commentsButton.hidden = false),
    shown: () => shownTab === 'comments',
    set: (on) => setTab('comments', on),
    onShown: (fn) => void onComments.push(fn),
  };

  function fillFormat(): void {
    fillPanes(app, formatPanel);
  }

  app.commands.define({
    id: 'shell.format',
    label: 'Format',
    checked: () => format,
    ...PANE_KEYS(1),
    run: () => setFormat(!format),
    menu: { bar: 'View', group: 'panes', order: 11 },
    toolbar: { group: 'inspector', order: 60, icon: 'format' },
  });

  const slideOnly = () => !app.nav.seen;
  let reopen: string | null = null;
  app.commands.define({
    id: 'view.slideOnly',
    label: 'Slide Only',
    menu: { bar: 'View', group: 'panes', order: 10.2 },
    checked: slideOnly,
    run: async () => {
      if (!slideOnly() && app.commands.get('view.lightTable') && app.commands.state('view.lightTable').checked) await app.commands.run('view.lightTable');
      const back = reopen;
      reopen = null;
      if (back && !slideOnly() && !format && !comments && !app.steps.shown) {
        await app.commands.run(back);
        if (app.nav.seen) app.nav.toggle();
        app.relayout();
        return;
      }
      if (app.nav.shown && !app.nav.seen) reopen = commandOf(app.steps.shown ? 'steps' : comments ? 'comments' : null);
      app.nav.toggle();
      if (app.nav.shown && !app.nav.seen) app.nav.toggle();
      app.relayout();
    },
  });

  queueMicrotask(() => {
    arrange();
    app.invalidate();
  });

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
    const peek = document.querySelector('.beeson-edit-peek');
    if (peek) document.body.append(peek);
    if (stored(INSPECTOR_KEY) !== '0' && !app.steps.shown) setFormat(true);
    started = true;
    syncInspector();
  }

  document.body.append(header, inspector, edge);
  app.listen('resize', () => app.stage.live || syncInspector());
  app.listen('slide', () => format && fillFormat());
  app.onRefresh(['selection', 'content', 'structure'], () => format && fillFormat());
  new MutationObserver(() => format && fillFormat()).observe(html, { attributes: true, attributeFilter: ['data-theme'] });

  function placeOf(target: Element | null): { kind: Context; target: Element | null } | null {
    if (!target || target.closest('[inert], .beeson-edit-menu, dialog, input, textarea, select, aside.notes')) return null;
    const row = target.closest('.beeson-edit-nav .row');
    if (row) {
      const rows = [...document.querySelectorAll('.beeson-edit-nav .row')];
      const slide = app.slides().querySelectorAll(':scope > section')[rows.indexOf(row)] ?? null;
      if (slide && !app.selection.has(slide)) app.selection.set('slides', [slide]);
      return { kind: 'slide', target: slide };
    }
    if (target.closest('.beeson-edit-nav')) return { kind: 'navigator', target: null };
    const tile = target.closest('.beeson-edit-sorter .tile');
    if (tile) return { kind: 'slide', target: tileSlide.get(tile) ?? null };
    if (target.closest('.beeson-edit-canvas')) return { kind: 'canvas', target: app.current() };
    const handle = target.closest('.beeson-handle') ? overlay().current() : target.closest('.beeson-grip, .beeson-rotor') ? (app.selection.elements()[0] ?? null) : null;
    if (!handle && !target.closest('.reveal:not(.beeson-peek)')) return null;
    const el = handle ?? app.move.movableOf(target);
    const host = app.hostOf(target);
    if (host && !(el && app.selection.kind === 'elements' && app.selection.has(el))) return { kind: 'text', target: host };
    if (el) {
      if (!app.selection.has(el)) app.selection.set('elements', [el]);
      return { kind: 'element', target: el };
    }
    return { kind: 'canvas', target: app.current() };
  }

  const picks = (x: number, y: number): MenuItem[] => {
    const stack = stackAt(app, x, y);
    const pick = (el: Element) => {
      (app.hostOf(document.activeElement) as HTMLElement | null)?.blur();
      selectIn(app, groupsOf(el), [el]);
    };
    return stack.length > 1 ? [{ label: 'Select', items: stack.map((el) => ({ label: describeObject(el).name, checked: app.selection.elements().includes(el), run: () => pick(el) })) }] : [];
  };

  const lineOf = (ev: MouseEvent) => (app.state === 'loaded' && ev.target instanceof Element && onCanvas(ev.target, app, { x: ev.clientX, y: ev.clientY }) && !document.documentElement.classList.contains('beeson-drawing-line') ? lineAt(app, ev.clientX, ev.clientY) : null);
  window.addEventListener('mousedown', (ev) => {
    if ((ev.button === 2 || (ev.ctrlKey && app.platform === 'mac')) && lineOf(ev)) ev.preventDefault();
  }, true);
  window.addEventListener('contextmenu', (ev) => {
    const svg = lineOf(ev);
    if (!svg || ev.altKey) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (!app.selection.has(svg)) app.selection.set('elements', [svg]);
    openContextMenu(app, 'element', svg, { x: ev.clientX, y: ev.clientY }, picks(ev.clientX, ev.clientY));
  }, true);
  window.addEventListener('contextmenu', (ev) => {
    if (!(ev.target instanceof Element) || !onCanvas(ev.target, app, { x: ev.clientX, y: ev.clientY })) return;
    const el = backdropAt(app, ev.target);
    if (!el || app.hostOf(ev.target)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (!app.selection.has(el)) app.selection.set('elements', [el]);
    const here: MenuItem = { command: 'backdrop.addLabel', arg: { el, x: ev.clientX, y: ev.clientY }, label: 'Add Label Here' };
    openContextMenu(app, 'element', el, { x: ev.clientX, y: ev.clientY }, [here, ...picks(ev.clientX, ev.clientY)]);
  }, true);
  document.addEventListener('contextmenu', (ev) => {
    const place = placeOf(ev.target instanceof Element ? ev.target : null);
    if (!place) return;
    const more = place.kind === 'canvas' || place.kind === 'element' || place.kind === 'text' ? picks(ev.clientX, ev.clientY) : [];
    if (openContextMenu(app, place.kind, place.target, { x: ev.clientX, y: ev.clientY }, more)) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  });
  window.addEventListener('keydown', (ev) => {
    if (!(ev.key === 'ContextMenu' || (ev.key === 'F10' && ev.shiftKey && !ev.metaKey && !ev.ctrlKey && !ev.altKey))) return;
    if (document.activeElement?.closest('.beeson-edit-titlebar')) return;
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
    keyClashes: (shared?: boolean) => keyClashes(app, shared),
    sheetClashes: () => sheetClashes(app),
    ask: (options: DialogOptions, focus?: string) => ask(options, focus),
  };
}
