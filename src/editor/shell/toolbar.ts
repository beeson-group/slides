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
import { injectStyle, make, wire } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, commandKeys, menuItems, openMenu, splitButton, type MenuItem } from '../ui/menu.ts';
import { ZOOMS } from './canvas.ts';

const NARROW = 820;
const POPUPS = new Set(['toolbar.view', 'toolbar.zoom']);
const percent = (z: number) => `${Math.round(z * 100)}%`;

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
`;

type Shown = { c: Command; el: HTMLButtonElement; variants: Command[] };

// the label of a command on the toolbar: its toolbar label, and else its label
function toolbarLabel(app: App, c: Command): string {
  return c.toolbar?.label ?? app.commands.label(c.id);
}

export function install(app: App): void {
  injectStyle('toolbar', CSS);
  const top = make('div', 'beeson-edit-top');
  top.setAttribute('role', 'toolbar');
  top.setAttribute('aria-label', 'Toolbar');
  let shown: Shown[] = [];
  let signature = '';
  let narrow = innerWidth < NARROW;
  let late: Group[] = [];
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
      return [...ids(['view.navigator', 'view.outline', 'view.lightTable']), { rule: true }, ...ids(['shell.format', 'view.steps', 'view.notes']), { rule: true }, ...ids(['view.rulers', 'view.guides', 'view.grid'])];
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
    const face = c.id === 'toolbar.zoom' ? make('span', 'readout', zoomText()) : icon(c.toolbar?.icon ?? 'square');
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

  function render(): void {
    const groups = app.commands.forToolbar();
    const at = groups.findIndex((g) => g.commands.some((c) => c.id === 'file.present'));
    signature = JSON.stringify([narrow, groups.map((g) => [g.group, g.commands.map((c) => c.id)])]);
    shown = [];
    late = narrow && at >= 0 ? groups.slice(at + 1) : [];
    const parts: HTMLElement[] = [];
    for (const [i, g] of groups.entries()) {
      if (late.includes(g)) continue;
      const box = make('div', 'group');
      box.dataset.group = g.group;
      if (at >= 0 && i === at + 1) box.classList.add('right');
      for (const c of g.commands) {
        const split = c.toolbar?.split;
        const variants = split ? g.commands.filter((x) => x.toolbar?.split === split) : [c];
        if (variants[0] !== c) continue;
        const b = button(c);
        shown.push({ c, el: b, variants });
        if (split) box.append(splitButton(app, b, () => splitItems(c, variants), `${toolbarLabel(app, c)} options`));
        else box.append(b);
      }
      parts.push(box);
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
    const next = JSON.stringify([innerWidth < NARROW, app.commands.forToolbar().map((g) => [g.group, g.commands.map((c) => c.id)])]);
    if (next !== signature) {
      narrow = innerWidth < NARROW;
      render();
      return;
    }
    for (const { c, el, variants } of shown) {
      const s = app.commands.state(c.id);
      el.disabled = !s.enabled;
      const keys = commandKeys(c, app.platform);
      el.title = keys ? `${s.label} (${keys})` : s.label;
      // a split button is pressed while one of its variants is on, e.g. Arrow while an arrow is drawn
      const on = variants.map((v) => app.commands.state(v.id).checked);
      if (on.some((x) => x !== null)) el.setAttribute('aria-pressed', String(on.some((x) => x === true)));
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

  const items = (): HTMLButtonElement[] => [...top.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.disabled && b.getClientRects().length > 0);

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
    if (!(ev.target instanceof HTMLButtonElement)) return;
    for (const b of top.querySelectorAll('button')) b.tabIndex = b === ev.target ? 0 : -1;
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
