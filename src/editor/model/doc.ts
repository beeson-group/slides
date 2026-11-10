// the document model of the editor: every structural change of the deck, i.e. a slide or an
// element inserted, removed, moved, or given another tag, and a change of a start tag. each change
// is applied to the page and recorded with its inverse as one entry of the history, and the file is
// written from the page by the renderer of render.ts. new content is a fragment of fragments.ts,
// and an element taken off the page is kept with the text of its unit, so that it is written again
// as it was when it is put back, also after a save

import type { Entry } from '../history.ts';
import { contentWithTex, setContentWithTex, type MathLookup } from '../math.ts';
import { childSpace, detached, renderDeck, renderUnit, type Pairing } from '../render.ts';
import type { Source, SrcEl } from '../source.ts';
import { mergeEdit, renderTag, stateOf, translateIn, translateText, type TagEdit, type TagState } from '../tags.ts';
import { tokenize } from '../tokens.ts';
import { fragmentRoot, mergePairing, pairFragment, parseFragment } from './fragments.ts';
import { elementText, layoutText, textStyle, type ElementKind, type ElementOptions, type Layout } from './templates.ts';

// what the document model is given by the editor. tags are the start tags changed since the last
// save, changed is called after each change, and restore puts a block back with its formulas
export type DocHost = {
  source(): Source | null;
  pairing(): Pairing | null;
  readonly tags: Map<Element, TagEdit>;
  math(): MathLookup;
  record(entry: Entry): void;
  changed(): void;
  restore?(host: Element, content: string): Promise<void>;
};

// an element taken off the page, with its place and the text of its unit. the place is given by
// the siblings before and after it, since one of them may be taken off the page as well
export type Detached = { node: Element; parent: Element; prev: Node | null; next: Node | null; text: string };

type Page = { Beeson?: { mount?(root: Element): void; refreshChrome?(): void }; Reveal?: { sync?(): void; layout?(): void } };

// a running head and the like, made at run time and replaced by Beeson.refreshChrome
const generated = (n: Node | null): boolean => n instanceof Element && n.hasAttribute('data-generated');

// the sibling after or before el that stays on the page
function nextKept(el: Node): Node | null {
  let n = el.nextSibling;
  while (generated(n)) n = n!.nextSibling;
  return n;
}

function prevKept(el: Node): Node | null {
  let n = el.previousSibling;
  while (generated(n)) n = n!.previousSibling;
  return n;
}

// an edit with the class fragment, data-fragment-index, and the declaration translate in the fields
// fragment, index, and translate, which are read by steps.ts and move.ts
export function normalizeEdit(edit: TagEdit): TagEdit {
  const out: TagEdit = { ...edit };
  if (edit.classes && 'fragment' in edit.classes) {
    const { fragment, ...rest } = edit.classes;
    out.classes = rest;
    out.fragment = fragment;
  }
  const index = edit.attrs?.['data-fragment-index'];
  if (index !== undefined && (index === null || /^\s*-?\d+\s*$/.test(index))) {
    const { 'data-fragment-index': _, ...rest } = edit.attrs!;
    out.attrs = rest;
    out.index = index === null ? null : Number(index);
  }
  const translate = edit.style?.translate;
  const parsed = translate ? translateIn(`translate: ${translate}`) : null;
  if (translate === null || parsed) {
    const { translate: _, ...rest } = edit.style!;
    out.style = rest;
    out.translate = parsed;
  }
  for (const key of ['classes', 'attrs', 'style'] as const) if (out[key] && !Object.keys(out[key]!).length) delete out[key];
  return out;
}

// the edit that sets back each value that edit sets, from the state before it
export function inverseEdit(before: TagState, edit: TagEdit): TagEdit {
  const out: TagEdit = {};
  const pick = <T>(keys: string[], value: (k: string) => T) => Object.fromEntries(keys.map((k) => [k, value(k)]));
  if (edit.classes) out.classes = pick(Object.keys(edit.classes), (c) => before.classes.includes(c));
  if (edit.fragment !== undefined) out.fragment = before.classes.includes('fragment');
  if (edit.attrs) out.attrs = pick(Object.keys(edit.attrs), (n) => before.attrs[n] ?? null);
  if (edit.index !== undefined) {
    const v = before.attrs['data-fragment-index'];
    out.index = v === undefined ? null : Number(v);
  }
  if (edit.style) out.style = pick(Object.keys(edit.style), (n) => before.style[n] ?? null);
  if (edit.translate !== undefined) {
    const v = before.style.translate;
    out.translate = v === undefined ? null : translateIn(`translate: ${v}`);
  }
  return out;
}

// the edit applied to the element on the page
function applyLive(el: Element, edit: TagEdit): void {
  for (const [c, on] of Object.entries(edit.classes ?? {})) el.classList.toggle(c, on);
  if (edit.fragment !== undefined) el.classList.toggle('fragment', edit.fragment);
  for (const [n, v] of Object.entries(edit.attrs ?? {})) {
    if (v === null) el.removeAttribute(n);
    else el.setAttribute(n, v);
  }
  if (edit.index !== undefined) {
    if (edit.index === null) el.removeAttribute('data-fragment-index');
    else el.setAttribute('data-fragment-index', String(edit.index));
  }
  const style = (el as HTMLElement).style;
  if (!style) return;
  for (const [n, v] of Object.entries(edit.style ?? {})) {
    if (v === null) style.removeProperty(n);
    else style.setProperty(n, v);
  }
  if (edit.translate !== undefined) style.translate = edit.translate ? translateText(edit.translate) : '';
}

// the text with each id renamed by fresh, together with the plots that name it
function renameIds(text: string, fresh: (id: string) => string): string {
  let out = text;
  for (const m of new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))) {
    const id = fresh(m);
    out = out.split(`id="${m}"`).join(`id="${id}"`).split(`data-plot="${m}"`).join(`data-plot="${id}"`);
  }
  return out;
}

export class Doc {
  private readonly host: DocHost;

  constructor(host: DocHost) {
    this.host = host;
  }

  private need(): { source: Source; pairing: Pairing } {
    const source = this.host.source();
    const pairing = this.host.pairing();
    if (!source || !pairing) throw new Error('no file is open');
    return { source, pairing };
  }

  private srcOf(el: Element): SrcEl {
    const { pairing } = this.need();
    const s = pairing.elements.get(el) ?? pairing.inner.get(el);
    if (!s) throw new Error(`the ${el.localName} is not in the file`);
    return s;
  }

  private eol(): string {
    return this.need().source.crlf ? '\r\n' : '\n';
  }

  private style() {
    return textStyle(this.need().source.text);
  }

  // the text of the file with the edits of the page
  render(): string {
    const { source, pairing } = this.need();
    return renderDeck(source, pairing, this.host.math(), this.host.tags).text;
  }

  // the text of the unit of el, i.e. its lead, the element with its edits, and the end comment of
  // its marker pair, and the text of the element alone
  unitText(el: Element): string {
    const u = this.unit(el);
    return u.lead + u.body + u.trail;
  }

  elementText(el: Element): string {
    return this.unit(el).body;
  }

  private unit(el: Element) {
    const { source, pairing } = this.need();
    const u = renderUnit(pairing, this.host.math(), this.host.tags, el, source);
    if (!u) throw new Error(`the ${el.localName} is not in the file`);
    return u;
  }

  // the state of the start tag of el with its edits, i.e. its classes, attributes, and declarations
  tagState(el: Element): TagState {
    const s = this.srcOf(el);
    return stateOf(s.attrs, this.host.tags.get(el) ?? {});
  }

  // sets the given classes, attributes, and declarations of the start tag of el. the inverse sets
  // the values before the edit, hence it holds after a save as well
  setTag(el: Element, edit: TagEdit, label = 'tag'): void {
    const s = this.srcOf(el);
    if (!s.open) throw new Error(`the ${el.localName} does not have a start tag in the file`);
    const e = normalizeEdit(edit);
    const back = inverseEdit(this.tagState(el), e);
    this.applyTag(el, e);
    this.host.record({ label, undo: () => this.applyTag(el, back), redo: () => this.applyTag(el, e) });
  }

  private applyTag(el: Element, edit: TagEdit): void {
    this.host.tags.set(el, mergeEdit(this.host.tags.get(el), edit));
    applyLive(el, edit);
    this.refresh();
  }

  hide(slide: Element, hidden = true): void {
    this.setTag(slide, { attrs: { 'data-visibility': hidden ? 'hidden' : null } }, hidden ? 'hide' : 'show');
  }

  // inserts the units of texts into parent before the node before, as one entry of the history. a
  // text is an element without the white space before it, which is that of the units of parent
  async insert(texts: string | string[], parent: Element, before: Node | null = null, label = 'insert'): Promise<Element[]> {
    const nodes: Element[] = [];
    let ref = before;
    for (const text of [...(typeof texts === 'string' ? [texts] : texts)].reverse()) {
      ref = await this.place(text, parent, ref);
      nodes.unshift(ref as Element);
    }
    let recs: Detached[] = [];
    this.host.record({
      label,
      undo: async () => {
        recs = nodes.map((n) => this.detach(n));
        await this.after(parent);
      },
      redo: async () => {
        for (const r of [...recs].reverse()) await this.attach(r, false);
        await this.after(parent);
      },
    });
    return nodes;
  }

  // a new slide of the layout before the slide before, or at the end
  async insertSlide(layout: Layout, before: Element | null = null): Promise<Element> {
    const { pairing } = this.need();
    if (!pairing.root) throw new Error('the deck does not have a div.slides element');
    const base = this.childIndent(pairing.root);
    const [slide] = await this.insert(layoutText(layout, this.style(), base), pairing.root, before, `new ${layout} slide`);
    return slide;
  }

  // a new element of the kind in parent before the node before, or at the end
  async insertElement(kind: ElementKind, parent: Element, before: Node | null = null, options: ElementOptions = {}): Promise<Element[]> {
    const o = kind === 'plot' && !options.id ? { ...options, id: this.uniqueId('plot') } : options;
    return this.insert(elementText(kind, this.style(), this.childIndent(parent), o), parent, before, `new ${kind}`);
  }

  // a copy of el after it, with each id renamed
  async duplicate(el: Element): Promise<Element> {
    const parent = el.parentElement;
    if (!parent) throw new Error('the element is not on the page');
    const text = renameIds(this.elementText(el), (id) => this.uniqueId(id));
    const [copy] = await this.insert(text, parent, nextKept(el), 'duplicate');
    return copy;
  }

  async remove(el: Element, label = 'remove'): Promise<void> {
    let rec = this.detach(el);
    await this.after(rec.parent);
    this.host.record({
      label,
      undo: () => this.attach(rec),
      redo: async () => {
        rec = this.detach(el);
        await this.after(rec.parent);
      },
    });
  }

  // moves el into parent before the node before, or at the end
  async move(el: Element, parent: Element, before: Node | null = null, label = 'move'): Promise<void> {
    const { pairing } = this.need();
    if (el === parent || el.contains(parent)) throw new Error('an element is not moved into itself');
    if (!pairing.elements.has(parent) || pairing.byLive.has(parent)) throw new Error(`the ${parent.localName} does not take elements`);
    if (!el.parentElement) throw new Error('the element is not on the page');
    const from = { parent: el.parentElement, next: nextKept(el) };
    const put = async (p: Element, n: Node | null) => {
      p.insertBefore(el, n && n !== el && n.parentNode === p ? n : null);
      await this.after(el);
    };
    await put(parent, before);
    this.host.record({ label, undo: () => put(from.parent, from.next), redo: () => put(parent, before) });
  }

  // el replaced by an element of the tag with the same attributes and content, and with the edit
  // applied to its start tag, e.g. a p made an h3
  async retag(el: Element, tag: string, edit: TagEdit = {}, label = 'retag'): Promise<Element> {
    const parent = el.parentElement;
    if (!parent) throw new Error('the element is not on the page');
    const u = this.unit(el);
    const old = el.localName;
    let body = u.body.replace(new RegExp(`^<${old}(?=[\\s/>])`, 'i'), `<${tag}`).replace(new RegExp(`</${old}(\\s*)>$`, 'i'), `</${tag}$1>`);
    const start = tokenize(body).find((t) => t.type === 'start');
    const e = normalizeEdit(edit);
    if (start?.type === 'start' && Object.keys(e).length) {
      const open = renderTag(body, start, start.attrs, e);
      if (open !== null) body = body.slice(0, start.start) + open + body.slice(start.end);
    }
    const node = await this.place(body + u.trail, parent, el, u.lead);
    let rec = this.detach(el);
    await this.after(parent);
    let back: Detached | null = null;
    this.host.record({
      label,
      undo: async () => {
        await this.attach(rec, false);
        back = this.detach(node);
        await this.after(parent);
      },
      redo: async () => {
        if (back) await this.attach(back, false);
        rec = this.detach(el);
        await this.after(parent);
      },
    });
    return node;
  }

  // the content of a block set to a text with each formula as its TeX, as one entry of the history
  async setContent(block: Element, content: string, label = 'content'): Promise<void> {
    const before = contentWithTex(block);
    const put = async (c: string) => {
      if (this.host.restore) await this.host.restore(block, c);
      else await setContentWithTex(block, c);
      this.host.changed();
    };
    await put(content);
    this.host.record({ label, undo: () => put(before), redo: () => put(content) });
  }

  // takes el off the page, with the text of its unit. its unit is then left out of the file
  detach(el: Element): Detached {
    const parent = el.parentElement;
    if (!parent) throw new Error('the element is not on the page');
    const u = this.unit(el);
    const rec = { node: el, parent, prev: prevKept(el), next: nextKept(el), text: u.lead + u.body + u.trail };
    el.remove();
    detached.add(el);
    return rec;
  }

  // puts an element taken off the page back. after a save it is no longer in the file, and it is
  // then paired with the text of its unit as a fragment
  async attach(rec: Detached, refresh = true): Promise<void> {
    const { pairing, source } = this.need();
    const { node, parent } = rec;
    const at = rec.next?.parentNode === parent ? rec.next : rec.prev?.parentNode === parent ? rec.prev.nextSibling : rec.prev ? null : parent.firstChild;
    parent.insertBefore(node, at);
    detached.delete(node);
    if (!pairing.elements.has(node)) mergePairing(pairing, pairFragment(parseFragment(rec.text, source.crlf, parent), node, this.host.math()));
    if (refresh) await this.after(node);
  }

  // an id that is not on the page or in the file, from base
  uniqueId(base: string): string {
    const stem = base.replace(/-\d+$/, '');
    const text = this.host.source()?.text ?? '';
    for (let i = 1; ; i++) {
      const id = `${stem}-${i}`;
      if (!document.getElementById(id) && !text.includes(`id="${id}"`)) return id;
    }
  }

  // the indentation of the children of parent in the file
  private childIndent(parent: Element): string {
    const space = childSpace(this.srcOf(parent), this.eol(), this.style().step);
    return space.slice(space.lastIndexOf('\n') + 1);
  }

  // the new element made from text and paired as a fragment, inserted before the node before. lead
  // is the white space and the comments before it, by default those of the units of parent
  private async place(text: string, parent: Element, before: Node | null, lead?: string): Promise<Element> {
    const { source, pairing } = this.need();
    const container = pairing.elements.get(parent);
    if (!container || pairing.byLive.has(parent)) throw new Error(`the ${parent.localName} does not take elements`);
    const fragment = parseFragment((lead ?? childSpace(container, this.eol(), this.style().step)) + text, source.crlf, parent);
    const node = document.importNode(fragmentRoot(fragment)!.node, true) as Element;
    parent.insertBefore(node, before && before.parentNode === parent ? before : null);
    const mj = window.MathJax;
    if (mj?.typesetPromise) await mj.typesetPromise([node]);
    mergePairing(pairing, pairFragment(fragment, node, this.host.math()));
    await this.after(node);
    return node;
  }

  private refresh(): void {
    const page = window as unknown as Page;
    page.Beeson?.refreshChrome?.();
    page.Reveal?.sync?.();
    page.Reveal?.layout?.();
    this.host.changed();
  }

  // the backdrops, plots, surfaces, and QR codes under root drawn, the running heads and the
  // outlines filled again, and the slides of reveal.js read again
  private async after(root: Element): Promise<void> {
    const page = window as unknown as Page;
    if (root.isConnected) page.Beeson?.mount?.(root);
    this.refresh();
  }
}
