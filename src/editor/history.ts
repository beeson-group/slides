// one history of undo and redo for every change made in the editor: the typing in a block, a
// formula, a step, and a move, as in Keynote and PowerPoint, where ⌘Z undoes the last change of
// any kind. the browser keeps a history of its own for each block that is typed into, hence the
// keys are taken before it, and the typing is recorded here as the content of the block before
// and after. the typing into one block within a short time is one entry. an undo or a redo asked
// for while another one runs is queued, and the changes made in a transaction are one entry

export type Entry = { label: string; undo(): Promise<void> | void; redo(): Promise<void> | void };

// the typing into a block is coalesced while the keystrokes are closer than this, in ms
const PAUSE = 1000;

export class History {
  private done: Entry[] = [];
  private undone: Entry[] = [];
  // the typing in progress: the block, its content before and after, and the time of the last key
  private typing: { host: Element; state: { before: string; after: string }; entry: Entry; at: number } | null = null;
  private busy = false;
  // the undos and redos asked for, run one after the other
  private queue: Promise<void> = Promise.resolve();
  // the entries of the open transaction, which are put into the history as one entry at its end
  private open: Entry[] | null = null;
  // the content of each block as it was last seen, for an input that is not announced before it
  // happens, e.g. a replacement from the spelling menu or a script
  private readonly known = new WeakMap<Element, string>();
  // the entries of each transaction, for an amend of it
  private readonly parts = new WeakMap<Entry, Entry[]>();
  private readonly snapshot: (host: Element) => string;
  private readonly restore: (host: Element, content: string) => Promise<void>;
  private readonly onChange: () => void;
  // the selected elements, or null for a selection of another kind, and their selection again
  private readonly selected: () => Element[] | null;
  private readonly reselect: (els: Element[]) => void;

  constructor(options: { snapshot(host: Element): string; restore(host: Element, content: string): Promise<void>; onChange(): void; selected?(): Element[] | null; reselect?(els: Element[]): void }) {
    this.snapshot = options.snapshot;
    this.restore = options.restore;
    this.onChange = options.onChange;
    this.selected = options.selected ?? (() => null);
    this.reselect = options.reselect ?? (() => {});
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  // the label of the entry that an undo or a redo would take back, e.g. for the Edit menu
  get undoLabel(): string | null {
    return this.done.at(-1)?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.undone.at(-1)?.label ?? null;
  }

  // the entry that an undo would take back
  get last(): Entry | null {
    return this.done.at(-1) ?? null;
  }

  // resolved once every undo and redo asked for has run
  idle(): Promise<void> {
    return this.queue;
  }

  // a change other than typing, already applied
  push(entry: Entry): void {
    this.typing = null;
    this.record(entry);
    this.onChange();
  }

  private record(entry: Entry): void {
    if (this.open) {
      this.open.push(entry);
      return;
    }
    this.done.push(entry);
    this.undone = [];
  }

  private recorded(entry: Entry): boolean {
    return this.done.includes(entry) || !!this.open?.includes(entry);
  }

  // the changes made in fn, typing included, are one entry with label, undone in reverse order. a
  // transaction opened inside another one is part of it, and the changes made before an error in
  // fn are still recorded
  async transact<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    if (this.open) return await fn();
    const entries: Entry[] = [];
    this.open = entries;
    this.typing = null;
    try {
      return await fn();
    } finally {
      this.open = null;
      this.typing = null;
      if (entries.length) {
        const entry: Entry = {
          label,
          undo: async () => {
            for (const e of [...entries].reverse()) await e.undo();
          },
          redo: async () => {
            for (const e of entries) await e.redo();
          },
        };
        this.parts.set(entry, entries);
        this.done.push(entry);
        this.undone = [];
        this.onChange();
      }
    }
  }

  // a transaction, or a part of the open one, after whose undo the elements selected before fn are
  // selected again, and after whose redo those selected after fn, e.g. a paragraph made a list, or
  // those of then, e.g. a new box that has the caret after fn
  async selecting<T>(label: string, fn: () => T | Promise<T>, then?: () => Element[]): Promise<T> {
    return this.keeping(label, this.selected, (els) => void (els && this.reselect(els)), fn, then);
  }

  // a transaction, or a part of the open one, after whose undo put is given what take read before
  // fn, and after whose redo what take, or then, read after fn, e.g. the current slide of a slide
  // command
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
        entries.splice(at, 0, { label, undo: () => put(before), redo: () => {} });
        entries.push({ label, undo: () => {}, redo: () => put(after) });
      }
    }
  }

  // a part of the open transaction after whose undo the selection that take reads now is put back,
  // and after whose redo the one that it reads at the call of the function returned, e.g. a word
  // made bold. take gives the function that puts the selection back
  keep(take: () => (() => void) | null): () => void {
    const entries = this.open;
    if (!entries) return () => {};
    const at = entries.length;
    const before = take();
    return () => {
      if (entries.length === at) return;
      const after = take();
      entries.splice(at, 0, { label: 'select', undo: () => before?.(), redo: () => {} });
      entries.push({ label: 'select', undo: () => {}, redo: () => after?.() });
    };
  }

  // called when host is focused or put back, so that its content before the next input is known
  track(host: Element): void {
    this.known.set(host, this.snapshot(host));
  }

  // called before an input into host, with the content that the input changes. an input with a
  // label of its own, e.g. Paste, is an entry apart from the typing around it
  beforeTyping(host: Element, label = 'typing'): void {
    if (this.busy) return;
    const now = performance.now();
    if (label !== 'typing') this.typing = null;
    if (this.typing && this.typing.host === host && now - this.typing.at < PAUSE && this.typing.entry.label === 'typing') return;
    this.start(host, this.snapshot(host), now, label);
  }

  private start(host: Element, before: string, at: number, label = 'typing'): void {
    const state = { before, after: before };
    const entry: Entry = {
      label,
      undo: () => this.put(host, state.before),
      redo: () => this.put(host, state.after),
    };
    this.typing = { host, state, entry, at };
    this.known.set(host, before);
  }

  private async put(host: Element, content: string): Promise<void> {
    await this.restore(host, content);
    this.known.set(host, content);
  }

  // called after an input into host. the entry is put into the history at the first input, and
  // an input without a call before it starts from the content last seen
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
    if (typing.state.after === typing.state.before && !this.recorded(typing.entry)) return;
    if (!this.recorded(typing.entry)) this.record(typing.entry);
    this.onChange();
  }

  // the typing that follows is a new entry, e.g. after the block was left
  break(): void {
    this.typing = null;
  }

  undo(): Promise<void> {
    return this.step('undo');
  }

  redo(): Promise<void> {
    return this.step('redo');
  }

  // the entry is taken when its turn in the queue comes, hence a second undo asked for during the
  // first one takes the entry before it
  private step(way: 'undo' | 'redo'): Promise<void> {
    const run = this.queue.then(async () => {
      // the stacks are read at the turn of the step, since clear() replaces them
      const [from, to] = way === 'undo' ? [this.done, this.undone] : [this.undone, this.done];
      const entry = from.pop();
      if (!entry) return;
      this.typing = null;
      this.busy = true;
      try {
        await entry[way]();
      } finally {
        this.busy = false;
      }
      to.push(entry);
      this.onChange();
    });
    // a failed step does not stop the steps after it, and its error is passed to its caller
    this.queue = run.catch(() => {});
    return run;
  }

  // the changes made in fn are added to entry, a transaction, while it is the last entry, e.g. the
  // TeX of a new formula to its insert, with the selection as selecting() keeps it. otherwise they
  // are entries of their own
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
      this.onChange();
    }
  }

  // entry, if it is still the last one, is undone and taken out of the history without a redo,
  // e.g. a new formula left empty
  retract(entry: Entry): Promise<void> {
    const run = this.queue.then(async () => {
      if (this.done.at(-1) !== entry) return;
      this.done.pop();
      this.typing = null;
      this.busy = true;
      try {
        await entry.undo();
      } finally {
        this.busy = false;
      }
      this.onChange();
    });
    this.queue = run.catch(() => {});
    return run;
  }

  // the last entry is taken out of the history without an undo, e.g. the insert of an empty box
  // that the editor has already taken off the page. it is taken at once, so that an entry pushed
  // right after it is kept
  discard(): void {
    this.typing = null;
    if (this.done.pop()) this.onChange();
  }

  clear(): void {
    this.done = [];
    this.undone = [];
    this.typing = null;
    this.onChange();
  }
}
