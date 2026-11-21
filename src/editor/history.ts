import { revert } from './merge.ts';

export type Entry = { label: string; undo(): Promise<void> | void; redo(): Promise<void> | void; els?: readonly Element[]; touches?: readonly Element[]; parents?: readonly Element[]; detaches?: readonly Element[]; orders?: readonly Element[]; selects?: 'undo' | 'redo' };

type Page = { Beeson?: { refreshChrome?(): void } };

const MINOR = new Set(['a', 'an', 'the', 'and', 'but', 'nor', 'or', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'onto', 'to', 'via', 'with']);

export function titled(label: string): string {
  const words = label.split(/(\s+)/);
  const last = words.length - 1;
  return words.map((w, i) => (i === 0 || i === last || !MINOR.has(w) ? w.replace(/^\p{Ll}/u, (l) => l.toUpperCase()) : w)).join('');
}

export function refreshHeads(host: Element): void {
  const slide = host.closest('section');
  if (!slide?.classList.contains('section') || (slide.querySelector('h2') ?? slide.querySelector('h1')) !== host) return;
  (window as unknown as Page).Beeson?.refreshChrome?.();
}

const PAUSE = 1000;

const REFUSED = new Error('the typing cannot be undone over the changes of others');

export class History {
  private done: Entry[] = [];
  private undone: Entry[] = [];
  private typing: { host: Element; state: { before: string; after: string }; entry: Entry; at: number } | null = null;
  private readonly latest = new WeakMap<Element, NonNullable<History['typing']>>();
  private busy = false;
  private still = false;
  private queue: Promise<void> = Promise.resolve();
  private open: Entry[] | null = null;
  private closed: Promise<void> = Promise.resolve();
  private readonly known = new WeakMap<Element, string>();
  private readonly parts = new WeakMap<Entry, Entry[]>();
  private readonly typed = new WeakMap<Entry, { before: string; after: string }>();
  private readonly dead = new WeakSet<Entry>();
  private readonly alone: () => boolean;
  private readonly snapshot: (host: Element) => string;
  private readonly restore: (host: Element, content: string) => Promise<void>;
  private readonly onChange: () => void;
  private readonly selected: () => Element[] | null;
  private readonly reselect: (els: Element[]) => void;
  private readonly view: () => (() => void) | null;
  refused?: (entry: Entry, way: 'undo' | 'redo') => void;
  private readonly settlers: (() => void)[] = [];
  private readonly waiting: (() => void)[] = [];
  private readonly typers: ((entry: Entry) => void)[] = [];
  private readonly changed: () => (el: Element) => void;

  constructor(options: { snapshot(host: Element): string; restore(host: Element, content: string): Promise<void>; onChange(): void; selected?(): Element[] | null; reselect?(els: Element[]): void; view?(): (() => void) | null; changed?(): (el: Element) => void; alone?(): boolean }) {
    this.snapshot = options.snapshot;
    this.restore = options.restore;
    this.onChange = options.onChange;
    this.selected = options.selected ?? (() => null);
    this.reselect = options.reselect ?? (() => {});
    this.view = options.view ?? (() => null);
    this.changed = options.changed ?? (() => () => {});
    this.alone = options.alone ?? (() => false);
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  get undoLabel(): string | null {
    return this.done.at(-1)?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.undone.at(-1)?.label ?? null;
  }

  get last(): Entry | null {
    return this.done.at(-1) ?? null;
  }

  get next(): Entry | null {
    return this.undone.at(-1) ?? null;
  }

  partsOf(entry: Entry): readonly Entry[] {
    return this.parts.get(entry) ?? [entry];
  }

  idle(): Promise<void> {
    return this.queue;
  }

  get settled(): boolean {
    return !this.open && !this.busy;
  }

  settle(): Promise<void> {
    return this.settled ? Promise.resolve() : new Promise((done) => this.waiting.push(done));
  }

  private calm(): void {
    if (this.settled) for (const done of this.waiting.splice(0)) done();
  }

  onSettle(fn: () => void): void {
    this.settlers.push(fn);
  }

  onTyped(fn: (entry: Entry) => void): void {
    this.typers.push(fn);
  }

  push(entry: Entry): void {
    this.typing = null;
    this.record(entry);
    this.onChange();
  }

  private record(entry: Entry): void {
    if (this.open) {
      this.typed.delete(entry);
      this.open.push(entry);
      return;
    }
    this.done.push(entry);
    this.undone = [];
  }

  private unrecord(entry: Entry): boolean {
    const list = this.open ?? this.done;
    if (list.at(-1) !== entry) return false;
    list.pop();
    return true;
  }

  private recorded(entry: Entry): boolean {
    return this.done.includes(entry) || !!this.open?.includes(entry);
  }

  async transact<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    if (this.open) return await fn();
    const entries: Entry[] = [];
    const show = this.view();
    this.open = entries;
    this.typing = null;
    let close = () => {};
    this.closed = new Promise((done) => {
      close = done;
    });
    try {
      return await fn();
    } finally {
      try {
        if (entries.length) for (const settle of this.settlers) settle();
      } finally {
        this.open = null;
        this.typing = null;
        try {
          if (entries.length) {
            const entry: Entry = {
              label,
              undo: async () => {
                show?.();
                for (const e of [...entries].reverse()) await e.undo();
              },
              redo: async () => {
                show?.();
                for (const e of entries) await e.redo();
              },
            };
            this.parts.set(entry, entries);
            this.done.push(entry);
            this.undone = [];
            this.onChange();
          }
        } finally {
          close();
          this.calm();
        }
      }
    }
  }

  async selecting<T>(label: string, fn: () => T | Promise<T>, then?: () => Element[]): Promise<T> {
    return this.keeping(label, this.selected, (els) => void (els && this.reselect(els)), fn, then);
  }

  async keeping<T, S>(label: string, take: () => S, put: (state: S) => void, fn: () => T | Promise<T>, then: () => S = take): Promise<T> {
    if (!this.open) return await this.transact(label, () => this.keeping(label, take, put, fn, then));
    const entries = this.open;
    const at = entries.length;
    const before = take();
    try {
      return await fn();
    } finally {
      const after = then();
      if (entries.length > at) {
        entries.splice(at, 0, { label, undo: () => put(before), redo: () => {}, ...(before != null && { selects: 'undo' as const }) });
        entries.push({ label, undo: () => {}, redo: () => put(after), ...(after != null && { selects: 'redo' as const }) });
      }
    }
  }

  keep(take: () => (() => void) | null): () => void {
    const entries = this.open;
    if (!entries) return () => {};
    const at = entries.length;
    const before = take();
    return () => {
      if (entries.length === at) return;
      const after = take();
      entries.splice(at, 0, { label: 'select', undo: () => before?.(), redo: () => {}, ...(before && { selects: 'undo' as const }) });
      entries.push({ label: 'select', undo: () => {}, redo: () => after?.(), ...(after && { selects: 'redo' as const }) });
    };
  }

  holding(): () => void {
    return this.keep(() => {
      const els = this.selected();
      const held = els?.length ? [...els] : null;
      return held && (() => this.reselect(held));
    });
  }

  track(host: Element): void {
    this.known.set(host, this.snapshot(host));
  }

  carry(host: Element): void {
    const now = this.snapshot(host);
    this.known.set(host, now);
    const t = this.latest.get(host);
    let n = now;
    if (t && !this.dead.has(t.entry) && (t === this.typing || this.done.includes(t.entry))) {
      const before = revert(t.state.after, t.state.before, now);
      if (before === null) {
        this.dead.add(t.entry);
        if (t === this.typing) this.typing = null;
      } else {
        t.state.before = n = before;
        t.state.after = now;
      }
    }
    let k = 0;
    for (const e of [...this.done].reverse()) {
      const s = this.typed.get(e);
      if (!s || e.els![0] !== host || e === t?.entry || this.dead.has(e)) continue;
      const r = k++ < 8 ? revert(s.after, s.before, n) : null;
      if (r === null) this.dead.add(e);
      else n = r;
    }
  }

  beforeTyping(host: Element, label = 'typing'): void {
    if (this.busy) return;
    const now = performance.now();
    if (label !== 'typing') this.typing = null;
    if (this.typing && this.typing.host === host && now - this.typing.at < PAUSE && this.typing.entry.label === 'typing') return;
    this.start(host, this.snapshot(host), now, label);
  }

  private start(host: Element, before: string, at: number, label = 'typing'): void {
    const state = { before, after: before };
    const restore = async (content: string, way: 'undo' | 'redo') => {
      const a = document.activeElement;
      const moves = !!a && a !== host && a.matches('[contenteditable="true"]') && !!a.closest('.reveal .slides');
      await this.put(host, content);
      entry.selects = moves && host.isConnected ? way : undefined;
    };
    const write = async (from: string, to: string, way: 'undo' | 'redo') => {
      if (this.alone()) return restore(to, way);
      const now = this.snapshot(host);
      const t = this.dead.has(entry) ? null : (revert(from, to, now) ?? (this.typed.has(entry) ? null : to));
      if (t === null) throw REFUSED;
      await restore(t, way);
      state[way === 'undo' ? 'after' : 'before'] = now;
      state[way === 'undo' ? 'before' : 'after'] = this.snapshot(host);
    };
    const entry: Entry = {
      label,
      undo: () => write(state.after, state.before, 'undo'),
      redo: () => write(state.before, state.after, 'redo'),
      els: [host],
    };
    this.typed.set(entry, state);
    this.typing = { host, state, entry, at };
    this.latest.set(host, this.typing);
    this.known.set(host, before);
  }

  private async put(host: Element, content: string): Promise<void> {
    await this.restore(host, content);
    this.known.set(host, content);
    refreshHeads(host);
  }

  afterTyping(host: Element): void {
    if (this.busy) return;
    const now = performance.now();
    if (!this.typing || this.typing.host !== host || now - this.typing.at >= PAUSE) {
      const before = this.known.get(host);
      if (before === undefined) {
        this.known.set(host, this.snapshot(host));
        return;
      }
      this.start(host, before, now);
    }
    const typing = this.typing as NonNullable<typeof this.typing>;
    typing.state.after = this.snapshot(host);
    typing.at = now;
    this.known.set(host, typing.state.after);
    const same = typing.state.after === typing.state.before;
    if (same && !this.recorded(typing.entry)) return;
    if (!this.recorded(typing.entry)) this.record(typing.entry);
    if (!this.open) for (const fn of this.typers) fn(typing.entry);
    if (same && !typing.entry.touches?.length) this.unrecord(typing.entry);
    refreshHeads(host);
    this.onChange();
  }

  break(): void {
    this.typing = null;
  }

  undo(): Promise<void> {
    return this.step('undo');
  }

  redo(): Promise<void> {
    return this.step('redo');
  }

  private step(way: 'undo' | 'redo'): Promise<void> {
    const run = this.queue.then(() => this.closed).then(async () => {
      const [from, to] = way === 'undo' ? [this.done, this.undone] : [this.undone, this.done];
      const entry = from.pop();
      if (!entry) return;
      this.typing = null;
      this.busy = true;
      const select = this.changed();
      try {
        await entry[way]();
      } catch (e) {
        if (e !== REFUSED) throw e;
        this.refused?.(entry, way);
        this.onChange();
        return;
      } finally {
        this.busy = false;
        this.calm();
      }
      const els = this.touched(entry, way);
      if (els?.length === 1) select(els[0]);
      to.push(entry);
      this.onChange();
    });
    this.queue = run.catch(() => {});
    return run;
  }

  private touched(entry: Entry, way: 'undo' | 'redo'): Element[] | null {
    const parts = this.parts.get(entry) ?? [entry];
    return parts.some((p) => p.selects === way) ? null : [...new Set(parts.flatMap((p) => p.els ?? []))];
  }

  async amend<T>(entry: Entry, fn: () => T | Promise<T>): Promise<T> {
    const entries = this.parts.get(entry);
    if (this.open || !entries || this.done.at(-1) !== entry) return await this.selecting(entry.label, fn);
    this.open = entries;
    this.typing = null;
    try {
      return await this.selecting(entry.label, fn);
    } finally {
      this.open = null;
      this.typing = null;
      this.undone = [];
      this.calm();
      this.onChange();
    }
  }

  retract(entry: Entry, quiet = false): Promise<void> {
    const run = this.queue.then(async () => {
      if (this.done.at(-1) !== entry) return;
      this.done.pop();
      this.typing = null;
      this.busy = true;
      this.still = quiet;
      try {
        await entry.undo();
      } catch (e) {
        if (e !== REFUSED) throw e;
      } finally {
        this.busy = false;
        this.still = false;
        this.calm();
      }
      this.onChange();
    });
    this.queue = run.catch(() => {});
    return run;
  }

  get quiet(): boolean {
    return this.still;
  }

  discard(): void {
    this.typing = null;
    this.undone = [];
    if (this.done.pop()) this.onChange();
  }

  prune(touched: (el: Element) => boolean, within: (root: Element) => boolean = () => false, reordered: (el: Element) => boolean = () => false, texts: readonly Element[] = []): void {
    const kept = (e: Entry) => this.typed.has(e) && !!e.els?.[0]?.isConnected && texts.includes(e.els[0]);
    const hits = (e: Entry) => (this.parts.get(e) ?? [e]).some((p) => (!kept(p) && p.els?.some(touched)) || p.touches?.some(touched) || p.detaches?.some(within) || p.orders?.some(reordered));
    const t = this.typing;
    if (t && ((touched(t.host) && !texts.includes(t.host)) || hits(t.entry))) this.typing = null;
    const done = this.done.filter((e) => !hits(e));
    const undone = this.undone.filter((e) => !hits(e));
    if (done.length === this.done.length && undone.length === this.undone.length) return;
    this.done = done;
    this.undone = undone;
    this.onChange();
  }

  clear(): void {
    this.done = [];
    this.undone = [];
    this.typing = null;
    this.onChange();
  }
}
