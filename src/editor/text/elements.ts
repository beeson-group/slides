import type { App } from '../app.ts';
import { mathLookup } from '../math.ts';
import { fileIndexes } from '../shown-steps.ts';
import { tokenize } from '../tokens.ts';
import { isRuntimeClass, stripRuntime } from '../render.ts';
import { renderTag, stateOf, translateIn, type TagEdit } from '../tags.ts';
import { textStyle } from '../model/templates.ts';
import { injectStyle } from '../ui/dom.ts';
import * as flow from './flow.ts';

const CSS = `
html.beeson-editing .reveal li[contenteditable="true"]:empty::after, html.beeson-editing .reveal [contenteditable="true"] li:empty::after { content: "\\200b"; }
html.beeson-editor .reveal ul > li:empty::before { content: ""; }
html.beeson-editor .reveal ol > li:empty::before { content: counter(list-item); }
`;

const ATOM = 'mjx-container, br, img';
const LIST = 'ul, ol';
const itemsOf = (root: Element): Element[] => [...root.querySelectorAll('li')];

function atoms(root: Node): Node[] {
  const out: Node[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType === Node.TEXT_NODE) return n.parentElement?.closest('mjx-container') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      return (n as Element).matches(ATOM) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
  return out.filter((n) => !n.parentElement?.closest('mjx-container'));
}

const indexOf = (n: Node) => Array.prototype.indexOf.call(n.parentNode!.childNodes, n) as number;

export function offsetIn(root: Node, node: Node, offset: number): number {
  const point = document.createRange();
  point.setStart(node, offset);
  let n = 0;
  for (const a of atoms(root)) {
    if (a instanceof Text) {
      if (a === node) return n + offset;
      if (point.comparePoint(a, a.length) <= 0) n += a.length;
      else return n;
    } else if (point.comparePoint(a.parentNode!, indexOf(a) + 1) <= 0) n += 1;
    else return n;
  }
  return n;
}

export function pointAt(root: Node, n: number): [Node, number] {
  let left = Math.max(0, n);
  for (const a of atoms(root)) {
    if (a instanceof Text) {
      if (left <= a.length) return [a, left];
      left -= a.length;
    } else {
      if (left === 0) return [a.parentNode!, indexOf(a)];
      left -= 1;
    }
  }
  return [root, root.childNodes.length];
}

export function selectIn(root: Element, start: number, end = start): void {
  const host = root.closest('[contenteditable="true"]') as HTMLElement | null;
  host?.focus({ preventScroll: true });
  const range = document.createRange();
  range.setStart(...pointAt(root, start));
  range.setEnd(...pointAt(root, end));
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export type Target = { host: Element; range: Range };

export function selectedTextElements(app: App): Element[] {
  const pairing = app.pairing;
  if (!pairing) return [];
  return app.selection.elements().flatMap((el) => {
    if (pairing.byLive.has(el)) return el.matches('aside.notes') ? [] : [el];
    if (el.matches('div.shape')) return [...el.querySelectorAll(':scope > p, :scope > ul > li, :scope > ol > li')].filter((p) => pairing.byLive.has(p));
    return el.matches(LIST) && pairing.elements.has(el) ? [...el.querySelectorAll('li')].filter((li) => pairing.byLive.has(li)) : [];
  });
}

let last: Target | null = null;

export function textTarget(app: App): Target | null {
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const range = sel.getRangeAt(0);
    const host = app.hostOf(range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement);
    if (host && host.contains(range.endContainer)) return { host, range };
  }
  if (last && last.host.isConnected && app.selection.kind === 'text' && app.selection.items[0] === last.host) return last;
  return null;
}

export function rangeTex(root: Element, range: Range): string {
  const div = document.createElement('div');
  div.append(range.cloneContents());
  const indexed = '[data-fragment-index]';
  fileIndexes([...root.querySelectorAll(indexed)].filter((el) => range.intersectsNode(el)), [...div.querySelectorAll(indexed)]);
  stripRuntime(div);
  const lookup = mathLookup();
  const outer = (m: Element) => !m.parentElement?.closest('mjx-container');
  const live = [...root.querySelectorAll('mjx-container')].filter((m) => outer(m) && range.intersectsNode(m));
  [...div.querySelectorAll('mjx-container')].filter(outer).forEach((c, i) => {
    const info = live[i] ? lookup(live[i]) : null;
    c.replaceWith(document.createTextNode(info ? info.open + info.tex + info.close : c.textContent ?? ''));
  });
  for (const el of [...div.querySelectorAll('strong, em, b, i, u, s, sup, sub, code, span, a')].reverse()) {
    if (!el.textContent && !el.querySelector(ATOM)) el.remove();
  }
  div.normalize();
  return div.innerHTML;
}

export function rangeWords(root: Element, range: Range): string {
  const div = document.createElement('div');
  div.innerHTML = rangeTex(root, range);
  return div.textContent ?? '';
}

export function rangeOf(root: Node, from: [Node, number] | null, to: [Node, number] | null): Range {
  const r = document.createRange();
  r.selectNodeContents(root);
  if (from) r.setStart(...from);
  if (to) r.setEnd(...to);
  return r;
}

function texCopy(host: Element): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = rangeTex(host, rangeOf(host, null, null));
  return div;
}

const spaceBefore = (n: Node): Text | null => {
  const p = n.previousSibling;
  return p instanceof Text && !p.data.trim() ? p : null;
};

const LAYOUT_END = /[ \t]*\r?\n\s*$/;
const layoutSpace = (n: Node | null): n is Text => n instanceof Text && !n.data.trim() && /\n/.test(n.data);

const trimEnd = (el: Element) => {
  while (layoutSpace(el.lastChild)) el.lastChild.remove();
  if (el.lastChild instanceof Text) el.lastChild.data = el.lastChild.data.replace(LAYOUT_END, '');
};

const blank = (r: Range) => !r.toString().trim() && !r.cloneContents().querySelector(ATOM);

const PLAIN = /^(small|center|faint|fragment|fade-[\w-]+|semi-fade-out|current-visible|grow|shrink|strike|highlight-[\w-]+)$/;
const plainClass = (c: string): boolean => PLAIN.test(c) || isRuntimeClass(c);

type Item = {
  host: Element;
  item: Element;
  nested: boolean;
  range: Range;
};

function itemAt(app: App): Item | null {
  const t = textTarget(app);
  if (!t || t.host.matches('aside.notes')) return null;
  const node = t.range.startContainer;
  if ((node instanceof Element ? node : node.parentElement)?.matches(LIST)) return null;
  const li = (node instanceof Element ? node : node.parentElement)?.closest('li');
  const item = li && t.host.contains(li) ? li : t.host;
  return { host: t.host, item, nested: item !== t.host, range: t.range };
}

function structural(app: App, el: Element | null): boolean {
  const pairing = app.pairing;
  if (!el || !pairing?.byLive.has(el) || el.matches('aside.notes')) return false;
  const parent = el.parentElement;
  if (!parent || !pairing.elements.has(parent) || pairing.byLive.has(parent)) return false;
  if (el.localName === 'li') return parent.matches(LIST);
  if (el.localName === 'h3') return true;
  if (el.localName === 'p') return [...el.classList].every(plainClass);
  return false;
}

function startTag(app: App, el: Element, tag = el.localName, edit: TagEdit = {}): string {
  const body = app.doc.elementText(el);
  const start = tokenize(body).find((t) => t.type === 'start');
  if (!start || start.type !== 'start') return `<${tag}>`;
  const open = renderTag(body, start, start.attrs, edit) ?? body.slice(start.start, start.end);
  return open.replace(/^<[\w-]+/, `<${tag}`);
}

const PLACE = ['width', 'translate'];

function placeOf(app: App, el: Element): [string, string][] {
  const start = tokenize(app.doc.elementText(el)).find((t) => t.type === 'start');
  return start?.type === 'start' ? Object.entries(stateOf(start.attrs).style).filter(([n]) => PLACE.includes(n)) : [];
}

function placedList(app: App, el: Element, kind: ListKind): { open: string; li: string } {
  const style = placeOf(app, el).map(([n, v]) => `${n}: ${v}`).join('; ').replace(/"/g, '&quot;');
  return { open: style ? openList(kind).replace(/>$/, ` style="${style}">`) : openList(kind), li: startTag(app, el, 'li', { classes: { small: false }, style: { width: null, translate: null } }) };
}

function placedParagraph(app: App, li: Element, list: Element): string {
  const own = placeOf(app, li).map(([n]) => n);
  return startTag(app, li, 'p', { style: Object.fromEntries(placeOf(app, list).filter(([n]) => !own.includes(n))) });
}

function hoist(app: App, list: Element): boolean {
  const moves = liOf(list).map((li) => translateIn(`translate: ${placeOf(app, li).find(([n]) => n === 'translate')?.[1] ?? ''}`));
  const t = moves[0];
  if (!t || moves.some((m) => m?.x !== t.x || m.y !== t.y)) return false;
  const own = translateIn(`translate: ${placeOf(app, list).find(([n]) => n === 'translate')?.[1] ?? ''}`) ?? { x: 0, y: 0 };
  app.doc.setTag(list, { translate: { x: own.x + t.x, y: own.y + t.y } }, 'new paragraph');
  for (const li of liOf(list)) app.doc.setTag(li, { style: { translate: null } }, 'new paragraph');
  return true;
}

function nextOf(app: App, el: Element): Element | null {
  let n = el.nextElementSibling;
  while (n && !app.pairing?.elements.has(n)) n = n.nextElementSibling;
  return n;
}

const sameKind = (a: Element, b: Element) => (a.localName === 'li') === (b.localName === 'li');

function previousElement(app: App, el: Element): Element | null {
  const p = el.previousElementSibling;
  return p && structural(app, p) && sameKind(p, el) ? p : null;
}

function nextElement(app: App, el: Element): Element | null {
  const n = el.nextElementSibling;
  return n && structural(app, n) && sameKind(n, el) ? n : null;
}

export function besideTextElement(app: App, el: Element, ahead: boolean): Element | null {
  const n = structural(app, el) ? (ahead ? nextElement : previousElement)(app, el) : null;
  return n && (n as HTMLElement).style.translate === (el as HTMLElement).style.translate ? n : null;
}

type Indent = { base: string; step: string; eol: string };

function indentOf(app: App, el: Element): Indent {
  const unit = app.doc.unitText(el);
  const lead = unit.slice(0, unit.indexOf(app.doc.elementText(el)));
  const base = /[ \t]*$/.exec(lead.slice(lead.lastIndexOf('\n') + 1))?.[0] ?? '';
  return { base, step: textStyle(app.source?.text ?? '').step, eol: app.source?.crlf ? '\r\n' : '\n' };
}

function goOn(list: Element, k: number): Record<string, string | null> {
  if (!(list instanceof HTMLOListElement)) return {};
  const n = list.start + k;
  return { start: n === 1 ? null : String(n) };
}

const cutOff = new WeakSet<Element>();

function keepCounts(app: App): void {
  for (const ol of app.slides().querySelectorAll('ol')) {
    if (!cutOff.has(ol) || !(ol instanceof HTMLOListElement)) continue;
    let first = ol.previousElementSibling;
    while (first && !first.matches('ol, ul')) first = first.previousElementSibling;
    const n = first instanceof HTMLOListElement ? first.start + first.querySelectorAll(':scope > li').length : 1;
    if (n !== ol.start) app.doc.setTag(ol, { attrs: { start: n === 1 ? null : String(n) } }, 'start at');
  }
}

function goesOn(list: Element, second: Element | undefined, k: number): void {
  if (list instanceof HTMLOListElement && second && (k > 0 || cutOff.has(list))) cutOff.add(second);
}

const fileList = (app: App, el: Element | null): el is Element => !!el?.matches(LIST) && !!app.pairing?.elements.has(el) && !app.pairing.byLive.has(el);

function listAttrs(app: App, list: Element): string {
  const start = tokenize(app.doc.elementText(list)).find((t) => t.type === 'start');
  return start?.type === 'start' ? start.attrs.filter((a) => a.name !== 'start').map((a) => `${a.name}=${a.value ?? ''}`).sort().join(' ') : '';
}

function prevOf(app: App, el: Element): Element | null {
  let n = el.previousElementSibling;
  while (n && !app.pairing?.elements.has(n)) n = n.previousElementSibling;
  return n;
}

export async function removeJoining(app: App, els: Element[], label: string): Promise<void> {
  const around: [Element | null, Element | null][] = [];
  for (const el of els) {
    const inFlow = el.matches('p, h1, h2, h3, h4, h5, h6, ul, ol, div.math, blockquote, pre') && !/^(absolute|fixed)$/.test(getComputedStyle(el).position);
    around.push(inFlow ? [prevOf(app, el), nextOf(app, el)] : [null, null]);
    await app.doc.remove(el, label);
  }
  const into = new Map<Element, Element>();
  for (let [first, second] of around) {
    while (first && into.has(first)) first = into.get(first)!;
    if (!fileList(app, first) || !fileList(app, second) || !first.isConnected || !second.isConnected || first.localName !== second.localName) continue;
    if (first.closest('[data-locked]') || second.closest('[data-locked]')) continue;
    if (nextOf(app, first) !== second || listAttrs(app, first) !== listAttrs(app, second)) continue;
    const items = [...second.children].filter((c) => c.localName === 'li' && app.pairing?.elements.has(c));
    const end = first.lastChild instanceof Text && !first.lastChild.data.trim() ? first.lastChild : null;
    await app.doc.insert(items.map((li) => app.doc.elementText(li)), first, end, label);
    await app.doc.remove(second, label);
    into.set(second, first);
  }
}

const listEdit = (kind: ListKind): TagEdit => ({ ...(kind === 'ol' ? {} : { attrs: { start: null } }), classes: { dots: kind === 'dots', dashes: kind === 'dashes' } });

async function relist(app: App, el: Element, kind: ListKind): Promise<Element> {
  if (el.localName !== tagOf(kind)) return app.doc.retag(el, tagOf(kind), listEdit(kind), 'list');
  app.doc.setTag(el, listEdit(kind), 'list');
  return el;
}

function markList(list: Element, kind: ListKind): void {
  let out = list;
  if (list.localName !== tagOf(kind)) {
    out = document.createElement(tagOf(kind));
    for (const a of list.attributes) out.setAttribute(a.name, a.value);
    out.append(...list.childNodes);
    list.replaceWith(out);
  }
  for (const m of MARKS) out.classList.toggle(m, m === kind);
  if (!out.classList.length) out.removeAttribute('class');
  if (kind !== 'ol') out.removeAttribute('start');
}

export function startList(app: App): HTMLOListElement | null {
  const textEls = wholeListTargets(app);
  const el = textEls ? (textEls.length === 1 ? textEls[0] : null) : itemAt(app)?.item.parentElement ?? null;
  return el instanceof HTMLOListElement && !!app.pairing?.elements.has(el) && !app.pairing.byLive.has(el) ? el : null;
}

export function setStart(app: App, n: number): void {
  const list = startList(app);
  if (!list || !Number.isInteger(n) || n < 1 || (n === list.start && !cutOff.has(list))) return;
  if (n !== list.start) app.doc.setTag(list, { attrs: { start: n === 1 ? null : String(n) } }, 'start at');
  if (!cutOff.delete(list)) return;
  app.history.push({ label: 'start at', undo: () => void cutOff.add(list), redo: () => void cutOff.delete(list) });
}

export function canSplit(app: App): boolean {
  const at = itemAt(app);
  return !!at && (at.nested || structural(app, at.item));
}

const caretAt = (app: App, el: Element, at = 0) => () => {
  const a = document.activeElement;
  if (!a?.matches('input, textarea, [contenteditable="true"]') || app.slides().contains(a)) selectIn(el, at);
};

export async function split(app: App): Promise<void> {
  const at = itemAt(app);
  if (!at || !canSplit(app)) return;
  const { host, item, range } = at;
  if (item.localName === 'li' && !item.textContent?.trim() && !item.querySelector('mjx-container, img, ul, ol')) {
    if (at.nested) {
      const place = (el: Element | null) => {
        if (!el || !host.contains(el)) return el && caretAt(app, el);
        const i = itemsOf(host).indexOf(el);
        return () => {
          const li = itemsOf(host)[i];
          if (li) caretAt(app, li)();
        };
      };
      let done = false;
      const kept = app.history.keep(() => place(done ? (itemAt(app)?.item ?? null) : item));
      await outdent(app);
      done = true;
      return kept();
    }
    const list = item.parentElement!;
    const items = [...list.children].filter((c) => c.localName === 'li');
    const followers = items.slice(items.indexOf(item) + 1);
    const move = list.querySelector(':scope > li') !== item && (list as HTMLElement).style.translate;
    const place = move ? placeOf(app, list) : [];
    if (move && !place.some(([n]) => n === 'translate')) place.push(['translate', move]);
    const texts = [move ? `<p style="${place.map(([n, v]) => `${n}: ${v}`).join('; ').replace(/"/g, '&quot;')}"></p>` : '<p></p>'];
    let to = item;
    const kept = app.history.keep(() => caretAt(app, to));
    if (followers.length) {
      const { base, step, eol } = indentOf(app, list);
      const rest = followers.map((f) => `${eol}${base}${step}${app.doc.elementText(f)}`).join('');
      texts.push(`${startTag(app, list, list.localName, { attrs: { id: null, ...goOn(list, items.indexOf(item)) } })}${rest}${eol}${base}</${list.localName}>`);
    }
    const [p, second] = await app.doc.insert(texts, list.parentElement!, nextOf(app, list), 'new paragraph');
    goesOn(list, second, items.indexOf(item));
    for (const f of followers) await app.doc.remove(f, 'new paragraph');
    await app.doc.remove(list.querySelectorAll(':scope > li').length > 1 ? item : list, 'new paragraph');
    selectIn(p, 0);
    to = p;
    return kept();
  }
  if (!range.collapsed) {
    app.history.beforeTyping(host, 'new paragraph');
    range.deleteContents();
    app.history.afterTyping(host);
    app.history.break();
  }
  const caret: [Node, number] = [range.startContainer, range.startOffset];
  const head = rangeTex(item, rangeOf(item, null, caret));
  const tail = rangeTex(item, rangeOf(item, caret, null));
  if (at.nested) {
    const k = itemsOf(host).indexOf(item);
    const copy = texCopy(host);
    const li = copy.querySelectorAll('li')[k];
    li.innerHTML = head;
    const second = li.cloneNode(false) as Element;
    second.removeAttribute('id');
    second.innerHTML = tail;
    const space = spaceBefore(li);
    li.after(...(space ? [space.cloneNode()] : []), second);
    const off = offsetIn(item, ...caret);
    let done = false;
    const nth = (i: number, at = 0) => () => {
      const el = itemsOf(host)[i];
      if (el) caretAt(app, el, at)();
    };
    const kept = app.history.keep(() => (done ? nth(k + 1) : nth(k, off)));
    await app.doc.setContent(host, copy.innerHTML, 'new paragraph');
    const now = host.querySelectorAll('li')[k + 1];
    if (now) selectIn(now, 0);
    done = true;
    return kept();
  }
  const tag = item.localName === 'h3' ? 'p' : item.localName;
  const moved = item.localName === 'li' && placeOf(app, item).some(([n]) => n === 'translate') && !hoist(app, item.parentElement!);
  const open = item.localName === 'h3' ? '<p>' : startTag(app, item, tag, { attrs: { id: null }, ...(item.localName === 'li' && !moved ? { style: { translate: null } } : {}) });
  const off = offsetIn(item, ...caret);
  let second: Element | null = null;
  const kept = app.history.keep(() => (second ? caretAt(app, second) : caretAt(app, item, off)));
  await app.doc.setContent(item, head, 'new paragraph');
  [second] = await app.doc.insert(`${open}${tail}</${tag}>`, item.parentElement!, nextOf(app, item), 'new paragraph');
  selectIn(second, 0);
  kept();
}

function joinTarget(el: Element): Element {
  let t = el;
  for (let list = t.lastElementChild; list?.matches(LIST); list = t.lastElementChild) {
    const li = [...list.children].reverse().find((c) => c.localName === 'li');
    if (!li) break;
    t = li;
  }
  return t;
}

function textEnd(el: Element): [Node, number] {
  let n: Node | null = el.lastChild;
  while (layoutSpace(n)) n = n.previousSibling;
  if (!n) return [el, 0];
  if (n instanceof Text) return [n, n.data.replace(LAYOUT_END, '').length];
  return [el, indexOf(n) + 1];
}

function joined(before: Element, after: string): string {
  const copy = texCopy(before);
  const target = joinTarget(copy);
  const space = target !== copy && copy.lastChild instanceof Text && !copy.lastChild.data.trim() ? copy.lastChild.data : '';
  if (space) copy.lastChild!.remove();
  trimEnd(target);
  const tail = document.createElement('template');
  tail.innerHTML = after.replace(/^\s*\n\s*/, '');
  target.append(tail.content);
  return copy.innerHTML + space;
}

export const endOf = (el: Element): number => offsetIn(el, ...textEnd(joinTarget(el)));

async function join(app: App, before: Element, after: Element): Promise<void> {
  const at = endOf(before);
  const content = joined(before, rangeTex(after, rangeOf(after, null, null)));
  await app.doc.setContent(before, content, 'join');
  await app.doc.remove(after, 'join');
  selectIn(before, at);
}

type Join = { kind: 'join'; before: Element; after: Element } | { kind: 'outdent' } | { kind: 'unlist'; item: Element } | { kind: 'drop'; item: Element; to: Element; end: boolean } | null;

const empty = (el: Element) => !el.textContent?.trim() && !el.querySelector('mjx-container, img');
const liOf = (list: Element) => [...list.children].filter((c) => c.localName === 'li');

function joinBack(app: App): Join {
  const at = itemAt(app);
  if (!at || !at.range.collapsed) return null;
  if (!blank(rangeOf(at.item, null, [at.range.startContainer, at.range.startOffset]))) return null;
  if (at.nested) return { kind: 'outdent' };
  if (!structural(app, at.item)) return null;
  const before = previousElement(app, at.item);
  if (before) return { kind: 'join', before, after: at.item };
  const list = at.item.localName === 'p' ? prevOf(app, at.item) : null;
  const last = fileList(app, list) && !list.closest('[data-locked]') ? liOf(list).at(-1) : null;
  if (last) return { kind: 'drop', item: at.item, to: last, end: true };
  return at.item.localName === 'li' && !at.item.previousElementSibling ? { kind: 'unlist', item: at.item } : null;
}

export const joinKind = (app: App): 'join' | 'outdent' | 'unlist' | 'drop' | null => joinBack(app)?.kind ?? null;

async function unlist(app: App, li: Element): Promise<void> {
  const list = li.parentElement!;
  let at = li;
  const kept = app.history.keep(() => {
    const el = at;
    return () => selectIn(el, 0);
  });
  const [p] = await app.doc.insert(`${placedParagraph(app, li, list)}${ownTex(li)}</p>`, list.parentElement!, list, 'list');
  const subs = [...texCopy(li).querySelectorAll(':scope > :is(ul, ol) > li')].map((s) => s.outerHTML);
  if (subs.length) await app.doc.insert(subs, list, li, 'list');
  await app.doc.remove(list.querySelectorAll(':scope > li').length > 1 ? li : list, 'list');
  selectIn(p, 0);
  at = p;
  kept();
}

function joinAhead(app: App): Join {
  const at = itemAt(app);
  if (!at || !at.range.collapsed || at.nested || !structural(app, at.item)) return null;
  if (!blank(rangeOf(at.item, [at.range.startContainer, at.range.startOffset], null))) return null;
  const after = nextElement(app, at.item);
  if (after) return { kind: 'join', before: at.item, after };
  const list = at.item.localName === 'p' && empty(at.item) ? nextOf(app, at.item) : null;
  const first = fileList(app, list) && !list.closest('[data-locked]') ? liOf(list)[0] : null;
  return first ? { kind: 'drop', item: at.item, to: first, end: false } : null;
}

async function drop(app: App, item: Element, to: Element, end: boolean): Promise<void> {
  const at = end ? endOf(to) : 0;
  let done = false;
  const kept = app.history.keep(() => (done ? caretAt(app, to, at) : caretAt(app, item)));
  if (!empty(item)) await app.doc.setContent(to, joined(to, rangeTex(item, rangeOf(item, null, null))), 'join');
  const first = end ? null : prevOf(app, item);
  const n = fileList(app, first) ? liOf(first).length : 0;
  await removeJoining(app, [item], 'join');
  if (!to.isConnected && first) to = liOf(first)[n] ?? to;
  selectIn(to, at);
  done = true;
  kept();
}

export const canJoinBack = (app: App): boolean => joinBack(app) !== null;
export const canJoinAhead = (app: App): boolean => joinAhead(app) !== null;

export async function joinBackward(app: App): Promise<void> {
  const j = joinBack(app);
  if (j?.kind === 'join') await join(app, j.before, j.after);
  else if (j?.kind === 'outdent') await outdent(app);
  else if (j?.kind === 'unlist') await unlist(app, j.item);
  else if (j?.kind === 'drop') await drop(app, j.item, j.to, j.end);
}

export async function joinForward(app: App): Promise<void> {
  const j = joinAhead(app);
  if (j?.kind === 'join') await join(app, j.before, j.after);
  else if (j?.kind === 'drop') await drop(app, j.item, j.to, j.end);
}

export function inList(app: App): boolean {
  const at = itemAt(app);
  return !!at && at.item.localName === 'li' && (at.nested || structural(app, at.item));
}

export function canIndent(app: App): boolean {
  const at = itemAt(app);
  if (!at || !inList(app)) return false;
  const before = at.item.previousElementSibling;
  return !!before && before.localName === 'li' && (at.nested || structural(app, before));
}

export function canOutdent(app: App): boolean {
  const at = itemAt(app);
  return !!at && at.nested;
}

function childList(item: Element, from: Element, indent: Indent | null): Element {
  const end = item.lastElementChild;
  if (end?.matches(LIST) && !(end.nextSibling instanceof Text && end.nextSibling.data.trim())) return end;
  trimEnd(item);
  const list = document.createElement(from.localName);
  const mark = kindOf(from);
  if (tagOf(mark) !== mark) list.className = mark;
  if (indent) item.append(`${indent.eol}${indent.base}${indent.step}`, list, `${indent.eol}${indent.base}`);
  else item.append(list);
  return list;
}

function appendItem(list: Element, li: Node, indent: Indent | null): void {
  const first = list.querySelector(':scope > li');
  const inner = indent ? `${indent.eol}${indent.base}${indent.step}${indent.step}` : '';
  const space = first ? spaceBefore(first)?.data ?? '' : inner;
  const end = list.lastChild instanceof Text && !list.lastChild.data.trim() ? list.lastChild : null;
  const closing = end?.data ?? (indent ? `${indent.eol}${indent.base}${indent.step}` : '');
  end?.remove();
  list.append(...(space ? [space] : []), li, ...(closing ? [closing] : []));
}

function takeOut(li: Element): void {
  const list = li.parentElement!;
  spaceBefore(li)?.remove();
  li.remove();
  if (list.querySelector(':scope > li')) return;
  const owner = list.parentElement!;
  spaceBefore(list)?.remove();
  list.remove();
  if (!owner.querySelector(`:scope > :is(${LIST})`)) trimEnd(owner);
}

export async function indent(app: App): Promise<void> {
  const at = itemAt(app);
  if (!at || !canIndent(app)) return;
  const { host, item } = at;
  const offset = offsetIn(item, at.range.startContainer, at.range.startOffset);
  if (at.nested) {
    const k = itemsOf(host).indexOf(item);
    const copy = texCopy(host);
    const li = copy.querySelectorAll('li')[k];
    const before = li.previousElementSibling!;
    const from = li.parentElement!;
    takeOut(li);
    appendItem(childList(before, from, null), li, null);
    await app.doc.setContent(host, copy.innerHTML, 'indent');
    const now = host.querySelectorAll('li')[k];
    if (now) selectIn(now, offset);
    return;
  }
  const before = item.previousElementSibling!;
  const ind = indentOf(app, before);
  const copy = texCopy(before);
  const template = document.createElement('template');
  template.innerHTML = app.doc.elementText(item);
  const li = template.content.firstElementChild!;
  appendItem(childList(copy, item.parentElement!, ind), li, ind);
  const k = itemsOf(copy).indexOf(li);
  await app.doc.setContent(before, copy.innerHTML, 'indent');
  await app.doc.remove(item, 'indent');
  const now = before.querySelectorAll('li')[k];
  if (now) selectIn(now, offset);
}

export async function outdent(app: App): Promise<void> {
  const at = itemAt(app);
  if (!at || !at.nested) return;
  const { host, item } = at;
  const offset = offsetIn(item, at.range.startContainer, at.range.startOffset);
  const k = itemsOf(host).indexOf(item);
  const copy = texCopy(host);
  const li = copy.querySelectorAll('li')[k];
  const list = li.parentElement!;
  const owner = list.parentElement!.closest('li') ?? copy;
  const followers = [...list.children].slice([...list.children].indexOf(li) + 1).filter((c) => c.localName === 'li');
  if (followers.length) {
    const sub = childList(li, list, null);
    for (const f of followers) {
      spaceBefore(f)?.remove();
      appendItem(sub, f, null);
    }
  }
  const space = spaceBefore(li)?.data ?? '';
  takeOut(li);
  if (owner !== copy) {
    owner.after(spaceBefore(owner)?.data ?? space, li);
    await app.doc.setContent(host, copy.innerHTML, 'outdent');
    const now = host.querySelectorAll('li')[k];
    if (now) selectIn(now, offset);
    return;
  }
  await app.doc.setContent(host, copy.innerHTML, 'outdent');
  const [node] = await app.doc.insert(li.outerHTML, host.parentElement!, nextOf(app, host), 'outdent');
  selectIn(node, offset);
}

export type ListKind = 'none' | 'ul' | 'dots' | 'dashes' | 'ol';
const MARKS = ['dots', 'dashes'] as const;
const tagOf = (kind: ListKind): string => (kind === 'dots' || kind === 'dashes' ? 'ul' : kind);
export const openList = (kind: ListKind): string => (tagOf(kind) === kind ? `<${kind}>` : `<ul class="${kind}">`);

export function kindOf(list: Element): ListKind {
  if (list.localName === 'ol') return 'ol';
  return MARKS.find((m) => list.classList.contains(m)) ?? 'ul';
}

function wholeListKind(app: App, el: Element): ListKind | null {
  if (el.localName === 'p') return structural(app, el) ? 'none' : null;
  const pairing = app.pairing;
  const parent = el.parentElement;
  if (!el.matches(LIST) || !pairing?.elements.has(el) || pairing.byLive.has(el) || !parent || !pairing.elements.has(parent) || pairing.byLive.has(parent)) return null;
  return kindOf(el);
}

function wholeListTargets(app: App): Element[] | null {
  if (app.selection.kind !== 'elements') return null;
  const els = app.selection.elements().flatMap((el) => (el.matches('div.shape') ? [...el.children].filter((c) => wholeListKind(app, c) !== null) : [el]));
  return els.length && els.every((el) => wholeListKind(app, el) !== null) ? els : null;
}

export function listKind(app: App): ListKind | null {
  const textEls = wholeListTargets(app);
  if (textEls) {
    const kinds = new Set(textEls.map((el) => wholeListKind(app, el)));
    return kinds.size === 1 ? [...kinds][0] : null;
  }
  const at = itemAt(app);
  if (!at) return null;
  if (at.item.localName === 'li') return at.nested || structural(app, at.item) ? kindOf(at.item.parentElement!) : null;
  return at.item.localName === 'p' && structural(app, at.item) ? 'none' : null;
}

export const OUTLINE = ':is(ul, ol).outline[data-auto]';

export function canSetList(app: App, kind: ListKind): boolean {
  const textEls = wholeListTargets(app);
  if (textEls) return kind !== 'none' || textEls.every((el) => !el.matches(OUTLINE) && !el.querySelector('li :is(ul, ol)'));
  const at = itemAt(app);
  const now = listKind(app);
  if (!at || now === null) return false;
  if (kind !== 'none') return true;
  return !at.nested && !at.item.querySelector(LIST);
}

export function listWhy(app: App, label: string): string | null {
  const el = textTarget(app)?.host ?? app.selection.elements()[0];
  if (!el) return null;
  if (el.matches('h1, h2, h3, h4')) return `${label} is not available on a heading, since only a paragraph or a list item is set as a list`;
  if (el.matches('td, th')) return `${label} is not available in a table, since a cell of the theme does not hold a list`;
  if (el.querySelector('li :is(ul, ol)') || itemAt(app)?.item.querySelector(LIST)) return `${label} is not available, since the nested items of the list would be lost`;
  return `${label} is not available on this text element, since only a paragraph or a list item is set as a list`;
}

export async function setList(app: App, kind: ListKind): Promise<void> {
  const textEls = wholeListTargets(app);
  if (textEls) return setWholeList(app, textEls, kind);
  if (flow.active() && (await setSpanList(app, kind))) return;
  const at = itemAt(app);
  const now = listKind(app);
  if (!at || now === null || now === kind || !canSetList(app, kind)) return;
  const { host, item } = at;
  const offset = offsetIn(item, at.range.startContainer, at.range.startOffset);
  const stop = item.contains(at.range.endContainer) ? offsetIn(item, at.range.endContainer, at.range.endOffset) : offset;
  if (at.nested) {
    const k = itemsOf(host).indexOf(item);
    const copy = texCopy(host);
    markList(copy.querySelectorAll('li')[k].parentElement!, kind);
    await app.doc.setContent(host, copy.innerHTML, 'list');
    const li = host.querySelectorAll('li')[k];
    if (li) selectIn(li, offset, stop);
    return;
  }
  const parent = item.parentElement!;
  const content = rangeTex(item, rangeOf(item, null, null));
  const { base, step, eol } = indentOf(app, now === 'none' ? item : parent);
  if (now === 'none') {
    const { open, li } = placedList(app, item, kind);
    const [list] = await app.doc.insert(`${open}${eol}${base}${step}${li}${content}</li>${eol}${base}</${tagOf(kind)}>`, parent, item, 'list');
    await app.doc.remove(item, 'list');
    const first = list.querySelector('li');
    if (first) selectIn(first, offset, stop);
    return;
  }
  if (kind !== 'none') {
    const index = [...parent.children].indexOf(item);
    const list = await relist(app, parent, kind);
    const li = list.children[index];
    if (li) selectIn(li, offset, stop);
    return;
  }
  const items = [...parent.children];
  const followers = items.slice(items.indexOf(item) + 1).filter((c) => c.localName === 'li');
  const texts = [`${placedParagraph(app, item, parent)}${content.trim()}</p>`];
  if (followers.length) {
    const rest = followers.map((f) => `${eol}${base}${step}${app.doc.elementText(f)}`).join('');
    const k = items.filter((c) => c.localName === 'li').indexOf(item);
    texts.push(`${startTag(app, parent, parent.localName, { attrs: { id: null, ...goOn(parent, k) } })}${rest}${eol}${base}</${parent.localName}>`);
  }
  const [p, second] = await app.doc.insert(texts, parent.parentElement!, nextOf(app, parent), 'list');
  goesOn(parent, second, items.filter((c) => c.localName === 'li').indexOf(item));
  for (const f of followers) await app.doc.remove(f, 'list');
  await app.doc.remove(item, 'list');
  if (!parent.querySelector(':scope > li')) await app.doc.remove(parent, 'list');
  selectIn(p, offset, stop);
}

async function setSpanList(app: App, kind: ListKind): Promise<boolean> {
  const p = flow.places(app);
  const run = flow.spanTargets(app).map((t) => t.host);
  const list = run[0]?.parentElement;
  if (p && list && run.every((h) => h.localName === 'p' && h.parentElement === list && structural(app, h))) return spanParagraphs(app, run, p, kind);
  if (!p || !list?.matches(LIST) || !run.every((h) => h.localName === 'li' && h.parentElement === list && structural(app, h))) return false;
  if (kindOf(list) === kind || (kind === 'none' && run.some((h) => h.querySelector(LIST)))) return true;
  const [a, f] = p.map(([el, at]) => [run.indexOf(el), at] as const);
  const items = [...list.children].filter((c) => c.localName === 'li');
  let made: Element[];
  if (kind !== 'none') {
    const now = await relist(app, list, kind);
    const kids = [...now.children].filter((c) => c.localName === 'li');
    made = run.map((h) => kids[items.indexOf(h)]);
  } else {
    const { base, step, eol } = indentOf(app, list);
    const followers = items.slice(items.indexOf(run[run.length - 1]) + 1);
    const texts = run.map((li) => `${placedParagraph(app, li, list)}${rangeTex(li, rangeOf(li, null, null)).trim()}</p>`);
    if (followers.length) {
      const rest = followers.map((f) => `${eol}${base}${step}${app.doc.elementText(f)}`).join('');
      texts.push(`${startTag(app, list, list.localName, { attrs: { id: null, ...goOn(list, items.indexOf(run[0])) } })}${rest}${eol}${base}</${list.localName}>`);
    }
    const inserted = await app.doc.insert(texts, list.parentElement!, nextOf(app, list), 'list');
    if (followers.length) goesOn(list, inserted.at(-1), items.indexOf(run[0]));
    made = inserted.slice(0, run.length);
    for (const el of [...followers, ...run]) await app.doc.remove(el, 'list');
    if (!list.querySelector(':scope > li')) await app.doc.remove(list, 'list');
  }
  if (made[a[0]] && made[f[0]]) flow.select(app, [made[a[0]], a[1]], [made[f[0]], f[1]]);
  return true;
}

async function spanParagraphs(app: App, run: Element[], p: [flow.Place, flow.Place], kind: ListKind): Promise<boolean> {
  if (kind === 'none') return true;
  const { base, step, eol } = indentOf(app, run[0]);
  const items = run.map((el) => `${eol}${base}${step}${placedList(app, el, kind).li}${rangeTex(el, rangeOf(el, null, null))}</li>`).join('');
  const [list] = await app.doc.insert(`${placedList(app, run[0], kind).open}${items}${eol}${base}</${tagOf(kind)}>`, run[0].parentElement!, run[0], 'list');
  for (const el of run) await app.doc.remove(el, 'list');
  const made = [...list.children].filter((c) => c.localName === 'li');
  const [a, f] = p.map(([el, at]) => [made[run.indexOf(el)], at] as const);
  if (a[0] && f[0]) flow.select(app, [a[0], a[1]], [f[0], f[1]]);
  return true;
}

function setWholeList(app: App, textEls: Element[], kind: ListKind): Promise<void> {
  if (!canSetList(app, kind)) return Promise.resolve();
  const els = textEls.some((el) => el.matches(OUTLINE)) ? [...new Set([...textEls, ...app.slides().querySelectorAll(OUTLINE)])] : textEls;
  return app.history.selecting('List', () => listAsWhole(app, els, kind));
}

async function listAsWhole(app: App, textEls: Element[], kind: ListKind): Promise<void> {
  const shapes = app.selection.elements().filter((el) => el.matches('div.shape'));
  const made: Element[] = [];
  for (const el of textEls) {
    const now = wholeListKind(app, el);
    if (now === kind) made.push(el);
    else if (now === 'none') {
      const { base, step, eol } = indentOf(app, el);
      const { open, li } = placedList(app, el, kind);
      const content = rangeTex(el, rangeOf(el, null, null));
      made.push(...(await app.doc.insert(`${open}${eol}${base}${step}${li}${content}</li>${eol}${base}</${tagOf(kind)}>`, el.parentElement!, el, 'list')));
      await app.doc.remove(el, 'list');
    } else if (kind !== 'none') made.push(await relist(app, el, kind));
    else {
      const texts = [...el.children].filter((c) => c.localName === 'li').map((li) => `${placedParagraph(app, li, el)}${rangeTex(li, rangeOf(li, null, null)).trim()}</p>`);
      made.push(...(await app.doc.insert(texts, el.parentElement!, nextOf(app, el), 'list')));
      await app.doc.remove(el, 'list');
    }
    if (tagOf(kind) === 'ul') await markNested(app, made.at(-1)!, kind);
  }
  const slide = app.current();
  app.selection.set('elements', [...shapes, ...made.filter((el) => !shapes.some((s) => s.contains(el)) && !!slide?.contains(el))]);
}

async function markNested(app: App, textEl: Element, kind: ListKind): Promise<void> {
  for (const li of textEl.querySelectorAll(':scope > li')) {
    if ([...li.querySelectorAll('ul')].every((ul) => kindOf(ul) === kind)) continue;
    const copy = texCopy(li);
    for (const ul of copy.querySelectorAll('ul')) markList(ul, kind);
    await app.doc.setContent(li, copy.innerHTML, 'list');
  }
}

export function install(app: App): void {
  injectStyle('text-elements', CSS);
  app.history.onSettle(() => keepCounts(app));
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const host = app.hostOf(range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement);
    if (host && host.contains(range.endContainer)) last = { host, range: range.cloneRange() };
  });
}

export type ParagraphStyle = 'body' | 'small' | 'subheading' | 'caption' | 'footnote';
export const PARAGRAPH_STYLES: ParagraphStyle[] = ['body', 'small', 'subheading', 'caption', 'footnote'];
const STYLE_TAG: Record<ParagraphStyle, string> = { body: 'p', small: 'p', subheading: 'h3', caption: 'p', footnote: 'div' };
const STYLE_CLASSES = { small: 'small', caption: 'caption', footnote: 'foot' } as const;
const LADDER: ParagraphStyle[] = ['footnote', 'small', 'body', 'subheading'];
const rank = (s: ParagraphStyle) => (s === 'caption' ? 1 : LADDER.indexOf(s));

export function styleOf(app: App, el: Element): ParagraphStyle | null {
  const pairing = app.pairing;
  if (!pairing?.byLive.has(el) || el.matches('aside.notes')) return null;
  const parent = el.parentElement;
  if (!parent || !pairing.elements.has(parent) || pairing.byLive.has(parent)) return null;
  const own = [...el.classList].filter((c) => !plainClass(c) || c === 'small');
  const one = (tag: string, cls: string | null) => el.localName === tag && (cls ? own.length === 1 && own[0] === cls : own.length === 0);
  if (one('h3', null)) return 'subheading';
  if (one('div', 'foot')) return 'footnote';
  if (one('p', 'caption')) return 'caption';
  if (one('p', 'small') || one('li', 'small')) return 'small';
  return one('p', null) || one('li', null) ? 'body' : null;
}

function chosen(app: App): Element[] {
  const spanned = flow.spanTargets(app).map((t) => t.host);
  const t = spanned.length ? null : textTarget(app);
  return spanned.length ? spanned : t ? [t.host] : selectedTextElements(app);
}

const styled = (app: App): Element[] => chosen(app).filter((el) => styleOf(app, el) !== null);

const ITEM_STYLES: ParagraphStyle[] = ['body', 'small'];
export const fits = (el: Element, style: ParagraphStyle): boolean => el.localName !== 'li' || ITEM_STYLES.includes(style);

export function paragraphStyle(app: App): ParagraphStyle | null {
  const styles = new Set(chosen(app).map((el) => styleOf(app, el)));
  return styles.size === 1 ? [...styles][0] : null;
}

export const canStyle = (app: App, style?: ParagraphStyle): boolean => styled(app).some((el) => !style || fits(el, style));

async function restyle(app: App, el: Element, style: ParagraphStyle, kept: [number, number] | null): Promise<Element> {
  const classes: Record<string, boolean> = {};
  for (const [s, c] of Object.entries(STYLE_CLASSES)) if (el.classList.contains(c) !== (s === style)) classes[c] = s === style;
  const tag = el.localName === 'li' ? 'li' : STYLE_TAG[style];
  let node = el;
  if (tag === el.localName) {
    if (Object.keys(classes).length) app.doc.setTag(el, { classes }, 'paragraph style');
  } else node = await app.doc.retag(el, tag, { classes }, 'paragraph style');
  if (kept) selectIn(node, ...kept);
  return node;
}

export async function setStyle(app: App, style: ParagraphStyle | ((s: ParagraphStyle) => ParagraphStyle)): Promise<void> {
  const spanned = flow.active() ? flow.places(app) : null;
  const t = spanned ? null : textTarget(app);
  const kept: [number, number] | null = t && [offsetIn(t.host, t.range.startContainer, t.range.startOffset), offsetIn(t.host, t.range.endContainer, t.range.endOffset)];
  const textEls = styled(app);
  const each = async () => {
    const made: Element[] = [];
    for (const el of textEls) {
      const now = styleOf(app, el)!;
      const next = typeof style === 'function' ? style(now) : style;
      made.push(next !== now && fits(el, next) ? await restyle(app, el, next, kept) : el);
    }
    return made;
  };
  if (spanned) {
    const made = await each();
    const place = ([el, at]: [Element, number]): [Element, number] => [made[textEls.indexOf(el)] ?? el, at];
    return flow.select(app, place(spanned[0]), place(spanned[1]));
  }
  if (t) return void (await each());
  await app.history.selecting('Paragraph Style', async () => {
    const made = await each();
    if (made.length) app.selection.set('elements', made);
  });
}

export function styleWhy(app: App, label: string, up?: boolean): string | null {
  const t = textTarget(app);
  const el = t?.host ?? selectedTextElements(app)[0] ?? app.selection.elements()[0];
  if (!el) return null;
  if (el.matches('h1, h2, h4')) return `${label} is not available on a heading, since the theme sets its size`;
  if (el.matches('td, th')) return `${label} is not available in a table, since the theme sets the size of its cells`;
  if (el.matches('aside.notes')) return `${label} is not available in the notes, which take only bold and italic`;
  const s = styleOf(app, el);
  if (!s) return `${label} is not available on this text element, since only a paragraph or a list item takes a style of the type scale`;
  if (up === undefined) return null;
  if (el.localName === 'li') return `${label} is not available, since a list item takes only Body and Small`;
  return `${label} is not available, since ${up ? 'Subheading is the largest' : 'Footnote is the smallest'} style of the type scale`;
}

export const stepped = (s: ParagraphStyle, up: boolean): ParagraphStyle => LADDER[Math.min(LADDER.length - 1, Math.max(0, rank(s) + (up ? 1 : -1)))];

export const canStep = (app: App, up: boolean): boolean => styled(app).some((el) => {
  const s = styleOf(app, el)!;
  const next = stepped(s, up);
  return next !== s && fits(el, next);
});

function ownNodes(el: Element): { own: Node[]; list: Element | null } {
  const list = [...el.children].find((c) => c.matches(LIST)) ?? null;
  const own: Node[] = [];
  for (const n of el.childNodes) {
    if (n === list) break;
    own.push(n);
  }
  return { own, list };
}

export function ownTex(el: Element): string {
  const { list } = ownNodes(el);
  const end: [Node, number] | null = list ? [el, [...el.childNodes].indexOf(list)] : null;
  return rangeTex(el, rangeOf(el, null, end)).trim();
}

export async function setOwnTex(app: App, el: Element, html: string, label = 'typing'): Promise<void> {
  const host = app.hostOf(el) ?? el;
  if (html === ownTex(el)) return;
  const copy = texCopy(host);
  const target = el === host ? copy : copy.querySelectorAll('li')[itemsOf(host).indexOf(el)];
  if (!target) return;
  const { own, list } = ownNodes(target);
  const last = own.at(-1);
  const tail = list && last instanceof Text ? /\s*$/.exec(last.data)?.[0] ?? '' : '';
  for (const n of own) n.parentNode?.removeChild(n);
  const holder = document.createElement('div');
  holder.innerHTML = html + tail;
  target.prepend(...holder.childNodes);
  await app.doc.setContent(host, copy.innerHTML, label);
}
