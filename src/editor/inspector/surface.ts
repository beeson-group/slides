// the Surface pane of the inspector, for a selected `.surface`: the camera, i.e. its azimuth,
// elevation, and zoom, the seconds per turn, and the scale of the heights, each written to an
// attribute of the start tag, and Use Current View, which writes the camera as it was turned by a
// drag. a drag on a surface turns its camera, as in the deck, and a drag from its frame moves it.
// a surface with the attributes of the surface on the slide before, apart from data-stage, is shown
// under its camera, hence each write is made to every surface of that chain on the slides around

import type { App } from '../app.ts';
import type { Command } from '../commands.ts';
import { CONTAINER, onCanvas } from '../canvas/hit.ts';
import { overlay, view as frameView } from '../canvas/frames.ts';
import { openContextMenu } from '../ui/menu.ts';
import { make } from '../ui/dom.ts';
import { button, glyph, keepFocus, note, row, section, type Control, type Run } from './controls.ts';

type Written = { azimuth: number; elevation: number; zoom: number; turn: number; zscale: number };
type Live = { el: HTMLElement; turn(dx: number, dy: number): void; view(): { azimuth: number; elevation: number; zoom: number; written: Written }; configure(): void };
type Page = { Beeson?: { surfaces?: Live[] } };

const liveOf = (el: Element | null): Live | null => (el ? ((window as unknown as Page).Beeson?.surfaces?.find((s) => s.el === el) ?? null) : null);

// the surface that the selection is or holds alone in a zone or a plate
export function surfaceOf(app: App): HTMLElement | null {
  const el = app.selection.only();
  if (!el) return null;
  const open = (s: Element) => !!app.pairing?.elements.get(s)?.open;
  if (el.matches('.surface')) return open(el) ? (el as HTMLElement) : null;
  if (!el.matches(CONTAINER)) return null;
  const found = [...el.querySelectorAll<HTMLElement>('.surface')].filter(open);
  return found.length === 1 ? found[0] : null;
}

// the key of main.ts by which a surface takes the camera of the surface on the slide before
const keyOf = (el: HTMLElement) => JSON.stringify(Object.entries(el.dataset).filter(([k]) => k !== 'stage' && k !== 'shown').sort());

// the surfaces whose camera is that of el: el, and the surfaces with its key on the slides next to
// it, in the order of the slides
export function chainOf(app: App, el: HTMLElement): HTMLElement[] {
  const slides = [...app.slides().querySelectorAll('section')].filter((s) => !s.querySelector('section'));
  const at = slides.findIndex((s) => s.contains(el));
  if (at < 0) return [el];
  const key = keyOf(el);
  const on = (i: number) => [...(slides[i]?.querySelectorAll<HTMLElement>('.surface') ?? [])].find((s) => keyOf(s) === key && app.pairing?.elements.get(s)?.open) ?? null;
  const out = [el];
  for (let i = at - 1, s = on(i); s; s = on(--i)) out.unshift(s);
  for (let i = at + 1, s = on(i); s; s = on(++i)) out.push(s);
  return out;
}

export const FIELDS = {
  azimuth: { attr: 'data-azimuth', label: 'Azimuth', unit: '°', digits: 0, step: 5, min: -180, max: 180 },
  elevation: { attr: 'data-elevation', label: 'Elevation', unit: '°', digits: 0, step: 1, min: 7, max: 83 },
  turn: { attr: 'data-turn', label: 'Turn', unit: 's', digits: 0, step: 10, min: 0, max: 3600 },
  zoom: { attr: 'data-zoom', label: 'Zoom', unit: '×', digits: 2, step: 0.1, min: 0.2, max: 5 },
  zscale: { attr: 'data-zscale', label: 'Z Scale', unit: '×', digits: 2, step: 0.1, min: 0.05, max: 10 },
} as const;
type Field = keyof typeof FIELDS;

const round = (v: number, digits: number) => Number(v.toFixed(digits));
// an azimuth in whole degrees in the range from -180 to 180, where -180 is written as 180
const azimuth = (deg: number) => {
  const a = round(((((deg + 180) % 360) + 360) % 360) - 180, 0);
  return a === -180 ? 180 : a;
};
const clean = (field: Field, v: number) => {
  const f = FIELDS[field];
  if (field === 'azimuth') return azimuth(v);
  return Math.min(f.max, Math.max(f.min, round(v, f.digits)));
};
const text = (v: number) => String(Object.is(v, -0) ? 0 : v);

// the attributes of values written on the surfaces of the chain of el, as one entry of the history
function writeAll(app: App, el: HTMLElement, attrs: Record<string, string | null>): void {
  for (const s of chainOf(app, el)) {
    const changed = Object.entries(attrs).filter(([k, v]) => s.getAttribute(k) !== v);
    if (changed.length) app.doc.setTag(s, { attrs: Object.fromEntries(changed) }, 'surface');
  }
}

const given = (arg: unknown): HTMLElement | null => {
  const el = (arg as { el?: HTMLElement } | undefined)?.el;
  return el?.isConnected ? el : null;
};

const surfaceMenu = (order: number): Command['menu'] => ({ bar: 'Format', group: 'surface', order, submenu: 'Surface' });

export function commands(): Command[] {
  const fields = (Object.keys(FIELDS) as Field[]).map((field): Command => ({
    // arg { value, el }, from a field of the Surface pane
    id: `surface.${field}`,
    label: `Surface ${FIELDS[field].label}`,
    undoable: true,
    enabled: (app) => !!surfaceOf(app),
    run: (app, arg) => {
      const el = given(arg) ?? surfaceOf(app);
      const value = Number((arg as { value?: unknown } | undefined)?.value);
      if (!el || !Number.isFinite(value)) return;
      writeAll(app, el, { [FIELDS[field].attr]: text(clean(field, value)) });
    },
  }));
  return [
    ...fields,
    {
      // the camera drawn now, as a drag in the editor turned it, written as the camera of the deck.
      // a zoom of 1 is the default, which is not written on a surface without data-zoom
      id: 'surface.useView',
      label: 'Use Current View',
      menu: surfaceMenu(10),
      context: ['element'],
      undoable: true,
      enabled: (app) => !!liveOf(surfaceOf(app)),
      run: (app, arg) => {
        const el = given(arg) ?? surfaceOf(app);
        const live = liveOf(el);
        if (!el || !live) return;
        const v = live.view();
        const zoom = clean('zoom', v.zoom);
        writeAll(app, el, {
          'data-azimuth': text(clean('azimuth', v.azimuth)),
          'data-elevation': text(clean('elevation', v.elevation)),
          'data-zoom': zoom === 1 && !el.hasAttribute('data-zoom') ? null : text(zoom),
        });
        live.configure();
      },
    },
    {
      id: 'surface.resetView',
      label: 'Reset View',
      menu: surfaceMenu(11),
      undoable: true,
      enabled: (app) => {
        const el = surfaceOf(app);
        return !!el && ['data-azimuth', 'data-elevation', 'data-zoom'].some((a) => el.hasAttribute(a));
      },
      run: (app, arg) => {
        const el = given(arg) ?? surfaceOf(app);
        if (el) writeAll(app, el, { 'data-azimuth': null, 'data-elevation': null, 'data-zoom': null });
      },
    },
  ];
}

let fieldCount = 0;

// a number field as numberField of controls.ts, with digits after the point and a step of its own
function decimalField(app: App, run: Run, el: HTMLElement | null, field: Field): Control {
  const f = FIELDS[field];
  const box = make('div', 'box');
  const wrap = make('div', 'ed-num');
  const input = make('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.name = field;
  input.id = `beeson-edit-surface-${field}-${++fieldCount}`;
  const stepper = make('div', 'stepper');
  const up = make('button');
  const down = make('button');
  for (const [b, name, what] of [[up, 'chevron-up', 'Increase'], [down, 'chevron-down', 'Decrease']] as const) {
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('aria-label', `${what} ${f.label}`);
    b.append(glyph(name, 12));
    keepFocus(b);
  }
  stepper.append(up, down);
  box.append(input, make('span', 'unit', f.unit), stepper);
  const label = make('label', '', f.label);
  label.htmlFor = input.id;
  wrap.append(box, label);
  const value = () => {
    const w = liveOf(el)?.view().written;
    return w ? w[field] : null;
  };
  let shown: number | null = null;
  const show = (v: number | null) => {
    shown = v;
    input.value = v === null ? '' : text(round(v, f.digits));
  };
  const commit = (v: number) => {
    const c = clean(field, v);
    show(c);
    void run(`surface.${field}`, { value: c, el });
  };
  const typed = () => (input.value.trim() === '' ? NaN : Number(input.value.trim().replace(/[°s×x]$/i, '').replace(',', '.').replace(/^−/, '-')));
  const flush = () => {
    if (input.disabled) return;
    const v = typed();
    if (Number.isFinite(v) && clean(field, v) !== shown) commit(v);
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
      commit(base + (ev.key === 'ArrowUp' ? 1 : -1) * f.step * (ev.shiftKey ? 10 : 1));
      input.select();
    }
  });
  for (const [b, sign] of [[up, 1], [down, -1]] as const) b.addEventListener('click', (ev) => commit((shown ?? 0) + sign * f.step * (ev.shiftKey ? 10 : 1)));
  const sync = () => {
    const on = !!el?.isConnected && !!liveOf(el);
    input.disabled = up.disabled = down.disabled = !on;
    wrap.classList.toggle('off', !on);
    if (document.activeElement === input) return;
    show(value());
  };
  sync();
  return { el: wrap, sync, flush };
}

export function surfacePane(app: App, run: Run): Control[] {
  const el = surfaceOf(app);
  const linked = () => {
    if (!el?.isConnected) return '';
    const others = chainOf(app, el).filter((s) => s !== el).map((s) => app.slideNumber(s.closest('section'))).filter((n): n is number => n !== null);
    if (!others.length) return '';
    const list = others.length === 1 ? `slide ${others[0]}` : `slides ${others.slice(0, -1).join(', ')}${others.length > 2 ? ',' : ''} and ${others.at(-1)}`;
    return `The surface on ${list} has the same attributes, hence it is shown under this camera, and each change is written to it too.`;
  };
  return [
    section('Camera', [
      row([decimalField(app, run, el, 'azimuth'), decimalField(app, run, el, 'elevation')]),
      row([decimalField(app, run, el, 'zoom'), decimalField(app, run, el, 'turn')]),
      row([button(app, run, { command: 'surface.useView', arg: { el }, text: 'Use Current View' }), button(app, run, { command: 'surface.resetView', arg: { el }, text: 'Reset' })]),
      note(() => 'Drag the surface to turn it, and then use its view. A turn of 0 s keeps it still.'),
      note(linked),
    ]),
    // an empty cell beside Z Scale keeps the field at the width of the fields above
    section('Heights', [row([decimalField(app, run, el, 'zscale'), { el: make('div', 'ed-num'), sync: () => {} }])]),
  ];
}

// the band at the edge of a surface, in screen pixels, from which a drag moves it
const EDGE = 8;

function onEdge(el: Element, x: number, y: number): boolean {
  const r = el.getBoundingClientRect();
  const inside = x > r.left + EDGE && x < r.right - EDGE && y > r.top + EDGE && y < r.bottom - EDGE;
  return !inside && x >= r.left - EDGE && x <= r.right + EDGE && y >= r.top - EDGE && y <= r.bottom + EDGE;
}

// the surface of the current slide under the point x, y or with its edge there, apart from a label
function surfaceAt(app: App, target: Element, x: number, y: number): HTMLElement | null {
  const slide = app.current();
  if (!slide || !app.pairing || app.hostOf(target) || !onCanvas(target, app, { x, y })) return null;
  const hit = target.closest<HTMLElement>('.surface');
  if (hit && slide.contains(hit) && app.pairing.elements.get(hit)?.open) return hit;
  const selected = app.selection.only();
  return selected?.matches('.surface') && slide.contains(selected) && onEdge(selected, x, y) ? (selected as HTMLElement) : null;
}

export function install(app: App): void {
  for (const c of commands()) app.commands.define(c);
  // a press on a surface selects it. a drag inside it turns its camera, and a drag from its edge is
  // handed to canvas/drag.ts as a drag of its handle, which moves it with the snapping of the slide
  // the press handed to canvas/drag.ts is not trusted, and it is left to it
  window.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || !ev.isTrusted || !(ev.target instanceof Element)) return;
    const el = surfaceAt(app, ev.target, ev.clientX, ev.clientY);
    if (!el) return;
    ev.preventDefault();
    ev.stopPropagation();
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
      app.selection.toggle(el);
      return;
    }
    if (!app.selection.has(el) || app.selection.elements().length > 1) app.selection.set('elements', [el]);
    if (onEdge(el, ev.clientX, ev.clientY) && !el.hasAttribute('data-locked')) {
      frameView.hover = el;
      const init = { bubbles: true, cancelable: true, composed: true, button: 0, buttons: 1, clientX: ev.clientX, clientY: ev.clientY, pointerId: ev.pointerId, pointerType: ev.pointerType, isPrimary: true };
      overlay().handle.dispatchEvent(new PointerEvent('pointerdown', init));
      return;
    }
    const live = liveOf(el);
    if (!live) return;
    let x = ev.clientX, y = ev.clientY;
    const move = (e: PointerEvent) => {
      live.turn(e.clientX - x, e.clientY - y);
      x = e.clientX;
      y = e.clientY;
      app.invalidate('layout');
    };
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }, true);
  // a right-click on a surface opens the menu of an element with the surface selected
  window.addEventListener('contextmenu', (ev) => {
    if (!(ev.target instanceof Element)) return;
    const el = surfaceAt(app, ev.target, ev.clientX, ev.clientY);
    if (!el) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (!app.selection.has(el)) app.selection.set('elements', [el]);
    openContextMenu(app, 'element', el, { x: ev.clientX, y: ev.clientY });
  }, true);
  // a surface reads its camera again after a change of its attributes, also at an undo
  new MutationObserver((records) => {
    const seen = new Set<Element>();
    for (const r of records) if (r.target instanceof HTMLElement && r.target.matches('.surface') && !seen.has(r.target)) {
      seen.add(r.target);
      liveOf(r.target)?.configure();
    }
  }).observe(app.slides(), { subtree: true, attributes: true, attributeFilter: Object.values(FIELDS).map((f) => f.attr) });
}
