// the Table pane of the Format tab, as the Table tab of Keynote: the size of the table and the cell
// of the caret or the range of the cells selected as a block, the cells merged and unmerged, the
// header row, the rows and the columns added and deleted, the widths of the columns, the numbers
// at the right with Auto-Align, and the delete of the table

import type { App } from '../app.ts';
import { targetOf } from '../commands/table.ts';
import { boxOf, columnName, columnsOf, placeOf } from '../table.ts';
import { button, checkbox, note, row, section, segmented, type Control, type Run } from './controls.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function tablePane(app: App, run: Run): Control[] {
  const size = () => {
    const t = targetOf(app);
    if (!t) return '';
    const b = t.box;
    const own = t.cell ? boxOf(placeOf(t.cell)!) : null;
    const name = (r: number, c: number) => `${columnName(c)}${r + 1}`;
    const one = !!b && !!own && JSON.stringify(b) === JSON.stringify(own);
    const where = !b ? '' : one ? `, cell ${name(b.r0, b.c0)}` : `, cells ${name(b.r0, b.c0)}:${name(b.r1, b.c1)}`;
    return `${plural(t.table.rows.length, 'row')}, ${plural(columnsOf(t.table), 'column')}${where}`;
  };
  return [
    section(null, [note(size)]),
    section('Cells', [row([
      button(app, run, { command: 'table.merge', text: 'Merge' }),
      button(app, run, { command: 'table.unmerge', text: 'Unmerge' }),
    ])]),
    section('Header', [checkbox(app, run, 'table.header', 'Header row, written as th')]),
    section('Rows', [
      row([segmented(app, run, [
        { command: 'table.rowAbove', text: 'Above', title: 'Add Row Above' },
        { command: 'table.rowBelow', text: 'Below', title: 'Add Row Below' },
      ], 'Add Row')], 'Add'),
      row([button(app, run, { command: 'table.deleteRow', text: 'Delete Row' })]),
    ]),
    section('Columns', [
      row([segmented(app, run, [
        { command: 'table.columnBefore', text: 'Before', title: 'Add Column Before' },
        { command: 'table.columnAfter', text: 'After', title: 'Add Column After' },
      ], 'Add Column')], 'Add'),
      row([button(app, run, { command: 'table.deleteColumn', text: 'Delete Column' })]),
      // the widths of the columns, on a row of their own as Merge and Unmerge, since the two
      // buttons do not fit beside a label in the width of the inspector
      row([
        button(app, run, { command: 'table.distributeColumns', text: 'Distribute Evenly', title: 'Distribute Columns Evenly' }),
        button(app, run, { command: 'table.fitColumn', text: 'Fit to Content', title: 'Resize Column to Fit Content' }),
      ]),
    ]),
    section('Numbers', [
      checkbox(app, run, 'table.numbersRight', 'Columns of numbers at the right'),
      row([button(app, run, { command: 'table.autoAlign', text: 'Auto-Align' })]),
    ]),
    section(null, [row([button(app, run, { command: 'table.delete', text: 'Delete Table' })])]),
  ];
}
