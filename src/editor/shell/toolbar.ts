// the toolbar, drawn from the commands of the registry that name a toolbar place: a 20 px icon over
// an 11 px label in groups with a thin rule between them, and the groups after Present at the
// right. a switch is shown pressed, and a command whose toolbar place names a split is drawn as a
// split button. the commands of a group that name the same split are its variants, e.g. Image…,
// Video…, and QR Code under Media, as the Pictures button of PowerPoint: the main part runs the
// first of them, and its arrow lists them with the commands of the submenu of that name of the
// menu of the first. below a window width of 1100 px
// the labels are hidden and kept as the text of the buttons, and below 820 px the groups after
// Present are put into a menu ». the toolbar has one tab stop, and the arrow keys move in it. the
// View and Zoom popups at its left are as in Keynote: View with the views of the slides and the
// panes, and Zoom with Fit, Actual Size, Zoom to Selection, and the levels, showing the zoom on its
// face

import type { App } from '../app.ts';
import type { Command, Group } from '../commands.ts';
import { injectStyle, make, stored, wire } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, commandKeys, menuItems, openMenu, splitButton, type MenuItem } from '../ui/menu.ts';
import { ZOOMS } from './canvas.ts';

const NARROW = 820;
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
@media (max-width: 1099px) { .beeson-edit-top .tb .label { display: none; } .beeson-edit-top .tb { min-width: 36px; } }
.beeson-edit-top.show-icon .tb .label { display: none; }
.beeson-edit-top.show-icon .tb { min-width: 36px; }
.beeson-edit-top.show-text .tb > .beeson-icon { display: none; }
.beeson-edit-top.show-text .tb .label { display: inline; font-size: 12px; }
.beeson-edit-top.customizing .tb { cursor: grab; }
.beeson-edit-top .sep { flex: none; align-self: center; width: 13px; height: 28px; background: linear-gradient(var(--ed-line), var(--ed-line)) center / 1px 100% no-repeat; }
.beeson-edit-top .space { flex: 1 1 24px; min-width: 24px; align-self: stretch; margin: 6px 0; border: 1px dashed var(--ed-line); border-radius: 6px; }
.beeson-edit-top .sep:focus-visible, .beeson-edit-top .space:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -2px; }
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
  let narrow = innerWidth < NARROW;
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

  const signatureOf = (groups: Group[]) => JSON.stringify([innerWidth < NARROW, customizing, show, layout(groups), groups.map((g) => [g.group, g.commands.map((c) => c.id)])]);

  function render(): void {
    const groups = app.commands.forToolbar();
    const list = layout(groups);
    signature = signatureOf(groups);
    shown = [];
    late = [];
    top.classList.toggle('customizing', customizing);
    for (const [v] of SHOWS) top.classList.toggle(`show-${v}`, v === show);
    const parts: HTMLElement[] = [];
    if (customizing) {
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
    let right = false;
    for (const [i, box] of boxes.entries()) {
      right ||= box.right;
      if (!box.commands.length) continue;
      if (narrow && spaced >= 0 && i >= spaced) {
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
      parts.push(el);
    }
    if (late.length) {
      const box = make('div', 'group right');
      box.append(more);
      parts.push(box);
    }
    top.replaceChildren(...parts);
    update();
  }

  // the state of each button, and the one tab stop on the first button that can be pressed
  function update(): void {
    if (signatureOf(app.commands.forToolbar()) !== signature) {
      narrow = innerWidth < NARROW;
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

  app.listen('history', update);
  app.listen('report', update);
  app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], update);
  window.addEventListener('resize', update);
  // a mode that ends without a change of the file, e.g. the drawing of a line left with Esc, is
  // shown on its switch after the key or the release that ends it
  for (const type of ['keyup', 'pointerup']) window.addEventListener(type, () => requestAnimationFrame(update), true);
  render();
  document.body.append(top);
}
