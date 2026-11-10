// one history of undo and redo for every change made in the editor: the typing in a block, a
// formula, a step, and a move, as in Keynote and PowerPoint, where ⌘Z undoes the last change of
// any kind. the browser keeps a history of its own for each block that is typed into, hence the
// keys are taken before it, and the typing is recorded here as the content of the block before
// and after. the typing into one block within a short time is one entry, and an undo or a redo
// asked for while another one runs is queued

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
  // the content of each block as it was last seen, for an input that is not announced before it
  // happens, e.g. a replacement from the spelling menu or a script
  private readonly known = new WeakMap<Element, string>();
  private readonly snapshot: (host: Element) => string;
  private readonly restore: (host: Element, content: string) => Promise<void>;
  private readonly onChange: () => void;

  constructor(options: { snapshot(host: Element): string; restore(host: Element, content: string): Promise<void>; onChange(): void }) {
    this.snapshot = options.snapshot;
    this.restore = options.restore;
    this.onChange = options.onChange;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  // resolved once every undo and redo asked for has run
  idle(): Promise<void> {
    return this.queue;
  }

  // a change other than typing, already applied
  push(entry: Entry): void {
    this.typing = null;
    this.done.push(entry);
    this.undone = [];
    this.onChange();
  }

  // called when host is focused or put back, so that its content before the next input is known
  track(host: Element): void {
    this.known.set(host, this.snapshot(host));
  }

  // called before an input into host, with the content that the input changes
  beforeTyping(host: Element): void {
    if (this.busy) return;
    const now = performance.now();
    if (this.typing && this.typing.host === host && now - this.typing.at < PAUSE) return;
    this.start(host, this.snapshot(host), now);
  }

  private start(host: Element, before: string, at: number): void {
    const state = { before, after: before };
    const entry: Entry = {
      label: 'typing',
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
    if (typing.state.after === typing.state.before && !this.done.includes(typing.entry)) return;
    if (!this.done.includes(typing.entry)) {
      this.done.push(typing.entry);
      this.undone = [];
    }
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

  clear(): void {
    this.done = [];
    this.undone = [];
    this.typing = null;
    this.onChange();
  }
}
