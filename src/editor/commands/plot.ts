// Edit Plot Data, in Format > Plot, in the context menu of an element, and in the Plot pane of the
// inspector, as Show Chart Data Editor in Keynote. it opens a floating window with the sheets of
// plotdata.ts, whose cells are edited in a grid while the plot is drawn again from the text typed.
// a cell is written when it is left, as a change of the text of the JSON block alone, i.e. the
// script element is replaced by a copy with the new text, and its unit keeps every other byte. a
// value that the theme cannot read is shown in red, and it is not written. the plot is drawn again
// after every change of its block, also at an undo

import type { App } from '../app.ts';
import { keysOf, type Command } from '../commands.ts';
import { matches } from '../keymap.ts';
import { CONTAINER } from '../canvas/hit.ts';
import { make, injectStyle } from '../ui/dom.ts';
import { install as installSurface } from '../inspector/surface.ts';
import { addRow, addSeries, addTab, cellsIn, clearCells, deleteRow, deleteSeries, deleteTab, literal, moveSeries, parseTsv, pasteCells, setCell, setKey, sheetsOf, type Cell, type Result, type Sheet } from '../plotdata.ts';
import { emptySlot } from '../media/actions.ts';
import { pasteWork } from './clipboard.ts';
import { placeNew } from './place.ts';
import { modelAt } from '../steps.ts';
import { ask, trapTab } from '../ui/dialog.ts';

// the tones that a mark of a new color takes, the data colors of the theme
export const DATA_TONES = ['data-1', 'data-2', 'data-3', 'data-4', 'data-5', 'data-6', 'data-7', 'data-8'];
// the colors of a series in Series Colors, the accent of a mark without a tone and the data colors
export const SERIES_TONES = ['accent', ...DATA_TONES];

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

// the count of the tabs of the JSON text of a plot, or 0 for a text that cannot be read
function tabCount(text: string): number {
  try {
    return (JSON.parse(text) as { tabs?: unknown[] }).tabs?.length ?? 0;
  } catch {
    return 0;
  }
}

// the plot drawn again from its block, at the tab of tab when it is given and the block has it,
// since the tab of the window is read again only after a deleted tab is drawn
function redraw(plot: HTMLElement, text: string | null = null, tab: number | null = null): void {
  const view = viewOf(plot);
  if (!view) return;
  view.reload(text);
  page().Beeson?.mount?.(plot);
  const id = plot.getAttribute('data-plot');
  if (tab !== null && tab < tabCount(text ?? (id ? document.getElementById(id)?.textContent : null) ?? '')) view.setTab(tab);
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
.beeson-plotdata .bar { flex-wrap: wrap; }
.beeson-plotdata .rows .more { min-width: 24px; padding: 0 6px; }
.beeson-plotdata .rows { display: flex; gap: 6px; }
.beeson-plotdata thead th[data-series] { cursor: grab; touch-action: none; }
.beeson-plotdata thead th.moving, .beeson-plotdata td.moving { opacity: 0.45; }
.beeson-plotdata thead th.drop-before { box-shadow: inset 2px 0 0 var(--ed-select); }
.beeson-plotdata thead th.drop-after { box-shadow: inset -2px 0 0 var(--ed-select); }
.beeson-plotdata td.sel { background: color-mix(in srgb, var(--ed-select) 16%, transparent); }
.beeson-plotdata thead th.sel, .beeson-plotdata tbody tr th.sel { color: var(--ed-text); background: color-mix(in srgb, var(--ed-select) 12%, var(--ed-panel)); }
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
  private readonly addCol = make('button', '', 'Add Series');
  private readonly delCol = make('button', '', 'Delete Series');
  private readonly addSheet = make('button', 'more', '+');
  private readonly delSheet = make('button', 'more', '−');
  private readonly grid = make('div', 'grid');
  private readonly state = make('div', 'state');
  plot: HTMLElement | null = null;
  // the JSON text of the block in the file, and its sheets
  private json = '';
  private sheets: Sheet[] = [];
  sheet = 0;
  // the cell focused last, as row and column
  at: { r: number; c: number } | null = null;
  // a range of cells from the focused cell a to the cell b, selected by a drag, by Shift with a
  // click, or by Shift with the arrow keys, while the focus stays in a, as in a spreadsheet
  range: { a: { r: number; c: number }; b: { r: number; c: number } } | null = null;
  // the key of the sheet shown after the next read, e.g. of a new tab
  want: string | null = null;
  // the texts typed into cells and not written, by the path of the cell, with the fault of a text
  // that cannot be read, which is shown in red. a refresh of the window keeps them
  private readonly drafts = new Map<string, { typed: string; error: string | null }>();
  // the number cells of a range that Delete or Cut could not clear, shown as invalid until a
  // number is typed into them
  private refused = new Set<string>();
  private inputs: (HTMLInputElement | null)[][] = [];
  private shape = '';
  private names = '';

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
    this.addSheet.title = 'Add Tab';
    this.delSheet.title = 'Delete Tab';
    for (const [b, id] of [[this.add, 'plot.addRow'], [this.del, 'plot.deleteRow'], [this.addCol, 'plot.addSeries'], [this.delCol, 'plot.deleteSeries'], [this.addSheet, 'plot.addTab'], [this.delSheet, 'plot.deleteTab']] as const) {
      b.type = 'button';
      b.dataset.command = id;
      b.addEventListener('pointerdown', (ev) => ev.preventDefault());
      b.addEventListener('click', () => void app.commands.run(id).catch((e) => this.fail(e)));
      if (b.classList.contains('more')) b.setAttribute('aria-label', b.title);
      else rows.append(b);
    }
    const more = make('div', 'rows');
    more.append(this.addSheet, this.delSheet);
    const bar = make('div', 'bar');
    bar.append(this.tabs, more, make('span', 'grow'), rows);
    this.el.append(this.title, bar, this.grid, this.state);
    this.state.setAttribute('aria-live', 'polite');
    this.dragTitle();
    this.grid.addEventListener('focusin', (ev) => this.focused(ev.target));
    this.grid.addEventListener('focusout', (ev) => this.left(ev.target));
    this.grid.addEventListener('input', (ev) => this.typed(ev.target));
    this.grid.addEventListener('keydown', (ev) => this.key(ev));
    // Tab and Shift+Tab go round the controls of the window, and Esc on a control that is not a
    // cell closes it, as the Esc of a cell does once the cell is not edited
    this.el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Tab' && !ev.altKey && !ev.ctrlKey && !ev.metaKey) trapTab(this.el, ev);
      else if (ev.key === 'Escape' && !ev.defaultPrevented) {
        ev.preventDefault();
        ev.stopPropagation();
        void app.commands.run('plot.closeData');
      }
    });
    this.pickRange();
    this.dragColumns();
    for (const type of ['copy', 'cut', 'paste'] as const) this.grid.addEventListener(type, (ev) => this.clip(ev));
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
      this.range = null;
      this.drafts.clear();
      this.refused.clear();
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
    this.refused.clear();
    // the focus is given back to the slide, whose keys then act on the plot selected
    if (this.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
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
    const wanted = this.want ? this.sheets.findIndex((s) => s.key === this.want) : -1;
    this.want = null;
    if (wanted >= 0) this.sheet = wanted;
    this.sheet = Math.min(this.sheet, this.sheets.length - 1);
    for (const [k, d] of this.drafts) if (!this.sheets.some((s) => s.rows.some((row) => row.some((c) => c && key(c) === k && c.text !== d.typed)))) this.drafts.delete(k);
    this.fill();
    const hit = this.cellOf(document.activeElement);
    const error = hit ? (this.drafts.get(key(hit.cell))?.error ?? null) : null;
    this.say(error ?? (this.refusal() || this.size()), !!error || this.refused.size > 0);
  }

  // the number cells of cells marked as not cleared
  refuse(cells: Cell[]): void {
    this.refused = new Set(cells.map(key));
    this.fill();
    this.say(this.refusal(), this.refused.size > 0);
  }

  private refusal(): string {
    const n = this.refused.size;
    return n ? `A number of a plot cannot be left empty, hence ${n === 1 ? 'a cell keeps its number' : `${n} cells keep their numbers`}.` : '';
  }

  // the tabs and the grid of the sheets. a grid of the same shape keeps its inputs, hence a field
  // keeps its focus while the plot is written
  private fill(): void {
    // the buttons of the sheets are kept while their names are, since a button replaced loses the
    // focus that Tab gave it
    const names = this.sheets.map((s) => s.name).join('\n');
    if (names !== this.names || this.tabs.childElementCount !== this.sheets.length) {
      this.names = names;
      this.tabs.replaceChildren(...this.sheets.map((s, i) => {
        const b = make('button', '', s.name);
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.addEventListener('pointerdown', (ev) => ev.preventDefault());
        b.addEventListener('click', () => this.choose(i));
        return b;
      }));
    }
    [...this.tabs.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === this.sheet)));
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
        input.closest('td')?.classList.toggle('bad', !!draft?.error || this.refused.has(key(cell)));
      }));
    }
    for (const [b, id] of [[this.add, 'plot.addRow'], [this.del, 'plot.deleteRow'], [this.addCol, 'plot.addSeries'], [this.delCol, 'plot.deleteSeries'], [this.addSheet, 'plot.addTab'], [this.delSheet, 'plot.deleteTab']] as const) b.disabled = !this.app.commands.enabled(id);
    if (this.range && sheet && !(this.inputs[this.range.b.r] && this.range.b.c < sheet.columns.length)) this.range = null;
    this.mark();
  }

  private build(sheet: Sheet | null): void {
    const focus = this.el.contains(document.activeElement) ? this.at : null;
    this.inputs = [];
    if (!sheet) return void this.grid.replaceChildren();
    const table = make('table');
    const head = make('tr');
    head.append(make('th'), ...sheet.columns.map((name, c) => {
      const th = make('th', '', name);
      th.dataset.c = String(c);
      const id = sheet.series[c];
      if (id) {
        th.dataset.series = id;
        th.title = `Drag to move the series ${id}`;
      }
      return th;
    }));
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
    if (focus) this.focusCell(focus);
  }

  private choose(i: number): void {
    this.flush();
    this.sheet = i;
    this.at = null;
    this.range = null;
    this.fill();
    this.preview(null);
    this.focusCell({ r: 0, c: 0 });
  }

  // the row of the focused cell, which the row names show, and the cells of the range with their
  // heads
  private mark(): void {
    const box = this.box();
    const inRow = (r: number) => !!box && r >= box.r0 && r <= box.r1;
    const inCol = (c: number) => !!box && c >= box.c0 && c <= box.c1;
    this.grid.querySelectorAll('tbody tr').forEach((tr, r) => {
      tr.classList.toggle('at', r === this.at?.r);
      tr.querySelector('th')?.classList.toggle('sel', inRow(r));
      tr.querySelectorAll('td').forEach((td, c) => td.classList.toggle('sel', inRow(r) && inCol(c)));
    });
    this.grid.querySelectorAll<HTMLElement>('thead th[data-c]').forEach((th) => th.classList.toggle('sel', inCol(Number(th.dataset.c))));
  }

  // the rows and columns of the range, or null for one cell
  box(): { r0: number; c0: number; r1: number; c1: number } | null {
    const g = this.range;
    if (!g || (g.a.r === g.b.r && g.a.c === g.b.c)) return null;
    return { r0: Math.min(g.a.r, g.b.r), c0: Math.min(g.a.c, g.b.c), r1: Math.max(g.a.r, g.b.r), c1: Math.max(g.a.c, g.b.c) };
  }

  private extend(b: { r: number; c: number }): void {
    const sheet = this.current();
    if (!sheet || !this.at) return;
    const r = Math.max(0, Math.min(sheet.rows.length - 1, b.r)), c = Math.max(0, Math.min(sheet.columns.length - 1, b.c));
    this.range = { a: this.range?.a ?? this.at, b: { r, c } };
    this.mark();
    this.say(this.size());
  }

  // the size of the range in words, which is kept in the state while the sheets are read again
  private size(): string {
    const box = this.box();
    return box ? `${box.r1 - box.r0 + 1} × ${box.c1 - box.c0 + 1} cells selected.` : '';
  }

  // the cells of the range, or the focused cell, by row
  selected(): { r: number; c: number; cells: (Cell | null)[][] } | null {
    const sheet = this.current();
    const box = this.box() ?? (this.at ? { r0: this.at.r, c0: this.at.c, r1: this.at.r, c1: this.at.c } : null);
    if (!sheet || !box) return null;
    return { r: box.r0, c: box.c0, cells: cellsIn(sheet, box.r0, box.c0, box.r1, box.c1) };
  }

  // a range picked by a drag over the cells, or by Shift with a click, which keeps the focus
  private pickRange(): void {
    const at = (target: EventTarget | null) => {
      const td = target instanceof Element ? target.closest('td') : null;
      const tr = td?.parentElement;
      if (!td || !tr || !this.grid.contains(td)) return null;
      return { r: [...tr.parentElement!.children].indexOf(tr), c: [...tr.children].indexOf(td) - 1 };
    };
    let from: { r: number; c: number } | null = null;
    this.grid.addEventListener('pointerdown', (ev) => {
      const hit = at(ev.target);
      if (ev.button !== 0 || !hit) return;
      if (ev.shiftKey && this.at) {
        ev.preventDefault();
        this.extend(hit);
        return;
      }
      from = hit;
    });
    this.grid.addEventListener('pointermove', (ev) => {
      if (!from || !(ev.buttons & 1)) return;
      const hit = at(document.elementFromPoint(ev.clientX, ev.clientY));
      if (!hit || (!this.range && hit.r === from.r && hit.c === from.c)) return;
      this.range = { a: from, b: from };
      this.extend(hit);
    });
    const end = () => (from = null);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  }

  // a series is moved by a drag of the head of one of its columns onto the head of another series
  private dragColumns(): void {
    this.grid.addEventListener('pointerdown', (ev) => {
      const th = ev.target instanceof Element ? ev.target.closest<HTMLElement>('thead th[data-series]') : null;
      if (ev.button !== 0 || !th) return;
      ev.preventDefault();
      const id = th.dataset.series!;
      const x0 = ev.clientX;
      let moving = false;
      let drop: { to: string; after: boolean } | null = null;
      const heads = () => [...this.grid.querySelectorAll<HTMLElement>('thead th[data-series]')];
      const own = () => heads().filter((h) => h.dataset.series === id).map((h) => Number(h.dataset.c));
      const clear = () => this.grid.querySelectorAll('.moving, .drop-before, .drop-after').forEach((e) => e.classList.remove('moving', 'drop-before', 'drop-after'));
      const move = (e: PointerEvent) => {
        if (!moving && Math.abs(e.clientX - x0) < 4) return;
        moving = true;
        clear();
        const cols = own();
        for (const h of heads()) if (cols.includes(Number(h.dataset.c))) h.classList.add('moving');
        this.inputs.forEach((row) => cols.forEach((c) => row[c]?.closest('td')?.classList.add('moving')));
        const target = heads().find((h) => {
          const r = h.getBoundingClientRect();
          return e.clientX >= r.left && e.clientX < r.right;
        });
        drop = null;
        if (!target || target.dataset.series === id) return;
        const group = heads().filter((h) => h.dataset.series === target.dataset.series);
        const left = group[0].getBoundingClientRect().left, right = group.at(-1)!.getBoundingClientRect().right;
        const after = e.clientX > (left + right) / 2;
        drop = { to: target.dataset.series!, after };
        (after ? group.at(-1)! : group[0]).classList.add(after ? 'drop-after' : 'drop-before');
      };
      const up = () => {
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        clear();
        if (drop) void this.app.commands.run('plot.moveSeries', { id, ...drop }).catch((e) => this.fail(e));
      };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    });
  }

  // a range is copied as text with tabs between the cells and a line per row, which a spreadsheet
  // takes, and a paste of such a text fills the cells from the upper left of the range. a text of
  // one cell is pasted into every cell of a range, and into the text of a cell without one
  private clip(ev: ClipboardEvent): void {
    const data = ev.clipboardData;
    const sel = this.selected();
    if (!data || !sel || !this.cellOf(ev.target)) return;
    const box = this.box();
    if (ev.type === 'paste') {
      const rows = parseTsv(data.getData('text/plain'));
      const one = rows.length === 1 && rows[0].length === 1;
      if (one && !box) return;
      ev.preventDefault();
      ev.stopPropagation();
      const fill = one && box ? sel.cells.map((row) => row.map(() => rows[0][0])) : rows;
      pasteWork.set(ev, this.app.commands.run('plot.pasteCells', { r: sel.r, c: sel.c, rows: fill }).catch((e) => this.fail(e)));
      return;
    }
    if (!box) return;
    ev.preventDefault();
    ev.stopPropagation();
    data.setData('text/plain', sel.cells.map((row) => row.map((c) => (c ? (this.drafts.get(key(c))?.typed ?? c.text) : '')).join('\t')).join('\n'));
    if (ev.type === 'cut') void this.app.commands.run('plot.clearCells').catch((e) => this.fail(e));
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
    if (this.range && (this.range.a.r !== hit.r || this.range.a.c !== hit.c)) this.range = null;
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
    this.refused.delete(key(hit.cell));
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
    // Undo and Redo in a cell without a typed text of its own act on the history, e.g. on the value
    // that Enter wrote, and not on the text of the field, as in a field of the inspector
    const history = ['edit.undo', 'edit.redo'].find((id) => {
      const c = this.app.commands.get(id);
      return c && keysOf(c, this.app.platform).some((k) => matches(ev, k, this.app.platform));
    });
    if (history && hit.input.value === hit.cell.text && !this.drafts.has(key(hit.cell))) {
      ev.preventDefault();
      ev.stopPropagation();
      void this.app.commands.run(history).then(() => this.focusCell({ r: hit.r, c: hit.c })).catch((e) => this.fail(e));
      return;
    }
    const rows = this.inputs.length;
    const go = (r: number) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.commit(hit);
      this.focusCell({ r: Math.max(0, Math.min(rows - 1, r)), c: hit.c });
    };
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const whole = hit.input.selectionStart === 0 && hit.input.selectionEnd === hit.input.value.length;
    if (ev.shiftKey && arrows[ev.key] && (whole || !arrows[ev.key][1]) && !ev.altKey && !ev.metaKey && !ev.ctrlKey) {
      ev.preventDefault();
      ev.stopPropagation();
      const b = this.range?.b ?? { r: hit.r, c: hit.c };
      this.extend({ r: b.r + arrows[ev.key][0], c: b.c + arrows[ev.key][1] });
      return;
    }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.box()) {
      ev.preventDefault();
      ev.stopPropagation();
      void this.app.commands.run('plot.clearCells').catch((e) => this.fail(e));
      return;
    }
    if (ev.key === 'Escape' && this.box()) {
      ev.preventDefault();
      ev.stopPropagation();
      this.range = null;
      this.mark();
      this.say('');
      return;
    }
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
  w.range = null;
  w.at = { r: change === addRow ? at.r + 1 : Math.max(0, at.r - (at.r >= at.sheet.rows.length - 1 ? 1 : 0)), c: w.at?.c ?? 0 };
  return write(app, w.plot, res.text);
}

const plotMenu = (order: number): Command['menu'] => ({ bar: 'Format', group: 'plot', order, submenu: 'Plot' });

// the text of the window changed by change, written as the entry of the command, with the focused
// cell and the range put where at says once the window reads the text again
function windowChange(app: App, change: (w: DataWindow, sheet: Sheet) => (Result & { at?: { r: number; c: number }; range?: DataWindow['range'] }) | null): Promise<void> | void {
  const w = open();
  const sheet = w?.current();
  if (!w || !sheet || !w.plot) return;
  w.flush();
  const res = change(w, sheet);
  if (!res) return;
  if (res.error !== null) throw new Error(res.error);
  if (res.at) w.at = res.at;
  w.range = res.range ?? null;
  return write(app, w.plot, res.text);
}

// the series of the focused column of the sheet of a tab
const seriesAt = (w: DataWindow | null): string | null => (w?.at ? (w.current()?.series[w.at.c] ?? null) : null);

// the series before or after the series id in the columns of sheet
function neighbor(sheet: Sheet, id: string, way: -1 | 1): string | null {
  const order = [...new Set(sheet.series.filter((x): x is string => !!x))];
  return order[order.indexOf(id) + way] ?? null;
}

// the column of the cell at offset k in the columns of the series id, read from text
function columnOf(text: string, key: string, id: string, k: number): number {
  const sheet = sheetsOf(text).find((x) => x.key === key);
  const first = sheet?.series.indexOf(id) ?? -1;
  return Math.max(0, first + k);
}

function moveBy(w: DataWindow, sheet: Sheet, way: -1 | 1): Result & { at?: { r: number; c: number } } | null {
  const id = seriesAt(w);
  const to = id && neighbor(sheet, id, way);
  if (!id || !to || !w.at) return null;
  const res = moveSeries(w.text, id, to, way > 0);
  if (res.error !== null) return res;
  return { ...res, at: { r: w.at.r, c: columnOf(res.text, sheet.key, id, w.at.c - sheet.series.indexOf(id)) } };
}

const NAMING = ['data-plot-tab', 'data-plot-tabs', 'data-plot-show'];

// the elements of the slide of plot whose attributes of NAMING name the tab name, with the edit
// that takes the name off each, i.e. the attribute without the name, or without the attribute
function namersOf(plot: Element, name: string): { el: Element; attrs: Record<string, string | null> }[] {
  const slide = plot.closest('section');
  return [...(slide?.querySelectorAll(NAMING.map((a) => `[${a}]`).join(', ')) ?? [])].flatMap((el) => {
    const attrs: Record<string, string | null> = {};
    for (const a of NAMING) {
      const words = (el.getAttribute(a) ?? '').split(/\s+/).filter(Boolean);
      if (words.includes(name)) attrs[a] = words.filter((w) => w !== name).join(' ') || null;
    }
    return Object.keys(attrs).length ? [{ el, attrs }] : [];
  });
}

// the words of the confirmation for each element that names a tab: its step, or a plot that offers
// the tab
function namerText(app: App, el: Element): string {
  const m = el.classList.contains('fragment') ? modelAt(app, el) : null;
  if (!m) return 'a plot of the slide';
  const k = m.plan.groups.findIndex((g) => g.includes(m.i));
  return `step ${k >= 0 ? k + 1 : m.plan.groups.length + 1}`;
}

// Delete Tab. a tab that a step or a plot of the slide names is deleted after a confirmation that
// names them, and the name is taken off them in the same entry, so that one undo brings back both
async function deleteTabOf(app: App): Promise<void> {
  const w = open();
  const sheet = w?.current();
  const plot = w?.plot;
  if (!w || !sheet || !plot || sheet.tab === null || !sheet.key.startsWith('tab:')) return;
  w.flush();
  const name = sheet.key.slice(4);
  const namers = namersOf(plot, name);
  if (namers.length) {
    const who = [...new Set(namers.map((n) => namerText(app, n.el)))];
    const list = who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who.at(-1)}` : who[0];
    const answer = await ask({
      title: `Delete the tab ${name}?`,
      text: `The tab ${name} is named by ${list} of the slide. The tab is deleted, and its name is taken off ${who.length > 1 ? 'them' : 'it'}.`,
      className: 'ask',
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Delete Tab', value: 'delete', primary: true }],
    }, 'delete');
    if (answer !== 'delete' || !w.open || w.plot !== plot) return;
  }
  const res = deleteTab(w.text, sheet.tab);
  if (res.error !== null) throw new Error(res.error);
  w.at = { r: 0, c: 0 };
  w.range = null;
  await app.history.transact('Delete Tab', async () => {
    await write(app, plot, res.text);
    for (const n of namers) app.doc.setTag(n.el, { attrs: n.attrs }, 'plot tab');
  });
}

// the place of a new plot: the first empty zone or plate of the current slide, which the plot
// takes, and else a new zone before the footnote and the notes, moved off the texts and the figures
// where a place of its size is free
async function insertPlot(app: App): Promise<HTMLElement> {
  const slide = app.current()!;
  const slot = emptySlot(app, slide);
  const fills = slot?.localName === 'div' ? slot : null;
  const parent = fills?.parentElement ?? slide;
  const before = fills ?? slide.querySelector(':scope > .foot, :scope > aside.notes');
  const [plot] = await app.doc.insertElement('plot', parent, before, { plate: !!fills?.matches('.plate') });
  if (fills) await app.doc.remove(fills, 'Insert Plot');
  else placeNew(app, plot as HTMLElement, undefined, true);
  return plot as HTMLElement;
}

// the JSON text of the block of a plot of the Plot pane, given as arg { el }, changed by change
function paneChange(app: App, arg: unknown, change: (json: string) => Result): Promise<void> | void {
  const el = (arg as { el?: HTMLElement } | undefined)?.el;
  const plot = el?.isConnected ? el : plotOf(app);
  const block = blockOf(app, plot);
  if (!plot || !block) return;
  const res = change(jsonOf(app, block));
  if (res.error !== null) throw new Error(res.error);
  return write(app, plot, res.text);
}

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
      id: 'plot.addSeries',
      label: 'Add Series',
      menu: plotMenu(22),
      undoable: true,
      enabled: () => !!open()?.current()?.key.startsWith('tab:'),
      run: (app) => windowChange(app, (w, sheet) => {
        const c = w.at?.c ?? sheet.columns.length - 1;
        const res = addSeries(w.text, sheet, c);
        return res.error === null ? { ...res, at: { r: w.at?.r ?? 0, c: columnOf(res.text, sheet.key, res.id!, 0) } } : res;
      }),
    },
    {
      id: 'plot.deleteSeries',
      label: 'Delete Series',
      menu: plotMenu(23),
      undoable: true,
      enabled: () => !!seriesAt(open()),
      run: (app) => windowChange(app, (w, sheet) => {
        const id = seriesAt(w);
        if (!id) return null;
        const res = deleteSeries(w.text, id);
        return res.error === null ? { ...res, at: { r: w.at?.r ?? 0, c: Math.max(0, sheet.series.indexOf(id) - 1) } } : res;
      }),
    },
    {
      id: 'plot.moveSeriesLeft',
      label: 'Move Series Left',
      menu: plotMenu(24),
      undoable: true,
      enabled: () => {
        const w = open(), id = seriesAt(w);
        return !!id && !!neighbor(w!.current()!, id, -1);
      },
      run: (app) => windowChange(app, (w, sheet) => moveBy(w, sheet, -1)),
    },
    {
      id: 'plot.moveSeriesRight',
      label: 'Move Series Right',
      menu: plotMenu(25),
      undoable: true,
      enabled: () => {
        const w = open(), id = seriesAt(w);
        return !!id && !!neighbor(w!.current()!, id, 1);
      },
      run: (app) => windowChange(app, (w, sheet) => moveBy(w, sheet, 1)),
    },
    {
      // the series arg.id put before the series arg.to, or after it with arg.after, by a drag of a head
      id: 'plot.moveSeries',
      label: 'Move Series',
      undoable: true,
      enabled: () => !!open(),
      run: (app, arg) => windowChange(app, (w, sheet) => {
        const a = arg as { id: string; to: string; after?: boolean };
        const res = moveSeries(w.text, a.id, a.to, !!a.after);
        return res.error === null ? { ...res, at: { r: w.at?.r ?? 0, c: columnOf(res.text, sheet.key, a.id, 0) } } : res;
      }),
    },
    {
      id: 'plot.addTab',
      label: 'Add Tab',
      menu: plotMenu(30),
      undoable: true,
      enabled: () => !!open()?.current()?.key.startsWith('tab:'),
      run: (app) => windowChange(app, (w, sheet) => {
        const res = addTab(w.text, sheet.tab!);
        if (res.error === null) w.want = `tab:${res.name}`;
        return res.error === null ? { ...res, at: { r: 0, c: 0 } } : res;
      }),
    },
    {
      id: 'plot.deleteTab',
      label: 'Delete Tab',
      menu: plotMenu(31),
      enabled: () => {
        const sheet = open()?.current();
        return !!sheet?.key.startsWith('tab:') && sheetsOf(open()!.text).filter((x) => x.key.startsWith('tab:')).length > 1;
      },
      run: deleteTabOf,
    },
    {
      // rows of texts arg.rows pasted from row arg.r and column arg.c of the sheet shown
      id: 'plot.pasteCells',
      label: 'Paste',
      undoable: true,
      enabled: () => !!open(),
      run: (app, arg) => windowChange(app, (w, sheet) => {
        const a = arg as { r: number; c: number; rows: string[][] };
        const res = pasteCells(w.text, sheet.key, a.r, a.c, a.rows);
        const b = { r: a.r + a.rows.length - 1, c: a.c + Math.max(...a.rows.map((x) => x.length)) - 1 };
        return res.error === null ? { ...res, at: { r: a.r, c: a.c }, range: { a: { r: a.r, c: a.c }, b } } : res;
      }),
    },
    {
      id: 'plot.clearCells',
      label: 'Clear Cells',
      undoable: true,
      enabled: () => !!open()?.selected(),
      run: (app) => windowChange(app, (w) => {
        const sel = w.selected();
        if (!sel) return null;
        const res = clearCells(w.text, sel.cells);
        w.refuse(res.kept);
        return { ...res, at: w.at ?? undefined, range: w.range };
      }),
    },
    {
      // the title of a panel or of an axis, given as arg { el, panel, axis, text }, where axis is x,
      // y, or null for the panel. an empty title is taken out of the block
      id: 'plot.title',
      label: 'Axis Title',
      undoable: true,
      enabled: (app) => !!blockOf(app, plotOf(app)),
      run: (app, arg) => paneChange(app, arg, (json) => {
        const a = arg as { panel: number; axis: 'x' | 'y' | null; text: string };
        return setKey(json, a.axis ? ['panels', a.panel, a.axis] : ['panels', a.panel], 'title', a.text.trim() ? JSON.stringify(a.text.trim()) : null);
      }),
    },
    {
      // an end of the range of an axis, given as arg { el, panel, axis, end, text }
      id: 'plot.range',
      label: 'Axis Range',
      undoable: true,
      enabled: (app) => !!blockOf(app, plotOf(app)),
      run: (app, arg) => paneChange(app, arg, (json) => {
        const a = arg as { panel: number; axis: 'x' | 'y'; end: 0 | 1; text: string };
        const range = sheetsOf(json).find((x) => x.key === 'axes')?.rows[a.panel]?.[(a.axis === 'y' ? 2 : 0) + a.end];
        if (!range) return { text: null, error: `the ${a.axis} axis of the panel does not have a range` };
        return setCell(json, range, a.text);
      }),
    },
    {
      // the scale of an axis, given as arg { el, panel, axis, scale }, where scale is linear, the
      // default, which is taken out of the block, or asinh
      id: 'plot.scale',
      label: 'Axis Scale',
      undoable: true,
      enabled: (app) => !!blockOf(app, plotOf(app)),
      run: (app, arg) => paneChange(app, arg, (json) => {
        const a = arg as { panel: number; axis: 'x' | 'y'; scale: string };
        return setKey(json, ['panels', a.panel, a.axis], 'scale', a.scale === 'linear' ? null : JSON.stringify(a.scale));
      }),
    },
    {
      // the unit u of an asinh axis, given as arg { el, panel, axis, text }. an empty text takes
      // the unit out of the block, and the default of 1 is drawn
      id: 'plot.unit',
      label: 'Axis Unit',
      undoable: true,
      enabled: (app) => !!blockOf(app, plotOf(app)),
      run: (app, arg) => paneChange(app, arg, (json) => {
        const a = arg as { panel: number; axis: 'x' | 'y'; text: string };
        const lit = a.text.trim() ? literal({ path: [], kind: 'number', text: '' }, a.text) : null;
        if (a.text.trim() && lit === null) return { text: null, error: `${a.text.trim()} is not a number` };
        return setKey(json, ['panels', a.panel, a.axis], 'unit', lit);
      }),
    },
    {
      // the axes of a panel shown or hidden, given as arg { el, panel }. shown axes are the
      // default, hence "axes": false is written or taken out
      id: 'plot.axes',
      label: 'Show Axes',
      undoable: true,
      enabled: (app) => !!blockOf(app, plotOf(app)),
      run: (app, arg) => paneChange(app, arg, (json) => {
        const a = arg as { panel: number };
        const panel = (JSON.parse(json) as { panels?: { axes?: unknown }[] }).panels?.[a.panel];
        return setKey(json, ['panels', a.panel], 'axes', panel?.axes === false ? null : 'false');
      }),
    },
    {
      // the tone of a mark, given as arg { el, mark, tone }, one of the data tokens of the theme
      id: 'plot.tone',
      label: 'Series Color',
      undoable: true,
      enabled: (app) => !!blockOf(app, plotOf(app)),
      run: (app, arg) => paneChange(app, arg, (json) => {
        const a = arg as { mark: number; tone: string };
        if (!SERIES_TONES.includes(a.tone)) return { text: null, error: `${a.tone} is not a data color of the theme` };
        return setKey(json, ['marks', a.mark], 'tone', JSON.stringify(a.tone));
      }),
    },
    {
      id: 'insert.plot',
      label: 'Plot',
      menu: { bar: 'Insert', group: 'element', order: 22.5 },
      toolbar: { group: 'insert', order: 20.5, icon: 'plot', label: 'Plot' },
      enabled: (app) => !!app.pairing?.root && !!app.current() && app.region() !== 'dialog',
      run: async (app) => {
        const plot = await app.history.transact('Insert Plot', () => insertPlot(app));
        app.selection.set('elements', [plot]);
        await app.commands.run('plot.editData');
      },
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
