// the smart quotes and smart dashes of the Substitutions of Keynote. a straight quote typed into a
// block is turned into a curly one, two hyphens into an em dash, and a hyphen between two spaces
// into an en dash. the typed character is one entry of the history and its substitution another,
// hence an undo takes back only the substitution, as on a Mac. each switch is kept in the local
// storage of the browser, and both are on unless switched off. a code box, inline code, and the
// TeX of a formula being typed are left as typed

import type { App } from '../app.ts';
import { contentWithTex } from '../math.ts';
import { store, stored } from '../ui/dom.ts';

export type Smart = 'quotes' | 'dashes';

const KEYS: Record<Smart, string> = { quotes: 'beeson-edit-smart-quotes', dashes: 'beeson-edit-smart-dashes' };

export const isSmart = (kind: Smart): boolean => stored(KEYS[kind]) !== 'off';

export function setSmart(kind: Smart, on: boolean): void {
  store(KEYS[kind], on ? 'on' : 'off');
}

// a quote opens after these characters, and closes after any other
const OPENS = /(^|[\s([{“‘—–-])$/u;

// true when before ends inside the TeX of a formula, i.e. after a \( or a \[ that is not closed
function inTex(before: string): boolean {
  return before.lastIndexOf('\\(') > before.lastIndexOf('\\)') || before.lastIndexOf('\\[') > before.lastIndexOf('\\]');
}

// the substitution of the character typed after the text before, as the count of the characters
// before the caret that are replaced, the typed one included, and the text put in their place.
// null where nothing is substituted
export function substitution(before: string, typed: string, on: Record<Smart, boolean>): { remove: number; insert: string } | null {
  if (inTex(before)) return null;
  if (on.quotes && (typed === '"' || typed === "'")) {
    const open = OPENS.test(before);
    if (typed === '"') return { remove: 1, insert: open ? '“' : '”' };
    return { remove: 1, insert: open ? '‘' : '’' };
  }
  if (on.dashes && typed === '-' && before.endsWith('-') && !before.endsWith('--')) return { remove: 2, insert: '—' };
  if (on.dashes && typed === ' ' && /\S -$/u.test(before)) return { remove: 2, insert: '– ' };
  return null;
}

// the text of host before the point (node, offset), without its formulas
function textBefore(host: Element, node: Text, offset: number): string {
  let out = '';
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (n === node) return out + n.data.slice(0, offset);
    if (!n.parentElement?.closest('mjx-container')) out += n.data;
  }
  return out;
}

export function install(app: App): void {
  // the data of the last beforeinput of typing. an insertText of a script, e.g. a paste of plain
  // text by execCommand, comes without a beforeinput, and it is not substituted
  let typed: string | null = null;
  document.addEventListener('beforeinput', (ev) => {
    typed = ev.inputType === 'insertText' && !ev.defaultPrevented ? ev.data : null;
  });
  document.addEventListener('input', (ev) => {
    const data = typed;
    typed = null;
    if (!(ev instanceof InputEvent) || ev.inputType !== 'insertText' || ev.data !== data || data?.length !== 1) return;
    const host = app.hostOf(ev.target);
    const sel = window.getSelection();
    if (!host || !sel?.rangeCount || !sel.isCollapsed) return;
    const node = sel.anchorNode;
    const offset = sel.anchorOffset;
    if (!(node instanceof Text) || !host.contains(node) || node.parentElement?.closest('pre, code, mjx-container')) return;
    const sub = substitution(textBefore(host, node, offset - 1), data, { quotes: isSmart('quotes'), dashes: isSmart('dashes') });
    if (!sub || offset < sub.remove) return;
    const was = contentWithTex(host);
    node.replaceData(offset - sub.remove, sub.remove, sub.insert);
    sel.collapse(node, offset - sub.remove + sub.insert.length);
    const now = contentWithTex(host);
    app.history.push({
      label: data === '"' || data === "'" ? 'smart quote' : 'smart dash',
      undo: () => app.typing.restoreHost(host, was),
      redo: () => app.typing.restoreHost(host, now),
    });
    app.history.track(host);
    app.markDirty();
    app.invalidate('content');
  });
}
