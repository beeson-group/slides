// the Plot pane of the inspector, for a selected plot: what its JSON block holds, and Edit Plot
// Data…, which opens the data editor of commands/plot.ts

import type { App } from '../app.ts';
import { blockOf, jsonOf, plotOf } from '../commands/plot.ts';
import { sheetsOf } from '../plotdata.ts';
import { button, note, row, section, type Control, type Run } from './controls.ts';

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

export function plotPane(app: App, run: Run): Control[] {
  const plot = plotOf(app);
  return [
    section('Data', [
      note(() => summary(app, plot), () => !blockOf(app, plot)),
      row([button(app, run, { command: 'plot.editData', text: 'Edit Plot Data…' })]),
    ]),
  ];
}
