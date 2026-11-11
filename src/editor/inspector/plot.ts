// the Plot pane of the inspector, for a selected plot: what its JSON block holds, Edit Plot Data…,
// which opens the data editor of commands/plot.ts, and the keys of the block that the Chart and
// Axis tabs of Keynote set, i.e. the title of each panel, the title and the range of each axis, and
// the color of each series, chosen from the data colors of the theme. a legend is not a key of the
// format of a plot, hence it is not offered

import type { App } from '../app.ts';
import { blockOf, DATA_TONES, jsonOf, plotOf } from '../commands/plot.ts';
import { sheetsOf } from '../plotdata.ts';
import { make } from '../ui/dom.ts';
import { button, keepFocus, note, row, section, textField, type Control, type Run } from './controls.ts';

type Raw = { panels?: { id?: string; title?: string; x?: { title?: string }; y?: { title?: string } }[]; marks?: { id?: string; kind?: string; tone?: string }[] };

// the block of plot as it is written, or null when it is not in the file or cannot be read
function rawOf(app: App, plot: HTMLElement | null): { json: string; raw: Raw } | null {
  const block = blockOf(app, plot);
  if (!block) return null;
  try {
    const json = jsonOf(app, block);
    return { json, raw: JSON.parse(json) as Raw };
  } catch {
    return null;
  }
}

// a line on the tabs, the frames, and the panels of the block of plot
function summary(app: App, plot: HTMLElement | null): string {
  const block = blockOf(app, plot);
  if (!plot || !block) return 'The JSON block of the plot is not in the file, hence its data cannot be edited here.';
  try {
    const sheets = sheetsOf(jsonOf(app, block));
    const tabs = sheets.filter((s) => s.key.startsWith('tab:'));
    const frames = tabs.map((s) => s.rows.length);
    const panels = sheets.find((s) => s.key === 'axes')?.rows.length ?? 0;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    return `The block ${block.id} holds ${plural(tabs.length, 'tab')} of ${frames.join(', ')} frames over ${plural(panels, 'panel')}.`;
  } catch (e) {
    return `The block ${block.id} cannot be read: ${(e as Error).message}`;
  }
}

// the fields of the panel i: its title, and the title and the range of each axis
function panelPart(app: App, run: Run, plot: HTMLElement, i: number, title: string | null): Control {
  const read = () => rawOf(app, plot);
  const on = () => !!read();
  const titleOf = (axis: 'x' | 'y' | null) => () => {
    const p = read()?.raw.panels?.[i];
    return (axis ? p?.[axis]?.title : p?.title) ?? '';
  };
  const end = (axis: 'x' | 'y', e: 0 | 1) => () => {
    const r = read();
    return r ? (sheetsOf(r.json).find((s) => s.key === 'axes')?.rows[i]?.[(axis === 'y' ? 2 : 0) + e]?.text ?? '') : '';
  };
  const name = (what: string) => `plot-${i}-${what}`;
  const titled = (axis: 'x' | 'y' | null, label: string) =>
    textField(app, { label, name: name(`${axis ?? 'panel'}-title`), value: titleOf(axis), enabled: on, commit: (text) => run('plot.title', { el: plot, panel: i, axis, text }) });
  const ranged = (axis: 'x' | 'y', e: 0 | 1) =>
    textField(app, { label: e ? 'To' : 'From', name: name(`${axis}-${e ? 'to' : 'from'}`), value: end(axis, e), enabled: on, commit: (text) => run('plot.range', { el: plot, panel: i, axis, end: e, text }) });
  return section(title, [
    titled(null, 'Title'),
    titled('x', 'X Axis Title'),
    row([ranged('x', 0), ranged('x', 1)]),
    titled('y', 'Y Axis Title'),
    row([ranged('y', 0), ranged('y', 1)]),
  ]);
}

// a row of the data colors for each series, drawn again when the series of the block change
function seriesPart(app: App, run: Run, plot: HTMLElement): Control {
  const el = make('div', 'ed-series');
  let shape = '';
  let parts: { b: HTMLButtonElement; mark: number; tone: string }[] = [];
  const build = (marks: NonNullable<Raw['marks']>) => {
    parts = [];
    el.replaceChildren(...marks.map((m, i) => {
      const line = make('div', 'ed-field');
      line.append(make('h5', '', m.id ?? `mark ${i + 1}`));
      const sw = make('div', 'ed-swatches');
      sw.setAttribute('role', 'group');
      sw.setAttribute('aria-label', `Color of ${m.id}`);
      for (const tone of DATA_TONES) {
        const b = make('button');
        b.type = 'button';
        b.title = `Data ${tone.slice(5)}`;
        b.setAttribute('aria-label', `${m.id} in data color ${tone.slice(5)}`);
        b.dataset.tone = tone;
        keepFocus(b);
        b.addEventListener('click', () => void run('plot.tone', { el: plot, mark: i, tone }));
        sw.append(b);
        parts.push({ b, mark: i, tone });
      }
      line.append(sw);
      return line;
    }));
  };
  const sync = () => {
    const marks = rawOf(app, plot)?.raw.marks ?? [];
    const now = marks.map((m) => m.id).join('|');
    if (now !== shape) {
      shape = now;
      build(marks);
    }
    const slide = app.current() ?? document.querySelector('.reveal');
    const style = slide ? getComputedStyle(slide) : null;
    for (const { b, mark, tone } of parts) {
      b.style.setProperty('--swatch', style?.getPropertyValue(`--${tone}`).trim() || 'transparent');
      b.setAttribute('aria-pressed', String(marks[mark]?.tone === tone));
    }
  };
  sync();
  return { el, sync };
}

export function plotPane(app: App, run: Run): Control[] {
  const plot = plotOf(app);
  const data = section('Data', [
    note(() => summary(app, plot), () => !blockOf(app, plot)),
    row([button(app, run, { command: 'plot.editData', text: 'Edit Plot Data…' })]),
  ]);
  const raw = plot ? rawOf(app, plot)?.raw : null;
  if (!plot || !raw) return [data];
  const panels = raw.panels ?? [];
  return [
    data,
    ...panels.map((p, i) => panelPart(app, run, plot, i, panels.length > 1 ? `Panel ${p.id ?? i + 1}` : 'Axes')),
    section('Series Colors', [seriesPart(app, run, plot)]),
  ];
}
