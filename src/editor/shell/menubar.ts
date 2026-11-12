// the menu bar, with the menus File, Edit, Insert, Slide, Format, Arrange, View, and Help drawn
// from the commands of the registry when they are opened, the name and the state of the file in
// the middle, and at the right Which? and the Autosave switch. a title is a menu item of a menubar
// with a roving tabindex: Left and Right move between the titles, and Down, Enter, or Space opens
// the menu. while a menu is open, the pointer over another title opens its menu, and Left and
// Right in a menu open the menu beside it. a menu without an item is dimmed. the Help menu opens
// with a search field over the commands of every menu, as in macOS

import type { App } from '../app.ts';
import { canWrite, fileName } from '../file/files.ts';
import { injectStyle, make, wire } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, menuItems, menuOpen, openMenu, type OpenMenu } from '../ui/menu.ts';

// the least width of the title of the file, in CSS px
const MIN_TITLE = 40;

// the order of the menu bar of Keynote
export const MENUS = ['File', 'Edit', 'Insert', 'Slide', 'Format', 'Arrange', 'View', 'Help'];

const CSS = `
.beeson-edit-titlebar { display: grid; grid-template-columns: minmax(max-content, 1fr) minmax(0, max-content) minmax(max-content, 1fr); align-items: center; column-gap: 12px; height: 28px; padding: 0 8px 0 6px; box-sizing: border-box; font: 13px/1 var(--ed-font); color: var(--ed-text); user-select: none; -webkit-user-select: none; }
.beeson-edit-menubar { display: flex; align-items: center; }
.beeson-edit-menubar [role=menuitem] { height: 22px; padding: 0 8px; border: 0; border-radius: 5px; background: transparent; color: inherit; font: inherit; cursor: default; white-space: nowrap; }
.beeson-edit-menubar [role=menuitem]:first-child { font-weight: 600; }
.beeson-edit-menubar [role=menuitem]:hover, .beeson-edit-menubar [role=menuitem][aria-expanded="true"] { background: var(--ed-pressed); }
.beeson-edit-menubar [role=menuitem][aria-disabled="true"] { color: var(--ed-faint); }
.beeson-edit-menubar [role=menuitem]:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -2px; }
.beeson-edit-titlebar .doc { min-width: 0; display: flex; gap: 12px; align-items: baseline; overflow: hidden; white-space: nowrap; }
.beeson-edit-titlebar .file { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.beeson-edit-titlebar .doc.tight .state { display: none; }
.beeson-edit-titlebar .doc.gone { visibility: hidden; }
.beeson-edit-titlebar .state { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--ed-muted); }
.beeson-edit-titlebar .state.warn { color: var(--ed-guide); }
.beeson-edit-titlebar .right { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
.beeson-edit-titlebar .right button { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border: 0; border-radius: 5px; background: transparent; color: inherit; font: 12px/1 var(--ed-font); cursor: default; white-space: nowrap; }
.beeson-edit-titlebar .right button:hover { background: var(--ed-hover); }
.beeson-edit-titlebar .right button[hidden] { display: none; }
.beeson-edit-titlebar .right button:disabled { color: var(--ed-faint); }
.beeson-edit-titlebar .right button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: -2px; }
.beeson-edit-titlebar button.which { color: var(--ed-guide); }
.beeson-edit-titlebar .track { position: relative; width: 26px; height: 15px; border-radius: 8px; background: var(--ed-control-line); transition: background 120ms; }
.beeson-edit-titlebar .track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%; background: #fff; box-shadow: 0 0.5px 1.5px rgba(0, 0, 0, 0.3); transition: transform 120ms; }
.beeson-edit-titlebar button[aria-pressed="true"] .track { background: var(--ed-select); }
.beeson-edit-titlebar button[aria-pressed="true"] .track::after { transform: translateX(11px); }
@media (max-width: 899px) { .beeson-edit-titlebar .doc .state { display: none; } }
`;

export function install(app: App): void {
  injectStyle('menubar', CSS);
  const row = make('div', 'beeson-edit-titlebar');
  const bar = make('div', 'beeson-edit-menubar');
  bar.setAttribute('role', 'menubar');
  bar.setAttribute('aria-label', 'Menus');
  const doc = make('div', 'doc');
  const fileEl = make('span', 'file');
  const stateEl = make('span', 'state');
  stateEl.setAttribute('aria-live', 'polite');
  doc.append(fileEl, stateEl);
  const right = make('div', 'right');
  const which = make('button', 'which');
  which.type = 'button';
  which.title = 'List the texts that cannot be edited';
  which.hidden = true;
  which.append(icon('warning', 14), document.createTextNode('Which?'));
  const autosave = make('button', 'autosave');
  autosave.type = 'button';
  autosave.title = 'Save the edits into the file after each change';
  autosave.append(document.createTextNode('Autosave'), make('span', 'track'));
  if (!canWrite()) {
    autosave.disabled = true;
    autosave.title = 'Autosave needs a browser that writes the file in place, i.e. Chrome or Edge';
  }
  right.append(which, autosave);
  row.append(bar, doc, right);

  const titles = MENUS.map((name, i) => {
    const b = make('button', '', name);
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.tabIndex = i === 0 ? 0 : -1;
    bar.append(b);
    return b;
  });

  let open: { title: HTMLButtonElement; menu: OpenMenu } | null = null;
  const empty = (name: string) => menuItems(app, name).length === 0;
  const dim = () => titles.forEach((t) => t.setAttribute('aria-disabled', String(empty(t.textContent ?? ''))));
  const rove = (to: HTMLButtonElement) => {
    for (const t of titles) t.tabIndex = t === to ? 0 : -1;
  };

  function show(title: HTMLButtonElement, keyboard: boolean): void {
    const name = title.textContent ?? '';
    rove(title);
    if (empty(name)) {
      closeMenus();
      if (keyboard) title.focus();
      return;
    }
    const help = name === 'Help';
    const items = menuItems(app, name);
    const menu = openMenu(app, help ? [{ search: { bars: MENUS } }, { rule: true }, ...items] : items, {
      anchor: title.getBoundingClientRect(),
      placement: 'below',
      owner: title,
      keyboard,
      label: name,
      className: help ? 'bar help' : 'bar',
      onClose: () => {
        if (open?.menu === menu) open = null;
      },
      onSibling: (step) => sibling(title, step, true),
    });
    open = { title, menu };
  }

  // the next title that has a menu, in the direction of step
  function sibling(from: HTMLButtonElement, step: 1 | -1, opening: boolean): void {
    let i = titles.indexOf(from);
    for (let n = 0; n < titles.length; n++) {
      i = (i + step + titles.length) % titles.length;
      if (!opening || !empty(titles[i].textContent ?? '')) break;
    }
    const to = titles[i];
    if (opening) show(to, true);
    else {
      rove(to);
      to.focus();
    }
  }

  for (const title of titles) {
    title.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (open?.title === title && menuOpen()) closeMenus();
      else show(title, false);
    });
    title.addEventListener('pointerenter', () => {
      if (open && open.title !== title && menuOpen()) show(title, false);
    });
    title.addEventListener('click', (ev) => {
      if (ev.detail === 0) show(title, true);
    });
    title.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') sibling(title, ev.key === 'ArrowRight' ? 1 : -1, false);
      else if (ev.key === 'Home' || ev.key === 'End') {
        const to = ev.key === 'Home' ? titles[0] : titles[titles.length - 1];
        rove(to);
        to.focus();
      } else if (ev.key === 'ArrowDown' || ev.key === 'Enter' || ev.key === ' ') show(title, true);
      else if (ev.key === 'Escape') title.blur();
      else return;
      ev.preventDefault();
      ev.stopPropagation();
    });
  }
  bar.addEventListener('focusin', dim);

  // the title of the file is centered between the menus and the buttons at the right while there is
  // room for it. with less room, as in PowerPoint and Keynote, the state is left out first, then
  // the name is cut with an ellipsis, and below a few letters the title is hidden
  function fit(): void {
    doc.classList.remove('tight', 'gone');
    const cut = () => doc.scrollWidth > doc.clientWidth || fileEl.scrollWidth > fileEl.clientWidth;
    if (!cut()) return;
    doc.classList.add('tight');
    if (cut() && doc.clientWidth < MIN_TITLE) doc.classList.add('gone');
  }

  const fail = (e: unknown) => app.fail(e);
  wire(which, () => app.files.showProblems(), fail);
  wire(autosave, () => app.commands.run('file.autosave'), fail);
  app.listen('report', () => {
    fileEl.textContent = app.handle?.name ?? fileName();
    autosave.setAttribute('aria-pressed', String(app.autosave));
    autosave.classList.toggle('on', app.autosave);
    which.hidden = !app.pairing?.problems.length;
    stateEl.textContent = app.line.text;
    stateEl.title = app.line.title;
    stateEl.classList.toggle('warn', app.line.warn);
    fit();
  });
  new ResizeObserver(fit).observe(row);
  app.onRefresh(['content', 'selection', 'slide', 'structure', 'layout'], dim);
  const header = document.querySelector('.beeson-edit-header');
  if (header) header.prepend(row);
  else document.body.append(row);
}
