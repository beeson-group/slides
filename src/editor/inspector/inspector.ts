// the Format tab of the inspector, whose panes follow the selection as in the Format inspector of
// Keynote: the Slide pane with nothing selected, Text and Arrange for a text or a block, Image,
// Video, or QR with Arrange for a figure, and Arrange alone for another element or for several.
// with more than one pane, the panes are tabs of a segmented control, and the tab chosen last is
// kept for the next selection that has it. the panes are built again only when the selection or
// the slide changes, and else read again in place, so that a field keeps its focus while the deck
// changes. shell/shell.ts calls fillFormat while the Format tab is shown

import type { App } from '../app.ts';
import { hasText } from '../canvas/hit.ts';
import { install as installAlign } from '../commands/align.ts';
import { install as installFigure, imageOf, onAltRequest, qrOf, videoOf } from '../commands/figure.ts';
import { make } from '../ui/dom.ts';
import { arrangePane } from './arrange.ts';
import { installStyle, keepFocus, runner, type Control } from './controls.ts';
import { imagePane, qrPane, videoPane } from './media.ts';
import { commands as slideCommands, slidePane } from './slide.ts';
import { tablePane } from './table.ts';
import { textPane } from './text.ts';
import { formulaPane, formulaView } from './formula.ts';

export type PaneKind = 'slide' | 'table' | 'text' | 'image' | 'video' | 'qr' | 'formula' | 'arrange';
const TAB_NAMES: Record<PaneKind, string> = { slide: 'Slide', table: 'Table', text: 'Text', image: 'Image', video: 'Video', qr: 'QR Code', formula: 'Formula', arrange: 'Arrange' };

// the panes of the selection, and the elements that tell one selection from another
function viewOf(app: App): { tabs: PaneKind[]; items: readonly Element[] } {
  const sel = app.selection;
  const formula = formulaView(app);
  if (formula) return formula;
  if (sel.kind === 'text') return { tabs: sel.items[0]?.matches('td, th') ? ['table', 'text', 'arrange'] : ['text', 'arrange'], items: sel.items };
  const els = sel.elements();
  if (!els.length) return { tabs: ['slide'], items: [app.current()].filter((s): s is Element => !!s) };
  if (els.length > 1) return { tabs: ['arrange'], items: els };
  const el = els[0];
  if (el.localName === 'table') return { tabs: ['table', 'arrange'], items: els };
  const img = imageOf(app), video = videoOf(app), qr = qrOf(app);
  if (img) return { tabs: ['image', 'arrange'], items: [el, img] };
  if (video) return { tabs: ['video', 'arrange'], items: [el, video] };
  if (qr) return { tabs: ['qr', 'arrange'], items: [el, qr] };
  if (hasText(el)) return { tabs: ['text', 'arrange'], items: els };
  return { tabs: ['arrange'], items: els };
}

let chosen: PaneKind | null = null;
let shown: { key: string; items: readonly Element[]; panel: HTMLElement; root: HTMLElement; parts: Control[] } | null = null;

function paneOf(app: App, kind: PaneKind, run: ReturnType<typeof runner>): Control[] {
  switch (kind) {
    case 'slide': return slidePane(app, run);
    case 'table': return tablePane(app, run);
    case 'text': return textPane(app, run);
    case 'image': return imagePane(app, run);
    case 'video': return videoPane(app, run);
    case 'qr': return qrPane(app, run);
    case 'formula': return formulaPane(app, run);
    case 'arrange': return arrangePane(app, run);
  }
}

// the Format tab of panel for the selection of app
export function fillFormat(app: App, panel: HTMLElement): void {
  const view = viewOf(app);
  const tab = chosen && view.tabs.includes(chosen) ? chosen : view.tabs[0];
  const key = `${view.tabs.join(',')}:${tab}`;
  const same = shown && shown.panel === panel && shown.key === key && panel.contains(shown.root) &&
    shown.items.length === view.items.length && shown.items.every((el, i) => el === view.items[i]);
  if (same && shown) {
    for (const p of shown.parts) p.sync();
    return;
  }
  // a value typed into a field of the panes that are replaced is committed to its own targets
  for (const p of shown?.parts ?? []) p.flush?.();
  const root = make('div', 'ed-panes');
  root.dataset.pane = tab;
  const sync = () => {
    if (shown?.root === root) for (const p of shown.parts) p.sync();
  };
  const run = runner(app, () => {
    app.flush();
    sync();
  });
  if (view.tabs.length > 1) {
    const tabs = make('div', 'ed-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Format');
    for (const kind of view.tabs) {
      const b = make('button', '', TAB_NAMES[kind]);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(kind === tab));
      b.tabIndex = kind === tab ? 0 : -1;
      keepFocus(b);
      b.addEventListener('click', () => {
        chosen = kind;
        fillFormat(app, panel);
      });
      tabs.append(b);
    }
    tabs.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      ev.stopPropagation();
      const i = view.tabs.indexOf(tab) + (ev.key === 'ArrowRight' ? 1 : -1);
      chosen = view.tabs[(i + view.tabs.length) % view.tabs.length];
      fillFormat(app, panel);
      (panel.querySelector('.ed-tabs [aria-selected="true"]') as HTMLElement | null)?.focus();
    });
    root.append(tabs);
  } else {
    root.append(make('div', 'ed-title', TAB_NAMES[tab]));
  }
  const parts = paneOf(app, tab, run);
  parts[0]?.el.classList.add('first');
  root.append(...parts.map((p) => p.el));
  panel.replaceChildren(root);
  shown = { key, items: view.items, panel, root, parts };
}

// the Format tab is shown, on the pane of tab when the selection has it
export function showFormat(app: App, tab: PaneKind): void {
  chosen = tab;
  if (!app.commands.state('shell.format').checked) void app.commands.run('shell.format');
  const panel = document.getElementById('beeson-edit-panel-format');
  if (panel && !panel.hidden) fillFormat(app, panel);
}

export function install(app: App): void {
  installStyle();
  installAlign(app);
  installFigure(app);
  for (const c of slideCommands()) app.commands.define(c);
  // the states of the Text pane follow the range in a block, which moves without a refresh of app
  let pending = false;
  document.addEventListener('selectionchange', () => {
    if (pending || !shown?.root.isConnected) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (shown?.root.isConnected) for (const p of shown.parts) p.sync();
    });
  });
  // Edit Alt Text… without a text shows the Image pane with its description field focused
  onAltRequest(() => {
    showFormat(app, 'image');
    const field = document.querySelector<HTMLTextAreaElement>('#beeson-edit-panel-format textarea[name="alt"]');
    field?.focus();
    field?.select();
  });
}
