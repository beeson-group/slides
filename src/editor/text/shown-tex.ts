import type { App } from '../app.ts';
import { mathIn, type MathLookup } from '../math.ts';
import { injectStyle } from '../ui/dom.ts';
import { isLabel, typesetLabel } from './labels.ts';

const CSS = `
html.beeson-editing .reveal [contenteditable="true"] mjx-container.beeson-math-selected { background: Highlight; }
`;

let shownIn: HTMLElement | null = null;
let selected: Element[] = [];

function unitsOf(host: Element, lookup: MathLookup): { node: Node; length: number }[] {
  const out: { node: Node; length: number }[] = [];
  const walk = (parent: Node) => {
    for (const n of parent.childNodes) {
      if (n instanceof Text) out.push({ node: n, length: n.length });
      else if (n instanceof Element && n.localName === 'mjx-container') {
        const info = lookup(n);
        out.push({ node: n, length: info ? info.open.length + info.tex.length + info.close.length : 0 });
      } else walk(n);
    }
  };
  walk(host);
  return out;
}

const indexOf = (n: Node) => Array.prototype.indexOf.call(n.parentNode!.childNodes, n) as number;

function texOffset(units: { node: Node; length: number }[], node: Node, offset: number): number {
  const point = document.createRange();
  point.setStart(node, offset);
  let n = 0;
  for (const u of units) {
    if (u.node === node) return n + offset;
    const end = u.node instanceof Text ? point.comparePoint(u.node, u.length) : point.comparePoint(u.node.parentNode!, indexOf(u.node) + 1);
    if (end > 0) return n;
    n += u.length;
  }
  return n;
}

function texPoint(host: Element, units: { node: Node; length: number }[], n: number): [Node, number] {
  let left = n;
  for (const u of units) {
    if (u.node instanceof Text) {
      if (left <= u.length) return [u.node, left];
    } else if (left === 0) return [u.node.parentNode!, indexOf(u.node)];
    else if (left < u.length) return [u.node.parentNode!, indexOf(u.node) + 1];
    left -= u.length;
  }
  return [host, host.childNodes.length];
}

const typesetIn = (n: Node) => !n.parentElement?.closest('code, pre, .mathjax_ignore');

function inTex(host: Element, node: Node, offset: number): boolean {
  const units = unitsOf(host, () => null).filter((u) => u.node instanceof Text && typesetIn(u.node));
  const at = texOffset(units, node, offset);
  const text = units.map((u) => (u.node as Text).data).join('');
  const before = text.slice(0, at);
  const after = text.slice(at);
  return before.lastIndexOf('\\(') > before.lastIndexOf('\\)') || before.endsWith('\\)') || after.startsWith('\\(') || (before.endsWith('\\') && after.startsWith('('));
}

const isInline = (app: App, container: Element): HTMLElement | null => {
  const host = app.hostOf(container);
  if (!(host instanceof HTMLElement) || host.matches('div.math')) return null;
  const info = mathIn(host)(container);
  return info && !info.display ? host : null;
};

export function showTex(app: App, container: Element, place: 'all' | 'start' | 'end'): boolean {
  const mj = window.MathJax;
  const host = mj ? isInline(app, container) : null;
  const info = host && mathIn(host)(container);
  if (!mj || !host || !info) return false;
  if (shownIn && shownIn !== host) void typesetAgain(app, shownIn).catch((e) => app.fail(e));
  mj.startup.document.clearMathItemsWithin([container]);
  const text = document.createTextNode(info.open + info.tex + info.close);
  container.replaceWith(text);
  shownIn = host;
  host.focus({ preventScroll: true });
  const s = getSelection();
  if (place === 'all') s?.setBaseAndExtent(text, 0, text, text.length);
  else s?.collapse(text, place === 'start' ? info.open.length : text.length - info.close.length);
  app.invalidate('selection');
  return true;
}

async function typesetAgain(app: App, host: HTMLElement): Promise<void> {
  if (shownIn === host) shownIn = null;
  const mj = window.MathJax;
  if (!mj?.typesetPromise) return;
  const s = getSelection();
  const inside = () => !!s?.rangeCount && host.contains(s.anchorNode) && host.contains(s.focusNode);
  let ends: [number, number] | null = null;
  if (inside()) {
    const units = unitsOf(host, mathIn(host));
    ends = [texOffset(units, s!.anchorNode!, s!.anchorOffset), texOffset(units, s!.focusNode!, s!.focusOffset)];
  }
  if (isLabel(host)) await typesetLabel(host);
  else try {
    if (!mj.typeset) throw new Error('MathJax does not typeset at once');
    mj.typeset([host]);
  } catch {
    await mj.typesetPromise([host]);
  }
  app.typing.markMath(host);
  app.invalidate('content');
  if (!ends || !inside()) return;
  const units = unitsOf(host, mathIn(host));
  s!.setBaseAndExtent(...texPoint(host, units, ends[0]), ...texPoint(host, units, ends[1]));
}

export function install(app: App): void {
  injectStyle('shown-tex', CSS);
  let back = false;
  document.addEventListener('keydown', (ev) => void (back = /^(ArrowLeft|ArrowUp|Home|PageUp)$/.test(ev.key)), true);
  const check = () => {
    const host = shownIn;
    if (!host) return;
    const s = getSelection();
    const n = s?.isCollapsed ? s.focusNode : null;
    const o = s?.focusOffset ?? 0;
    if (n instanceof Text && host.contains(n) && typesetIn(n) && n.data[o - 1] === '\\' && /[()]/.test(n.data[o] ?? '')) s!.collapse(n, back ? o - 1 : o + 1);
    const held = host.isConnected && document.activeElement === host && !!s?.rangeCount && host.contains(s.anchorNode) && host.contains(s.focusNode) && (isLabel(host) || inTex(host, s.anchorNode!, s.anchorOffset) || inTex(host, s.focusNode!, s.focusOffset));
    if (!held) void typesetAgain(app, host).catch((e) => app.fail(e));
  };
  document.addEventListener('selectionchange', () => {
    check();
    for (const m of selected) m.classList.remove('beeson-math-selected');
    selected = [];
    const s = getSelection();
    if (!s?.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0);
    const root = r.commonAncestorContainer instanceof Element ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
    if (!root || !app.hostOf(root)) return;
    selected = [...root.querySelectorAll('mjx-container')].filter((m) => r.intersectsNode(m));
    for (const m of selected) m.classList.add('beeson-math-selected');
  });
  document.addEventListener('focusout', () => setTimeout(check, 0));
  document.addEventListener('focusin', (ev) => {
    const face = ev.target instanceof Element && isLabel(ev.target) ? ev.target.querySelector(':scope > mjx-container') : null;
    if (face) showTex(app, face, 'end');
  });
  document.addEventListener('keyup', check);
  document.addEventListener('mouseup', check);
}
