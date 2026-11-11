// the controls of the panes of the inspector, drawn in the tokens of the chrome as the controls of
// the Format inspector of Keynote: sections with a heading, segmented buttons, number fields with a
// stepper, checkboxes, and text fields. a press on a button is run as a command of the registry,
// and neither the focus nor the range of a text is moved by it, hence the selection on the canvas
// is kept. the value of a field is committed with Return or at a blur, as one entry of the history,
// and Esc puts the shown value back

import type { App } from '../app.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';

const SVG = 'http://www.w3.org/2000/svg';

// the icons of the inspector, on the grid of ui/icons.ts: 20 by 20 px, a stroke of 1.5 px, and a
// path that starts with F filled
export const GLYPHS: Record<string, string[]> = {
  'align-left': ['M3.5 3v14', 'M6.5 5.5h10v3.5h-10z', 'M6.5 11.5h6v3.5h-6z'],
  'align-center': ['M10 3v14', 'M4.5 5.5h11v3.5h-11z', 'M6.75 11.5h6.5v3.5h-6.5z'],
  'align-right': ['M16.5 3v14', 'M3.5 5.5h10v3.5h-10z', 'M7.5 11.5h6v3.5h-6z'],
  'align-top': ['M3 3.5h14', 'M5.5 6.5h3.5v10h-3.5z', 'M11.5 6.5h3.5v6h-3.5z'],
  'align-middle': ['M3 10h14', 'M5.5 4.5h3.5v11h-3.5z', 'M11.5 6.75h3.5v6.5h-3.5z'],
  'align-bottom': ['M3 16.5h14', 'M5.5 3.5h3.5v10h-3.5z', 'M11.5 7.5h3.5v6h-3.5z'],
  'distribute-h': ['M3 3.5v13', 'M17 3.5v13', 'M8.25 6h3.5v8h-3.5z'],
  'distribute-v': ['M3.5 3h13', 'M3.5 17h13', 'M6 8.25h8v3.5H6z'],
  'column-narrow': ['M2.5 4.5h15v11h-15z', 'M5 8h5', 'M5 10.5h5', 'M5 13h3.5'],
  'column-normal': ['M2.5 4.5h15v11h-15z', 'M5 8h7.5', 'M5 10.5h7.5', 'M5 13h5'],
  'column-wide': ['M2.5 4.5h15v11h-15z', 'M5 8h10', 'M5 10.5h10', 'M5 13h7'],
  'list-none': ['M4 6h12', 'M4 10h12', 'M4 14h8'],
  'list-dash': ['M3.5 6h2.5', 'M8.5 6h8', 'M3.5 10h2.5', 'M8.5 10h8', 'M3.5 14h2.5', 'M8.5 14h5.5'],
  'list-number': ['M3.75 4.75l1.25-.75v4', 'M3.5 12.25c.25-.9 2.6-1 2.4.4-.1.8-2.4 1.9-2.4 2.6h2.6', 'M8.5 6h8', 'M8.5 13.5h8'],
  outdent: ['M9 6h8', 'M9 10h8', 'M9 14h8', 'M6.5 7.5 3.5 10l3 2.5'],
  indent: ['M9 6h8', 'M9 10h8', 'M9 14h8', 'M3.5 7.5l3 2.5-3 2.5'],
  link: ['M8.5 11.5a3 3 0 0 0 4.25 0l2.5-2.5a3 3 0 0 0-4.25-4.25l-1 1', 'M11.5 8.5a3 3 0 0 0-4.25 0l-2.5 2.5a3 3 0 0 0 4.25 4.25l1-1'],
  reset: ['M4.75 10a5.25 5.25 0 1 0 1.55-3.7', 'M5.75 3.5v3.25H9'],
  'mode-both': ['M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z', 'F10 3.5a6.5 6.5 0 0 0 0 13z'],
  'mode-dark': ['F10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z'],
  'mode-light': ['M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z'],
  'chevron-up': ['M6 12l4-4 4 4'],
};

// the svg of an icon of GLYPHS, or of ui/icons.ts for another name
export function glyph(name: string, size = 18): SVGSVGElement {
  const paths = GLYPHS[name];
  if (!paths) return icon(name, size);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('beeson-icon');
  for (const d of paths) {
    const path = document.createElementNS(SVG, 'path');
    const filled = d.startsWith('F');
    path.setAttribute('d', filled ? `M${d.slice(1)}` : d);
    path.setAttribute('fill', filled ? 'currentColor' : 'none');
    if (!filled) {
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    }
    svg.append(path);
  }
  return svg;
}

const CSS = `
.beeson-edit-inspector .panel.format { padding: 0 0 16px; font: 13px/1.35 var(--ed-font); }
.beeson-edit-inspector .ed-title { margin: 10px 16px 6px; text-align: center; color: var(--ed-muted); font: 500 12px/1.3 var(--ed-font); }
.beeson-edit-inspector .ed-tabs { display: flex; gap: 2px; margin: 6px 16px 4px; }
.beeson-edit-inspector .ed-tabs button { flex: 1; height: 24px; border: 0; border-radius: 6px; background: transparent; color: var(--ed-muted); font: 500 12px/1 var(--ed-font); cursor: default; }
.beeson-edit-inspector .ed-tabs button:hover { color: var(--ed-text); }
.beeson-edit-inspector .ed-tabs button[aria-selected="true"] { background: var(--ed-pressed); color: var(--ed-text); font-weight: 600; }
.beeson-edit-inspector .ed-sec { padding: 12px 16px; border-top: 1px solid var(--ed-line); }
.beeson-edit-inspector .ed-sec.first { border-top: 0; padding-top: 6px; }
.beeson-edit-inspector .ed-sec > h5, .beeson-edit-inspector .ed-field > h5 { margin: 0 0 8px; font: 600 13px/1.3 var(--ed-font); color: var(--ed-text); }
.beeson-edit-inspector .ed-field > h5 { margin: 0 0 2px; }
.beeson-edit-inspector .ed-row { display: flex; align-items: flex-start; gap: 8px; }
.beeson-edit-inspector .ed-sec > * + * { margin-top: 8px; }
.beeson-edit-inspector .ed-sec > h5 + * { margin-top: 0; }
.beeson-edit-inspector .ed-label { flex: 0 0 auto; min-width: 72px; padding-top: 5px; color: var(--ed-text); }
.beeson-edit-inspector .ed-seg { display: flex; flex: 1; min-width: 0; padding: 2px; border-radius: 7px; background: var(--ed-pressed); }
.beeson-edit-inspector .ed-seg button { position: relative; flex: 1; min-width: 0; height: 24px; padding: 0 4px; border: 0; border-radius: 5px; background: transparent; color: var(--ed-text); display: flex; align-items: center; justify-content: center; gap: 4px; font: 12px/1 var(--ed-font); white-space: nowrap; cursor: default; }
.beeson-edit-inspector .ed-seg button + button::before { content: ""; position: absolute; left: 0; top: 6px; bottom: 6px; width: 1px; background: var(--ed-edge); }
.beeson-edit-inspector .ed-seg button[aria-pressed="true"]::before, .beeson-edit-inspector .ed-seg button[aria-pressed="true"] + button::before { background: transparent; }
.beeson-edit-inspector .ed-seg button[aria-pressed="true"] { background: var(--ed-select); color: var(--ed-on-select); }
.beeson-edit-inspector .ed-seg button:not(:disabled):not([aria-pressed="true"]):hover { background: var(--ed-hover); }
.beeson-edit-inspector .ed-seg button:not(:disabled):active { background: var(--ed-pressed); }
.beeson-edit-inspector .ed-seg button:disabled { color: var(--ed-faint); }
.beeson-edit-inspector .ed-seg .b { font: 700 14px/1 Georgia, "Times New Roman", serif; }
.beeson-edit-inspector .ed-seg .i { font: italic 14px/1 Georgia, "Times New Roman", serif; }
.beeson-edit-inspector .ed-seg .mono { font: 11px/1 ui-monospace, Menlo, Consolas, monospace; }
.beeson-edit-inspector .ed-seg .script { font: 13px/1 Georgia, "Times New Roman", serif; }
.beeson-edit-inspector .ed-seg .script sup, .beeson-edit-inspector .ed-seg .script sub { position: relative; font-size: 9px; line-height: 0; vertical-align: baseline; }
.beeson-edit-inspector .ed-seg .script sup { top: -0.5em; }
.beeson-edit-inspector .ed-seg .script sub { top: 0.3em; }
.beeson-edit-inspector .ed-btn { flex: 1; height: 26px; padding: 0 10px; border: 0; border-radius: 7px; background: var(--ed-pressed); color: var(--ed-text); display: flex; align-items: center; justify-content: center; gap: 5px; font: 12px/1 var(--ed-font); white-space: nowrap; cursor: default; }
.beeson-edit-inspector .ed-btn:not(:disabled):hover { background: color-mix(in srgb, var(--ed-pressed), var(--ed-text) 6%); }
.beeson-edit-inspector .ed-btn:disabled { color: var(--ed-faint); }
.beeson-edit-inspector .ed-num { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 4px; }
.beeson-edit-inspector .ed-num .box { display: flex; align-items: center; gap: 3px; }
.beeson-edit-inspector .ed-num input { flex: 1; min-width: 0; height: 24px; box-sizing: border-box; padding: 0 7px; border: 0; border-radius: 6px; background: var(--ed-control); box-shadow: inset 0 0 0 1px var(--ed-control-line); color: var(--ed-text); text-align: right; font: 12px/1 var(--ed-font); font-variant-numeric: tabular-nums; }
.beeson-edit-inspector .ed-num input:disabled { color: var(--ed-faint); background: transparent; }
.beeson-edit-inspector .ed-num .unit { color: var(--ed-muted); font-size: 11px; }
.beeson-edit-inspector .ed-num.off .unit { color: var(--ed-faint); }
.beeson-edit-inspector .ed-num .stepper { display: flex; flex-direction: column; gap: 1px; }
.beeson-edit-inspector .ed-num .stepper button { width: 15px; height: 11px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--ed-muted); display: flex; align-items: center; justify-content: center; cursor: default; }
.beeson-edit-inspector .ed-num .stepper button:not(:disabled):hover { background: var(--ed-hover); color: var(--ed-text); }
.beeson-edit-inspector .ed-num .stepper button:disabled { color: var(--ed-faint); }
.beeson-edit-inspector .ed-num > label { text-align: center; font: 600 11px/1.2 var(--ed-font); color: var(--ed-text); }
.beeson-edit-inspector .ed-num.off > label { color: var(--ed-faint); }
.beeson-edit-inspector .ed-check { display: flex; align-items: center; gap: 8px; min-height: 22px; color: var(--ed-text); }
.beeson-edit-inspector .ed-check input { width: 14px; height: 14px; margin: 0; accent-color: var(--ed-select); }
.beeson-edit-inspector .ed-check.off { color: var(--ed-faint); }
.beeson-edit-inspector .ed-field { display: flex; flex-direction: column; gap: 4px; }
.beeson-edit-inspector .ed-field textarea, .beeson-edit-inspector .ed-field input { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 0; border-radius: 6px; background: var(--ed-control); box-shadow: inset 0 0 0 1px var(--ed-control-line); color: var(--ed-text); font: 12px/1.4 var(--ed-font); resize: vertical; }
.beeson-edit-inspector .ed-field input { height: 26px; padding: 0 8px; }
.beeson-edit-inspector .ed-field textarea:disabled, .beeson-edit-inspector .ed-field input:disabled { color: var(--ed-faint); background: transparent; }
.beeson-edit-inspector .ed-field ::placeholder { color: var(--ed-faint); }
.beeson-edit-inspector .ed-note { color: var(--ed-muted); font: 11px/1.35 var(--ed-font); }
.beeson-edit-inspector .ed-note.warn { color: var(--ed-guide); }
.beeson-edit-inspector .ed-note[hidden] { display: none; }
.beeson-edit-inspector .ed-card { display: flex; align-items: center; gap: 12px; margin: 6px 16px 12px; padding: 10px; border-radius: 9px; background: var(--ed-control); box-shadow: 0 0 0 1px var(--ed-line), 0 1px 2px rgba(0, 0, 0, 0.06); }
.beeson-edit-inspector .ed-card .thumb { flex: 0 0 auto; display: flex; }
.beeson-edit-inspector .ed-card .what { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.beeson-edit-inspector .ed-card .what span:first-child { color: var(--ed-muted); font-size: 11px; }
.beeson-edit-inspector .ed-card .what span:last-child { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-inspector .ed-popup { display: flex; align-items: center; justify-content: space-between; width: calc(100% - 32px); height: 40px; margin: 6px 16px 12px; padding: 0 10px 0 12px; border: 0; border-radius: 9px; background: var(--ed-control); box-shadow: 0 0 0 1px var(--ed-line), 0 1px 2px rgba(0, 0, 0, 0.06); color: var(--ed-text); font: 600 16px/1 var(--ed-font); cursor: default; }
.beeson-edit-inspector .ed-popup:disabled { color: var(--ed-faint); }
.beeson-edit-inspector .ed-swatches { display: flex; flex: 1; justify-content: space-between; }
.beeson-edit-inspector .ed-swatches button { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: var(--swatch); box-shadow: inset 0 0 0 1px var(--ed-edge); cursor: default; }
.beeson-edit-inspector .ed-swatches button[aria-pressed="true"] { outline: 2px solid var(--ed-select); outline-offset: 2px; }
.beeson-edit-inspector .ed-swatches button:disabled { opacity: 0.35; }
.beeson-edit-inspector :is(button, input, textarea):focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
`;

export function installStyle(): void {
  injectStyle('inspector', CSS);
}

// a part of a pane, which reads its state again at sync. flush commits a field that has a value
// typed and not committed yet
export type Control = { el: HTMLElement; sync(): void; flush?(): void };

export const group = (el: HTMLElement, parts: Control[]): Control => {
  el.append(...parts.map((p) => p.el));
  return { el, sync: () => parts.forEach((p) => p.sync()), flush: () => parts.forEach((p) => p.flush?.()) };
};

// a section of a pane with a heading
export function section(title: string | null, parts: Control[]): Control {
  const el = make('div', 'ed-sec');
  if (title) el.append(make('h5', '', title));
  return group(el, parts);
}

export function row(parts: Control[], label?: string): Control {
  const el = make('div', 'ed-row');
  if (label) el.append(make('span', 'ed-label', label));
  return group(el, parts);
}

export function note(text: () => string, warn: () => boolean = () => false): Control {
  const el = make('div', 'ed-note');
  const sync = () => {
    el.textContent = text();
    el.hidden = !el.textContent;
    el.classList.toggle('warn', warn());
  };
  sync();
  return { el, sync };
}

// a press on a button of the inspector leaves the focus and the range of a text where they are
export function keepFocus(el: HTMLElement): void {
  el.addEventListener('pointerdown', (ev) => ev.preventDefault());
  el.addEventListener('mousedown', (ev) => ev.preventDefault());
}

// the command id is run with arg, an error is shown in the state of the toolbar, and after is
// called once it is done, e.g. to read the inspector again
export function runner(app: App, after: () => void) {
  return (id: string, arg?: unknown) =>
    app.commands
      .run(id, arg)
      .catch((e) => app.fail(e))
      .finally(after);
}

export type Run = ReturnType<typeof runner>;

const stateOf = (app: App, id: string) => (app.commands.get(id) ? app.commands.state(id) : null);

// a button of a segmented control or of its own: a command with its arg, shown with an icon of
// GLYPHS, a text, or both. a command that is not defined is drawn disabled
export type Item = { command: string; arg?: unknown; icon?: string; text?: string | (() => Node); title?: string; pressed?: () => boolean | null };

function itemButton(app: App, run: Run, item: Item, className: string): { el: HTMLButtonElement; sync(): void } {
  const b = make('button', className);
  b.type = 'button';
  b.dataset.command = item.command;
  if (item.icon) b.append(glyph(item.icon));
  if (typeof item.text === 'function') b.append(item.text());
  else if (item.text) b.append(make('span', '', item.text));
  if (item.title && typeof item.text !== 'string') b.setAttribute('aria-label', item.title);
  keepFocus(b);
  b.addEventListener('click', () => void run(item.command, item.arg));
  const sync = () => {
    const s = stateOf(app, item.command);
    b.disabled = !s?.enabled;
    const on = item.pressed ? item.pressed() : s?.checked;
    if (on === null || on === undefined) b.removeAttribute('aria-pressed');
    else b.setAttribute('aria-pressed', String(on && !b.disabled));
    if (!item.title && s && typeof item.text !== 'string') b.setAttribute('aria-label', s.label);
    // a dimmed control says why in its tooltip
    b.title = s?.why ?? item.title ?? (s && typeof item.text !== 'string' ? s.label : '');
  };
  sync();
  return { el: b, sync };
}

export function segmented(app: App, run: Run, items: Item[], label: string): Control {
  const el = make('div', 'ed-seg');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', label);
  return group(el, items.map((item) => itemButton(app, run, item, '')));
}

export function button(app: App, run: Run, item: Item): Control {
  return itemButton(app, run, item, 'ed-btn');
}

// a checkbox of a switch command, e.g. Paper on an image. checked is given for a command that is
// not a switch, e.g. Hide Slide
export function checkbox(app: App, run: Run, command: string, text: string, checked?: () => boolean): Control {
  const el = make('label', 'ed-check');
  const input = make('input');
  input.type = 'checkbox';
  input.dataset.command = command;
  el.append(input, make('span', '', text));
  keepFocus(el);
  // the browser puts back the old check of a cancelled click after its listeners, hence the box
  // is synced once the click is over, for a command that does not refresh the pane
  el.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!input.disabled) void Promise.resolve(run(command)).then(() => setTimeout(sync));
  });
  const sync = () => {
    const s = stateOf(app, command);
    input.disabled = !s?.enabled;
    input.checked = checked ? checked() : !!s?.checked;
    el.classList.toggle('off', input.disabled);
  };
  sync();
  return { el, sync };
}

// a field whose text is committed with Return or at a blur. commit is given the text, and it acts
// on the targets read when the pane was built, which a later change of the selection does not
// change
type FieldOptions = {
  label?: string;
  name: string;
  placeholder?: string | (() => string);
  multiline?: boolean;
  value(): string | null;
  enabled(): boolean;
  commit(text: string): unknown;
  // a line under the field, e.g. the count of the bytes of a QR code
  hint?(text: string): { text: string; warn: boolean } | null;
};

export function textField(app: App, o: FieldOptions): Control & { input: HTMLInputElement | HTMLTextAreaElement } {
  const el = make('div', 'ed-field');
  if (o.label) el.append(make('h5', '', o.label));
  const input = o.multiline ? make('textarea') : make('input');
  if (input instanceof HTMLTextAreaElement) input.rows = 3;
  else input.type = 'text';
  input.name = o.name;
  input.setAttribute('aria-label', o.label ?? o.name);
  const hint = make('div', 'ed-note');
  el.append(input, hint);
  let shown = '';
  const showHint = () => {
    const h = o.hint?.(input.value) ?? null;
    hint.hidden = !h;
    hint.textContent = h?.text ?? '';
    hint.classList.toggle('warn', !!h?.warn);
  };
  const flush = () => {
    if (input.value === shown || input.disabled) return;
    shown = input.value;
    Promise.resolve(o.commit(input.value)).catch((e) => app.fail(e));
  };
  input.addEventListener('input', showHint);
  input.addEventListener('blur', flush);
  (input as HTMLElement).addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      flush();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      input.value = shown;
      showHint();
      input.blur();
    }
  });
  const sync = () => {
    input.disabled = !o.enabled();
    input.placeholder = typeof o.placeholder === 'function' ? o.placeholder() : (o.placeholder ?? '');
    if (document.activeElement === input) return;
    shown = o.value() ?? '';
    input.value = shown;
    showHint();
  };
  sync();
  return { el, sync, flush, input };
}

// a number field with a stepper and its label under it, as the size and position fields of the
// Arrange tab of Keynote. the arrow keys step it by step, 1 by default, or by 10 steps with Shift,
// and so does a click on the stepper. a value is rounded to a whole number of steps
type NumberOptions = {
  label: string;
  unit?: string;
  value(): number | null;
  enabled(): boolean;
  commit(value: number): unknown;
  min?: number;
  max?: number;
  step?: number;
};

export function numberField(app: App, o: NumberOptions): Control & { input: HTMLInputElement } {
  const el = make('div', 'ed-num');
  const box = make('div', 'box');
  const input = make('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.name = o.label;
  input.id = `beeson-edit-num-${o.label.toLowerCase()}`;
  const unit = make('span', 'unit', o.unit ?? 'px');
  const stepper = make('div', 'stepper');
  const up = make('button');
  const down = make('button');
  for (const [b, name, text] of [[up, 'chevron-up', 'Increase'], [down, 'chevron-down', 'Decrease']] as const) {
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('aria-label', `${text} ${o.label}`);
    b.append(glyph(name, 12));
    keepFocus(b);
  }
  stepper.append(up, down);
  box.append(input, unit, stepper);
  const label = make('label', '', o.label);
  label.htmlFor = input.id;
  el.append(box, label);
  const step = o.step ?? 1;
  const digits = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const round = (v: number) => Number((Math.round(v / step) * step).toFixed(digits));
  // the value as the field shows it, rounded to its step, hence a flush commits a typed value only
  let shown: number | null = null;
  const show = (v: number | null) => {
    shown = v === null ? null : round(v);
    input.value = v === null ? '' : String(shown);
  };
  const commit = (v: number) => {
    const value = Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, round(v)));
    show(value);
    Promise.resolve(o.commit(value)).catch((e) => app.fail(e));
  };
  const typed = () => (input.value.trim() === '' ? NaN : Number(input.value.trim().replace(/\s*(px|s)$/i, '').replace(',', '.')));
  const flush = () => {
    if (input.disabled) return;
    const v = typed();
    if (Number.isFinite(v) && round(v) !== shown) commit(v);
    else show(shown);
  };
  input.addEventListener('blur', flush);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      flush();
      input.select();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      show(shown);
      input.blur();
    } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      const base = Number.isFinite(typed()) ? typed() : (shown ?? 0);
      commit(base + (ev.key === 'ArrowUp' ? 1 : -1) * (ev.shiftKey ? 10 : 1) * step);
      input.select();
    }
  });
  for (const [b, sign] of [[up, 1], [down, -1]] as const) {
    b.addEventListener('click', (ev) => commit((shown ?? 0) + sign * (ev.shiftKey ? 10 : 1) * step));
  }
  const sync = () => {
    const on = o.enabled();
    input.disabled = up.disabled = down.disabled = !on;
    el.classList.toggle('off', !on);
    if (document.activeElement === input) return;
    show(o.value());
  };
  sync();
  return { el, sync, flush, input };
}

// the layout card at the top of the Slide pane, with a sketch of the layout
export function card(sketch: () => SVGSVGElement, caption: string, value: () => string): Control {
  const el = make('div', 'ed-card');
  const thumb = make('div', 'thumb');
  const what = make('div', 'what');
  const name = make('span');
  what.append(make('span', '', caption), name);
  el.append(thumb, what);
  const sync = () => {
    thumb.replaceChildren(sketch());
    name.textContent = value();
  };
  sync();
  return { el, sync };
}
