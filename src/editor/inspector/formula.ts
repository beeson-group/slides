// the Formula pane of the Format tab, for a selected display, a display with the caret, or the
// inline formula focused last in a text: the TeX in a field with its live preview and the
// completion of the macros of the deck, Hold Through the Next Step for a display, and the color of
// a symbol at a step. a symbol is a part of the TeX selected in the field, which Color Symbol marks
// with \class and colors in the chosen tone at the chosen step. the colored symbols of the formula
// are listed under it, each with its tone and step and a button that takes its color off. the
// formula is read again at each sync, since a formula is replaced when its block is typeset again

import type { App } from '../app.ts';
import { TONES, coloredOf, colorSteps, displayOf, formulaOf, type ColorStep, type Tone } from '../commands/math.ts';
import { balanced, mathLookup } from '../math.ts';
import { texEditor } from '../text/mathpop.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { openMenu, type MenuItem } from '../ui/menu.ts';
import { GLYPHS, checkbox, glyph, keepFocus, note, row, section, type Control, type Run } from './controls.ts';

// the cross of the button that takes the color off a symbol, on the grid of the icons of controls.ts
GLYPHS.remove ??= ['M6.5 6.5l7 7', 'M13.5 6.5l-7 7'];

const CSS = `
.beeson-edit-inspector .ed-tex { display: flex; flex-direction: column; gap: 8px; }
.beeson-edit-inspector .ed-tex textarea { width: 100%; box-sizing: border-box; min-height: 84px; padding: 7px 8px; border: 0; border-radius: 6px; background: var(--ed-control); box-shadow: inset 0 0 0 1px var(--ed-control-line); color: var(--ed-text); font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; resize: vertical; }
.beeson-edit-inspector .ed-tex textarea:focus-visible { outline: 2px solid var(--ed-focus); outline-offset: 1px; }
.beeson-edit-inspector .ed-tex .preview { min-height: 44px; font-size: 20px; overflow: hidden; }
.beeson-edit-inspector .ed-tex .preview svg { max-width: 100%; height: auto; }
.beeson-edit-inspector .ed-tones { display: flex; gap: 10px; }
.beeson-edit-inspector .ed-tones button { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: var(--swatch); box-shadow: inset 0 0 0 1px var(--ed-edge); cursor: default; }
.beeson-edit-inspector .ed-tones button[aria-pressed="true"] { outline: 2px solid var(--ed-select); outline-offset: 2px; }
.beeson-edit-inspector .ed-step { flex: 1; min-width: 0; height: 26px; display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 0 6px 0 10px; border: 0; border-radius: 7px; background: var(--ed-control); box-shadow: 0 0 0 1px var(--ed-line); color: var(--ed-text); font: 12px/1 var(--ed-font); cursor: default; }
.beeson-edit-inspector .ed-step span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-inspector .ed-step:disabled { color: var(--ed-faint); }
.beeson-edit-inspector .ed-colored { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.beeson-edit-inspector .ed-colored li { display: flex; align-items: center; gap: 8px; min-height: 26px; padding: 0 4px 0 6px; border-radius: 6px; }
.beeson-edit-inspector .ed-colored li:hover { background: var(--ed-hover); }
.beeson-edit-inspector .ed-colored .dot { flex: 0 0 auto; width: 10px; height: 10px; border-radius: 50%; background: var(--swatch); box-shadow: inset 0 0 0 1px var(--ed-edge); }
.beeson-edit-inspector .ed-colored .sym { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12px/1.3 ui-monospace, Menlo, Consolas, monospace; }
.beeson-edit-inspector .ed-colored .at { color: var(--ed-muted); font-size: 11px; white-space: nowrap; }
.beeson-edit-inspector .ed-colored button { width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--ed-muted); display: flex; align-items: center; justify-content: center; cursor: default; }
.beeson-edit-inspector .ed-colored button:hover { background: var(--ed-pressed); color: var(--ed-text); }
`;

// the color of a tone on the current slide, in its mode
const swatchOf = (app: App, tone: Tone): string => {
  const slide = app.current() ?? document.querySelector('.reveal');
  return (slide ? getComputedStyle(slide).getPropertyValue(`--${tone}`).trim() : '') || 'transparent';
};

const toneName = (tone: Tone): string => TONES.find(([t]) => t === tone)?.[1] ?? tone;

// the formula and the selection or caret in its TeX field, shared by the parts of the pane
type Shared = { formula: () => Element | null; field: HTMLTextAreaElement | null; changed: (() => void)[] };

function texPart(app: App, run: Run, shared: Shared): Control {
  const el = make('div', 'ed-tex beeson-tex');
  const ed = texEditor({ display: () => !!displayOf(shared.formula()), label: 'TeX of the formula' });
  const { field } = ed;
  field.name = 'tex';
  shared.field = field;
  el.append(field, ed.preview, ed.message);
  let shown = '';
  let target: Element | null = null;
  const commit = async () => {
    if (field.value === shown || !target) return;
    await ed.refresh();
    if (!ed.ok()) return;
    shown = field.value;
    await run('math.tex', { el: target, tex: field.value });
  };
  field.addEventListener('blur', () => void commit());
  field.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey || !ev.shiftKey)) {
      ev.preventDefault();
      void commit();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      field.value = shown;
      void ed.refresh();
      field.blur();
    }
  });
  for (const type of ['select', 'keyup', 'pointerup', 'input']) field.addEventListener(type, () => shared.changed.forEach((fn) => fn()));
  const sync = () => {
    target = shared.formula();
    field.disabled = !target;
    if (document.activeElement === field) return;
    const tex = target ? (mathLookup()(target)?.tex ?? '') : '';
    if (tex === shown && field.value === tex) return;
    shown = tex;
    field.value = tex;
    void ed.refresh();
  };
  sync();
  return { el, sync, flush: () => void commit() };
}

// the step chosen for a color, kept between the panes of one session, by the label of its step
let chosenTone: Tone = 'accent';
let chosenStep: string | null = null;

function colorPart(app: App, run: Run, shared: Shared): Control {
  const el = make('div', 'ed-sec');
  el.append(make('h5', '', 'Color at a Step'));
  const tip = make('div', 'ed-note');
  const tones = make('div', 'ed-tones');
  tones.setAttribute('role', 'radiogroup');
  tones.setAttribute('aria-label', 'Color of the symbol');
  const toneButtons = TONES.map(([tone, label]) => {
    const b = make('button');
    b.type = 'button';
    b.title = label;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', label);
    keepFocus(b);
    b.addEventListener('click', () => {
      chosenTone = tone;
      sync();
    });
    tones.append(b);
    return { b, tone };
  });
  const stepRow = make('div', 'ed-row');
  const step = make('button', 'ed-step');
  step.type = 'button';
  step.setAttribute('aria-haspopup', 'menu');
  step.setAttribute('aria-label', 'Step of the color');
  const stepText = make('span');
  step.append(stepText, glyph('chevron-down', 14));
  keepFocus(step);
  const apply = make('button', 'ed-btn', 'Color Symbol');
  apply.type = 'button';
  apply.dataset.command = 'math.color';
  apply.style.flex = '0 0 auto';
  keepFocus(apply);
  stepRow.append(step, apply);
  const list = make('ul', 'ed-colored');
  list.setAttribute('aria-label', 'Colored symbols');
  el.append(tip, tones, stepRow, list);

  let options: ColorStep[] = [];
  const current = (): ColorStep | null => options.find((o) => o.label === chosenStep) ?? options[0] ?? null;
  const selected = (): { start: number; end: number } | null => {
    const f = shared.field;
    if (!f || f.selectionStart === f.selectionEnd) return null;
    const part = f.value.slice(f.selectionStart, f.selectionEnd);
    return part.trim() && balanced(part) ? { start: f.selectionStart, end: f.selectionEnd } : null;
  };
  const openSteps = (keyboard: boolean) => {
    const items: MenuItem[] = [];
    const later = options.filter((o) => o.step !== null);
    const fresh = options.filter((o) => o.step === null);
    for (const o of later) items.push({ label: o.label, checked: o === current(), run: () => ((chosenStep = o.label), sync()) });
    if (later.length && fresh.length) items.push({ rule: true });
    for (const o of fresh) items.push({ label: o.label, checked: o === current(), run: () => ((chosenStep = o.label), sync()) });
    openMenu(app, items, { anchor: step.getBoundingClientRect(), placement: 'below', owner: step, keyboard, label: 'Step of the color', className: 'select' });
  };
  step.addEventListener('pointerdown', () => openSteps(false));
  step.addEventListener('click', (ev) => {
    if (ev.detail === 0) openSteps(true);
  });
  apply.addEventListener('click', () => {
    const f = shared.formula();
    const sel = selected();
    const o = current();
    if (!f || !sel || !o || !shared.field) return;
    void run('math.color', { el: f, tex: shared.field.value, start: sel.start, end: sel.end, tone: chosenTone, step: o.step, ...(o.step === null ? { with: o.with } : {}) });
  });

  const sync = () => {
    const f = shared.formula();
    options = f ? colorSteps(app, f) : [];
    for (const { b, tone } of toneButtons) {
      b.style.setProperty('--swatch', swatchOf(app, tone));
      b.setAttribute('aria-checked', String(tone === chosenTone));
      b.setAttribute('aria-pressed', String(tone === chosenTone));
      b.disabled = !f;
    }
    const o = current();
    stepText.textContent = o ? o.label : 'No later step';
    step.disabled = !options.length;
    const sel = selected();
    apply.disabled = !f || !sel || !o;
    tip.textContent = !f ? '' : !options.length
      ? 'A symbol is colored at a step after its formula, and the slide does not have one. Give a sentence after the formula a step first.'
      : sel ? `${toneName(chosenTone)} from ${o?.label.split(':')[0]} on.` : 'Select a symbol in the TeX, then choose its color and its step.';
    const colored = f ? coloredOf(app, f) : [];
    list.hidden = !colored.length;
    list.replaceChildren(...colored.map((c) => {
      const li = make('li');
      const dot = make('span', 'dot');
      dot.style.setProperty('--swatch', c.tone ? swatchOf(app, c.tone) : 'transparent');
      const sym = make('span', 'sym', c.body);
      sym.title = `\\class{${c.name}}{${c.body}}`;
      const at = make('span', 'at', c.step === null ? 'not colored' : `${toneName(c.tone ?? 'accent')}, Step ${c.step + 1}`);
      const remove = make('button');
      remove.type = 'button';
      remove.title = `Remove the color of ${c.name}`;
      remove.setAttribute('aria-label', `Remove the color of ${c.name}`);
      remove.dataset.command = 'math.uncolor';
      remove.append(glyph('remove', 14));
      keepFocus(remove);
      remove.addEventListener('click', () => void run('math.uncolor', { el: f, name: c.name }));
      li.addEventListener('click', (ev) => {
        if (ev.target instanceof Element && ev.target.closest('button')) return;
        shared.field?.focus();
        shared.field?.setSelectionRange(c.start, c.end);
        sync();
      });
      li.append(dot, sym, at, remove);
      return li;
    }));
  };
  shared.changed.push(sync);
  sync();
  return { el, sync };
}

export function formulaPane(app: App, run: Run): Control[] {
  injectStyle('inspector-formula', CSS);
  const shared: Shared = { formula: () => formulaOf(app), field: null, changed: [] };
  const tex = texPart(app, run, shared);
  const display = !!displayOf(shared.formula());
  return [
    section('TeX', [tex]),
    ...(display ? [section(null, [checkbox(app, run, 'math.hold', 'Hold through the next step'), note(() => 'The display is held at full opacity while the sentence after it is shown, and while a symbol of it is colored.')])] : []),
    colorPart(app, run, shared),
    section(null, [row([note(() => (app.platform === 'mac' ? '⌥⌘E puts an inline formula at the caret of a text.' : 'Alt+= puts an inline formula at the caret of a text.'))])]),
  ];
}

// the panes of a formula: Formula and Arrange for a display, and Formula, Text, and Arrange for an
// inline formula, whose block is a text. the items are the blocks, so that the pane is not built
// again when its formula is typeset again
export function formulaView(app: App): { tabs: ('formula' | 'text' | 'arrange')[]; items: Element[] } | null {
  const f = formulaOf(app);
  if (!f) return null;
  const display = displayOf(f);
  if (display) return { tabs: ['formula', 'arrange'], items: [display] };
  const host = app.hostOf(f);
  return host ? { tabs: ['formula', 'text', 'arrange'], items: [host] } : null;
}
