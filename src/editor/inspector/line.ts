// the Line pane of the Format tab, for a selected line or arrow, as the Line section of the Style
// tab of Keynote: a swatch of each tone of the theme, and the arrowheads (none, at the start, at the
// end, or at both ends). each control runs a command of commands/line.ts by its id

import type { App } from '../app.ts';
import { HEADS, LINE_TONES } from '../commands/line.ts';
import { make } from '../ui/dom.ts';
import { keepFocus, row, section, segmented, type Control, type Run } from './controls.ts';

const SVG = 'http://www.w3.org/2000/svg';

// a short line with the arrowheads of heads, on the grid of the glyphs of controls.ts
function glyphOf(heads: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 28 12');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '12');
  svg.setAttribute('aria-hidden', 'true');
  const d = ['M3 6h22'];
  if (heads === 'end' || heads === 'both') d.push('M20 2l5 4-5 4');
  if (heads === 'start' || heads === 'both') d.push('M8 2L3 6l5 4');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d.join(''));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
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

export function linePane(app: App, run: Run): Control[] {
  const heads = HEADS.map(([h, label]) => ({ command: `line.heads.${h}`, title: label, text: () => glyphOf(h) }));
  return [
    section('Color', [row([swatches(app, run)])]),
    section('Arrowheads', [segmented(app, run, heads, 'Arrowheads')]),
  ];
}
