import type { App, Typing } from '../app.ts';
import { mathReady, setContentWithTex } from '../math.ts';
import { hasTex } from '../typeset.ts';
import { fromPoint } from './flow.ts';
import { showTex } from './shown-tex.ts';
import { isLabel } from './labels.ts';
import { injectStyle } from '../ui/dom.ts';

const CSS = `
html.beeson-editing .reveal [contenteditable="true"] { cursor: text; outline: 1px solid transparent; outline-offset: 6px; border-radius: 2px; }
html.beeson-editing .reveal [contenteditable="true"]:hover { outline-color: color-mix(in srgb, var(--ed-muted, var(--subtle, #bbb)) 30%, transparent); }
html.beeson-editing .reveal [contenteditable="true"]:focus { outline-color: transparent; }
html.beeson-editing .reveal [contenteditable="true"] mjx-container { cursor: pointer; border-radius: 2px; }
html.beeson-editing .reveal [contenteditable="true"] mjx-container:hover, html.beeson-editing .reveal [contenteditable="true"] mjx-container:focus-visible { outline: 1px dashed var(--accent, #f80); outline-offset: 4px; }
`;

export function changeEnd(before: string, after: string): number | null {
  if (before === after) return null;
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  return after.length - tail;
}

const loose = (n: Text): boolean => !n.data.trim() && !!n.parentElement?.matches('ul, ol');

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

const wordsOf = (host: Element): Text[] => {
  const out: Text[] = [];
  const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) if (!n.parentElement?.closest('mjx-container')) out.push(n);
  return out;
};

export async function typesetTyped(app: App, host: Element): Promise<void> {
  const mj = window.MathJax;
  const sel = window.getSelection();
  if (!mj?.typesetPromise) return;
  const inside = () => !!sel?.rangeCount && host.contains(sel.anchorNode);
  let left = -1;
  if (inside()) {
    const tail = sel!.getRangeAt(0).cloneRange();
    tail.setEnd(host, host.childNodes.length);
    const caret = tail.startContainer;
    left = wordsOf(host).reduce((n, t) => n + (t === caret ? t.length - tail.startOffset : tail.comparePoint(t, 0) === 0 ? t.length : 0), 0);
  }
  await mathReady();
  await mj.typesetPromise([host]);
  app.typing.markMath(host);
  app.invalidate('content');
  if (left < 0 || !inside()) return;
  const r = document.createRange();
  r.selectNodeContents(host);
  r.collapse(false);
  for (const t of wordsOf(host).reverse()) {
    if (left <= 0) break;
    if (left <= t.length) r.setStart(t, t.length - left);
    left -= t.length;
  }
  r.collapse(true);
  sel!.removeAllRanges();
  sel!.addRange(r);
}

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

export function pastesItems(app: App, host: Element, text: string): boolean {
  return host.matches('li') && /\r?\n/.test(text.replace(/\r?\n$/, '')) && app.commands.enabled('text.newParagraph');
}

export async function pasteItems(app: App, text: string): Promise<void> {
  const caretHost = () => {
    const n = window.getSelection()?.anchorNode;
    return app.hostOf(n instanceof Element ? n : n?.parentElement ?? null);
  };
  app.history.break();
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
      if (hasTex(line)) await typesetTyped(app, host);
    }
  });
}

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

  function markMath(root: Element): void {
    for (const c of root.querySelectorAll('mjx-container')) {
      c.setAttribute('contenteditable', 'false');
      if (!app.hostOf(c)) continue;
      c.setAttribute('tabindex', '0');
      c.setAttribute('role', 'button');
      c.setAttribute('aria-label', 'Formula. Press Enter to open its TeX');
    }
  }

  function attach(): void {
    const next = app.pairing ? app.pairing.texts.map((b) => b.live) : [];
    for (const h of hosts) if (!next.includes(h)) h.removeAttribute('contenteditable');
    for (const h of next) if (h.getAttribute('contenteditable') !== 'true') h.setAttribute('contenteditable', 'true');
    hosts = next;
    for (const h of next) if (h.matches('aside.notes')) h.setAttribute('aria-label', 'Speaker notes');
    app.move.mark(app.pairing);
    markMath(app.slides());
    document.documentElement.classList.toggle('beeson-editing', hosts.length > 0);
    app.notes.ensure();
  }

  async function restoreHost(host: Element, content: string): Promise<void> {
    app.showSlide(host);
    if (host.matches('aside.notes') && !app.notes.shown()) app.notes.toggle();
    const before = host.textContent ?? '';
    await setContentWithTex(host, content);
    (window as { Beeson?: { refreshChrome?(): void } }).Beeson?.refreshChrome?.();
    markMath(host);
    history.track(host);
    app.markDirty();
    const framed = app.selection.kind === 'elements' && app.selection.items.includes(host);
    if (!framed) placeCaret(host, changeEnd(before, host.textContent ?? ''));
    app.invalidate('content');
  }

  function onBeforeInput(ev: InputEvent): void {
    if (ev.defaultPrevented) return;
    const host = app.hostOf(ev.target);
    if (!host) return;
    const type = ev.inputType;
    if (type === 'historyUndo' || type === 'historyRedo') {
      ev.preventDefault();
      void app.commands.run(type === 'historyUndo' ? 'edit.undo' : 'edit.redo').catch((e) => app.fail(e));
      return;
    }
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
    if ((type === 'insertParagraph' || type === 'insertLineBreak') && isLabel(host)) {
      ev.preventDefault();
      void app.commands.run('selection.leaveText').catch((e) => app.fail(e));
      return;
    }
    if (type === 'insertParagraph' || type === 'insertLineBreak') history.break();
    history.beforeTyping(host, type === 'insertFromPaste' ? 'Paste' : type === 'deleteByCut' ? 'Cut' : 'typing');
    if (type === 'insertText' && ev.data && !host.closest('pre') && typeBeforeSpace(host, ev.data)) ev.preventDefault();
    else if (type === 'insertParagraph' || type === 'insertLineBreak') {
      ev.preventDefault();
      insertPlain(host, '\n');
    } else if (type === 'insertFromPaste') {
      ev.preventDefault();
      const text = ev.dataTransfer?.getData('text/plain') ?? '';
      insertPlain(host, spaced(host, text));
      history.afterTyping(host);
      history.break();
      if (hasTex(text) && !host.closest('pre')) void typesetTyped(app, host).catch((e) => app.fail(e));
    } else if (type === 'formatUnderline') {
      ev.preventDefault();
      void app.commands.run('text.underline');
    } else if (type === 'insertFromDrop' || type.startsWith('format') || type.startsWith('insertOrdered') || type.startsWith('insertUnordered') || type === 'insertHorizontalRule' || type === 'insertLink') {
      ev.preventDefault();
    }
  }

  function smartCut(): void {
    const s = getSelection();
    const n = s?.focusNode;
    const k = s?.focusOffset ?? 0;
    if (!s?.isCollapsed || !(n instanceof Text) || k === 0 || n.parentElement?.closest('pre, code')) return;
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
  const besideMath = (math: Element, after: boolean) => {
    const r = document.createRange();
    if (after) r.setStartAfter(math);
    else r.setStartBefore(math);
    getSelection()?.collapse(r.startContainer, r.startOffset);
  };
  const mathAt = (node: Node | null | undefined): Element | null | undefined => (node instanceof Element ? node : node?.parentElement)?.closest('mjx-container');
  const nextMath = (forward: boolean): Element | null => {
    const s = getSelection();
    if (!s?.isCollapsed) return null;
    const { focusNode: n, focusOffset: o } = s;
    let next: Node | null | undefined;
    if (n instanceof Text) next = (forward ? o === n.length : o === 0) ? (forward ? n.nextSibling : n.previousSibling) : null;
    else next = n?.childNodes[forward ? o : o - 1];
    while (next instanceof Text && !next.data) next = forward ? next.nextSibling : next.previousSibling;
    return next instanceof Element && next.matches('mjx-container') ? next : null;
  };
  let back = false;
  document.addEventListener('keydown', (ev) => {
    back = /^(ArrowLeft|ArrowUp|Home|PageUp)$/.test(ev.key);
    const host = app.hostOf(ev.target);
    if (!host || !/^Arrow(Left|Right)$/.test(ev.key) || ev.shiftKey || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    const math = nextMath(ev.key === 'ArrowRight');
    if (!math || !host.contains(math)) return;
    ev.preventDefault();
    if (!showTex(app, math, ev.key === 'ArrowRight' ? 'start' : 'end')) besideMath(math, ev.key === 'ArrowRight');
  });
  document.addEventListener('selectionchange', () => {
    const s = getSelection();
    const math = s?.isCollapsed ? mathAt(s.focusNode) : null;
    const host = math && app.hostOf(math);
    if (host && document.activeElement === host) besideMath(math, !back);
  });
  document.addEventListener('click', (ev) => {
    const host = app.hostOf(ev.target);
    if (!host || !getSelection()?.isCollapsed || mathAt(ev.target as Node)) return;
    const at = fromPoint(ev.clientX, ev.clientY);
    const math = mathAt(at?.[0]) ?? nextMath(true) ?? nextMath(false);
    if (!math || !host.contains(math)) return;
    const r = math.getBoundingClientRect();
    if (ev.clientY < r.top || ev.clientY > r.bottom || (ev.clientX > r.left && ev.clientX < r.right)) return;
    besideMath(math, ev.clientX >= r.right);
  });
}
