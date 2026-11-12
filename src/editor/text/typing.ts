// the typing into the blocks of the slides. a block paired with the file is made editable, and the
// input of the browser is filtered so that a block holds only what the file can hold: a line is a
// br, or a newline in a pre, a paste is plain text, and ⌘B and ⌘I write strong and em. the typing
// is recorded in the history as the content of the block before and after, and an undo puts the
// block back with restoreHost

import type { App, Typing } from '../app.ts';
import { setContentWithTex } from '../math.ts';
import { injectStyle } from '../ui/dom.ts';

const CSS = `
html.beeson-editing .reveal [contenteditable="true"] { cursor: text; outline: 1px dashed transparent; outline-offset: 6px; border-radius: 2px; }
html.beeson-editing .reveal [contenteditable="true"]:hover { outline-color: var(--subtle, #bbb); }
html.beeson-editing .reveal [contenteditable="true"]:focus { outline: 2px solid var(--violet, #96f); }
html.beeson-editing .reveal [contenteditable="true"] mjx-container { cursor: pointer; border-radius: 2px; }
html.beeson-editing .reveal [contenteditable="true"] mjx-container:hover, html.beeson-editing .reveal [contenteditable="true"] mjx-container:focus-visible { outline: 1px dashed var(--accent, #f80); outline-offset: 4px; }
`;

// the end of the part of after that differs from before, as an offset into after, i.e. the first
// character that differs after an undo of typing. null when the texts are the same
export function changeEnd(before: string, after: string): number | null {
  if (before === after) return null;
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  return after.length - tail;
}

const loose = (n: Text): boolean => !n.data.trim() && !!n.parentElement?.matches('ul, ol');

// the caret is put at the offset into the text of host, or at its end. an offset inside a formula
// puts it after the formula
export function placeCaret(host: Element, offset: number | null = null): void {
  if (!(host instanceof HTMLElement)) return;
  host.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(host);
  range.collapse(false);
  if (offset !== null) {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let left = offset;
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (left <= node.length) {
        // white space between the items of a list does not take the caret, which goes to the end of
        // the text before it, or else to the start of the text after it
        if (loose(node)) {
          const near = (way: 'previousNode' | 'nextNode') => {
            walker.currentNode = node!;
            let n = walker[way]() as Text | null;
            while (n && loose(n)) n = walker[way]() as Text | null;
            return n;
          };
          const before = near('previousNode');
          const after = before ? null : near('nextNode');
          if (before || after) [node, left] = before ? [before, before.length] : [after!, 0];
        }
        const math = node.parentElement?.closest('mjx-container');
        if (math && host.contains(math)) range.setStartAfter(math);
        else range.setStart(node, left);
        range.collapse(true);
        break;
      }
      left -= node.length;
    }
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

// Cmd+B and Cmd+I wrap the selection in strong and em, as the deck is written, or take it out of
// them when all of its text is inside. the command of the browser would write b and i, and it
// nests a b inside a strong of the theme, whose weight of 500 it does not take for bold
export function toggleFormat(host: Element, tag: 'strong' | 'em'): void {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !host.contains(range.commonAncestorContainer)) return;
  const alias = tag === 'strong' ? 'b' : 'i';
  const same = (el: Element) => el.localName === tag || el.localName === alias;
  const formatOf = (node: Node): Element | null => {
    for (let el = node instanceof Element ? node : node.parentElement; el && el !== host; el = el.parentElement) if (same(el)) return el;
    return null;
  };
  const unwrap = (root: ParentNode) => {
    for (const el of [...root.querySelectorAll(`${tag}, ${alias}`)]) el.replaceWith(...el.childNodes);
  };
  const common = range.commonAncestorContainer;
  const texts: Text[] = [];
  if (common instanceof Text) texts.push(common);
  else {
    const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const empty = (node === range.startContainer && range.startOffset === node.length) || (node === range.endContainer && range.endOffset === 0);
      if (range.intersectsNode(node) && !empty && node.data.trim()) texts.push(node);
    }
  }
  const off = texts.length > 0 && texts.every((node) => formatOf(node));
  const outer = off ? formatOf(common) : null;
  let nodes: Node[];
  if (outer) {
    // the element around the whole selection is split into the part before it, the selection
    // without the element, and the part after it, so that the formats inside it are kept
    const start: [Node, number] = [range.startContainer, range.startOffset];
    const tail = document.createRange();
    tail.setStart(range.endContainer, range.endOffset);
    tail.setEnd(outer, outer.childNodes.length);
    const after = outer.cloneNode(false) as Element;
    after.append(tail.extractContents());
    const head = document.createRange();
    head.setStart(outer, 0);
    head.setEnd(...start);
    const before = outer.cloneNode(false) as Element;
    before.append(head.extractContents());
    unwrap(outer);
    nodes = [...outer.childNodes];
    outer.before(before);
    outer.after(after);
    outer.replaceWith(...nodes);
  } else {
    const fragment = range.extractContents();
    unwrap(fragment);
    if (off) {
      nodes = [...fragment.childNodes];
      range.insertNode(fragment);
    } else {
      const el = document.createElement(tag);
      el.append(fragment);
      range.insertNode(el);
      nodes = [el];
    }
  }
  for (const el of [...host.querySelectorAll('strong, em, b, i')]) {
    if (!el.textContent && !el.querySelector('br, img, mjx-container')) el.remove();
  }
  if (nodes.length) {
    const selected = document.createRange();
    selected.setStartBefore(nodes[0]);
    selected.setEndAfter(nodes[nodes.length - 1]);
    selection.removeAllRanges();
    selection.addRange(selected);
  }
  host.normalize();
}

// a line in a block is a br, or a newline in a pre, and a paste is plain text, so that the text
// of a slide stays what the file can hold
export function insertPlain(host: Element, text: string): void {
  const pre = host.closest('pre');
  if (pre && text.includes('\n')) return insertCode(host, pre, text);
  if (pre) {
    document.execCommand('insertText', false, text);
    return;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line) document.execCommand('insertText', false, line);
    if (i < lines.length - 1) document.execCommand('insertLineBreak');
  });
}

// a text of several lines pasted into a list item of a slide is an item for each line, as Return
// makes a new item, in Keynote and PowerPoint. a blank line is dropped, since Return on an empty
// item ends the list, apart from a blank first line after a text of the item, which starts a new
// item there. the first line typed replaces a selected text in the entry of the paste, which is one
// entry of the history, and blank lines alone take the selected text off
export function pastesItems(app: App, host: Element, text: string): boolean {
  return host.matches('li') && /\r?\n/.test(text.replace(/\r?\n$/, '')) && app.commands.enabled('text.newParagraph');
}

export async function pasteItems(app: App, text: string): Promise<void> {
  const caretHost = () => {
    const n = window.getSelection()?.anchorNode;
    return app.hostOf(n instanceof Element ? n : n?.parentElement ?? null);
  };
  app.history.break();
  // the text of the item before the caret, or before the selected text
  const before = () => {
    const r = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
    const start = r?.startContainer;
    const li = (start instanceof Element ? start : start?.parentElement)?.closest('li');
    if (!r || !li) return false;
    const head = document.createRange();
    head.setStart(li, 0);
    head.setEnd(r.startContainer, r.startOffset);
    return !!head.toString().trim() || !!head.cloneContents().querySelector('img, mjx-container');
  };
  await app.history.transact('Paste', async () => {
    const all = text.split(/\r?\n/);
    const lines = all.filter((line) => line.trim());
    const host = caretHost();
    if (!lines.length && host && !window.getSelection()?.isCollapsed) {
      app.history.beforeTyping(host, 'Paste');
      // a range taken off directly, since execCommand leaves a br in an emptied item
      window.getSelection()!.getRangeAt(0).deleteContents();
      app.history.afterTyping(host);
      app.history.break();
    }
    const lead = !!lines.length && !all[0].trim() && before();
    for (const [i, line] of lines.entries()) {
      if (i || lead) await app.commands.run('text.newParagraph');
      const host = caretHost();
      if (!host || !line) continue;
      app.history.beforeTyping(host, 'Paste');
      if (!typeBeforeSpace(host, line)) document.execCommand('insertText', false, line);
      app.history.afterTyping(host);
      app.history.break();
    }
  });
}

// one word with the space after it, as a double click takes it on Windows, is pasted with the
// spaces of PowerPoint. the space is dropped before a space, a closing mark, or the end of the
// text, and a space is put after a letter, a digit, or a closing mark. a paste into a word or
// into code is kept as it is. a line break is read as a new line, and a formula or a picture as
// a word, which Range.toString() skips
const spacedText = (r: Range): string => {
  const f = r.cloneContents();
  f.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  f.querySelectorAll('mjx-container, img').forEach((m) => m.replaceWith('x'));
  return f.textContent ?? '';
};

export function spaced(host: Element, text: string): string {
  const r = getSelection()?.rangeCount ? getSelection()!.getRangeAt(0) : null;
  const at = r?.startContainer;
  if (!r || !/^\S+ $/.test(text) || (at instanceof Element ? at : at?.parentElement)?.closest('pre, code')) return text;
  const head = document.createRange();
  head.setStart(host, 0);
  head.setEnd(r.startContainer, r.startOffset);
  const tail = document.createRange();
  tail.setStart(r.endContainer, r.endOffset);
  tail.setEnd(host, host.childNodes.length);
  const before = spacedText(head).slice(-1);
  const next = spacedText(tail).charAt(0);
  const word = /[\p{L}\p{N}]/u;
  const close = /[.,;:!?)\]}’”»]/;
  if (word.test(before) && word.test(next)) return text;
  return (word.test(before) || close.test(before) ? ' ' : '') + (!next || /\s/.test(next) || close.test(next) ? text.slice(0, -1) : text);
}

// Chrome drops a space after the caret where the space is not drawn, i.e. at the start of a block,
// when it types there. text is put into the text node instead, so that the space is kept and drawn,
// as in Keynote and PowerPoint. false where the caret is not before such a space
function typeBeforeSpace(host: Element, text: string): boolean {
  const sel = window.getSelection();
  const node = sel?.focusNode;
  if (!sel?.isCollapsed || !(node instanceof Text) || !/^ \S/.test(node.data.slice(sel.focusOffset))) return false;
  const before = document.createRange();
  before.setStart(node.parentElement?.closest('li, p') ?? host, 0);
  before.setEnd(node, sel.focusOffset);
  if (before.toString().trim() || before.cloneContents().querySelector('img, mjx-container, br')) return false;
  const at = sel.focusOffset;
  node.insertData(at, text);
  sel.collapse(node, at + text.length);
  host.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  return true;
}

// Chrome types a newline of insertText in a pre as a split of its code element, hence a text with
// lines is put at the caret as a text node. a newline at the end of a pre is drawn only before
// another character, thus a second newline is put after the caret there, which the numbers of
// commands/code.ts do not count
function insertCode(host: Element, pre: Element, text: string): void {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  const rest = document.createRange();
  rest.setStartAfter(node);
  rest.setEnd(pre, pre.childNodes.length);
  if (!rest.toString()) node.data += '\n';
  const caret = document.createRange();
  caret.setStart(node, text.length);
  sel.removeAllRanges();
  sel.addRange(caret);
  host.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}

export function install(app: App): void {
  injectStyle('typing', CSS);
  const history = app.history;
  let hosts: Element[] = [];

  // each formula is one unit that the caret skips, reached with Tab and opened with Enter
  function markMath(root: Element): void {
    for (const c of root.querySelectorAll('mjx-container')) {
      c.setAttribute('contenteditable', 'false');
      if (!app.hostOf(c)) continue;
      c.setAttribute('tabindex', '0');
      c.setAttribute('role', 'button');
      c.setAttribute('aria-label', 'Formula, Enter opens its TeX');
    }
  }

  // marks the blocks of the pairing editable, and the formulas in them as one unit each. a block
  // that stays a block is left alone, so that a save does not take the focus
  function attach(): void {
    const next = app.pairing ? app.pairing.blocks.map((b) => b.live) : [];
    for (const h of hosts) if (!next.includes(h)) h.removeAttribute('contenteditable');
    for (const h of next) if (h.getAttribute('contenteditable') !== 'true') h.setAttribute('contenteditable', 'true');
    hosts = next;
    for (const h of next) if (h.matches('aside.notes')) h.setAttribute('aria-label', 'Speaker notes');
    app.move.mark(app.pairing);
    markMath(app.slides());
    document.documentElement.classList.toggle('beeson-editing', hosts.length > 0);
    app.notes.ensure();
  }

  // a block is put back to a content of the history, on its slide, with the caret at the end of
  // the text that changed. a block framed as an object stays framed without a caret, e.g. a
  // paragraph after Apply of the TeX of its inline formula
  async function restoreHost(host: Element, content: string): Promise<void> {
    app.showSlide(host);
    if (host.matches('aside.notes') && !app.notes.shown()) app.notes.toggle();
    const before = host.textContent ?? '';
    await setContentWithTex(host, content);
    markMath(host);
    history.track(host);
    app.markDirty();
    const framed = app.selection.kind === 'elements' && app.selection.items.includes(host);
    if (!framed) placeCaret(host, changeEnd(before, host.textContent ?? ''));
    app.invalidate('content');
  }

  // the undo of the browser, e.g. from its Edit menu, is taken by the history
  function onBeforeInput(ev: InputEvent): void {
    const host = app.hostOf(ev.target);
    if (!host) return;
    const type = ev.inputType;
    if (type === 'historyUndo' || type === 'historyRedo') {
      ev.preventDefault();
      void (type === 'historyUndo' ? history.undo() : history.redo()).catch((e) => app.fail(e));
      return;
    }
    // bold and italic are an entry of the history each
    if (type === 'formatBold' || type === 'formatItalic') {
      ev.preventDefault();
      history.break();
      history.beforeTyping(host);
      toggleFormat(host, type === 'formatBold' ? 'strong' : 'em');
      history.afterTyping(host);
      history.break();
      app.markDirty();
      app.invalidate('content');
      return;
    }
    if (type === 'insertFromPaste' && pastesItems(app, host, ev.dataTransfer?.getData('text/plain') ?? '')) {
      ev.preventDefault();
      void pasteItems(app, ev.dataTransfer?.getData('text/plain') ?? '').catch((e) => app.fail(e));
      return;
    }
    // a new line starts a new entry of the history, as in a text editor
    if (type === 'insertParagraph' || type === 'insertLineBreak') history.break();
    history.beforeTyping(host, type === 'insertFromPaste' ? 'Paste' : type === 'deleteByCut' ? 'Cut' : 'typing');
    if (type === 'insertText' && ev.data && !host.closest('pre') && typeBeforeSpace(host, ev.data)) ev.preventDefault();
    else if (type === 'insertParagraph' || type === 'insertLineBreak') {
      ev.preventDefault();
      insertPlain(host, '\n');
    } else if (type === 'insertFromPaste') {
      ev.preventDefault();
      insertPlain(host, spaced(host, ev.dataTransfer?.getData('text/plain') ?? ''));
      history.afterTyping(host);
      history.break();
    } else if (type === 'insertFromDrop' || type.startsWith('format') || type.startsWith('insertOrdered') || type.startsWith('insertUnordered') || type === 'insertHorizontalRule' || type === 'insertLink') {
      ev.preventDefault();
    }
  }

  // the space left before a cut word when a space or a punctuation mark follows it, which Chrome
  // takes out only on macOS, and Word and PowerPoint on every platform. a space of code is kept
  function smartCut(): void {
    const s = getSelection();
    const n = s?.focusNode;
    const k = s?.focusOffset ?? 0;
    if (!s?.isCollapsed || !(n instanceof Text) || k === 0 || n.parentElement?.closest('pre, code')) return;
    // a word that was the whole text of an inline element leaves the caret at the end of n, and
    // the character after it is read from the next text of the block
    let next = n.data[k];
    const host = next === undefined ? app.hostOf(n.parentElement) : null;
    if (host) {
      const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      w.currentNode = n;
      for (let t = w.nextNode() as Text | null; t && next === undefined; t = w.nextNode() as Text | null) next = t.data[0];
    }
    if (!/[ \u00a0]/.test(n.data[k - 1]) || !/[\s.,;:!?)\]]/.test(next ?? '')) return;
    n.deleteData(k - 1, 1);
    s.collapse(n, k - 1);
  }

  const typing: Typing = { attach, markMath, restoreHost };
  app.typing = typing;
  document.addEventListener('beforeinput', onBeforeInput);
  document.addEventListener('input', (ev) => {
    const host = app.hostOf(ev.target);
    if (!host) return;
    const cut = (ev as InputEvent).inputType === 'deleteByCut';
    if (cut) smartCut();
    history.afterTyping(host);
    if (cut) history.break();
    app.markDirty();
    app.invalidate('content');
  });
  document.addEventListener('focusin', (ev) => {
    const host = app.hostOf(ev.target);
    if (host) history.track(host);
    app.invalidate('selection');
  });
  document.addEventListener('focusout', () => setTimeout(() => app.invalidate('selection'), 0));
}
