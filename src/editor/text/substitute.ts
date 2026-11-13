// the smart quotes, smart dashes, and smart links of the Substitutions of Keynote. a straight quote
// typed into a block is turned into a curly one, two hyphens into an em dash, and a hyphen between
// two spaces into an en dash. a web or email address is made a link at the space typed after it,
// as an a with href. the typed character is one entry of the history and its substitution
// another, hence an undo takes back only the substitution, as on a Mac. each switch is kept in the
// local storage of the browser, and all are on unless switched off. a code box, inline code, a
// link, and the TeX of a formula being typed are left as typed

import type { App } from '../app.ts';
import { contentWithTex } from '../math.ts';
import { store, stored } from '../ui/dom.ts';

export type Smart = 'quotes' | 'dashes' | 'links';

const KEYS: Record<Smart, string> = { quotes: 'beeson-edit-smart-quotes', dashes: 'beeson-edit-smart-dashes', links: 'beeson-edit-smart-links' };

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
export function substitution(before: string, typed: string, on: Record<'quotes' | 'dashes', boolean>): { remove: number; insert: string } | null {
  if (inTex(before)) return null;
  if (on.quotes && (typed === '"' || typed === "'")) {
    const open = OPENS.test(before);
    if (typed === '"') return { remove: 1, insert: open ? '“' : '”' };
    return { remove: 1, insert: open ? '‘' : '’' };
  }
  if (on.dashes && typed === '-' && before.endsWith('-') && !before.endsWith('--')) return { remove: 2, insert: '—' };
  // a space typed at the end of a block is a no-break space in Chrome, and it is kept as typed,
  // since a plain space there is dropped once the next character is typed
  if (on.dashes && (typed === ' ' || typed === '\u00a0') && /\S[ \u00a0]-$/u.test(before)) return { remove: 2, insert: `–${typed}` };
  return null;
}

const URL = /^(?:https?:\/\/|www\.)[\p{L}\p{N}][^\s<>"]*$/iu;
const EMAIL = /^[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}$/u;

const count = (text: string, char: string) => text.split(char).length - 1;

// word without the punctuation that closes the sentence after it. a closing bracket is kept where
// it closes one opened in word, as in an address of Wikipedia
function trimmed(word: string): string {
  while (word) {
    const last = word.slice(-1);
    const open = last === ')' ? '(' : last === ']' ? '[' : '';
    if (open ? count(word, open) >= count(word, last) : !/[.,;:!?'"’”]/u.test(last)) return word;
    word = word.slice(0, -1);
  }
  return word;
}

// the link of the web or email address at the end of the text before a typed space, as its start
// and end in before and its href. null where before does not end with an address
export function smartLink(before: string): { start: number; end: number; href: string } | null {
  if (inTex(before)) return null;
  let start = before.search(/\S+$/u);
  if (start < 0) return null;
  start += /^[(["'“‘]*/u.exec(before.slice(start))![0].length;
  const word = trimmed(before.slice(start));
  const end = start + word.length;
  if (EMAIL.test(word)) return { start, end, href: `mailto:${word}` };
  if (URL.test(word)) return { start, end, href: /^www\./i.test(word) ? `https://${word}` : word };
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
    // the substitution is an entry of its own after the typing, which an undo takes back alone
    const record = (label: string, was: string) => {
      const now = contentWithTex(host);
      app.history.push({ label, undo: () => app.typing.restoreHost(host, was), redo: () => app.typing.restoreHost(host, now) });
      app.history.track(host);
      app.markDirty();
      app.invalidate('content');
    };
    const char = data === ' ' ? node.data.charAt(offset - 1) : data;
    const before = textBefore(host, node, offset - 1);
    // an address is made a link only where it is in the text node of the caret, outside a link
    const link = data === ' ' && isSmart('links') && !node.parentElement?.closest('a') ? smartLink(before) : null;
    const from = link ? offset - 1 - (before.length - link.start) : -1;
    if (link && from >= 0) {
      const was = contentWithTex(host);
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, from + link.end - link.start);
      const a = document.createElement('a');
      a.setAttribute('href', link.href);
      range.surroundContents(a);
      host.normalize();
      if (a.nextSibling instanceof Text) sel.collapse(a.nextSibling, offset - from - (link.end - link.start));
      record('smart link', was);
      return;
    }
    const sub = substitution(before, char, { quotes: isSmart('quotes'), dashes: isSmart('dashes') });
    if (!sub || offset < sub.remove) return;
    const was = contentWithTex(host);
    node.replaceData(offset - sub.remove, sub.remove, sub.insert);
    sel.collapse(node, offset - sub.remove + sub.insert.length);
    record(data === '"' || data === "'" ? 'smart quote' : 'smart dash', was);
  });
}
