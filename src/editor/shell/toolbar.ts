// the toolbar, drawn from the commands of the registry that name a toolbar place: a 20 px icon over
// an 11 px label in groups with a thin rule between them, and the groups after Present at the
// right. a switch is shown pressed, and a command whose toolbar place names a split is drawn as a
// split button. the commands of a group that name the same split are its variants, e.g. Image…,
// Video…, and QR Code under Media, as the Pictures button of PowerPoint: the main part runs the
// first of them, and its arrow lists them with the commands of the submenu of that name of the
// menu of the first. while the toolbar is wider than the window, its last groups are put into a
// menu » at its right end, as in Keynote, first those after Present and then those before it.
// the labels are hidden only while the toolbar does not fit with them. the toolbar has one tab stop, and the arrow keys move in it. the
// View and Zoom popups at its left are as in Keynote: View with the views of the slides and the
// panes, and Zoom with Fit, Actual Size, Zoom to Selection, and the levels, showing the zoom on its
// face. the items of the toolbar and whether it shows icons, labels, or both are set in the sheet
// Customize Toolbar of the View menu, as in Keynote, and kept in the storage of the browser for
// each deck, never in the file

import type { App } from '../app.ts';
import { OUTSIDE_DIALOGS, type Command, type Group } from '../commands.ts';
import { injectStyle, make, store, stored, wire } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, commandKeys, menuItems, openMenu, splitButton, type MenuItem } from '../ui/menu.ts';
import { ZOOMS } from './canvas.ts';

const POPUPS = new Set(['toolbar.view', 'toolbar.zoom']);
const percent = (z: number) => `${Math.round(z * 100)}%`;

// an item of the layout is a command, a separator, or a space that pushes the items after it to
// the right. a split button is laid out as its first command
const SEPARATOR = 'separator';
const SPACE = 'space';
type Show = 'both' | 'icon' | 'text';
const SHOWS: [Show, string][] = [['both', 'Icon and Text'], ['icon', 'Icon Only'], ['text', 'Text Only']];
const storeKey = () => `beeson-edit-toolbar:${location.pathname}`;

// the commands without a place in the default set that the sheet offers, with their icons on the
// grid of ui/icons.ts. a name is an icon of that file, and a list is the paths of a new one
const EXTRA: Record<string, { label: string; icon: string | string[] }> = {
  'file.open': { label: 'Open', icon: 'open' },
  'find.open': { label: 'Find', icon: ['M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M12.25 12.25 16.5 16.5'] },
  'view.notes': { label: 'Notes', icon: 'notes' },
  'view.accessibility': { label: 'Accessibility', icon: ['F10 2.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z', 'M4.5 7.25 10 8.25l5.5-1', 'M10 8.25v4', 'M10 12.25 7.5 17', 'M10 12.25 12.5 17'] },
  'play.rehearse': { label: 'Rehearse', icon: ['M3 4.5h14v9H3z', 'M8.75 7v4l3.25-2z', 'M7 16.5h6'] },
  'arrange.group': { label: 'Group', icon: ['M2.75 2.75h14.5v14.5H2.75z', 'M5.5 5.5H10V10H5.5z', 'M10 10h4.5v4.5H10z'] },
  'arrange.ungroup': { label: 'Ungroup', icon: ['M3.5 3.5h6v6h-6z', 'M10.5 10.5h6v6h-6z'] },
  'arrange.lock': { label: 'Lock', icon: ['M5 9h10v7.5H5z', 'M7 9V6.75a3 3 0 0 1 6 0V9'] },
  'arrange.unlock': { label: 'Unlock', icon: ['M5 9h10v7.5H5z', 'M7 9V6.75a3 3 0 0 1 5.8-1.1'] },
  'text.bigger': { label: 'Bigger', icon: ['M2.75 16 6.75 4.5 10.75 16', 'M4.25 12h5', 'M15 5.5v5', 'M12.5 8h5'] },
  'text.smaller': { label: 'Smaller', icon: ['M2.75 16 6.75 4.5 10.75 16', 'M4.25 12h5', 'M12.5 8h5'] },
  'text.copyStyle': { label: 'Copy Style', icon: ['M12.5 3.25l4.25 4.25-7.5 7.5H5v-4.25z', 'M10.5 5.25l4.25 4.25'] },
  'text.pasteStyle': { label: 'Paste Style', icon: ['M6 4.5H4.5v12h11v-12H14', 'M7 3h6v3H7z', 'M7.5 10h5', 'M7.5 13h5'] },
  'text.link': { label: 'Link', icon: ['M8.5 11.5a3 3 0 0 0 4.24 0l2.5-2.5a3 3 0 0 0-4.24-4.24l-1 1', 'M11.5 8.5a3 3 0 0 0-4.24 0l-2.5 2.5a3 3 0 0 0 4.24 4.24l1-1'] },
};
const MARKS: Record<string, { label: string; icon: string[] }> = {
  [SEPARATOR]: { label: 'Separator', icon: ['M10 3.5v13'] },
  [SPACE]: { label: 'Space', icon: ['M3 6.5v7', 'M17 6.5v7', 'M3 10h14'] },
};

// an icon of ui/icons.ts, or one drawn from paths in the same style
function glyph(face: string | string[]): SVGSVGElement {
  if (typeof face === 'string') return icon(face);
  const svg = icon('square');
  svg.replaceChildren(...face.map((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const filled = d.startsWith('F');
    path.setAttribute('d', filled ? `M${d.slice(1)}` : d);
    path.setAttribute('fill', filled ? 'currentColor' : 'none');
    if (!filled) {
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    }
    return path;
  }));
  return svg;
}

const CSS = `
.beeson-edit-top { display: flex; align-items: center; gap: 2px; height: 52px; padding: 0 10px; box-sizing: border-box; font: 11px/1.2 var(--ed-font); color: var(--ed-text); user-select: none; -webkit-user-select: none; }
html.beeson-no-toolbar .beeson-edit-top { display: none; }
.beeson-edit-top .group { display: flex; align-items: center; gap: 2px; }
.beeson-edit-top .group + .group::before { content: ''; align-self: center; width: 1px; height: 28px; margin: 0 6px; background: var(--ed-line); }
.beeson-edit-top .group.right { margin-left: auto; }
.beeson-edit-top .group.right ~ .group.right { margin-left: 0; }
.beeson-edit-top .group[hidden] { display: none; }
.beeson-edit-top .tb { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-width: 56px; height: 44px; padding: 3px 6px 2px; box-sizing: border-box; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: default; white-space: nowrap; }
.beeson-edit-top .tb .beeson-icon { flex: none; }
.beeson-edit-top .tb .readout { display: flex; align-items: center; height: 20px; font: 500 12px/1 var(--ed-font); font-variant-numeric: tabular-nums; }
.beeson-edit-top .tb .readout::after { content: ''; width: 5px; height: 5px; margin: -3px 0 0 5px; border: solid currentColor; border-width: 0 1.25px 1.25px 0; transform: rotate(45deg); opacity: 0.7; }
.beeson-edit-top .tb:hover:not(:disabled) { background: var(--ed-hover); }
.beeson-edit-top .tb:active:not(:disabled), .beeson-edit-top .tb[aria-pressed="true"] { background: var(--ed-pressed); }
.beeson-edit-top .tb[aria-pressed="true"] .beeson-icon { color: var(--ed-select); }
.beeson-edit-top .tb.on .beeson-icon { color: var(--ed-select); }
.beeson-edit-top .tb:disabled { color: var(--ed-faint); }
.beeson-edit-top .tb:focus-visible, .beeson-edit-split .more:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -2px; }
.beeson-edit-split { display: inline-flex; align-items: stretch; border-radius: 6px; }
.beeson-edit-split .tb { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.beeson-edit-split .more { width: 16px; height: 44px; padding: 0; border: 0; border-radius: 0 6px 6px 0; background: transparent; color: var(--ed-muted); cursor: default; }
.beeson-edit-split .more:hover, .beeson-edit-split .more[aria-expanded="true"] { background: var(--ed-hover); }
.beeson-edit-top:is(.show-icon, .compact:not(.show-text)) .tb .label { display: none; }
.beeson-edit-top:is(.show-icon, .compact:not(.show-text)) .tb { min-width: 36px; }
.beeson-edit-top.show-text .tb > .beeson-icon { display: none; }
.beeson-edit-top.show-text .tb .label { display: inline; font-size: 12px; }
.beeson-edit-top.customizing .tb { cursor: grab; }
.beeson-edit-top .sep { flex: none; align-self: center; width: 13px; height: 28px; background: linear-gradient(var(--ed-line), var(--ed-line)) center / 1px 100% no-repeat; }
.beeson-edit-top .space { flex: 1 1 24px; min-width: 24px; align-self: stretch; margin: 6px 0; border: 1px dashed var(--ed-line); border-radius: 6px; }
.beeson-edit-top .sep:focus-visible, .beeson-edit-top .space:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -2px; }
.beeson-edit-customize-scrim { position: fixed; left: 0; right: 0; bottom: 0; z-index: 79; background: rgba(0, 0, 0, 0.36); }
.beeson-edit-customize { position: fixed; left: 50%; z-index: 80; transform: translateX(-50%); box-sizing: border-box; width: min(980px, calc(100vw - 32px)); display: flex; flex-direction: column; padding: 16px 22px 14px; border: 1px solid var(--ed-menu-line); border-top: 0; border-radius: 0 0 12px 12px; background: var(--ed-panel); color: var(--ed-text); font: 13px/1.35 var(--ed-font); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.32); user-select: none; -webkit-user-select: none; }
.beeson-edit-customize[hidden], .beeson-edit-customize-scrim[hidden] { display: none; }
.beeson-edit-customize .lead { margin: 0 0 10px; }
.beeson-edit-customize .palette { flex: 0 1 auto; min-height: 60px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px 4px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--ed-line); }
.beeson-edit-customize .item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px; border-radius: 8px; text-align: center; font-size: 11px; color: var(--ed-muted); cursor: grab; }
.beeson-edit-customize .item .well { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--ed-hover); color: var(--ed-text); }
.beeson-edit-customize .item:hover .well { background: var(--ed-pressed); }
.beeson-edit-customize .item:focus-visible, .beeson-edit-customize .default:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-customize .default { display: flex; align-items: center; gap: 2px; padding: 6px 8px; margin-bottom: 12px; border: 1px solid var(--ed-line); border-radius: 8px; font-size: 10px; color: var(--ed-muted); overflow: hidden; cursor: grab; }
.beeson-edit-customize .default .mini { flex: none; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 40px; }
.beeson-edit-customize .default .mini.sep { width: 9px; min-width: 0; align-self: stretch; background: linear-gradient(var(--ed-line), var(--ed-line)) center / 1px 70% no-repeat; }
.beeson-edit-customize .default .mini.space { flex: 1 1 0; min-width: 8px; }
.beeson-edit-customize .foot { display: flex; align-items: center; gap: 8px; padding-top: 10px; border-top: 1px solid var(--ed-line); }
.beeson-edit-customize .foot button { font: inherit; padding: 3px 12px; border: 1px solid var(--ed-control-line); border-radius: 6px; background: var(--ed-control); color: var(--ed-text); cursor: default; }
.beeson-edit-customize .foot .show::after { content: ''; display: inline-block; width: 5px; height: 5px; margin: -3px 0 0 8px; border: solid currentColor; border-width: 0 1.25px 1.25px 0; transform: rotate(45deg); opacity: 0.7; vertical-align: middle; }
.beeson-edit-customize .foot .done { margin-left: auto; min-width: 72px; border-color: transparent; background: var(--ed-select); color: var(--ed-on-select); }
.beeson-edit-customize .foot button:focus-visible { outline: 3px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-drag-ghost { position: fixed; z-index: 95; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px 6px; border-radius: 6px; background: var(--ed-panel); color: var(--ed-text); font: 11px/1.2 var(--ed-font); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3); transform: translate(-50%, -50%); opacity: 0.92; }
.beeson-edit-drag-ghost.remove { opacity: 0.45; }
.beeson-edit-drop-mark { position: fixed; z-index: 95; width: 2px; border-radius: 1px; background: var(--ed-select); pointer-events: none; }
.beeson-edit-drop-mark[hidden], .beeson-edit-drag-ghost[hidden] { display: none; }
`;

type Shown = { c: Command; el: HTMLButtonElement; variants: Command[] };

// the label of a command on the toolbar: its toolbar label, and else its label
function toolbarLabel(app: App, c: Command): string {
  return c.toolbar?.label ?? EXTRA[c.id]?.label ?? app.commands.label(c.id);
}

const faceOf = (c: Command): string | string[] => c.toolbar?.icon ?? EXTRA[c.id]?.icon ?? 'square';

export function install(app: App): void {
  injectStyle('toolbar', CSS);
  const top = make('div', 'beeson-edit-top');
  top.setAttribute('role', 'toolbar');
  top.setAttribute('aria-label', 'Toolbar');
  let shown: Shown[] = [];
  let signature = '';
  let late: { commands: Command[] }[] = [];
  // the layout kept for this deck, with null for the default set
  let kept: string[] | null = null;
  let show: Show = 'both';
  try {
    const saved = JSON.parse(stored(storeKey()) ?? 'null') as { items?: unknown; show?: unknown } | null;
    if (Array.isArray(saved?.items) && saved.items.every((x) => typeof x === 'string')) kept = saved.items as string[];
    if (SHOWS.some(([v]) => v === saved?.show)) show = saved!.show as Show;
  } catch {
    // a layout that is not read is the default set
  }
  let customizing = false;
  const more = make('button', 'tb more-groups');
  more.type = 'button';
  more.setAttribute('aria-label', 'More');
  more.setAttribute('aria-haspopup', 'menu');
  more.title = 'More';
  more.append(icon('more'), make('span', 'label', 'More'));
  const fail = (e: unknown) => app.fail(e);

  const zoomText = () => (app.stage?.zoom == null ? 'Fit' : percent(app.stage.zoom));
  const ids = (list: string[]): MenuItem[] => list.filter((id) => app.commands.get(id)).map((id) => ({ command: id }));
  const popupItems = (id: string): MenuItem[] => {
    if (id === 'toolbar.view') {
      return [...ids(['view.navigator', 'view.slideOnly', 'view.outline', 'view.lightTable']), { rule: true }, ...ids(['shell.format', 'view.steps', 'view.notes']), { rule: true }, ...ids(['view.rulers', 'view.guides', 'view.grid'])];
    }
    const zoom = app.stage.zoom;
    return [
      { label: 'Fit', checked: zoom === null, run: () => app.stage.setZoom(null) },
      ...ids(['zoom.actual', 'zoom.selection']),
      { rule: true },
      ...ZOOMS.map((z): MenuItem => ({ label: percent(z), checked: zoom !== null && Math.abs(zoom - z) < 0.005, run: () => app.stage.setZoom(z) })),
    ];
  };
  const openPopup = (id: string, b: HTMLElement | null, keyboard: boolean) => {
    const owner = b ?? top.querySelector<HTMLElement>(`[data-command="${id}"]`);
    if (!owner?.getClientRects().length) return;
    openMenu(app, popupItems(id), { anchor: owner.getBoundingClientRect(), placement: 'below', owner, keyboard, label: id === 'toolbar.view' ? 'View' : 'Zoom', className: id === 'toolbar.zoom' ? 'select' : undefined });
  };
  app.commands.define({ id: 'toolbar.view', label: 'View', toolbar: { group: 'view', order: 1, icon: 'navigator' }, run: () => openPopup('toolbar.view', null, document.activeElement?.matches('[data-command="toolbar.view"]') ?? false) });
  app.commands.define({ id: 'toolbar.zoom', label: 'Zoom', toolbar: { group: 'view', order: 2, icon: 'fit' }, run: () => openPopup('toolbar.zoom', null, document.activeElement?.matches('[data-command="toolbar.zoom"]') ?? false) });

  const button = (c: Command): HTMLButtonElement => {
    const b = make('button', 'tb');
    b.type = 'button';
    b.dataset.command = c.id;
    const label = toolbarLabel(app, c);
    const face = c.id === 'toolbar.zoom' ? make('span', 'readout', zoomText()) : glyph(faceOf(c));
    b.append(face, make('span', 'label', label));
    if (!POPUPS.has(c.id)) {
      wire(b, () => app.commands.run(c.id), fail);
      return b;
    }
    // a popup opens at the press, and a second press on its button closes it
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      if (b.getAttribute('aria-expanded') === 'true') closeMenus();
      else openPopup(c.id, b, false);
    });
    b.addEventListener('click', (ev) => {
      if (ev.detail === 0) openPopup(c.id, b, true);
    });
    return b;
  };

  // the list of a split button: its variants, with a rule where their group of the menu changes,
  // then the submenu that the split names in the menu of the first
  const splitItems = (first: Command, variants: Command[]): MenuItem[] => {
    const out: MenuItem[] = [];
    let last: string | undefined;
    for (const v of variants.length > 1 ? variants : []) {
      if (out.length && v.menu?.group !== last) out.push({ rule: true });
      last = v.menu?.group;
      out.push({ command: v.id });
    }
    const sub = first.menu && first.toolbar?.split ? menuItems(app, first.menu.bar, first.toolbar.split) : [];
    return out.length && sub.length ? [...out, { rule: true }, ...sub] : [...out, ...sub];
  };

  // the default set: the groups of the registry with a separator between them, and a space before
  // the groups after Present
  function defaults(groups: Group[]): string[] {
    const at = groups.findIndex((g) => g.commands.some((c) => c.id === 'file.present'));
    const out: string[] = [];
    for (const [i, g] of groups.entries()) {
      if (i) out.push(at >= 0 && i === at + 1 ? SPACE : SEPARATOR);
      for (const c of g.commands) if (!c.toolbar?.split || g.commands.find((x) => x.toolbar?.split === c.toolbar?.split) === c) out.push(c.id);
    }
    return out;
  }
  const layout = (groups = app.commands.forToolbar()): string[] => (kept ?? defaults(groups)).filter((id) => id === SEPARATOR || id === SPACE || app.commands.get(id));

  // the variants of the split of a command, in the order of its toolbar group, or the command alone
  const variantsOf = (c: Command, groups: Group[]): Command[] => {
    const split = c.toolbar?.split;
    const list = split ? (groups.find((g) => g.group === c.toolbar?.group)?.commands ?? []).filter((x) => x.toolbar?.split === split) : [];
    return list[0] === c ? list : [c];
  };

  const signatureOf = (groups: Group[]) => JSON.stringify([customizing, show, layout(groups), groups.map((g) => [g.group, g.commands.map((c) => c.id)])]);

  function render(): void {
    const groups = app.commands.forToolbar();
    const list = layout(groups);
    signature = signatureOf(groups);
    shown = [];
    late = [];
    top.classList.toggle('customizing', customizing);
    for (const [v] of SHOWS) top.classList.toggle(`show-${v}`, v === show);
    if (customizing) {
      top.classList.remove('compact');
      const parts: HTMLElement[] = [];
      // while the sheet is open, every item is drawn by itself, to be dragged
      for (const [i, id] of list.entries()) {
        let el: HTMLElement;
        if (id === SEPARATOR || id === SPACE) {
          el = make('span', id === SEPARATOR ? 'sep' : 'space');
          el.tabIndex = -1;
          el.setAttribute('role', 'separator');
          el.setAttribute('aria-label', MARKS[id].label);
        } else {
          const c = app.commands.get(id)!;
          const b = button(c);
          shown.push({ c, el: b, variants: [c] });
          el = b;
        }
        el.dataset.at = String(i);
        parts.push(el);
      }
      top.replaceChildren(...parts);
      update();
      return;
    }
    // the groups between the separators and the spaces, the group after a space at the right
    const boxes: { commands: Command[]; right: boolean }[] = [{ commands: [], right: false }];
    for (const id of list) {
      if (id === SEPARATOR || id === SPACE) boxes.push({ commands: [], right: id === SPACE });
      else boxes[boxes.length - 1].commands.push(app.commands.get(id)!);
    }
    const spaced = boxes.findIndex((b) => b.right);
    // the groups that may be folded into », from the right: those after the space, then those
    // before it but the first. the group of Format, which opens and closes the inspector, stays,
    // and the labels are hidden only where the toolbar does not fit with every group folded
    const filled = boxes.map((b, i) => i).filter((i) => boxes[i].commands.length && !boxes[i].commands.some((c) => c.id === 'shell.format'));
    const after = filled.filter((i) => spaced >= 0 && i >= spaced).reverse();
    const before = filled.filter((i) => !after.includes(i)).slice(1).reverse();
    const draw = (folded: Set<number>) => {
      shown = [];
      late = [];
      const parts: HTMLElement[] = [];
      const kept: HTMLElement[] = [];
      let right = false;
      for (const [i, box] of boxes.entries()) {
        right ||= box.right;
        if (!box.commands.length) continue;
        if (folded.has(i)) {
          late.push(box);
          continue;
        }
        const el = make('div', 'group');
        el.dataset.group = box.commands[0].toolbar?.group ?? 'custom';
        if (right) el.classList.add('right');
        right = false;
        for (const c of box.commands) {
          const variants = variantsOf(c, groups);
          const b = button(c);
          shown.push({ c, el: b, variants });
          if (c.toolbar?.split) el.append(splitButton(app, b, () => splitItems(c, variants), `${toolbarLabel(app, c)} options`));
          else el.append(b);
        }
        // the group of Format after a folded group is put after »
        (late.length && box.commands.some((c) => c.id === 'shell.format') ? kept : parts).push(el);
      }
      if (late.length) {
        const box = make('div', 'group');
        if (!parts.some((p) => p.classList.contains('right'))) box.classList.add('right');
        kept.forEach((k) => k.classList.remove('right'));
        box.append(more);
        parts.push(box);
      }
      parts.push(...kept);
      top.replaceChildren(...parts);
    };
    const over = () => top.isConnected && top.scrollWidth > top.clientWidth + 0.5;
    top.classList.remove('compact');
    draw(new Set());
    const fold = (order: number[]) => {
      const folded = new Set<number>();
      for (const i of order) {
        if (!over()) return;
        folded.add(i);
        draw(folded);
      }
    };
    fold([...after, ...before]);
    if (over()) {
      top.classList.add('compact');
      draw(new Set());
      fold([...after, ...before]);
    }
    update();
  }

  // the state of each button, and the one tab stop on the first button that can be pressed
  function update(): void {
    if (signatureOf(app.commands.forToolbar()) !== signature) {
      render();
      return;
    }
    for (const { c, el, variants } of shown) {
      const s = app.commands.state(c.id);
      el.disabled = !s.enabled && !customizing;
      const keys = commandKeys(c, app.platform);
      el.title = keys ? `${s.label} (${keys})` : s.label;
      // a split button is pressed while one of its variants is on, e.g. Arrow while an arrow is drawn
      const on = variants.map((v) => app.commands.state(v.id).checked);
      if (on.some((x) => x !== null) && !customizing) el.setAttribute('aria-pressed', String(on.some((x) => x === true)));
      else el.removeAttribute('aria-pressed');
      if (c.id === 'file.save') el.classList.toggle('on', app.dirty);
      if (c.id === 'toolbar.zoom') {
        const r = el.querySelector('.readout');
        if (r) r.textContent = zoomText();
      }
    }
    const stops = items();
    if (!stops.some((b) => b.tabIndex === 0)) stops.forEach((b, i) => (b.tabIndex = i === 0 ? 0 : -1));
    else stops.forEach((b) => b.tabIndex === 0 || (b.tabIndex = -1));
  }

  const items = (): HTMLElement[] => [...top.querySelectorAll<HTMLElement>(customizing ? 'button, .sep, .space' : 'button')].filter((b) => !(b as HTMLButtonElement).disabled && b.getClientRects().length > 0);

  top.addEventListener('keydown', (ev) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    let to = -1;
    if (ev.key === 'ArrowRight') to = (at + 1) % list.length;
    else if (ev.key === 'ArrowLeft') to = (at - 1 + list.length) % list.length;
    else if (ev.key === 'Home') to = 0;
    else if (ev.key === 'End') to = list.length - 1;
    else return;
    ev.preventDefault();
    ev.stopPropagation();
    list.forEach((b, i) => (b.tabIndex = i === to ? 0 : -1));
    list[to].focus();
  });
  // a button that gets the focus is the tab stop
  top.addEventListener('focusin', (ev) => {
    if (!(ev.target instanceof HTMLElement) || !items().includes(ev.target)) return;
    for (const b of items()) b.tabIndex = b === ev.target ? 0 : -1;
  });

  const openMore = (keyboard: boolean) => {
    const out: MenuItem[] = [];
    for (const g of late) {
      if (out.length) out.push({ rule: true });
      for (const c of g.commands) out.push({ command: c.id, label: toolbarLabel(app, c) });
    }
    openMenu(app, out, { anchor: more.getBoundingClientRect(), placement: 'below', owner: more, keyboard, label: 'More' });
  };
  more.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (more.getAttribute('aria-expanded') === 'true') closeMenus();
    else openMore(false);
  });
  more.addEventListener('click', (ev) => {
    if (ev.detail === 0) openMore(true);
  });

  // the sheet Customize Toolbar of Keynote, drawn down from the toolbar: the items that have a
  // place on it, the default set, and the choice of icons and labels. an item is dragged into the
  // toolbar or out of it, and the default set dragged into it puts it back. on the keyboard,
  // Return adds an item or puts the default set back, and Delete takes the item of the focus off
  const sheet = make('div', 'beeson-edit-customize');
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Customize Toolbar');
  const scrim = make('div', 'beeson-edit-customize-scrim');
  scrim.hidden = true;
  const palette = make('div', 'palette');
  palette.setAttribute('role', 'group');
  palette.setAttribute('aria-label', 'Items');
  const defaultRow = make('div', 'default');
  defaultRow.tabIndex = 0;
  defaultRow.setAttribute('role', 'button');
  defaultRow.setAttribute('aria-label', 'Default Set');
  defaultRow.title = 'Drag the default set into the toolbar, or press Return to put it back';
  const showButton = make('button', 'show');
  showButton.type = 'button';
  showButton.setAttribute('aria-haspopup', 'menu');
  const done = make('button', 'done', 'Done');
  done.type = 'button';
  const foot = make('div', 'foot');
  foot.append(make('span', '', 'Show'), showButton, done);
  sheet.append(make('p', 'lead', 'Drag your favorite items into the toolbar…'), palette, make('p', 'lead', '… or drag the default set into the toolbar.'), defaultRow, foot);
  const ghost = make('div', 'beeson-edit-drag-ghost');
  ghost.hidden = true;
  const mark = make('div', 'beeson-edit-drop-mark');
  mark.hidden = true;
  let back: HTMLElement | null = null;

  // a layout equal to the default set is kept as the default, and nothing is kept for the
  // default set shown with icons and labels
  const save = (next: string[] | null) => {
    kept = next && JSON.stringify(next) !== JSON.stringify(defaults(app.commands.forToolbar())) ? next : null;
    store(storeKey(), kept || show !== 'both' ? JSON.stringify({ items: kept, show }) : null);
    showButton.textContent = SHOWS.find(([v]) => v === show)![1];
    render();
  };
  const isMark = (id: string) => id === SEPARATOR || id === SPACE;
  const nameOf = (id: string) => (isMark(id) ? MARKS[id].label : toolbarLabel(app, app.commands.get(id)!));
  const faceFor = (id: string) => glyph(isMark(id) ? MARKS[id].icon : faceOf(app.commands.get(id)!));

  // the commands with a place in the default set, then the others that the sheet offers
  const paletteIds = (): string[] => {
    const ids = defaults(app.commands.forToolbar()).filter((id) => !isMark(id));
    for (const id of Object.keys(EXTRA)) if (app.commands.get(id) && !ids.includes(id)) ids.push(id);
    return [...ids, SEPARATOR, SPACE];
  };
  function fill(): void {
    palette.replaceChildren(...paletteIds().map((id) => {
      const el = make('div', 'item');
      const well = make('span', 'well');
      well.append(faceFor(id));
      el.append(well, make('span', 'name', nameOf(id)));
      el.dataset.item = id;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.title = `Drag ${nameOf(id)} into the toolbar, or press Return to add it`;
      return el;
    }));
    defaultRow.replaceChildren(...defaults(app.commands.forToolbar()).map((id) => {
      if (isMark(id)) return make('span', `mini ${id === SEPARATOR ? 'sep' : 'space'}`);
      const m = make('span', 'mini');
      m.append(faceFor(id), make('span', '', nameOf(id)));
      return m;
    }));
    showButton.textContent = SHOWS.find(([v]) => v === show)![1];
  }
  const place = () => {
    const y = top.getBoundingClientRect().bottom;
    sheet.style.top = scrim.style.top = `${y}px`;
    sheet.style.maxHeight = `${Math.max(160, innerHeight - y - 16)}px`;
  };
  function openSheet(): void {
    if (customizing) return;
    closeMenus();
    back = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    customizing = true;
    render();
    fill();
    if (!sheet.isConnected) document.body.append(scrim, sheet, ghost, mark);
    sheet.hidden = scrim.hidden = false;
    place();
    palette.querySelector<HTMLElement>('.item')?.focus();
  }
  function closeSheet(): void {
    if (!customizing) return;
    endDrag();
    customizing = false;
    sheet.hidden = scrim.hidden = true;
    closeMenus();
    render();
    if (back?.isConnected) back.focus({ preventScroll: true });
    else if (sheet.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    back = null;
  }
  // Show Toolbar and Hide Toolbar of the View menu of Keynote, with its key ⌥⌘T, and elsewhere
  // with Ctrl+F1, the key of the ribbon of PowerPoint for Windows. the choice is kept per browser
  const hidden = () => document.documentElement.classList.contains('beeson-no-toolbar');
  const setHidden = (on: boolean) => {
    if (on && top.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    document.documentElement.classList.toggle('beeson-no-toolbar', on);
    store('beeson-toolbar-hidden', on ? '1' : null);
    app.relayout();
  };
  if (stored('beeson-toolbar-hidden') === '1') document.documentElement.classList.add('beeson-no-toolbar');
  app.commands.define({
    id: 'view.toolbar',
    label: () => (hidden() ? 'Show Toolbar' : 'Hide Toolbar'),
    keys: { mac: ['Alt+Mod+T'], other: ['Ctrl+F1'] },
    in: OUTSIDE_DIALOGS,
    menu: { bar: 'View', group: 'toolbar', order: 89 },
    run: () => setHidden(!hidden()),
  });
  app.commands.define({
    id: 'view.customizeToolbar',
    label: 'Customize Toolbar…',
    menu: { bar: 'View', group: 'toolbar', order: 90 },
    run: () => {
      if (hidden()) setHidden(false);
      if (customizing) closeSheet();
      else openSheet();
    },
  });

  // a drag adds an item of the sheet, moves an item of the toolbar or takes it off when it is
  // dropped outside, or puts the default set back. it starts once the pointer moves 4 px
  type Drag = { kind: 'add' | 'move' | 'default'; id: string; from: number; x: number; y: number; started: boolean; pointer: number };
  let drag: Drag | null = null;
  const begin = (ev: PointerEvent, kind: Drag['kind'], id: string, from: number) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    drag = { kind, id, from, x: ev.clientX, y: ev.clientY, started: false, pointer: ev.pointerId };
  };
  function endDrag(): void {
    drag = null;
    ghost.hidden = mark.hidden = true;
  }
  const overBar = (ev: PointerEvent) => {
    const r = top.getBoundingClientRect();
    return ev.clientY >= r.top - 8 && ev.clientY <= r.bottom + 8 && ev.clientX >= r.left && ev.clientX <= r.right;
  };
  const slots = () => [...top.querySelectorAll<HTMLElement>(':scope > [data-at]')];
  // the index of the layout before which a drop at x puts its item
  const dropAt = (x: number): number => {
    for (const el of slots()) {
      const r = el.getBoundingClientRect();
      if (x < r.left + r.width / 2) return Number(el.dataset.at);
    }
    return layout().length;
  };
  const showMark = (at: number) => {
    const r = top.getBoundingClientRect();
    const list = slots();
    const el = list.find((k) => Number(k.dataset.at) === at);
    const last = list[list.length - 1];
    const x = el ? el.getBoundingClientRect().left : last ? last.getBoundingClientRect().right : r.left + 10;
    mark.style.left = `${x - 1}px`;
    mark.style.top = `${r.top + 6}px`;
    mark.style.height = `${r.height - 12}px`;
    mark.hidden = false;
  };
  window.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.pointer) return;
    if (!drag.started) {
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 4) return;
      drag.started = true;
      if (drag.kind === 'default') ghost.replaceChildren(make('span', '', 'Default Set'));
      else ghost.replaceChildren(faceFor(drag.id), make('span', '', nameOf(drag.id)));
      ghost.hidden = false;
    }
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    const over = overBar(ev);
    ghost.classList.toggle('remove', drag.kind === 'move' && !over);
    if (over && drag.kind !== 'default') showMark(dropAt(ev.clientX));
    else mark.hidden = true;
  }, true);
  window.addEventListener('pointerup', (ev) => {
    if (!drag || ev.pointerId !== drag.pointer) return;
    const d = drag;
    endDrag();
    if (!d.started) return;
    const over = overBar(ev);
    if (d.kind === 'default') {
      if (over) save(null);
      return;
    }
    let at = over ? dropAt(ev.clientX) : -1;
    if (at < 0 && d.kind === 'add') return;
    const list = layout();
    // a command is on the toolbar once, hence a command dragged in from the sheet is moved
    const was = d.kind === 'move' ? d.from : isMark(d.id) ? -1 : list.indexOf(d.id);
    if (was >= 0) {
      list.splice(was, 1);
      if (at > was) at--;
    }
    if (at >= 0) list.splice(at, 0, d.id);
    save(list);
  }, true);
  window.addEventListener('pointercancel', () => drag && endDrag(), true);

  // while the sheet is open, the buttons of the toolbar are items to drag and do not run
  top.addEventListener('pointerdown', (ev) => {
    if (!customizing) return;
    ev.stopPropagation();
    const el = (ev.target as Element).closest<HTMLElement>('[data-at]');
    if (!el) return;
    el.focus({ preventScroll: true });
    begin(ev, 'move', layout()[Number(el.dataset.at)], Number(el.dataset.at));
  }, true);
  top.addEventListener('click', (ev) => {
    if (!customizing) return;
    ev.stopPropagation();
    ev.preventDefault();
  }, true);
  top.addEventListener('keydown', (ev) => {
    if (!customizing) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      closeSheet();
      return;
    }
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
    const el = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('[data-at]') : null;
    if (!el || !top.contains(el)) return;
    ev.preventDefault();
    const at = Number(el.dataset.at);
    const list = layout();
    list.splice(at, 1);
    save(list);
    top.querySelector<HTMLElement>(`[data-at="${Math.min(at, list.length - 1)}"]`)?.focus();
  });
  const add = (id: string) => {
    const list = layout();
    if (!isMark(id) && list.includes(id)) return;
    const at = list.indexOf(SPACE);
    list.splice(at < 0 ? list.length : at, 0, id);
    save(list);
  };
  const pressed = (ev: KeyboardEvent) => ev.key === 'Enter' || ev.key === ' ';
  palette.addEventListener('pointerdown', (ev) => {
    const el = (ev.target as Element).closest<HTMLElement>('.item');
    if (el) begin(ev, 'add', el.dataset.item!, -1);
  });
  palette.addEventListener('keydown', (ev) => {
    const el = (ev.target as Element).closest<HTMLElement>('.item');
    if (!el || !pressed(ev)) return;
    ev.preventDefault();
    add(el.dataset.item!);
  });
  defaultRow.addEventListener('pointerdown', (ev) => begin(ev, 'default', '', -1));
  defaultRow.addEventListener('keydown', (ev) => {
    if (!pressed(ev)) return;
    ev.preventDefault();
    save(null);
  });
  const openShow = (keyboard: boolean) =>
    openMenu(app, SHOWS.map(([v, label]): MenuItem => ({ label, checked: v === show, run: () => { show = v; save(kept); } })), { anchor: showButton.getBoundingClientRect(), placement: 'below', owner: showButton, keyboard, label: 'Show', className: 'select' });
  showButton.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    if (showButton.getAttribute('aria-expanded') === 'true') closeMenus();
    else openShow(false);
  });
  showButton.addEventListener('click', (ev) => ev.detail === 0 && openShow(true));
  done.addEventListener('click', closeSheet);
  sheet.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    ev.preventDefault();
    closeSheet();
  });
  scrim.addEventListener('pointerdown', (ev) => ev.preventDefault());
  window.addEventListener('resize', () => customizing && place());

  app.listen('history', update);
  app.listen('report', update);
  app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], update);
  // the toolbar is laid out again when its width changes, e.g. with the window
  let width = 0;
  new ResizeObserver(() => {
    if (top.clientWidth === width) return;
    width = top.clientWidth;
    if (!customizing) render();
  }).observe(top);
  // a mode that ends without a change of the file, e.g. the drawing of a line left with Esc, is
  // shown on its switch after the key or the release that ends it
  for (const type of ['keyup', 'pointerup']) window.addEventListener(type, () => requestAnimationFrame(update), true);
  render();
  document.body.append(top);
}
