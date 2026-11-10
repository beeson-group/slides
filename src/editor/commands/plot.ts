// Edit Plot Data, in Format > Plot, in the context menu of an element, and in the Plot pane of the
// inspector, as Show Chart Data Editor in Keynote. it opens a floating window with the sheets of
// plotdata.ts, whose cells are edited in a grid while the plot is drawn again from the text typed.
// a cell is written when it is left, as a change of the text of the JSON block alone, i.e. the
// script element is replaced by a copy with the new text, and its unit keeps every other byte. a
// value that the theme cannot read is shown in red, and it is not written. the plot is drawn again
// after every change of its block, also at an undo

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { CONTAINER } from '../canvas/hit.ts';
import { make, injectStyle } from '../ui/dom.ts';
import { install as installSurface } from '../inspector/surface.ts';
import { addRow, deleteRow, setCell, sheetsOf, type Cell, type Result, type Sheet } from '../plotdata.ts';

type View = { el: HTMLElement; reload(text?: string | null): void; setTab(i: number): void };
type Page = { Beeson?: { plots?: View[]; mount?(root: Element): void } };
const page = () => window as unknown as Page;

const shown = (el: Element) => el.getBoundingClientRect().width > 0;

// the plot that the selection is or holds alone in a figure, a zone, or a plate
export function plotOf(app: App): HTMLElement | null {
  const el = app.selection.only();
  if (!el) return null;
  if (el.matches('.plot')) return el as HTMLElement;
  if (!el.matches(CONTAINER)) return null;
  const found = [...el.querySelectorAll<HTMLElement>('.plot')].filter(shown);
  return found.length === 1 ? found[0] : null;
}

// the JSON block of plot when it is in the file, which a block made by a script is not
export function blockOf(app: App, plot: Element | null): HTMLScriptElement | null {
  const id = plot?.getAttribute('data-plot');
  const block = id ? document.getElementById(id) : null;
  return block instanceof HTMLScriptElement && app.pairing?.elements.get(block)?.open ? block : null;
}

const viewOf = (plot: Element) => page().Beeson?.plots?.find((p) => p.el === plot) ?? null;

// the text of the unit of a block in the file, cut around the JSON text inside the script element
function partsOf(app: App, block: Element) {
  const unit = app.doc.unitText(block);
  const body = app.doc.elementText(block);
  const at = unit.indexOf(body);
  const open = body.indexOf('>') + 1;
  const close = body.lastIndexOf('</');
  return { before: unit.slice(0, at) + body.slice(0, open), json: body.slice(open, close), after: body.slice(close) + unit.slice(at + body.length) };
}

export const jsonOf = (app: App, block: Element): string => partsOf(app, block).json;

// the block of plot replaced by a copy with the JSON text json, as an entry of the history
async function write(app: App, plot: Element, json: string): Promise<void> {
  const block = blockOf(app, plot);
  if (!block) throw new Error('the JSON block of the plot is not in the file');
  const parts = partsOf(app, block);
  if (parts.json === json) return;
  const fresh = block.cloneNode(false) as HTMLScriptElement;
  fresh.textContent = json.replace(/\r\n/g, '\n');
  const rec = app.doc.detach(block);
  let made = { node: fresh as Element, parent: rec.parent, prev: rec.prev, next: rec.next, text: parts.before + json + parts.after };
  await app.doc.attach(made);
  app.history.push({
    label: 'Edit Plot Data',
    undo: async () => {
      made = app.doc.detach(fresh);
      await app.doc.attach(rec);
    },
    redo: async () => {
      app.doc.detach(block);
      await app.doc.attach(made);
    },
  });
}

// the plot drawn again from its block, at the tab of tab when it is given
function redraw(plot: HTMLElement, text: string | null = null, tab: number | null = null): void {
  const view = viewOf(plot);
  if (!view) return;
  view.reload(text);
  page().Beeson?.mount?.(plot);
  if (tab !== null) view.setTab(tab);
}

const STYLE = `
.beeson-plotdata { position: fixed; z-index: 80; top: 92px; right: calc(var(--ed-insp-col, 0px) + 16px); width: 560px; max-width: calc(100vw - 32px); max-height: calc(100vh - 140px); display: flex; flex-direction: column; box-sizing: border-box; background: var(--ed-panel); color: var(--ed-text); border: 1px solid var(--ed-menu-line); border-radius: 10px; box-shadow: 0 10px 32px rgba(0, 0, 0, 0.22), 0 0 0 0.5px rgba(0, 0, 0, 0.12); font: 13px/1.3 var(--ed-font); user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: dark) { .beeson-plotdata { background: var(--ed-bg); box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55), 0 0 0 0.5px rgba(0, 0, 0, 0.8); } }
.beeson-plotdata[hidden] { display: none; }
.beeson-plotdata .title { position: relative; flex: none; height: 28px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--ed-line); color: var(--ed-muted); font-weight: 500; cursor: grab; touch-action: none; }
.beeson-plotdata .title.dragging { cursor: grabbing; }
.beeson-plotdata .title .close { position: absolute; left: 9px; top: 8px; width: 12px; height: 12px; padding: 0; border: 0; border-radius: 50%; background: var(--ed-control-line); }
.beeson-plotdata .title .close:hover, .beeson-plotdata .title .close:focus-visible { background: var(--ed-muted); }
.beeson-plotdata .bar { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; }
.beeson-plotdata .sheets { display: flex; flex-wrap: wrap; gap: 2px; padding: 2px; border-radius: 7px; background: var(--ed-pressed); min-width: 0; }
.beeson-plotdata .sheets button { height: 22px; padding: 0 10px; border: 0; border-radius: 5px; background: transparent; color: var(--ed-text); white-space: nowrap; }
.beeson-plotdata .sheets button[aria-selected="true"] { background: var(--ed-panel); box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.25); }
.beeson-plotdata .grow { flex: 1; }
.beeson-plotdata .rows button { height: 24px; padding: 0 10px; border: 0; border-radius: 6px; background: var(--ed-pressed); color: var(--ed-text); white-space: nowrap; }
.beeson-plotdata button { font: inherit; cursor: default; }
.beeson-plotdata button:hover:not(:disabled) { box-shadow: inset 0 0 0 100px var(--ed-hover); }
.beeson-plotdata button:disabled { color: var(--ed-faint); }
.beeson-plotdata button:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-plotdata .grid { flex: 1 1 auto; min-height: 60px; overflow: auto; margin: 0 12px; border: 1px solid var(--ed-line); border-radius: 6px; background: var(--ed-control); }
.beeson-plotdata table { border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; }
.beeson-plotdata th, .beeson-plotdata td { border-right: 1px solid var(--ed-line); border-bottom: 1px solid var(--ed-line); padding: 0; height: 24px; }
.beeson-plotdata thead th { position: sticky; top: 0; z-index: 1; background: var(--ed-panel); color: var(--ed-muted); font-weight: 500; padding: 0 8px; white-space: nowrap; text-align: left; }
.beeson-plotdata tbody th { position: sticky; left: 0; background: var(--ed-panel); color: var(--ed-muted); font-weight: 400; padding: 0 8px; text-align: right; min-width: 18px; }
.beeson-plotdata thead th:first-child { left: 0; z-index: 2; }
.beeson-plotdata tbody tr.at th { color: var(--ed-text); }
.beeson-plotdata td.none { background: repeating-linear-gradient(135deg, transparent 0 5px, var(--ed-line) 5px 6px); }
.beeson-plotdata td input { box-sizing: border-box; width: 100%; min-width: 84px; height: 23px; padding: 0 8px; border: 0; outline: 0; background: transparent; color: var(--ed-text); font: inherit; user-select: text; -webkit-user-select: text; }
.beeson-plotdata td input.num { text-align: right; }
.beeson-plotdata td input:focus { box-shadow: inset 0 0 0 2px var(--ed-select); }
.beeson-plotdata td.bad { background: rgba(209, 69, 59, 0.14); }
.beeson-plotdata td.bad input { color: #d1453b; }
.beeson-plotdata .state { flex: none; min-height: 16px; padding: 8px 12px 10px; color: var(--ed-muted); font-size: 12px; }
.beeson-plotdata .state.bad { color: #d1453b; }
`;

const key = (cell: Cell) => cell.path.join('/');

// the window of the data of one plot at a time, which follows the selection to another plot
class DataWindow {
  readonly el = make('div', 'beeson-plotdata');
  private readonly app: App;
  private readonly title = make('div', 'title');
  private readonly name = make('span');
  private readonly tabs = make('div', 'sheets');
  private readonly add = make('button', '', 'Add Row');
  private readonly del = make('button', '', 'Delete Row');
  private readonly grid = make('div', 'grid');
  private readonly state = make('div', 'state');
  plot: HTMLElement | null = null;
  // the JSON text of the block in the file, and its sheets
  private json = '';
  private sheets: Sheet[] = [];
  sheet = 0;
  // the cell focused last, as row and column
  at: { r: number; c: number } | null = null;
  // the texts typed into cells and not written, by the path of the cell, with the fault of a text
  // that cannot be read, which is shown in red. a refresh of the window keeps them
  private readonly drafts = new Map<string, { typed: string; error: string | null }>();
  private inputs: (HTMLInputElement | null)[][] = [];
  private shape = '';

  constructor(app: App) {
    this.app = app;
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Plot Data');
    const close = make('button', 'close');
    close.type = 'button';
    close.title = 'Close';
    close.setAttribute('aria-label', 'Close Plot Data');
    close.addEventListener('click', () => void app.commands.run('plot.closeData'));
    this.title.append(close, this.name);
    const rows = make('div', 'rows');
    for (const [b, id] of [[this.add, 'plot.addRow'], [this.del, 'plot.deleteRow']] as const) {
      b.type = 'button';
      b.dataset.command = id;
      b.addEventListener('pointerdown', (ev) => ev.preventDefault());
      b.addEventListener('click', () => void app.commands.run(id).catch((e) => this.fail(e)));
      rows.append(b);
    }
    const bar = make('div', 'bar');
    bar.append(this.tabs, make('span', 'grow'), rows);
    this.el.append(this.title, bar, this.grid, this.state);
    this.state.setAttribute('aria-live', 'polite');
    this.dragTitle();
    this.grid.addEventListener('focusin', (ev) => this.focused(ev.target));
    this.grid.addEventListener('focusout', (ev) => this.left(ev.target));
    this.grid.addEventListener('input', (ev) => this.typed(ev.target));
    this.grid.addEventListener('keydown', (ev) => this.key(ev));
    document.body.append(this.el);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  current(): Sheet | null {
    return this.sheets[this.sheet] ?? null;
  }

  show(plot: HTMLElement): void {
    if (plot !== this.plot) {
      this.plot = plot;
      this.sheet = 0;
      this.at = null;
      this.drafts.clear();
    }
    this.el.hidden = false;
    this.read();
    this.preview(null);
    this.focusCell(this.at ?? { r: 0, c: 0 });
  }

  close(): void {
    const plot = this.plot;
    this.el.hidden = true;
    this.plot = null;
    this.drafts.clear();
    // a preview of a text that was not written is replaced by the plot of the file
    if (plot?.isConnected) redraw(plot);
  }

  // the sheets read again from the file, e.g. after a write, an undo, or a change of the selection
  read(): void {
    const plot = this.plot;
    const block = plot?.isConnected ? blockOf(this.app, plot) : null;
    if (!plot || !block) return this.close();
    this.name.textContent = `Plot Data of ${plot.getAttribute('data-plot')}`;
    this.json = jsonOf(this.app, block);
    try {
      this.sheets = sheetsOf(this.json);
    } catch (e) {
      this.sheets = [];
      this.fill();
      this.say(`The block cannot be read: ${(e as Error).message}`, true);
      return;
    }
    this.sheet = Math.min(this.sheet, this.sheets.length - 1);
    for (const [k, d] of this.drafts) if (!this.sheets.some((s) => s.rows.some((row) => row.some((c) => c && key(c) === k && c.text !== d.typed)))) this.drafts.delete(k);
    this.fill();
    const hit = this.cellOf(document.activeElement);
    const error = hit ? (this.drafts.get(key(hit.cell))?.error ?? null) : null;
    this.say(error ?? '', !!error);
  }

  // the tabs and the grid of the sheets. a grid of the same shape keeps its inputs, hence a field
  // keeps its focus while the plot is written
  private fill(): void {
    this.tabs.replaceChildren(...this.sheets.map((s, i) => {
      const b = make('button', '', s.name);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === this.sheet));
      b.addEventListener('pointerdown', (ev) => ev.preventDefault());
      b.addEventListener('click', () => this.choose(i));
      return b;
    }));
    const sheet = this.current();
    const shape = sheet ? `${sheet.key}:${sheet.columns.join('|')}:${sheet.rowNames.join('|')}:${sheet.rows.map((r) => r.map((c) => (c ? 1 : 0)).join('')).join()}` : '';
    if (shape !== this.shape || !this.grid.firstChild) {
      this.shape = shape;
      this.build(sheet);
    }
    if (sheet) {
      sheet.rows.forEach((row, r) => row.forEach((cell, c) => {
        const input = this.inputs[r]?.[c];
        if (!input || !cell) return;
        const draft = this.drafts.get(key(cell));
        input.value = draft?.typed ?? cell.text;
        input.closest('td')?.classList.toggle('bad', !!draft?.error);
      }));
    }
    this.add.disabled = !this.app.commands.enabled('plot.addRow');
    this.del.disabled = !this.app.commands.enabled('plot.deleteRow');
    this.mark();
  }

  private build(sheet: Sheet | null): void {
    const focus = this.at;
    this.inputs = [];
    if (!sheet) return void this.grid.replaceChildren();
    const table = make('table');
    const head = make('tr');
    head.append(make('th'), ...sheet.columns.map((c) => make('th', '', c)));
    const body = make('tbody');
    sheet.rows.forEach((row, r) => {
      const tr = make('tr');
      tr.append(make('th', '', sheet.rowNames[r]));
      this.inputs.push(row.map((cell, c) => {
        const td = make('td');
        tr.append(td);
        if (!cell) {
          td.className = 'none';
          return null;
        }
        const input = make('input', cell.kind === 'number' ? 'num' : '');
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        if (cell.kind === 'number') input.inputMode = 'decimal';
        input.dataset.r = String(r);
        input.dataset.c = String(c);
        input.setAttribute('aria-label', `${sheet.columns[c]}, row ${sheet.rowNames[r]}`);
        td.append(input);
        return input;
      }));
      body.append(tr);
    });
    const thead = make('thead');
    thead.append(head);
    table.append(thead, body);
    this.grid.replaceChildren(table);
    if (focus && this.el.contains(document.activeElement)) this.focusCell(focus);
  }

  private choose(i: number): void {
    this.flush();
    this.sheet = i;
    this.at = null;
    this.fill();
    this.preview(null);
    this.focusCell({ r: 0, c: 0 });
  }

  // the row of the focused cell, which the row names show
  private mark(): void {
    this.grid.querySelectorAll('tbody tr').forEach((tr, r) => tr.classList.toggle('at', r === this.at?.r));
  }

  focusCell(at: { r: number; c: number }): void {
    const row = this.inputs[Math.max(0, Math.min(at.r, this.inputs.length - 1))] ?? [];
    const input = row[at.c] ?? row.find(Boolean) ?? null;
    if (!input) return;
    input.focus();
    input.select();
  }

  // the cell of an input of the grid shown. an input of a grid that was replaced, e.g. after a row
  // was deleted, is left out, since its row and column are those of the sheet before
  private cellOf(target: EventTarget | null): { cell: Cell; input: HTMLInputElement; r: number; c: number } | null {
    if (!(target instanceof HTMLInputElement) || !target.dataset.r) return null;
    const r = Number(target.dataset.r), c = Number(target.dataset.c);
    if (this.inputs[r]?.[c] !== target) return null;
    const cell = this.current()?.rows[r]?.[c];
    return cell ? { cell, input: target, r, c } : null;
  }

  private focused(target: EventTarget | null): void {
    const hit = this.cellOf(target);
    if (!hit) return;
    this.at = { r: hit.r, c: hit.c };
    this.mark();
    const error = this.drafts.get(key(hit.cell))?.error ?? null;
    this.say(error ?? '', !!error);
  }

  private result(cell: Cell, typed: string): Result {
    return setCell(this.json, cell, typed);
  }

  // the plot is drawn from the text typed while it can be read, and the cell is red while not
  private typed(target: EventTarget | null): void {
    const hit = this.cellOf(target);
    if (!hit) return;
    const typed = hit.input.value;
    const res = typed !== hit.cell.text ? this.result(hit.cell, typed) : { text: this.json, error: null };
    hit.input.closest('td')?.classList.toggle('bad', !!res.error);
    if (typed === hit.cell.text) this.drafts.delete(key(hit.cell));
    else this.drafts.set(key(hit.cell), { typed, error: res.error });
    if (res.error === null) {
      this.say('');
      this.preview(res.text);
    } else {
      this.say(res.error, true);
    }
  }

  private left(target: EventTarget | null): void {
    const hit = this.cellOf(target);
    if (hit) this.commit(hit);
  }

  // the value of a cell is written once it is left, unless it cannot be read
  private commit(hit: { cell: Cell; input: HTMLInputElement }): void {
    const typed = hit.input.value;
    if (typed === hit.cell.text) {
      this.drafts.delete(key(hit.cell));
      return;
    }
    const res = this.result(hit.cell, typed);
    if (res.error !== null) {
      this.drafts.set(key(hit.cell), { typed, error: res.error });
      hit.input.closest('td')?.classList.add('bad');
      this.preview(null);
      return;
    }
    this.drafts.delete(key(hit.cell));
    const plot = this.plot;
    if (plot) void this.app.commands.run('plot.setData', { el: plot, text: res.text }).catch((e) => this.fail(e));
  }

  // the focused cell written, e.g. before a row is added or the window is closed
  flush(): void {
    const hit = this.cellOf(document.activeElement);
    if (hit) this.commit(hit);
  }

  private preview(text: string | null): void {
    const tab = this.current()?.tab ?? null;
    if (this.plot) redraw(this.plot, text, tab);
  }

  private key(ev: KeyboardEvent): void {
    const hit = this.cellOf(ev.target);
    if (!hit) return;
    const rows = this.inputs.length;
    const go = (r: number) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.commit(hit);
      this.focusCell({ r: Math.max(0, Math.min(rows - 1, r)), c: hit.c });
    };
    if (ev.key === 'Enter') go(hit.r + (ev.shiftKey ? -1 : 1));
    else if (ev.key === 'ArrowDown') go(hit.r + 1);
    else if (ev.key === 'ArrowUp') go(hit.r - 1);
    else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      if (hit.input.value !== hit.cell.text || this.drafts.has(key(hit.cell))) {
        // the first Esc takes back what was typed, and the next one closes the window
        this.drafts.delete(key(hit.cell));
        hit.input.value = hit.cell.text;
        hit.input.closest('td')?.classList.remove('bad');
        hit.input.select();
        this.say('');
        this.preview(null);
      } else {
        void this.app.commands.run('plot.closeData');
      }
    }
  }

  say(text: string, bad = false): void {
    this.state.textContent = text || (this.current() ? `${this.current()!.rows.length} rows. A cell is written when it is left.` : '');
    this.state.classList.toggle('bad', bad);
  }

  fail(e: unknown): void {
    this.say(e instanceof Error ? e.message : String(e), true);
  }

  // the window is moved by its title, and kept on the screen
  private dragTitle(): void {
    this.title.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || (ev.target as Element).closest('button')) return;
      ev.preventDefault();
      const r = this.el.getBoundingClientRect();
      const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      this.title.classList.add('dragging');
      this.title.setPointerCapture?.(ev.pointerId);
      const move = (e: PointerEvent) => {
        const left = Math.max(0, Math.min(innerWidth - 40, e.clientX - dx));
        const top = Math.max(0, Math.min(innerHeight - 28, e.clientY - dy));
        Object.assign(this.el.style, { left: `${left}px`, top: `${top}px`, right: 'auto' });
      };
      const up = () => {
        this.title.classList.remove('dragging');
        this.title.removeEventListener('pointermove', move);
        this.title.removeEventListener('pointerup', up);
        this.title.removeEventListener('pointercancel', up);
      };
      this.title.addEventListener('pointermove', move);
      this.title.addEventListener('pointerup', up);
      this.title.addEventListener('pointercancel', up);
    });
  }

  // the sheet and the row of a row command, read before the focused cell is written
  rowAt(): { sheet: Sheet; r: number } | null {
    const sheet = this.current();
    if (!sheet) return null;
    return { sheet, r: this.at ? Math.min(this.at.r, sheet.rows.length - 1) : sheet.rows.length - 1 };
  }

  get text(): string {
    return this.json;
  }
}

let win: DataWindow | null = null;
const open = () => (win?.open ? win : null);

// the text with a row added or deleted, or an error
function rowChange(app: App, change: typeof addRow): Promise<void> | void {
  const w = open();
  const at = w?.rowAt();
  if (!w || !at || !w.plot) return;
  w.flush();
  const res = change(w.text, at.sheet, at.r);
  if (res.error !== null) throw new Error(res.error);
  w.at = { r: change === addRow ? at.r + 1 : Math.max(0, at.r - (at.r >= at.sheet.rows.length - 1 ? 1 : 0)), c: w.at?.c ?? 0 };
  return write(app, w.plot, res.text);
}

const plotMenu = (order: number): Command['menu'] => ({ bar: 'Format', group: 'plot', order, submenu: 'Plot' });

export function commands(): Command[] {
  return [
    {
      // Shift+Cmd+D, as Show Chart Data Editor in Keynote, and Ctrl+Shift+D elsewhere
      id: 'plot.editData',
      label: 'Edit Plot Data…',
      keys: { mac: ['Mod+Shift+D'], other: ['Mod+Shift+D'] },
      in: ['canvas', 'navigator', 'inspector'],
      menu: plotMenu(10),
      context: ['element'],
      enabled: (app) => !!blockOf(app, plotOf(app)),
      run: (app) => {
        const plot = plotOf(app);
        if (!plot) return;
        win ??= new DataWindow(app);
        win.show(plot);
      },
    },
    {
      // the JSON text of the block of a plot, given as arg { el, text }
      id: 'plot.setData',
      label: 'Edit Plot Data',
      undoable: true,
      enabled: (app) => !!open() || !!plotOf(app),
      run: (app, arg) => {
        const a = arg as { el?: HTMLElement; text?: string } | undefined;
        const plot = a?.el?.isConnected ? a.el : plotOf(app);
        if (plot && typeof a?.text === 'string') return write(app, plot, a.text);
      },
    },
    {
      id: 'plot.addRow',
      label: 'Add Row',
      menu: plotMenu(20),
      undoable: true,
      enabled: () => !!open()?.rowAt()?.sheet.arrays,
      run: (app) => rowChange(app, addRow),
    },
    {
      id: 'plot.deleteRow',
      label: 'Delete Row',
      menu: plotMenu(21),
      undoable: true,
      enabled: () => {
        const at = open()?.rowAt();
        return !!at?.sheet.arrays && at.sheet.rows.length > at.sheet.least;
      },
      run: (app) => rowChange(app, deleteRow),
    },
    {
      id: 'plot.closeData',
      label: 'Close Plot Data',
      enabled: () => !!open(),
      run: () => {
        const w = open();
        if (!w) return;
        w.flush();
        w.close();
      },
    },
  ];
}

// the commands of plots and of surfaces
export function install(app: App): void {
  injectStyle('plot-data', STYLE);
  for (const c of commands()) app.commands.define(c);
  installSurface(app);
  // a plot is drawn again once its block is replaced, by a write, an undo, or a redo
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (!(n instanceof HTMLScriptElement) || !n.id) continue;
        for (const plot of document.querySelectorAll<HTMLElement>(`.plot[data-plot="${CSS.escape(n.id)}"]`)) {
          const w = open();
          redraw(plot, null, w?.plot === plot ? (w.current()?.tab ?? null) : null);
        }
      }
    }
  }).observe(app.slides(), { subtree: true, childList: true });
  // the window follows the file and the selection: it is read again after a change, and it shows
  // the data of another plot once that plot is selected
  app.onRefresh(['content', 'structure', 'selection'], () => {
    const w = open();
    if (!w) return;
    const plot = plotOf(app);
    if (plot && plot !== w.plot && blockOf(app, plot)) {
      w.flush();
      w.show(plot);
    } else {
      w.read();
    }
  });
}
