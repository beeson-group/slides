// the Line pane of the Format tab, for a selected line or arrow, as the Line section of the Style
// tab of Keynote: a swatch of each tone of the theme, the arrowheads (none, at the start, at the
// end, or at both ends), the kind (straight, curved, or elbow, as Connection of Keynote), the weight
// in px, a dash, and the element that each attached end is attached to. each control runs a command of
// commands/line.ts by its id

import type { App } from '../app.ts';
import { HEADS, KINDS, LINE_TONES, WEIGHTS, selectedLines } from '../commands/line.ts';
import { attachedTo, type End } from '../model/attach.ts';
import { describeObject } from '../navigator/objects.ts';
import { make } from '../ui/dom.ts';
import { button, checkbox, keepFocus, row, section, segmented, type Control, type Run } from './controls.ts';

const SVG = 'http://www.w3.org/2000/svg';

// a short line with the arrowheads of heads, on the grid of the glyphs of controls.ts, drawn along
// the path line at the stroke width width
function glyphOf(heads: string, line = 'M3 6h22', width = 1.5): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 28 12');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '12');
  svg.setAttribute('aria-hidden', 'true');
  const d = [line];
  if (heads === 'end' || heads === 'both') d.push('M20 2l5 4-5 4');
  if (heads === 'start' || heads === 'both') d.push('M8 2L3 6l5 4');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d.join(''));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', String(width));
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

// a swatch of each tone, in the color that the tone has on the slide in its mode, each running the
// command of the tone after prefix, e.g. line.tone
export function swatches(app: App, run: Run, prefix = 'line.tone', label = 'Line color'): Control {
  const el = make('div', 'ed-swatches');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', label);
  const buttons = LINE_TONES.map(([tone, label, token]) => {
    const b = make('button');
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.dataset.command = `${prefix}.${tone}`;
    keepFocus(b);
    b.addEventListener('click', () => void run(`${prefix}.${tone}`));
    el.append(b);
    return { b, tone, token };
  });
  const sync = () => {
    const slide = app.current() ?? document.querySelector('.reveal');
    const style = slide ? getComputedStyle(slide) : null;
    for (const { b, tone, token } of buttons) {
      const s = app.commands.state(`${prefix}.${tone}`);
      b.style.setProperty('--swatch', style?.getPropertyValue(token).trim() || 'transparent');
      b.disabled = !s.enabled;
      b.setAttribute('aria-pressed', String(!!s.checked && !b.disabled));
    }
  };
  sync();
  return { el, sync };
}

// a row of an attached end of the one selected line, e.g. Start: Rounded Rectangle, with the name of its
// element or group in the Object List and a button that takes its attachment off. it is hidden without
// an attachment, as the section is without a row
function attachRow(app: App, run: Run, end: End): Control {
  const label = make('span', 'ed-label');
  const detach = button(app, run, { command: `line.detach.${end === 'from' ? 'start' : 'end'}`, text: 'Detach' });
  const r = row([{ el: label, sync: () => {} }, detach]);
  const sync = () => {
    const lines = selectedLines(app);
    const els = lines.length === 1 ? attachedTo(lines[0], end) : [];
    r.el.style.display = els.length ? '' : 'none';
    label.textContent = els.length ? `${end === 'from' ? 'Start' : 'End'}: ${els.length > 1 ? 'Group' : describeObject(els[0]).name}` : '';
    detach.sync();
  };
  sync();
  return { el: r.el, sync };
}

function connections(app: App, run: Run): Control {
  const rows = [attachRow(app, run, 'from'), attachRow(app, run, 'to')];
  const s = section('Connections', rows);
  const sync = () => {
    s.sync();
    s.el.style.display = rows.some((r) => r.el.style.display !== 'none') ? '' : 'none';
  };
  sync();
  return { el: s.el, sync };
}

export function linePane(app: App, run: Run): Control[] {
  const heads = HEADS.map(([h, label]) => ({ command: `line.heads.${h}`, title: label, text: () => glyphOf(h) }));
  const shapes: Record<string, string> = { straight: 'M3 9L25 3', curve: 'M3 10Q14-4 25 10', elbow: 'M3 10H14V2H25' };
  const kinds = KINDS.map(([k, label]) => ({ command: `line.kind.${k}`, title: label, text: () => glyphOf('none', shapes[k]) }));
  const weights = WEIGHTS.map((w) => ({ command: `line.weight.${w}`, title: `${w} px`, text: () => glyphOf('none', 'M3 6h22', w / 2 + 0.5) }));
  return [
    section('Color', [row([swatches(app, run)])]),
    section('Arrowheads', [segmented(app, run, heads, 'Arrowheads')]),
    section('Kind', [segmented(app, run, kinds, 'Kind')]),
    section('Weight', [segmented(app, run, weights, 'Weight'), checkbox(app, run, 'line.dashed', 'Dashed')]),
    connections(app, run),
  ];
}
