// the Table pane of the Format tab, as the Table tab of Keynote: the size of the table and the cell
// of the caret, the header row, the rows and the columns added and deleted at the cell of the
// caret, the numbers at the right, and the delete of the table

import type { App } from '../app.ts';
import { targetOf } from '../commands/table.ts';
import { columnName, columnsOf, placeOf } from '../table.ts';
import { button, checkbox, note, row, section, segmented, type Control, type Run } from './controls.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function tablePane(app: App, run: Run): Control[] {
  const size = () => {
    const t = targetOf(app);
    if (!t) return '';
    const at = t.cell ? placeOf(t.cell) : null;
    const where = at ? `, cell ${columnName(at.col)}${at.row + 1}` : '';
    return `${plural(t.table.rows.length, 'row')}, ${plural(columnsOf(t.table), 'column')}${where}`;
  };
  return [
    section(null, [note(size)]),
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
    ]),
    section('Numbers', [checkbox(app, run, 'table.numbersRight', 'Columns of numbers at the right')]),
    section(null, [row([button(app, run, { command: 'table.delete', text: 'Delete Table' })])]),
  ];
}
