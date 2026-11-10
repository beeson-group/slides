/*! editor.js 0.9.0-beta.1, the in-place editor of the beeson theme. MIT license. */
"use strict";
(() => {
  // src/editor/history.ts
  var PAUSE = 1e3;
  var History = class {
    constructor(options) {
      this.done = [];
      this.undone = [];
      // the typing in progress: the block, its content before and after, and the time of the last key
      this.typing = null;
      this.busy = false;
      // the undos and redos asked for, run one after the other
      this.queue = Promise.resolve();
      // the entries of the open transaction, which are put into the history as one entry at its end
      this.open = null;
      // the content of each block as it was last seen, for an input that is not announced before it
      // happens, e.g. a replacement from the spelling menu or a script
      this.known = /* @__PURE__ */ new WeakMap();
      this.snapshot = options.snapshot;
      this.restore = options.restore;
      this.onChange = options.onChange;
    }
    get canUndo() {
      return this.done.length > 0;
    }
    get canRedo() {
      return this.undone.length > 0;
    }
    // the label of the entry that an undo or a redo would take back, e.g. for the Edit menu
    get undoLabel() {
      return this.done.at(-1)?.label ?? null;
    }
    get redoLabel() {
      return this.undone.at(-1)?.label ?? null;
    }
    // resolved once every undo and redo asked for has run
    idle() {
      return this.queue;
    }
    // a change other than typing, already applied
    push(entry) {
      this.typing = null;
      this.record(entry);
      this.onChange();
    }
    record(entry) {
      if (this.open) {
        this.open.push(entry);
        return;
      }
      this.done.push(entry);
      this.undone = [];
    }
    recorded(entry) {
      return this.done.includes(entry) || !!this.open?.includes(entry);
    }
    // the changes made in fn, typing included, are one entry with label, undone in reverse order. a
    // transaction opened inside another one is part of it, and the changes made before an error in
    // fn are still recorded
    async transact(label2, fn) {
      if (this.open) return await fn();
      const entries = [];
      this.open = entries;
      this.typing = null;
      try {
        return await fn();
      } finally {
        this.open = null;
        this.typing = null;
        if (entries.length) {
          this.done.push({
            label: label2,
            undo: async () => {
              for (const e of [...entries].reverse()) await e.undo();
            },
            redo: async () => {
              for (const e of entries) await e.redo();
            }
          });
          this.undone = [];
          this.onChange();
        }
      }
    }
    // called when host is focused or put back, so that its content before the next input is known
    track(host) {
      this.known.set(host, this.snapshot(host));
    }
    // called before an input into host, with the content that the input changes
    beforeTyping(host) {
      if (this.busy) return;
      const now = performance.now();
      if (this.typing && this.typing.host === host && now - this.typing.at < PAUSE) return;
      this.start(host, this.snapshot(host), now);
    }
    start(host, before, at) {
      const state = { before, after: before };
      const entry = {
        label: "typing",
        undo: () => this.put(host, state.before),
        redo: () => this.put(host, state.after)
      };
      this.typing = { host, state, entry, at };
      this.known.set(host, before);
    }
    async put(host, content) {
      await this.restore(host, content);
      this.known.set(host, content);
    }
    // called after an input into host. the entry is put into the history at the first input, and
    // an input without a call before it starts from the content last seen
    afterTyping(host) {
      if (this.busy) return;
      const now = performance.now();
      if (!this.typing || this.typing.host !== host || now - this.typing.at >= PAUSE) {
        const before = this.known.get(host);
        if (before === void 0) {
          this.known.set(host, this.snapshot(host));
          return;
        }
        this.start(host, before, now);
      }
      const typing = this.typing;
      typing.state.after = this.snapshot(host);
      typing.at = now;
      this.known.set(host, typing.state.after);
      if (typing.state.after === typing.state.before && !this.recorded(typing.entry)) return;
      if (!this.recorded(typing.entry)) this.record(typing.entry);
      this.onChange();
    }
    // the typing that follows is a new entry, e.g. after the block was left
    break() {
      this.typing = null;
    }
    undo() {
      return this.step("undo");
    }
    redo() {
      return this.step("redo");
    }
    // the entry is taken when its turn in the queue comes, hence a second undo asked for during the
    // first one takes the entry before it
    step(way) {
      const run2 = this.queue.then(async () => {
        const [from, to] = way === "undo" ? [this.done, this.undone] : [this.undone, this.done];
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
      this.queue = run2.catch(() => {
      });
      return run2;
    }
    clear() {
      this.done = [];
      this.undone = [];
      this.typing = null;
      this.onChange();
    }
  };

  // src/editor/math.ts
  var mathjax = () => window.MathJax?.startup?.document ? window.MathJax : null;
  function mathLookup() {
    const map = /* @__PURE__ */ new Map();
    const mj = mathjax();
    if (mj) {
      for (const item of mj.startup.document.getMathItemsWithin([document.body])) {
        if (!item.typesetRoot) continue;
        map.set(item.typesetRoot, { tex: item.math, display: item.display, open: item.start.delim ?? "", close: item.end.delim ?? "" });
      }
    }
    return (el) => map.get(el) ?? null;
  }
  async function previewTex(tex, display2) {
    if (!tex.trim()) return { node: null, error: "The formula is empty" };
    const mj = mathjax();
    if (!mj?.tex2svgPromise) return { node: null, error: null };
    const node = await mj.tex2svgPromise(tex, { display: display2 });
    const merror = node.querySelector("[data-mjx-error], mjx-merror");
    const error = merror ? merror.getAttribute("data-mjx-error") ?? merror.textContent ?? "TeX error" : null;
    return { node, error };
  }
  async function retypeset(host, container, tex) {
    const mj = mathjax();
    if (!mj) return false;
    const lookup = mathLookup();
    const former = lookup(container);
    const count = host.querySelectorAll("mjx-container").length;
    const typeset = async (replacement) => {
      for (const c of [...host.querySelectorAll("mjx-container")]) {
        const info = lookup(c);
        if (!info) continue;
        c.replaceWith(document.createTextNode(info.open + (c === container ? replacement : info.tex) + info.close));
      }
      host.normalize();
      mj.typesetClear([host]);
      await mj.typesetPromise([host]);
      return host.querySelectorAll("mjx-container").length === count;
    };
    if (await typeset(tex)) return true;
    if (former) {
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      const source = former.open + tex + former.close;
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.nodeValue?.includes(source)) continue;
        text.nodeValue = text.nodeValue.replace(source, former.open + former.tex + former.close);
        break;
      }
      mj.typesetClear([host]);
      await mj.typesetPromise([host]);
    }
    return false;
  }
  var mathReady = () => window.MathJax?.startup?.promise ?? Promise.resolve();
  function contentWithTex(host) {
    const copy = host.cloneNode(true);
    const lookup = mathLookup();
    const live = [...host.querySelectorAll("mjx-container")];
    const copies = [...copy.querySelectorAll("mjx-container")];
    copies.forEach((c, i) => {
      const info = lookup(live[i]);
      c.replaceWith(document.createTextNode(info ? info.open + info.tex + info.close : c.textContent ?? ""));
    });
    copy.normalize();
    return copy.innerHTML;
  }
  async function setContentWithTex(host, content) {
    const mj = mathjax();
    if (mj) mj.typesetClear([host]);
    host.innerHTML = content;
    if (mj) await mj.typesetPromise([host]);
  }

  // src/editor/keymap.ts
  var MODIFIERS = ["Mod", "Shift", "Alt", "Ctrl", "Meta"];
  var NAMED = /* @__PURE__ */ new Set([
    "Enter",
    "Escape",
    "Tab",
    "Backspace",
    "Delete",
    "Space",
    "ContextMenu",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)
  ]);
  var SYMBOLS = {
    Minus: ["-", "_"],
    Equal: ["=", "+"],
    BracketLeft: ["[", "{"],
    BracketRight: ["]", "}"],
    Backslash: ["\\", "|"],
    Semicolon: [";", ":"],
    Quote: ["'", '"'],
    Backquote: ["`", "~"],
    Comma: [",", "<"],
    Period: [".", ">"],
    Slash: ["/", "?"]
  };
  var isLetter = (key) => /^[a-z]$/i.test(key);
  var isDigit = (key) => /^[0-9]$/.test(key);
  var isSymbol = (key) => key.length === 1 && !isLetter(key) && !isDigit(key);
  function parseKey(value, platform) {
    const parts = value.endsWith("++") ? [...value.slice(0, -2).split("+"), "+"] : value.split("+");
    const raw = parts.pop() ?? "";
    for (const part of parts) if (!MODIFIERS.includes(part)) throw new Error(`the modifier ${part} of ${value} is not known`);
    const key = raw.length === 1 ? raw.toLowerCase() : raw;
    if (!key || key.length > 1 && !NAMED.has(key)) throw new Error(`the key of ${value} is not known`);
    const mods = new Set(parts);
    return {
      key,
      shift: mods.has("Shift"),
      alt: mods.has("Alt"),
      ctrl: mods.has("Ctrl") || mods.has("Mod") && platform === "other",
      meta: mods.has("Meta") || mods.has("Mod") && platform === "mac"
    };
  }
  function keyMatches(ev, chord, platform) {
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    const code = ev.code ?? "";
    if (isLetter(chord.key)) {
      const ascii = key.length === 1 && key.charCodeAt(0) < 128;
      return ascii ? key === chord.key : code === `Key${chord.key.toUpperCase()}`;
    }
    if (isDigit(chord.key)) return key === chord.key || code === `Digit${chord.key}`;
    if (isSymbol(chord.key)) {
      if (key === chord.key) return true;
      const typed = platform === "mac" && ev.altKey ? SYMBOLS[code] : void 0;
      return !!typed && typed[ev.shiftKey ? 1 : 0] === chord.key;
    }
    if (chord.key === "Space") return ev.key === " ";
    return ev.key === chord.key;
  }
  function matches(ev, value, platform) {
    if (platform === "other" && ev.getModifierState?.("AltGraph")) return false;
    const chord = parseKey(value, platform);
    if (!keyMatches(ev, chord, platform)) return false;
    if (!isSymbol(chord.key) && ev.shiftKey !== chord.shift) return false;
    return ev.altKey === chord.alt && ev.ctrlKey === chord.ctrl && ev.metaKey === chord.meta;
  }
  function fallback(ev, platform) {
    const get = (name) => ev.getModifierState?.(name) ?? false;
    const base = { key: ev.key, code: ev.code, shiftKey: ev.shiftKey, altKey: ev.altKey, getModifierState: get };
    if (platform === "mac" && ev.ctrlKey && !ev.metaKey) return { ...base, ctrlKey: false, metaKey: true };
    if (platform === "other" && ev.metaKey && !ev.ctrlKey) return { ...base, ctrlKey: true, metaKey: false };
    return null;
  }
  var MAC_KEYS = {
    Enter: "\u21A9",
    Escape: "\u238B",
    Tab: "\u21E5",
    Backspace: "\u232B",
    Delete: "\u2326",
    Space: "Space",
    ContextMenu: "Menu",
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
    Home: "\u2196",
    End: "\u2198",
    PageUp: "\u21DE",
    PageDown: "\u21DF"
  };
  var OTHER_KEYS = {
    Escape: "Esc",
    ContextMenu: "Menu",
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
    PageUp: "Page Up",
    PageDown: "Page Down"
  };
  function display(value, platform) {
    const c = parseKey(value, platform);
    const key = c.key.length === 1 ? c.key.toUpperCase() : c.key;
    if (platform === "mac") {
      const mods2 = (c.ctrl ? "\u2303" : "") + (c.alt ? "\u2325" : "") + (c.shift ? "\u21E7" : "") + (c.meta ? "\u2318" : "");
      return mods2 + (MAC_KEYS[key] ?? key);
    }
    const mods = [c.ctrl && "Ctrl", c.meta && "Meta", c.alt && "Alt", c.shift && "Shift"].filter(Boolean);
    return [...mods, OTHER_KEYS[key] ?? key].join("+");
  }
  function install(_app) {
  }

  // src/editor/commands.ts
  var DEFAULT_REGIONS = ["canvas", "navigator"];
  var OUTSIDE_DIALOGS = ["canvas", "text", "field", "navigator", "notes", "inspector"];
  var EVERYWHERE = [...OUTSIDE_DIALOGS, "dialog"];
  function keysOf(c, platform) {
    return c.keys?.[platform] ?? [];
  }
  function isPlain(value) {
    return !/(^|\+)(Mod|Ctrl|Alt|Meta)\+/.test(value) && !/^(Shift\+)?F\d+$/.test(value);
  }
  var orderOf = (c, place3) => c[place3]?.order ?? 0;
  function grouped(list, place3) {
    const groups = /* @__PURE__ */ new Map();
    for (const c of [...list].sort((a, b) => orderOf(a, place3) - orderOf(b, place3))) {
      const name = c[place3]?.group ?? "";
      groups.set(name, [...groups.get(name) ?? [], c]);
    }
    return [...groups].map(([group, commands2]) => ({ group, commands: commands2 }));
  }
  var Commands = class {
    constructor(app2) {
      this.byId = /* @__PURE__ */ new Map();
      this.app = app2;
    }
    // a command is defined once. a second definition of its id is an error, since two packages
    // would then both own it
    define(command) {
      if (this.byId.has(command.id)) throw new Error(`the command ${command.id} is defined twice`);
      this.byId.set(command.id, command);
      return command;
    }
    get(id) {
      return this.byId.get(id);
    }
    list() {
      return [...this.byId.values()];
    }
    label(id) {
      const c = this.byId.get(id);
      if (!c) return id;
      return typeof c.label === "function" ? c.label(this.app) : c.label;
    }
    enabled(id) {
      const c = this.byId.get(id);
      return !!c && (c.enabled?.(this.app) ?? true);
    }
    state(id) {
      const c = this.byId.get(id);
      if (!c) throw new Error(`there is no command ${id}`);
      return { id, label: this.label(id), enabled: this.enabled(id), checked: c.checked?.(this.app) ?? null };
    }
    // a disabled command is not run. an undoable command is one entry of the history, however many
    // changes it makes
    async run(id, arg) {
      const c = this.byId.get(id);
      if (!c) throw new Error(`there is no command ${id}`);
      if (!this.enabled(id)) return;
      if (c.undoable) await this.app.history.transact(this.label(id), () => c.run(this.app, arg));
      else await c.run(this.app, arg);
    }
    // the keys of a command on the platform of the editor, as a menu shows them
    shortcuts(id) {
      const c = this.byId.get(id);
      return c ? keysOf(c, this.app.platform).map((k) => display(k, this.app.platform)) : [];
    }
    // the first enabled command taken in region whose keys match ev, and else the first one whose
    // keys match ev with the fallback modifier of keymap.ts. with plain set, a key of isPlain is not
    // taken
    forKey(ev, region, plain = true) {
      const platform = this.app.platform;
      const find = (e) => this.list().find((c) => (c.in ?? DEFAULT_REGIONS).includes(region) && keysOf(c, platform).some((k) => (plain || !isPlain(k)) && matches(e, k, platform)) && this.enabled(c.id));
      const alt = fallback(ev, platform);
      return find(ev) ?? (alt ? find(alt) : void 0);
    }
    // the commands of a menu of the menu bar, or of one of its submenus, in groups
    forMenu(bar, submenu) {
      return grouped(this.list().filter((c) => c.menu?.bar === bar && c.menu.submenu === submenu), "menu");
    }
    forToolbar() {
      return grouped(this.list().filter((c) => c.toolbar), "toolbar");
    }
    // the commands of a context menu, in the order of their definition
    forContext(kind) {
      return this.list().filter((c) => c.context?.includes(kind));
    }
  };
  function installKeys(app2) {
    window.addEventListener("keydown", (ev) => {
      if (ev.isComposing || ev.keyCode === 229) return;
      if (dialogKey(app2, ev)) return;
      const region = app2.region();
      const active = document.activeElement;
      const onBar = region === "canvas" && active instanceof Element && active !== document.body && active !== document.documentElement && !active.closest(".reveal, .beeson-handle");
      const command = app2.commands.forKey(ev, region, !onBar);
      if (!command) return;
      ev.preventDefault();
      ev.stopPropagation();
      void app2.commands.run(command.id).catch((e) => app2.fail(e));
    }, true);
    app2.listen("resize", () => {
      const d = app2.deck();
      if (d?.isReady() && d.getConfig?.().keyboard !== false) d.configure({ keyboard: false });
    });
  }
  function dialogKey(app2, ev) {
    const active = document.activeElement;
    if ((ev.key === "Enter" || ev.key === " ") && !app2.math.isOpen() && active instanceof Element && active.matches("mjx-container") && app2.hostOf(active)) {
      ev.preventDefault();
      ev.stopPropagation();
      app2.math.open(active);
      return true;
    }
    if (ev.key !== "Escape") return false;
    if (app2.files.problemsShown()) app2.files.closeProblems();
    else if (app2.files.askShown()) app2.files.cancelAsk();
    else if (app2.math.isOpen()) app2.math.close();
    else return false;
    ev.stopPropagation();
    return true;
  }

  // src/editor/app.ts
  var ALL = ["content", "selection", "slide", "structure", "layout"];
  var HOST = '[contenteditable="true"]';
  var detectPlatform = () => {
    const forced = new URLSearchParams(location.search).get("edit-platform");
    if (forced === "mac" || forced === "other") return forced;
    const agent = navigator.userAgentData?.platform ?? navigator.platform ?? "";
    return /mac|iphone|ipad/i.test(agent) ? "mac" : "other";
  };
  var App = class {
    constructor() {
      this.source = null;
      // the text last read from the file or written to it. it differs from the source after a save
      // during which an edit was made, and the deck is clean when it renders as this text
      this.saved = null;
      this.pairing = null;
      // the step, the offset, and later any attribute of each element changed since the last save
      this.tagEdits = /* @__PURE__ */ new Map();
      this.handle = null;
      this.state = "starting";
      this.dirty = false;
      // the message of the last save or error, shown until the next edit
      this.note = null;
      this.autosave = false;
      // the texts of the current slide that run past its edge
      this.overflow = 0;
      // the state line as last reported
      this.line = { text: "", warn: false, title: "" };
      this.platform = detectPlatform();
      this.listeners = /* @__PURE__ */ new Map();
      this.refreshers = [];
      this.pending = /* @__PURE__ */ new Set();
      this.scheduled = false;
      this.history = new History({
        snapshot: contentWithTex,
        restore: (host, content) => this.typing.restoreHost(host, content),
        onChange: () => this.emit("history")
      });
      this.commands = new Commands(this);
    }
    deck() {
      return window.Reveal;
    }
    slides() {
      return document.querySelector(".reveal .slides") ?? document.body;
    }
    current() {
      return this.deck()?.getCurrentSlide() ?? null;
    }
    // the slide of el is shown in the layer in which el is seen, e.g. for an undo of a change on
    // another slide
    showSlide(el) {
      const d = this.deck();
      const section = el.closest("section");
      if (d && section && section !== d.getCurrentSlide()) {
        const { h, v } = d.getIndices(section);
        d.slide(h, v);
      }
      this.layers?.reveal(el);
    }
    slideNumber(slide) {
      if (!slide) return null;
      const d = this.deck();
      return d ? d.getIndices(slide).h + 1 : null;
    }
    // the editable block around target, on a slide
    hostOf(target) {
      const host = target instanceof Element ? target.closest(HOST) : null;
      return host && this.slides().contains(host) ? host : null;
    }
    // the viewport of reveal.js is laid out again, e.g. after a pane was shown or resized
    relayout() {
      this.deck()?.layout();
      this.emit("resize");
    }
    listen(event, fn) {
      const list = this.listeners.get(event) ?? [];
      list.push(fn);
      this.listeners.set(event, list);
    }
    emit(event) {
      for (const fn of this.listeners.get(event) ?? []) fn();
    }
    // every change passes here: the state is shown, and the drafts and the autosave are scheduled
    markDirty() {
      if (!this.dirty) {
        this.dirty = true;
        this.note = null;
        this.report();
      }
      this.emit("dirty");
    }
    report() {
      if (this.files) this.line = this.files.line();
      this.emit("report");
    }
    // an error of a button or a key, shown in the state until the next edit
    fail(e) {
      this.note = { text: e instanceof Error ? e.message : String(e), warn: true };
      this.report();
    }
    // refresh is called once after the event in which one of flags was invalidated, with every flag
    // invalidated in the event, and the modules are refreshed in the order of their install. the
    // refresh is run in a microtask rather than an animation frame, since a pane is read right after
    // an action in the tests of today
    onRefresh(flags, refresh) {
      this.refreshers.push({ flags, refresh });
    }
    invalidate(...flags) {
      for (const f of flags.length ? flags : ALL) this.pending.add(f);
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => this.flush());
    }
    // the refresh that is due is run now, e.g. before the state is read by a test
    flush() {
      this.scheduled = false;
      const flags = this.pending;
      if (!flags.size) return;
      this.pending = /* @__PURE__ */ new Set();
      for (const r of this.refreshers) if (r.flags.some((f) => flags.has(f))) r.refresh(flags);
    }
    region() {
      const active = document.activeElement;
      if (!(active instanceof Element) || active === document.body) return "canvas";
      if (active.closest(".beeson-math, .beeson-edit-card:not([hidden]), dialog[open]")) return "dialog";
      if (active.matches("input, textarea, select")) return "field";
      if (active.closest("aside.notes")) return "notes";
      if (this.hostOf(active)) return "text";
      if (active.closest(".beeson-edit-nav")) return "navigator";
      if (active.closest(".beeson-edit-side")) return "inspector";
      return "canvas";
    }
  };

  // src/editor/layers.ts
  var OUT = ".fade-out";
  var ONLY = ".current-visible, .fade-in-then-out";
  var OFF = "beeson-off";
  function fragmentsOf(slide) {
    const els = [...slide.querySelectorAll(".fragment")].filter((el) => !el.closest("aside.notes"));
    const given = els.map((el) => parseInt(el.getAttribute("data-fragment-index") ?? "", 10));
    let next = Math.max(0, ...given.filter((i) => !Number.isNaN(i))) + 1;
    const index = given.map((i) => Number.isNaN(i) ? next++ : i);
    const order = [...new Set(index)].sort((a, b) => a - b);
    return els.map((el, i) => ({ el, step: order.indexOf(index[i]) + 1, kind: el.matches(OUT) ? "out" : el.matches(ONLY) ? "only" : "in" }));
  }
  function layersOf(slide) {
    const fragments = fragmentsOf(slide);
    const last = Math.max(0, ...fragments.map((f) => f.step));
    const cuts = /* @__PURE__ */ new Set();
    for (const f of fragments) {
      const at = f.kind === "out" ? f.step : f.kind === "only" ? f.step + 1 : 0;
      if (at > 0 && at <= last) cuts.add(at);
    }
    const starts = [0, ...[...cuts].sort((a, b) => a - b)];
    return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] - 1 : last }));
  }
  var shownAt = (f, step2) => f.kind === "in" ? f.step <= step2 : f.kind === "out" ? step2 < f.step : step2 === f.step;
  function showLayer(slide, layer) {
    for (const f of fragmentsOf(slide)) {
      const up = f.el.parentElement?.closest(".fragment");
      f.el.classList.toggle(OFF, !!layer && (!shownAt(f, layer.to) || !!up && up.classList.contains(OFF)));
    }
  }
  function label(layer, last) {
    if (layer.from === 0) return layer.to === 0 ? "Before step 1" : `Up to step ${layer.to}`;
    if (last) return `From step ${layer.from}`;
    return layer.from === layer.to ? `Step ${layer.from}` : `Steps ${layer.from}\u2013${layer.to}`;
  }
  var Layers = class {
    constructor(slide, onChange) {
      this.box = document.createElement("span");
      // the layer chosen on each slide, kept while the editor is open
      this.chosen = /* @__PURE__ */ new WeakMap();
      this.key = "";
      this.slide = slide;
      this.onChange = onChange;
      this.box.className = "beeson-layers";
      this.box.setAttribute("role", "group");
      this.box.setAttribute("aria-label", "Layer of the slide");
      this.box.hidden = true;
    }
    // the marks and the switch follow the current slide and its steps
    refresh() {
      const slide = this.slide();
      const layers2 = slide ? layersOf(slide) : [];
      if (!slide || layers2.length < 2) {
        if (slide) showLayer(slide, null);
        this.box.hidden = true;
        this.box.replaceChildren();
        this.key = "";
        return;
      }
      const at = Math.min(this.chosen.get(slide) ?? 0, layers2.length - 1);
      showLayer(slide, layers2[at]);
      const labels = layers2.map((l, i) => label(l, i === layers2.length - 1));
      const key = `${labels.join("|")}#${at}`;
      this.box.hidden = false;
      if (key === this.key) return;
      this.key = key;
      const head = document.createElement("span");
      head.textContent = "Shows";
      this.box.replaceChildren(head, ...labels.map((text, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.title = `Show the slide as it is at step ${layers2[i].to}, without the elements hidden by then and those shown after it`;
        b.setAttribute("aria-pressed", String(i === at));
        b.classList.toggle("on", i === at);
        b.addEventListener("click", (ev) => {
          if (ev.detail > 0) b.blur();
          this.choose(slide, i);
        });
        return b;
      }));
    }
    choose(slide, i) {
      this.chosen.set(slide, i);
      this.refresh();
      this.onChange();
    }
    // the layer in which el is shown is chosen, e.g. for an undo of a change to a hidden element
    reveal(el) {
      const slide = this.slide();
      if (!slide || !slide.contains(el) || !el.closest(`.${OFF}`)) return;
      const layers2 = layersOf(slide);
      for (let i = 0; i < layers2.length; i++) {
        showLayer(slide, layers2[i]);
        if (!el.closest(`.${OFF}`)) {
          this.choose(slide, i);
          return;
        }
      }
      this.refresh();
    }
  };

  // src/editor/ui/dom.ts
  function make(tag, className = "", text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function button(text, title = "", label2 = "") {
    const el = make("button", "", text);
    el.title = title;
    if (label2) el.setAttribute("aria-label", label2);
    return el;
  }
  function injectStyle(id, css) {
    const key = `beeson-edit-${id}`;
    const found = document.getElementById(key);
    if (found instanceof HTMLStyleElement) return found;
    const style = make("style");
    style.id = key;
    style.textContent = css;
    document.head.append(style);
    return style;
  }
  function stored(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
    }
  }
  function wire(el, action, fail2) {
    el.addEventListener("click", (ev) => {
      if (ev.detail > 0) el.blur();
      Promise.resolve().then(action).catch(fail2);
    });
  }

  // src/editor/tokens.ts
  var RAW_TEXT = /* @__PURE__ */ new Set(["script", "style", "xmp", "iframe", "noembed", "noframes"]);
  var RCDATA = /* @__PURE__ */ new Set(["textarea", "title"]);
  var isLetter2 = (c) => /^[A-Za-z]$/.test(c);
  var isSpace = (c) => c === " " || c === "	" || c === "\n" || c === "\r" || c === "\f";
  var opensMarkup = (c) => /^[A-Za-z!/?]$/.test(c);
  function tokenize(html) {
    const out = [];
    const lower = html.toLowerCase();
    const n = html.length;
    let i = 0;
    let rawFor = null;
    const textUntilMarkup = (from) => {
      let j = from;
      while (j < n && !(html[j] === "<" && j + 1 < n && opensMarkup(html[j + 1]))) j++;
      return j;
    };
    while (i < n) {
      if (rawFor) {
        let end2 = n;
        for (let k = lower.indexOf(`</${rawFor.name}`, i); k >= 0; k = lower.indexOf(`</${rawFor.name}`, k + 1)) {
          const after = html[k + 2 + rawFor.name.length] ?? ">";
          if (isSpace(after) || after === "/" || after === ">") {
            end2 = k;
            break;
          }
        }
        if (end2 > i) out.push({ type: "text", raw: rawFor.raw, start: i, end: end2 });
        rawFor = null;
        i = end2;
        continue;
      }
      const next = html[i + 1] ?? "";
      if (html[i] !== "<" || !opensMarkup(next)) {
        const end2 = textUntilMarkup(i + 1);
        out.push({ type: "text", raw: false, start: i, end: end2 });
        i = end2;
        continue;
      }
      if (html.startsWith("<!--", i)) {
        let end2;
        if (html.startsWith(">", i + 4)) end2 = i + 5;
        else if (html.startsWith("->", i + 4)) end2 = i + 6;
        else {
          const k = html.indexOf("-->", i + 4);
          end2 = k < 0 ? n : k + 3;
        }
        out.push({ type: "comment", start: i, end: end2 });
        i = end2;
      } else if (next === "!" || next === "?" || next === "/" && !isLetter2(html[i + 2] ?? "")) {
        const k = html.indexOf(">", i);
        const end2 = k < 0 ? n : k + 1;
        out.push({ type: "other", start: i, end: end2 });
        i = end2;
      } else if (next === "/") {
        let j = i + 2;
        while (j < n && !isSpace(html[j]) && html[j] !== ">" && html[j] !== "/") j++;
        const name = lower.slice(i + 2, j);
        const k = html.indexOf(">", j);
        const end2 = k < 0 ? n : k + 1;
        out.push({ type: "end", name, start: i, end: end2 });
        i = end2;
      } else {
        let j = i + 1;
        while (j < n && !isSpace(html[j]) && html[j] !== ">" && html[j] !== "/") j++;
        const name = lower.slice(i + 1, j);
        const attrs = [];
        let selfClosing = false;
        for (; ; ) {
          while (j < n && (isSpace(html[j]) || html[j] === "/")) {
            selfClosing = html[j] === "/" && html[j + 1] === ">";
            j++;
          }
          if (j >= n || html[j] === ">") break;
          const nameStart = j;
          while (j < n && !isSpace(html[j]) && html[j] !== ">" && html[j] !== "/" && html[j] !== "=") j++;
          if (j === nameStart) {
            j++;
            continue;
          }
          const attrName = lower.slice(nameStart, j);
          let k = j;
          while (k < n && isSpace(html[k])) k++;
          if (html[k] !== "=") {
            attrs.push({ name: attrName, value: null, start: nameStart, end: j });
            continue;
          }
          k++;
          while (k < n && isSpace(html[k])) k++;
          const quote = html[k];
          if (quote === '"' || quote === "'") {
            const e = html.indexOf(quote, k + 1);
            const valueEnd = e < 0 ? n : e;
            attrs.push({ name: attrName, value: html.slice(k + 1, valueEnd), start: nameStart, end: Math.min(valueEnd + 1, n) });
            j = Math.min(valueEnd + 1, n);
          } else {
            let e = k;
            while (e < n && !isSpace(html[e]) && html[e] !== ">") e++;
            attrs.push({ name: attrName, value: html.slice(k, e), start: nameStart, end: e });
            j = e;
          }
        }
        const end2 = Math.min(j + 1, n);
        out.push({ type: "start", name, attrs, selfClosing, start: i, end: end2 });
        i = end2;
        if (RAW_TEXT.has(name)) rawFor = { name, raw: true };
        else if (RCDATA.has(name)) rawFor = { name, raw: false };
      }
    }
    return out;
  }
  function classesOf(token) {
    if (token.type !== "start") return [];
    const value = token.attrs.find((a) => a.name === "class")?.value ?? "";
    return value.split(/\s+/).filter(Boolean);
  }
  var NAMED2 = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\xA0",
    ensp: "\u2002",
    emsp: "\u2003",
    thinsp: "\u2009",
    ndash: "\u2013",
    mdash: "\u2014",
    minus: "\u2212",
    hellip: "\u2026",
    lsquo: "\u2018",
    rsquo: "\u2019",
    ldquo: "\u201C",
    rdquo: "\u201D",
    laquo: "\xAB",
    raquo: "\xBB",
    middot: "\xB7",
    bull: "\u2022",
    times: "\xD7",
    deg: "\xB0",
    copy: "\xA9",
    reg: "\xAE",
    trade: "\u2122",
    shy: "\xAD",
    zwj: "\u200D",
    zwnj: "\u200C"
  };
  var LEGACY = /* @__PURE__ */ new Set(["amp", "lt", "gt", "quot", "nbsp", "copy", "reg", "times", "deg", "laquo", "raquo", "middot", "shy"]);
  var REFERENCE_IN_ATTR = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*)(;?)/g;
  function decodeAttr(raw) {
    return raw.replace(REFERENCE_IN_ATTR, (m, body, semi, at) => {
      if (body[0] === "#") {
        const hex = body[1] === "x" || body[1] === "X";
        const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
        const bad = !Number.isFinite(code) || code === 0 || code > 1114111 || code >= 55296 && code <= 57343;
        return bad ? "\uFFFD" : String.fromCodePoint(code);
      }
      const value = NAMED2[body];
      if (value === void 0) return m;
      if (semi) return value;
      const next = raw[at + m.length] ?? "";
      return LEGACY.has(body) && !/[A-Za-z0-9=]/.test(next) ? value : m;
    });
  }

  // src/editor/source.ts
  var VOID = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  var PRE_LIKE = /* @__PURE__ */ new Set(["pre", "textarea", "listing"]);
  var box = null;
  function decode(raw) {
    box ?? (box = document.createElement("textarea"));
    box.innerHTML = `.${raw}`;
    return box.value.slice(1);
  }
  var short = (s) => (s.length > 40 ? `${s.slice(0, 40)}\u2026` : s).replace(/\n/g, "\\n");
  function parseSource(text) {
    const tokens = tokenize(text);
    const doc2 = new DOMParser().parseFromString(text, "text/html");
    const slides = doc2.querySelector(".reveal .slides") ?? doc2.querySelector(".slides");
    if (!slides) throw new Error("the file does not have a div.slides element");
    const index = [...doc2.querySelectorAll(`${slides.localName}.slides`)].indexOf(slides);
    let seen2 = -1, at = -1;
    tokens.forEach((t, i) => {
      if (t.type === "start" && t.name === slides.localName && classesOf(t).includes("slides")) {
        seen2 += 1;
        if (seen2 === index) at = i;
      }
    });
    if (at < 0) throw new Error("the start tag of div.slides was not found in the file");
    const source = { text, crlf: text.includes("\r\n"), doc: doc2 };
    const root = { kind: "element", node: slides, tag: slides.localName, open: tokens[at], attrs: [], close: null, children: [], parent: null, source };
    source.slides = root;
    const cursor = { i: at + 1 };
    walkChildren(slides, root, cursor, tokens, text);
    const end2 = tokens[cursor.i];
    if (end2?.type === "end" && end2.name === root.tag) root.close = end2;
    return source;
  }
  function fail(text, at, what) {
    const line = text.slice(0, at).split("\n").length;
    throw new Error(`the file could not be matched to the page at line ${line}: ${what}`);
  }
  function walkChildren(el, out, cursor, tokens, text) {
    const raw = RAW_TEXT.has(el.localName);
    for (const child of el.childNodes) {
      while (tokens[cursor.i]?.type === "other" && child.nodeType !== Node.COMMENT_NODE) cursor.i += 1;
      const token = tokens[cursor.i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        const e = child;
        const tag = e.localName;
        let open = null;
        let attrs = [];
        if (token?.type === "start" && token.name === tag.toLowerCase()) {
          open = token;
          attrs = token.attrs;
          cursor.i += 1;
        }
        const node = { kind: "element", node: e, tag, open, attrs, close: null, children: [], parent: out, source: out.source };
        out.children.push(node);
        walkChildren(e, node, cursor, tokens, text);
        const after = tokens[cursor.i];
        if (after?.type === "end" && after.name === tag.toLowerCase()) {
          node.close = after;
          cursor.i += 1;
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        const data = child.data;
        if (token?.type !== "text") fail(text, token?.start ?? text.length, `the text "${short(data)}" is not in the file`);
        const rawText = text.slice(token.start, token.end);
        const decoded = raw || token.raw ? rawText.replace(/\r\n?/g, "\n") : decode(rawText);
        let lead = 0;
        if (decoded !== data) {
          const stripped = PRE_LIKE.has(el.localName) && decoded.startsWith("\n") && decoded.slice(1) === data;
          if (!stripped) fail(text, token.start, `the text "${short(data)}" reads "${short(decoded)}" in the file`);
          lead = rawText.startsWith("\r\n") ? 2 : 1;
        }
        cursor.i += 1;
        const start2 = token.start + lead;
        out.children.push({
          kind: "text",
          node: child,
          range: { start: token.start, end: token.end },
          lead,
          decoded: data,
          segments: segmentsOf(text.slice(start2, token.end), start2, raw || token.raw, data),
          pieces: null
        });
      } else if (child.nodeType === Node.COMMENT_NODE) {
        if (token?.type !== "comment" && token?.type !== "other") fail(text, token?.start ?? text.length, "a comment is not in the file");
        cursor.i += 1;
        out.children.push({ kind: "comment", node: child, range: token });
      }
    }
  }
  var REFERENCE = /&(?:#[xX][0-9a-fA-F]+;?|#[0-9]+;?|[A-Za-z][A-Za-z0-9]*;?)/y;
  function segmentsOf(raw, base, isRaw, decoded) {
    const out = [];
    const whole = [{ raw: { start: base, end: base + raw.length }, dec: { start: 0, end: decoded.length }, literal: false }];
    let i = 0, d = 0, literalStart = -1;
    const parts = [];
    const flush = (to) => {
      if (literalStart >= 0 && to > literalStart) {
        out.push({ raw: { start: base + literalStart, end: base + to }, dec: { start: d, end: d + to - literalStart }, literal: true });
        parts.push(raw.slice(literalStart, to));
        d += to - literalStart;
      }
      literalStart = -1;
    };
    while (i < raw.length) {
      const c = raw[i];
      if (c === "\r") {
        flush(i);
        const length = raw[i + 1] === "\n" ? 2 : 1;
        out.push({ raw: { start: base + i, end: base + i + length }, dec: { start: d, end: d + 1 }, literal: false });
        parts.push("\n");
        d += 1;
        i += length;
        continue;
      }
      if (c === "&" && !isRaw) {
        REFERENCE.lastIndex = i;
        const m = REFERENCE.exec(raw);
        const value = m ? decode(m[0]) : null;
        if (m && value !== null && value !== m[0]) {
          flush(i);
          out.push({ raw: { start: base + i, end: base + i + m[0].length }, dec: { start: d, end: d + value.length }, literal: false });
          parts.push(value);
          d += value.length;
          i += m[0].length;
          continue;
        }
      }
      if (literalStart < 0) literalStart = i;
      i += 1;
    }
    flush(i);
    return parts.join("") === decoded ? out : whole;
  }
  function rawRange(s, dec) {
    const at = (pos, isEnd) => {
      for (const seg of s.segments) {
        if (pos < seg.dec.start || pos > seg.dec.end) continue;
        if (seg.literal) return seg.raw.start + (pos - seg.dec.start);
        if (pos === seg.dec.start) return seg.raw.start;
        if (pos === seg.dec.end) return seg.raw.end;
        return isEnd ? seg.raw.end : seg.raw.start;
      }
      return pos <= 0 ? s.range.start + s.lead : s.range.end;
    };
    return { start: at(dec.start, false), end: at(dec.end, true) };
  }
  function elementRange(s) {
    const start2 = s.open?.start ?? firstStart(s);
    const end2 = s.close?.end ?? lastEnd(s);
    return start2 === null || end2 < start2 ? null : { start: start2, end: end2 };
  }
  function contentRange(s) {
    const start2 = s.open ? s.open.end : firstStart(s);
    if (start2 === null) return null;
    return { start: start2, end: s.close ? s.close.start : Math.max(start2, lastEnd(s)) };
  }
  function firstStart(s) {
    for (const c of s.children) {
      if (c.kind !== "element") return c.range.start;
      const r = elementRange(c);
      if (r) return r.start;
    }
    return null;
  }
  function lastEnd(s) {
    const last = s.children[s.children.length - 1];
    if (!last) return s.open?.end ?? -1;
    if (last.kind === "element") return last.close ? last.close.end : lastEnd(last);
    return last.range.end;
  }
  var isFragmentRoot = (s) => !!s.source.fragment && s.parent === s.source.slides;

  // src/editor/tags.ts
  function placeOf(order, list, name, nameOf) {
    const i = order ? order.indexOf(name) : -1;
    if (i < 0) return list.length;
    const j = list.findIndex((t) => order.indexOf(nameOf(t)) > i);
    return j < 0 ? list.length : j;
  }
  var isSpace2 = (c) => c === " " || c === "	" || c === "\n" || c === "\r" || c === "\f";
  var attr = (attrs, name) => attrs.find((a) => a.name === name) ?? null;
  var px = (n) => `${Math.round(n)}px`;
  var norm = (value) => value.trim().replace(/\s+/g, " ");
  var splitClasses = (raw) => (raw ?? "").split(/[ \t\n\r\f]+/).filter(Boolean).map((r) => ({ raw: r, name: decodeAttr(r) }));
  var rawClasses = (attrs) => splitClasses(attr(attrs, "class")?.value);
  function rawDeclarations(value) {
    const raw = value ?? "";
    const out = [];
    let start2 = 0;
    for (const m of raw.matchAll(new RegExp(`${REFERENCE_IN_ATTR.source}|;`, "g"))) {
      if (m[0] !== ";") continue;
      out.push(raw.slice(start2, m.index));
      start2 = m.index + 1;
    }
    out.push(raw.slice(start2));
    return out.map((d) => d.trim()).filter(Boolean).map((d) => {
      const decoded = decodeAttr(d);
      const colon = decoded.indexOf(":");
      return { raw: d, name: (colon < 0 ? decoded : decoded.slice(0, colon)).trim().toLowerCase(), value: colon < 0 ? "" : norm(decoded.slice(colon + 1)) };
    });
  }
  var classesIn = (attrs) => rawClasses(attrs).map((c) => c.name);
  function stepIn(attrs) {
    const value = attr(attrs, "data-fragment-index")?.value;
    const index = value === void 0 || value === null || !/^\s*-?\d+\s*$/.test(value) ? null : Number(value);
    return { fragment: classesIn(attrs).includes("fragment"), index };
  }
  function translateIn(style) {
    const m = (style ?? "").match(/(?:^|;)\s*translate\s*:\s*(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?\s*(?:;|$)/);
    return m ? { x: Number(m[1]), y: Number(m[2] ?? 0) } : null;
  }
  var translateText = (t) => `${px(t.x)} ${px(t.y)}`;
  function mergeEdit(a, b) {
    const out = { ...a, ...b };
    if (a?.attrs || b.attrs) out.attrs = { ...a?.attrs, ...b.attrs };
    if (a?.classes || b.classes) out.classes = { ...a?.classes, ...b.classes };
    if (a?.style || b.style) out.style = { ...a?.style, ...b.style };
    return out;
  }
  function stateOf(attrs, edit = {}) {
    const out = { classes: [], attrs: {}, style: {} };
    for (const a of attrs) if (!(a.name in out.attrs)) out.attrs[a.name] = a.value === null ? "" : decodeAttr(a.value);
    const classValue = edit.attrs && "class" in edit.attrs ? edit.attrs.class : out.attrs.class ?? null;
    const styleValue = edit.attrs && "style" in edit.attrs ? edit.attrs.style : out.attrs.style ?? null;
    for (const [name, value] of Object.entries(edit.attrs ?? {})) {
      if (value === null) delete out.attrs[name];
      else out.attrs[name] = value;
    }
    out.classes = splitClasses(classValue).map((c) => c.name);
    for (const [name, on] of Object.entries(classesOf2(edit))) {
      out.classes = out.classes.filter((c) => c !== name);
      if (on) out.classes.push(name);
    }
    for (const d of rawDeclarations(styleValue)) out.style[d.name] = d.value;
    for (const [name, value] of Object.entries(styleOf(edit))) {
      if (value === null) delete out.style[name];
      else out.style[name] = norm(value);
    }
    if (edit.index !== void 0) {
      if (edit.index === null) delete out.attrs["data-fragment-index"];
      else out.attrs["data-fragment-index"] = String(edit.index);
    }
    if (out.classes.length) out.attrs.class = out.classes.join(" ");
    else delete out.attrs.class;
    const decls = Object.entries(out.style);
    if (decls.length) out.attrs.style = decls.map(([k, v]) => `${k}: ${v}`).join("; ");
    else delete out.attrs.style;
    return out;
  }
  function classesOf2(edit) {
    return edit.fragment === void 0 ? { ...edit.classes } : { ...edit.classes, fragment: edit.fragment };
  }
  function styleOf(edit) {
    if (edit.translate === void 0) return { ...edit.style };
    return { ...edit.style, translate: edit.translate === null ? null : translateText(edit.translate) };
  }
  var join = (parts, by) => parts.flatMap((p, i) => i ? [{ text: by, raw: true }, ...p] : p);
  function values(attrs, edit) {
    const out = /* @__PURE__ */ new Map();
    const whole = edit.attrs ?? {};
    const classMap = classesOf2(edit);
    if ("class" in whole || Object.keys(classMap).length) {
      const before = rawClasses(attrs);
      let after = "class" in whole ? splitClasses(whole.class).map((c) => ({ ...c, fresh: true })) : before.map((c) => ({ ...c, fresh: false }));
      for (const [name, on] of Object.entries(classMap)) {
        const has = after.some((c) => c.name === name);
        if (on && !has) after.splice(placeOf(edit.order?.classes, after, name, (c) => c.name), 0, { raw: name, name, fresh: true });
        if (!on && has) after = after.filter((c) => c.name !== name);
      }
      const same = after.length === before.length && after.every((c, i) => c.name === before[i].name);
      if (!same) out.set("class", after.length ? join(after.map((c) => [{ text: c.fresh ? c.name : c.raw, raw: !c.fresh }]), " ") : null);
    }
    if (edit.index !== void 0) {
      const current = stepIn(attrs).index;
      if (edit.index !== current) out.set("data-fragment-index", edit.index === null ? null : [{ text: String(edit.index), raw: false }]);
    }
    const styleMap = { ...edit.style };
    if ("style" in whole || Object.keys(styleMap).length || edit.translate !== void 0) {
      const before = rawDeclarations(attr(attrs, "style")?.value);
      let after = "style" in whole ? rawDeclarations(whole.style).map((d) => ({ ...d, raw: d.raw, fresh: true })) : before.map((d) => ({ ...d, fresh: false }));
      for (const [name, value] of Object.entries(styleMap)) {
        const at = after.findIndex((d) => d.name === name);
        if (value === null) {
          if (at >= 0) after = after.filter((d) => d.name !== name);
          continue;
        }
        if (at >= 0 && after[at].value === norm(value)) continue;
        const decl = { raw: `${name}: ${value}`, name, value: norm(value), fresh: true };
        if (at >= 0) after = [...after.slice(0, at), decl, ...after.slice(at + 1).filter((d) => d.name !== name)];
        else after.splice(placeOf(edit.order?.style, after, name, (d) => d.name), 0, decl);
      }
      if (edit.translate !== void 0) {
        const current = translateIn(after.filter((d) => d.name === "translate").map((d) => `translate: ${d.value}`)[0] ?? "");
        const t = edit.translate;
        const same2 = current === t || !!current && !!t && px(current.x) === px(t.x) && px(current.y) === px(t.y);
        if (!same2) {
          after = after.filter((d) => d.name !== "translate");
          if (t) after.splice(placeOf(edit.order?.style, after, "translate", (d) => d.name), 0, { raw: `translate: ${translateText(t)}`, name: "translate", value: translateText(t), fresh: true });
        }
      }
      const same = after.length === before.length && after.every((d, i) => d.name === before[i].name && d.value === before[i].value);
      if (!same) out.set("style", after.length ? join(after.map((d) => [{ text: d.raw, raw: !d.fresh }]), "; ") : null);
    }
    for (const [name, value] of Object.entries(whole)) {
      if (name === "class" || name === "style" || name === "data-fragment-index" && edit.index !== void 0) continue;
      const a = attr(attrs, name);
      if (value === null) {
        if (a) out.set(name, null);
        continue;
      }
      const current = a ? a.value === null ? "" : decodeAttr(a.value) : null;
      if (current !== value) out.set(name, value === "" ? [] : [{ text: value, raw: false }]);
    }
    return out;
  }
  function quoteOf(text, a) {
    if (a.value === null) return null;
    const c = text[a.end - 1];
    return (c === '"' || c === "'") && a.end - a.start >= a.name.length + 2 ? c : null;
  }
  function written(name, parts, quote) {
    if (!parts.length) return name;
    const q = quote ?? '"';
    const other2 = q === '"' ? "&quot;" : "&#39;";
    const value = parts.map((p) => p.raw ? quote ? p.text : p.text.replace(/"/g, "&quot;") : p.text.replace(/&/g, "&amp;").split(q).join(other2)).join("");
    return `${name}=${q}${value}${q}`;
  }
  function renderTag(text, range, attrs, edit) {
    const changes = values(attrs, edit);
    if (!changes.size) return null;
    const ops = [];
    const order = edit.order?.attrs;
    const kept = attrs.filter((a) => changes.get(a.name) !== null);
    let end2 = range.end - 1;
    if (text[end2 - 1] === "/") end2--;
    while (end2 > range.start && isSpace2(text[end2 - 1])) end2--;
    for (const [name, value] of changes) {
      const a = attr(attrs, name);
      if (a && value === null) {
        let start2 = a.start;
        while (start2 > range.start && isSpace2(text[start2 - 1])) start2--;
        ops.push({ start: start2, end: a.end, text: "", rank: Infinity });
      } else if (a) {
        ops.push({ start: a.start, end: a.end, text: written(name, value, quoteOf(text, a)), rank: Infinity });
      } else if (value !== null) {
        const next = kept[placeOf(order, kept, name, (k) => k.name)];
        const rank = order?.includes(name) ? order.indexOf(name) : 2 ** 40 + ops.length;
        if (next) ops.push({ start: next.start, end: next.start, text: `${written(name, value, '"')} `, rank });
        else ops.push({ start: end2, end: end2, text: ` ${written(name, value, '"')}`, rank });
      }
    }
    ops.sort((a, b) => b.start - a.start || b.rank - a.rank);
    let tag = text.slice(range.start, range.end);
    for (const op of ops) tag = tag.slice(0, op.start - range.start) + op.text + tag.slice(op.end - range.start);
    return tag === text.slice(range.start, range.end) ? null : tag;
  }

  // src/editor/model/units.ts
  var START = /^\s*(\S+) start\b/;
  var commentText = (text, c) => text.slice(c.start + 4, Math.max(c.start + 4, c.end - 3));
  var blank = (text, c) => c.kind === "text" && !/\S/.test(text.slice(c.start, c.end));
  function unitsOf(text, children, content) {
    const units = [];
    let pos = content.start;
    let from = 0;
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c.kind !== "element") continue;
      const unit = { lead: { start: pos, end: c.start }, range: { start: c.start, end: c.end }, end: c.end, child: i };
      const opener = children.slice(from, i).reverse().find((k) => k.kind === "comment");
      const name = opener ? START.exec(commentText(text, opener))?.[1] : void 0;
      if (name) {
        let j = i + 1;
        while (j < children.length && blank(text, children[j])) j++;
        const closer = children[j];
        if (closer?.kind === "comment" && new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} end\\b`).test(commentText(text, closer))) {
          unit.end = closer.end;
          i = j;
        }
      }
      units.push(unit);
      pos = unit.end;
      from = i + 1;
    }
    return { units, tail: { start: pos, end: Math.max(pos, content.end) } };
  }
  var eolOf = (text) => text.includes("\r\n") ? "\r\n" : "\n";
  var spaceOf = (lead) => /^[ \t\r\n\f]*/.exec(lead)?.[0] ?? "";
  function indentAt(text, pos) {
    const start2 = text.lastIndexOf("\n", pos - 1) + 1;
    return /^[ \t]*/.exec(text.slice(start2, pos))?.[0] ?? "";
  }
  function placeLead(lead, space, eol) {
    const own = spaceOf(lead);
    const rest = lead.slice(own.length);
    const indent = space.slice(space.lastIndexOf("\n") + 1);
    if (own.includes("\n") && space.includes("\n") && own.slice(own.lastIndexOf("\n") + 1) === indent) return lead;
    if (!rest) return space;
    return space + rest.replace(/\r?\n[ \t]*/g, eol + indent);
  }

  // src/editor/model/templates.ts
  var LAYOUTS = ["title", "section", "content", "narrow", "wide", "figure", "split", "closing"];
  function textStyle(text) {
    let step2 = null;
    for (const m of text.matchAll(/^([ \t]+)</gm)) if (step2 === null || m[1].length < step2.length) step2 = m[1];
    return { eol: eolOf(text), step: step2 && step2.startsWith("	") ? "	" : step2 ?? "  " };
  }
  var attr2 = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  function lines(rows, style, base) {
    return rows.map(([depth, row], i) => (i ? base + style.step.repeat(depth) : "") + row).join(style.eol);
  }
  function layoutText(layout, style, base = "") {
    const block = [[1, '<div class="block">'], [2, "<h1></h1>"], [2, '<p class="sub"></p>'], [2, '<p class="who"></p>'], [1, "</div>"]];
    switch (layout) {
      case "title":
        return lines([[0, '<section class="title">'], [1, '<div class="backdrop" data-strands="brand/transfer.js" data-duration="20" data-cx="-0.84" data-cy="0" data-half="1.128"></div>'], ...block, [0, "</section>"]], style, base);
      case "closing":
        return lines([[0, '<section class="closing">'], [1, '<div class="backdrop" data-scene="tubes" data-cx="0.42" data-cy="0" data-half="0.6"></div>'], ...block, [0, "</section>"]], style, base);
      case "section":
        return lines(
          [[0, '<section class="section">'], [1, '<div class="sec">'], [2, "<h2></h2>"], [2, '<ul class="outline" data-auto></ul>'], [1, "</div>"], [1, '<div class="backdrop" data-scene="wideRibbon" data-cx="0.2" data-cy="0" data-half="1.3"></div>'], [0, "</section>"]],
          style,
          base
        );
      case "figure":
        return lines([[0, '<section class="figure">'], [1, '<div class="plate"></div>'], [1, "<h2></h2>"], [1, '<p class="caption"></p>'], [0, "</section>"]], style, base);
      case "split":
        return lines([[0, '<section class="split">'], [1, '<div class="panel">'], [2, "<h2></h2>"], [2, "<p></p>"], [1, "</div>"], [1, '<div class="zone"></div>'], [0, "</section>"]], style, base);
      default:
        return lines([[0, layout === "content" ? "<section>" : `<section class="${layout}">`], [1, "<h2></h2>"], [1, "<p></p>"], [0, "</section>"]], style, base);
    }
  }
  function elementText(kind, style, base, options = {}) {
    const o = options;
    switch (kind) {
      case "text":
        return ["<p></p>"];
      case "image":
        return [lines([[0, '<figure class="zone">'], [1, `<img src="${attr2(o.src ?? "media/image.png")}" alt="${attr2(o.alt ?? "")}">`], [0, "</figure>"]], style, base)];
      case "video": {
        const src = o.src ?? "media/video.mp4";
        const poster = o.poster ?? src.replace(/\.[^./]*$/, ".png");
        return [lines([[0, '<div class="zone">'], [1, `<video src="${attr2(src)}" poster="${attr2(poster)}" muted loop data-autoplay></video>`], [0, "</div>"]], style, base)];
      }
      case "table": {
        const columns = Math.max(1, o.columns ?? 2);
        const rows = Math.max(1, o.rows ?? 2);
        const row = (cell) => `<tr>${`<${cell}></${cell}>`.repeat(columns)}</tr>`;
        const body = Array.from({ length: rows }, (_, i) => [2, row(i ? "td" : "th")]);
        return [lines([[0, "<table>"], [1, "<tbody>"], ...body, [1, "</tbody>"], [0, "</table>"]], style, base)];
      }
      case "formula":
        return [`<div class="math">\\[${o.tex ?? "x"}\\]</div>`];
      case "code":
        return [`<pre><code class="language-${attr2(o.language ?? "python")}"></code></pre>`];
      case "qr":
        return [`<div class="qr" data-qr="${attr2(o.qr ?? "https://example.com")}"></div>`];
      case "plot": {
        const id = attr2(o.id ?? "plot-1");
        const json = [
          [0, `<script type="application/json" id="${id}">{`],
          [1, '"duration": 2,'],
          [1, '"panels": [{ "id": "main", "x": { "range": [0, 1] }, "y": { "range": [0, 1] } }],'],
          [1, '"marks": [{ "id": "line", "panel": "main", "kind": "trace" }],'],
          [1, '"tabs": [{ "name": "data", "values": [0, 1], "data": { "line": [[0, 0], [1, 1]] } }]'],
          [0, "}<\/script>"]
        ];
        return [`<div class="plot zone" data-plot="${id}"></div>`, lines(json, style, base)];
      }
      case "backdrop":
        return [`<div class="backdrop" data-scene="${attr2(o.scene ?? "nest")}" data-cx="0.97" data-cy="0" data-half="0.5"></div>`];
    }
  }

  // src/editor/render.ts
  function virtualChildren(el, math) {
    const items = [];
    let pending = null;
    const flush = () => {
      if (!pending) return;
      const text = pending.map((p) => p.kind === "text" ? p.text : p.open + p.tex + p.close).join("");
      if (text !== "") items.push({ kind: "text", text, pieces: pending });
      pending = null;
    };
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        (pending ?? (pending = [])).push({ kind: "text", text: node.data, node });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const e = node;
        const info = e.localName === "mjx-container" ? math(e) : null;
        if (info) (pending ?? (pending = [])).push({ kind: "math", node: e, ...info });
        else {
          flush();
          items.push({ kind: "element", el: e });
        }
      } else if (node.nodeType === Node.COMMENT_NODE) {
        flush();
        items.push({ kind: "comment", node });
      }
    }
    flush();
    return items;
  }
  var BLOCK_TAGS = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "th", "dt", "dd", "figcaption", "caption", "blockquote", "pre", "aside", "summary", "label"]);
  var INLINE_TAGS = /* @__PURE__ */ new Set(["a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em", "i", "img", "kbd", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr"]);
  function isBlock(s) {
    if (BLOCK_TAGS.has(s.tag)) return true;
    if (s.tag !== "div" && s.tag !== "span") return false;
    const own = s.children.some((c) => c.kind === "text" && /\S/.test(c.decoded));
    return own && s.children.every((c) => c.kind !== "element" || INLINE_TAGS.has(c.tag));
  }
  var sameTag = (el, s) => el.localName.toLowerCase() === s.tag.toLowerCase();
  var shown = (live, src) => src.includes("\xA0") ? live : live.replace(/\u00a0/g, " ");
  var short2 = (s) => (s.length > 40 ? `${s.slice(0, 40)}\u2026` : s).replace(/\n/g, "\\n");
  function pair(source, liveSlides, math) {
    const out = { blocks: [], byLive: /* @__PURE__ */ new Map(), elements: /* @__PURE__ */ new Map(), inner: /* @__PURE__ */ new Map(), sections: [], problems: [], root: liveSlides };
    out.elements.set(liveSlides, source.slides);
    pairChildren(source.slides, liveSlides, null, math, out);
    return out;
  }
  function blocksWithin(s) {
    if (isBlock(s)) return [s];
    return s.children.flatMap((c) => c.kind === "element" ? blocksWithin(c) : []);
  }
  var generated = (el) => el.hasAttribute("data-generated");
  function pairChildren(src, live, slide, math, out) {
    const items = virtualChildren(live, math);
    let j = 0;
    for (const s of src.children) {
      if (s.kind !== "element") continue;
      let k = j;
      while (k < items.length && !(items[k].kind === "element" && sameTag(items[k].el, s) && !generated(items[k].el))) k++;
      if (k === items.length) {
        for (const b of blocksWithin(s)) out.problems.push({ slide, tag: b.tag, reason: "it is not on the page" });
        continue;
      }
      j = k + 1;
      pairElement(s, items[k].el, slide, math, out);
    }
  }
  function pairElement(s, el, slide, math, out) {
    out.elements.set(el, s);
    const here = s.tag === "section" ? el : slide;
    if (s.tag === "section") out.sections.push({ src: s, live: el });
    if (isBlock(s)) {
      const reason = verify(s, el, math, out.inner);
      if (reason) out.problems.push({ slide: here, tag: s.tag, reason });
      else {
        const block = { src: s, live: el, slide: here };
        out.blocks.push(block);
        out.byLive.set(el, block);
      }
    } else pairChildren(s, el, here, math, out);
  }
  function verify(s, el, math, inner) {
    const items = virtualChildren(el, math);
    const kids = s.children;
    if (items.length !== kids.length) return `the ${s.tag} has ${kids.length} parts in the file and ${items.length} on the page`;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i], it = items[i];
      if (k.kind === "element") {
        if (it.kind !== "element" || !sameTag(it.el, k)) return `a ${k.tag} of the file is not on the page`;
        const reason = verify(k, it.el, math, inner);
        if (reason) return reason;
        inner?.set(it.el, k);
      } else if (k.kind === "text") {
        if (it.kind !== "text") return `the text "${short2(k.decoded)}" is not on the page`;
        if (shown(it.text, k.decoded) !== k.decoded) return `the text "${short2(k.decoded)}" reads "${short2(it.text)}" on the page`;
        k.pieces = piecesOf(it.pieces);
      } else if (it.kind !== "comment") return "a comment of the file is not on the page";
    }
    return null;
  }
  function piecesOf(live) {
    let d = 0;
    return live.map((p) => {
      if (p.kind === "text") {
        const piece2 = { kind: "text", dec: { start: d, end: d + p.text.length } };
        d += p.text.length;
        return piece2;
      }
      const length = p.open.length + p.tex.length + p.close.length;
      const piece = { kind: "math", dec: { start: d, end: d + length }, inner: { start: d + p.open.length, end: d + p.open.length + p.tex.length } };
      d += length;
      return piece;
    });
  }
  function innerRange(s) {
    if (!s.open) return null;
    const start2 = s.open.end;
    const end2 = s.close ? s.close.start : Math.max(start2, lastEnd(s));
    return { start: start2, end: end2 };
  }
  function escape(source, text, keepNbsp) {
    let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    s = keepNbsp ? s.replace(/ /g, "&nbsp;") : s.replace(/ /g, " ");
    return source.crlf ? s.replace(/\n/g, "\r\n") : s;
  }
  function serializeNew(source, el, math) {
    const tag = el.localName;
    const attrs = [...el.attributes].map((a) => a.value === "" ? ` ${a.name}` : ` ${a.name}="${a.value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join("");
    if (VOID.has(tag)) return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${serializeNewChildren(source, el, math)}</${tag}>`;
  }
  function serializeNewChildren(source, el, math) {
    return virtualChildren(el, math).map((it) => it.kind === "text" ? escape(source, it.text, false) : it.kind === "element" ? serializeNew(source, it.el, math) : `<!--${it.node.data}-->`).join("");
  }
  function serializeText(source, s, it) {
    const text = source.text;
    if (shown(it.text, s.decoded) === s.decoded) return text.slice(s.range.start, s.range.end);
    const keepNbsp = s.decoded.includes("\xA0");
    const lead = text.slice(s.range.start, s.range.start + s.lead);
    const live = it.pieces;
    if (s.pieces && s.pieces.length === live.length && s.pieces.every((p, i) => p.kind === live[i].kind)) {
      const parts = s.pieces.map((p, i) => {
        const lp = live[i];
        const r = rawRange(s, p.dec);
        if (p.kind === "text" || lp.kind !== "math") {
          const old2 = s.decoded.slice(p.dec.start, p.dec.end);
          const now = lp.kind === "text" ? lp.text : lp.open + lp.tex + lp.close;
          return shown(now, old2) === old2 ? text.slice(r.start, r.end) : escape(source, now, keepNbsp);
        }
        const inner = rawRange(s, p.inner);
        const old = s.decoded.slice(p.inner.start, p.inner.end);
        const tex = shown(lp.tex, old) === old ? text.slice(inner.start, inner.end) : escape(source, lp.tex, keepNbsp);
        return text.slice(r.start, inner.start) + tex + text.slice(inner.end, r.end);
      });
      return lead + parts.join("");
    }
    return lead + escape(source, it.text, keepNbsp);
  }
  function serializeChildren(source, s, el, math, tags) {
    const text = source.text;
    const items = virtualChildren(el, math);
    const kids = s.children;
    let c = 0;
    const parts = [];
    for (const it of items) {
      if (it.kind === "element") {
        let k2 = c;
        while (k2 < kids.length && !(kids[k2].kind === "element" && sameTag(it.el, kids[k2]))) k2++;
        if (k2 < kids.length) {
          c = k2 + 1;
          parts.push(serializeElement(source, kids[k2], it.el, math, tags));
        } else parts.push(serializeNew(source, it.el, math));
        continue;
      }
      let k = c;
      while (k < kids.length && kids[k].kind !== it.kind && kids[k].kind !== "element") k++;
      const hit = k < kids.length && kids[k].kind === it.kind ? kids[k] : null;
      if (hit) c = k + 1;
      if (it.kind === "text") parts.push(hit ? serializeText(source, hit, it) : escape(source, it.text, false));
      else parts.push(hit ? text.slice(hit.range.start, hit.range.end) : `<!--${it.node.data}-->`);
    }
    return parts.join("");
  }
  var RUNTIME_PREFIX = /^(beeson-|hl-|plot-)/;
  var RUNTIME_CLASSES = /* @__PURE__ */ new Set(["visible", "current-fragment", "present", "past", "future", "disabled", "enabled", "stack"]);
  var isRuntimeClass = (c) => RUNTIME_PREFIX.test(c) || RUNTIME_CLASSES.has(c);
  var LIVE_STYLE = ["translate", "rotate", "width", "font-size", "text-align"];
  var LIVE_ATTRS = ["alt", "src", "poster", "href", "muted", "loop", "colspan", "rowspan"];
  var probe = null;
  function liveEdit(s, el) {
    const file = stateOf(s.attrs);
    const edit = {};
    const live = [...el.classList].filter((c) => !isRuntimeClass(c));
    const classes = {};
    for (const c of live) if (!file.classes.includes(c)) classes[c] = true;
    for (const c of file.classes) if (!live.includes(c)) classes[c] = false;
    if (Object.keys(classes).length) edit.classes = classes;
    const style = el.style;
    if (style) {
      probe ?? (probe = document.createElement("div"));
      probe.setAttribute("style", file.attrs.style ?? "");
      const decls = {};
      for (const name of LIVE_STYLE) {
        const now = style.getPropertyValue(name);
        if (now !== probe.style.getPropertyValue(name)) decls[name] = now || null;
      }
      if (Object.keys(decls).length) edit.style = decls;
    }
    const attrs = {};
    for (const name of LIVE_ATTRS) {
      const now = el.getAttribute(name);
      if (now !== (file.attrs[name] ?? null)) attrs[name] = now;
    }
    if (Object.keys(attrs).length) edit.attrs = attrs;
    return edit;
  }
  function serializeElement(source, s, el, math, tags) {
    const text = source.text;
    let open = s.open ? text.slice(s.open.start, s.open.end) : "";
    if (s.open) open = renderTag(text, s.open, s.attrs, mergeEdit(liveEdit(s, el), tags.get(el) ?? {})) ?? open;
    const close = s.close ? text.slice(s.close.start, s.close.end) : "";
    if (VOID.has(s.tag)) return open;
    if (RAW_TEXT.has(s.tag)) {
      const inner = innerRange(s);
      return open + (inner ? text.slice(inner.start, inner.end) : "") + close;
    }
    return open + serializeChildren(source, s, el, math, tags) + close;
  }
  var detached = /* @__PURE__ */ new WeakSet();
  function kidsOf(s) {
    const out = [];
    for (const c of s.children) {
      const range = c.kind === "element" ? elementRange(c) : c.range;
      if (range) out.push({ child: { kind: c.kind, start: range.start, end: range.end }, node: c });
    }
    return out;
  }
  function unitsWithin(s) {
    const range = contentRange(s);
    if (!range) return null;
    const kids = kidsOf(s);
    const { units, tail } = unitsOf(s.source.text, kids.map((k) => k.child), range);
    return { units: units.map((u) => ({ ...u, el: kids[u.child].node })), tail };
  }
  function unitOf(s) {
    if (!s.parent) return null;
    return unitsWithin(s.parent)?.units.find((u) => u.el === s) ?? null;
  }
  function childSpace(s, eol, step2) {
    const first2 = unitsWithin(s)?.units[0];
    if (first2) return spaceOf(s.source.text.slice(first2.lead.start, first2.range.start));
    return eol + (s.open ? indentAt(s.source.text, s.open.start) : "") + step2;
  }
  var Renderer = class {
    constructor(source, pairing, math, tags) {
      this.edits = [];
      this.changed = [];
      this.warnings = [];
      this.liveOf = /* @__PURE__ */ new Map();
      this.step = null;
      this.source = source;
      this.pairing = pairing;
      this.math = math;
      this.tags = tags;
      for (const [el, s] of pairing.elements) this.liveOf.set(s, el);
      this.eol = source.crlf ? "\r\n" : "\n";
    }
    element(s, live) {
      const text = s.source.text;
      const range = elementRange(s);
      if (!range) return "";
      if (!live) return text.slice(range.start, range.end);
      const open = this.open(s, live);
      const close = s.close ? text.slice(s.close.start, s.close.end) : "";
      const inner = contentRange(s);
      const verbatim = inner ? text.slice(inner.start, inner.end) : "";
      if (VOID.has(s.tag)) return open;
      if (RAW_TEXT.has(s.tag)) return open + verbatim + close;
      const block = this.pairing.byLive.get(live);
      if (block?.src === s) {
        const content = serializeChildren(s.source, s, live, this.math, this.tags);
        if (content !== verbatim) {
          this.edits.push({ start: inner?.start ?? range.start, end: inner?.end ?? range.start, text: content });
          this.changed.push(block);
        }
        return open + content + close;
      }
      if (isBlock(s)) return open + verbatim + close;
      return open + this.content(s, live) + close;
    }
    open(s, live) {
      if (!s.open) return "";
      const raw = s.source.text.slice(s.open.start, s.open.end);
      const edit = this.tags.get(live);
      const tag = edit ? renderTag(s.source.text, s.open, s.attrs, edit) : null;
      if (tag === null) return raw;
      this.edits.push({ start: s.open.start, end: s.open.end, text: tag });
      return tag;
    }
    // a unit is left out when its element was taken off the page by the document model, moved into
    // another element, also one taken off the page, or is a block deleted on the page
    dropped(s, node) {
      if (detached.has(node) || node.parentNode) return true;
      return this.pairing.byLive.get(node)?.src === s;
    }
    // the indentation of the line of the start tag of s, and one step of the file
    indent(s) {
      return s.open ? indentAt(s.source.text, s.open.start) : "";
    }
    stepOf() {
      return this.step ?? (this.step = textStyle(this.source.text).step);
    }
    space(s) {
      return childSpace(s, this.eol, this.stepOf());
    }
    content(s, live) {
      const text = s.source.text;
      const within = unitsWithin(s);
      const units = within?.units ?? [];
      const own = new Map(units.map((u) => [u.el, u]));
      const kept = /* @__PURE__ */ new Map();
      let anchor = null;
      let changed = false;
      for (const u of units) {
        const node = this.liveOf.get(u.el);
        if (node?.parentElement === live) anchor = u.el;
        else if (node && this.dropped(u.el, node)) changed = true;
        else kept.set(anchor, [...kept.get(anchor) ?? [], u]);
      }
      const parts = [];
      const keep = (key) => {
        for (const u of kept.get(key) ?? []) parts.push(text.slice(u.lead.start, u.end));
      };
      keep(null);
      const notes = [];
      let order = -1;
      for (const c of live.children) {
        const m = this.pairing.elements.get(c);
        if (!m) {
          if (s.tag === "section" && c.matches("aside.notes") && !generated(c)) notes.push(c);
          continue;
        }
        const u = own.get(m);
        if (u) {
          if (units.indexOf(u) < order) changed = true;
          order = units.indexOf(u);
          parts.push(text.slice(u.lead.start, u.range.start) + this.element(m, c) + text.slice(u.range.end, u.end));
          keep(m);
          continue;
        }
        const home = unitOf(m);
        if (!home) continue;
        changed = true;
        const mt = m.source.text;
        const lead = mt.slice(home.lead.start, home.range.start);
        const inPlace = isFragmentRoot(m) && m.source.fragment?.home === live;
        parts.push((inPlace ? lead : placeLead(lead, this.space(s), this.eol)) + this.element(m, c) + mt.slice(home.range.end, home.end));
      }
      let tail = within ? text.slice(within.tail.start, within.tail.end) : "";
      if (!units.length && !tail && parts.length) tail = this.eol + this.indent(s);
      let out = parts.join("") + tail;
      for (const aside of notes) {
        const inner = serializeNewChildren(this.source, aside, this.math);
        if (!inner.trim()) continue;
        if (!s.close) {
          this.warnings.push("the notes of a slide without an end tag are not saved");
          continue;
        }
        out += `  <aside class="notes">${inner}</aside>${this.eol}`;
        changed = true;
      }
      const range = contentRange(s);
      if (changed && range) this.edits.push({ ...range, text: out });
      return out;
    }
  };
  function renderDeck(source, pairing, math, tags = /* @__PURE__ */ new Map()) {
    const r = new Renderer(source, pairing, math, tags);
    const range = elementRange(source.slides);
    let text = source.text;
    if (range && pairing.root) text = text.slice(0, range.start) + r.element(source.slides, pairing.root) + text.slice(range.end);
    return { text, edits: r.edits, changed: r.changed, warnings: r.warnings };
  }
  function renderUnit(pairing, math, tags, el, source) {
    const s = pairing.elements.get(el);
    if (!s) return null;
    const u = unitOf(s);
    const text = s.source.text;
    const body = new Renderer(source, pairing, math, tags).element(s, el);
    if (!u) return { lead: "", body, trail: "" };
    return { lead: text.slice(u.lead.start, u.range.start), body, trail: text.slice(u.range.end, u.end) };
  }

  // src/editor/navigator/thumbs.ts
  var CSS = `
:host { display: block; position: relative; overflow: hidden; contain: strict; }
.reveal.beeson-thumb { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; overflow: hidden; background: var(--bg); pointer-events: none; }
.reveal.beeson-thumb .slides { position: absolute; inset: 0 auto auto 0; margin: 0; transform-origin: 0 0; pointer-events: none; }
.reveal.beeson-thumb .slides > section { display: block !important; position: absolute; inset: 0; transform: none !important; }
.reveal.beeson-thumb .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
.reveal.beeson-thumb .fragment.beeson-off { visibility: hidden !important; }
.reveal.beeson-thumb:not([data-theme="light"]) .for-light, .reveal.beeson-thumb[data-theme="light"] .for-dark { display: none !important; }
.reveal.beeson-thumb[data-theme="dark"] .invert { filter: invert(1) hue-rotate(180deg); }
.reveal.beeson-thumb[data-theme="light"] .slides section.title::before, .reveal.beeson-thumb[data-theme="light"] .slides section.closing::before { background-image: url("brand/lockup-light.png"); }
.reveal.beeson-thumb:not([data-theme="light"]) .slides section.split .panel { box-shadow: 1px 0 0 var(--line); }
.reveal.beeson-thumb.no-logo .slides section::after { content: none; }
.reveal.beeson-thumb.no-lockup .slides section.title::before, .reveal.beeson-thumb.no-lockup .slides section.closing::before { content: none; }
`;
  var SVG = "http://www.w3.org/2000/svg";
  var XLINK = "http://www.w3.org/1999/xlink";
  var sheets = /* @__PURE__ */ new Map();
  var sheetOf = (text) => {
    let sheet = sheets.get(text);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      sheets.set(text, sheet);
    }
    return sheet;
  };
  function deckStyles() {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    const adopted = [...document.querySelectorAll("style")].filter((s) => !s.id.startsWith("beeson-edit-")).map((s) => sheetOf(s.textContent ?? ""));
    return { links, adopted: [...adopted, sheetOf(CSS)] };
  }
  function cloneSlide(slide, scale) {
    const clone = slide.cloneNode(true);
    clone.querySelectorAll("aside.notes").forEach((n) => n.remove());
    const from = slide.querySelectorAll("canvas");
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    clone.querySelectorAll("canvas").forEach((canvas, i) => {
      const source = from[i];
      const w = source.offsetWidth || parseFloat(source.style.width) || source.width;
      const h = source.offsetHeight || parseFloat(source.style.height) || source.height;
      canvas.width = Math.max(1, Math.round(w * scale * ratio));
      canvas.height = Math.max(1, Math.round(h * scale * ratio));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      try {
        if (source.width && source.height) canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
      } catch {
      }
    });
    clone.querySelectorAll(".backdrop .lab").forEach((l) => {
      if (!l.style.left) l.remove();
    });
    clone.querySelectorAll("tycho-viewer").forEach((v) => {
      const box2 = document.createElement("div");
      box2.className = v.className;
      box2.setAttribute("style", v.getAttribute("style") ?? "");
      v.replaceWith(box2);
    });
    clone.querySelectorAll("video").forEach((v) => {
      v.removeAttribute("autoplay");
      v.removeAttribute("data-autoplay");
      v.preload = "none";
    });
    for (const el of [clone, ...clone.querySelectorAll("*")]) {
      for (const name of ["contenteditable", "tabindex", "hidden", "aria-hidden", "role"]) el.removeAttribute(name);
      for (const c of [...el.classList]) if (isRuntimeClass(c)) el.classList.remove(c);
    }
    const layers2 = layersOf(clone);
    showLayer(clone, layers2.length > 1 ? layers2[0] : null);
    clone.classList.add("present");
    clone.style.display = "block";
    clone.style.top = "0";
    return clone;
  }
  function glyphsOf(clone) {
    const ids = /* @__PURE__ */ new Set();
    for (const use of clone.querySelectorAll("use")) {
      const href = use.getAttribute("href") ?? use.getAttributeNS(XLINK, "href") ?? "";
      if (href.startsWith("#")) ids.add(href.slice(1));
    }
    const glyphs = [...ids].map((id) => document.getElementById(id)).filter((g) => !!g && !clone.contains(g));
    if (!glyphs.length) return null;
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("style", "display: none");
    const defs = document.createElementNS(SVG, "defs");
    defs.append(...glyphs.map((g) => g.cloneNode(true)));
    svg.append(defs);
    return svg;
  }
  function drawInto(host, slide, deck, width) {
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const { links, adopted } = deckStyles();
    root.adoptedStyleSheets = adopted;
    const have = [...root.querySelectorAll("link")].map((l) => l.href).join("\n");
    if (have !== links.map((l) => l.href).join("\n")) {
      root.querySelectorAll("link").forEach((l) => l.remove());
      root.prepend(...links.map((l) => l.cloneNode(true)));
    }
    const wrap = document.createElement("div");
    wrap.className = "reveal beeson-thumb";
    const theme2 = document.documentElement.dataset.theme;
    if (theme2) wrap.dataset.theme = theme2;
    for (const c of ["no-logo", "no-lockup"]) wrap.classList.toggle(c, document.body.classList.contains(c));
    wrap.setAttribute("inert", "");
    const slides = document.createElement("div");
    slides.className = "slides";
    slides.style.cssText = `width: ${deck.width}px; height: ${deck.height}px; transform: scale(${width / deck.width});`;
    const clone = cloneSlide(slide, width / deck.width);
    slides.append(clone);
    wrap.append(slides);
    const glyphs = glyphsOf(clone);
    if (glyphs) wrap.append(glyphs);
    root.querySelector(".beeson-thumb")?.remove();
    root.append(wrap);
  }
  var QUIET = /* @__PURE__ */ new Set(["contenteditable", "tabindex", "aria-hidden", "hidden", "role", "aria-label", "data-appendix", "data-visibility"]);
  function seen(m) {
    if (m.type !== "attributes") return true;
    const el = m.target;
    const name = m.attributeName ?? "";
    if (name === "class") {
      const kept = (v) => (v ?? "").split(/\s+/).filter((c) => c && !isRuntimeClass(c)).sort().join(" ");
      return kept(m.oldValue) !== kept(el.getAttribute("class"));
    }
    if (name === "style") return el.localName !== "section";
    return !QUIET.has(name);
  }
  var DELAY = 300;
  var Thumbs = class {
    constructor(app2, scroller) {
      this.hosts = /* @__PURE__ */ new Map();
      this.dirty = /* @__PURE__ */ new Set();
      this.timers = /* @__PURE__ */ new Map();
      this.inView = /* @__PURE__ */ new Set();
      this.idle = 0;
      this.width = 0;
      this.app = app2;
      this.seenBy = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const host = e.target;
            if (e.isIntersecting) this.inView.add(host);
            else this.inView.delete(host);
          }
          this.drawDue();
        },
        { root: scroller, rootMargin: "200px 0px" }
      );
      const watch = new MutationObserver((records) => {
        const slides = /* @__PURE__ */ new Set();
        for (const m of records) {
          if (!seen(m)) continue;
          const node = m.target instanceof Element ? m.target : m.target.parentElement;
          const slide = node?.closest(".reveal .slides > section");
          if (slide) slides.add(slide);
        }
        for (const s of slides) this.soon(s);
      });
      watch.observe(app2.slides(), { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true });
    }
    // the host of each slide, kept while its slide is on the page. a new host is drawn once seen
    setHosts(next) {
      for (const [slide, host] of this.hosts) {
        if (next.get(slide) === host) continue;
        this.seenBy.unobserve(host);
        this.inView.delete(host);
        this.hosts.delete(slide);
      }
      for (const [slide, host] of next) {
        if (this.hosts.get(slide) === host) continue;
        this.hosts.set(slide, host);
        this.dirty.add(slide);
        this.seenBy.observe(host);
      }
      this.drawDue();
    }
    // the width of the thumbnails in CSS px, set after a resize of the pane
    setWidth(width) {
      if (Math.abs(width - this.width) < 0.5) return;
      this.width = width;
      for (const s of this.hosts.keys()) this.dirty.add(s);
      this.drawDue();
    }
    // the slide is drawn again 300 ms after its last change
    soon(slide) {
      clearTimeout(this.timers.get(slide));
      this.timers.set(
        slide,
        window.setTimeout(() => {
          this.timers.delete(slide);
          this.dirty.add(slide);
          this.drawDue();
        }, DELAY)
      );
    }
    // every slide drawn again soon, e.g. after the mode of the slides was flipped
    all() {
      for (const s of this.hosts.keys()) this.soon(s);
    }
    deck() {
      const s = this.app.slides();
      return { width: s.offsetWidth || 1920, height: s.offsetHeight || 1080 };
    }
    draw(slide) {
      const host = this.hosts.get(slide);
      this.dirty.delete(slide);
      if (!host || !this.width || !slide.isConnected) return;
      drawInto(host, slide, this.deck(), this.width);
      host.dataset.drawn = String(Number(host.dataset.drawn ?? 0) + 1);
    }
    drawDue() {
      if (!this.width) return;
      for (const [slide, host] of this.hosts) if (this.dirty.has(slide) && this.inView.has(host)) this.draw(slide);
      if (this.idle || ![...this.dirty].some((s) => this.hosts.has(s))) return;
      const later = (fn) => typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 16);
      const step2 = () => {
        this.idle = 0;
        const next = [...this.hosts.keys()].find((s) => this.dirty.has(s));
        if (!next) return;
        this.draw(next);
        this.idle = later(step2);
      };
      this.idle = later(step2);
    }
  };
  function install2(app2) {
    const nav2 = app2.nav;
    const thumbs = new Thumbs(app2, nav2.list);
    nav2.useThumbs(thumbs);
    new MutationObserver(() => thumbs.all()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  // src/editor/navigator/navigator.ts
  var KEY = "beeson-nav";
  var LAYOUTS2 = ["title", "section", "closing", "figure", "split"];
  var PEEK_WIDTH = 320;
  var PEEK_DELAY = 300;
  var DRAG_START = 4;
  var SCROLL_BAND = 28;
  function describe(slide) {
    const heading = [...slide.querySelectorAll("h1, h2, h3, p, .caption")].find((h) => !h.closest("aside.notes, .backdrop") && (h.textContent ?? "").trim());
    const title = (heading?.textContent ?? "").replace(/\s+/g, " ").trim() || "Untitled slide";
    const kind = LAYOUTS2.find((c) => slide.classList.contains(c)) ?? "content";
    return { title, kind };
  }
  var isHidden = (slide) => slide.getAttribute("data-visibility") === "hidden";
  var hasSteps = (slide) => [...slide.querySelectorAll(".fragment")].some((f) => !f.closest("aside.notes"));
  function numbers(slides, written2) {
    let n = 0;
    let a = 0;
    let appendix = false;
    return slides.map((s) => {
      let label2 = "";
      if (isHidden(s)) label2 = "";
      else if (appendix) label2 = `A${++a}`;
      else if (!s.matches(".title, .section, .closing") && written2(s) !== "uncounted") label2 = String(++n);
      if (s.classList.contains("closing")) appendix = true;
      return label2;
    });
  }
  var CSS2 = `
.beeson-edit-nav { --nav-bg: var(--ed-panel, #f4f4f6); --nav-text: var(--ed-text, #1d1d1f); --nav-muted: var(--ed-muted, #86868b); --nav-line: var(--ed-line, #d2d2d7); --nav-select: var(--ed-select, #7a5af8); --nav-current: rgba(0, 0, 0, 0.07); --nav-shadow: 0 1px 3px rgba(0, 0, 0, 0.22); }
@media (prefers-color-scheme: dark) {
  .beeson-edit-nav { --nav-bg: var(--ed-panel, #232326); --nav-text: var(--ed-text, #f2f2f7); --nav-muted: var(--ed-muted, #98989d); --nav-line: var(--ed-line, #3a3a3c); --nav-select: var(--ed-select, #9b82ff); --nav-current: rgba(255, 255, 255, 0.09); --nav-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); }
}
.beeson-edit-nav { position: fixed; left: 0; top: 44px; bottom: 36px; z-index: 50; width: 240px; box-sizing: border-box; display: none; flex-direction: column; background: var(--nav-bg); border-right: 1px solid var(--nav-line); color: var(--nav-text); font: 12px/1.3 system-ui, sans-serif; }
html.beeson-nav .beeson-edit-nav { display: flex; }
.beeson-edit-nav .rows { position: relative; flex: 1; overflow: auto; padding: 10px 10px 40px 4px; outline: none; }
.beeson-edit-nav .row { position: relative; display: grid; grid-template-columns: 24px 1fr; column-gap: 6px; align-items: end; width: 100%; box-sizing: border-box; margin: 0 0 8px; padding: 5px 6px 5px 0; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: default; touch-action: none; }
.beeson-edit-nav .row:focus-visible { outline: none; }
.beeson-edit-nav .row[aria-current="true"] { background: var(--nav-current); }
.beeson-edit-nav .row .no { color: var(--nav-muted); text-align: right; font-variant-numeric: tabular-nums; line-height: 1; padding-bottom: 1px; }
.beeson-edit-nav .row .frame { position: relative; border-radius: 5px; box-shadow: var(--nav-shadow); outline: 1px solid var(--nav-line); outline-offset: 0; }
.beeson-edit-nav .row .pic { aspect-ratio: 16 / 9; border-radius: 5px; background: var(--bg, #000); }
.beeson-edit-nav .row[aria-selected="true"] .frame { outline: 3px solid var(--nav-select); outline-offset: 2px; }
.beeson-edit-nav .rows:focus-within .row[aria-selected="true"] .no { color: var(--nav-select); font-weight: 600; }
.beeson-edit-nav .row .dots { position: absolute; left: 6px; bottom: 5px; display: flex; gap: 3px; pointer-events: none; }
.beeson-edit-nav .row .dots[hidden] { display: none; }
.beeson-edit-nav .row .dots i { width: 5px; height: 5px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45); }
.beeson-edit-nav .row.skip { align-items: center; padding-top: 2px; padding-bottom: 2px; }
.beeson-edit-nav .row.skip .frame { height: 5px; box-shadow: none; outline: 0; border-top: 1px solid var(--nav-muted); border-bottom: 1px solid var(--nav-muted); border-radius: 0; }
.beeson-edit-nav .row.skip .pic, .beeson-edit-nav .row.skip .dots { display: none; }
.beeson-edit-nav .row.skip[aria-selected="true"] .frame { outline: 0; border-color: var(--nav-select); }
.beeson-edit-nav .row.dragged { opacity: 0.35; }
.beeson-edit-nav .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.beeson-edit-nav .drop { position: absolute; left: 22px; right: 10px; height: 3px; margin-top: -1.5px; border-radius: 2px; background: var(--nav-select); pointer-events: none; }
.beeson-edit-nav .drop::before { content: ""; position: absolute; left: -7px; top: -3.5px; width: 6px; height: 6px; border: 2px solid var(--nav-select); border-radius: 50%; background: var(--nav-bg); }
.beeson-edit-nav .drop[hidden] { display: none; }
.beeson-edit-ghost { position: fixed; z-index: 70; pointer-events: none; border-radius: 6px; overflow: visible; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35); transform: rotate(-1.5deg); opacity: 0.95; }
.beeson-edit-ghost .pic { border-radius: 6px; aspect-ratio: 16 / 9; background: var(--bg, #000); }
.beeson-edit-ghost .count { position: absolute; right: -8px; top: -8px; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 10px; background: var(--ed-select, #7a5af8); color: #fff; font: 600 12px/20px system-ui, sans-serif; text-align: center; }
.beeson-edit-peek { position: fixed; left: 248px; z-index: 57; width: 320px; overflow: hidden; border-radius: 6px; outline: 1px solid var(--line, #555); background: var(--bg, #000); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); pointer-events: none; }
.beeson-edit-peek[hidden] { display: none; }
.beeson-edit-peek .reveal { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; overflow: hidden; }
.beeson-edit-peek .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
.beeson-edit-peek .fragment.beeson-off { visibility: hidden !important; }
`;
  function droppedOrder(list, moved, gap) {
    const set = new Set(moved);
    const rest = list.filter((s) => !set.has(s));
    const at = gap - list.slice(0, gap).filter((s) => set.has(s)).length;
    return [...rest.slice(0, at), ...list.filter((s) => set.has(s)), ...rest.slice(at)];
  }
  var Navigator = class {
    constructor(app2) {
      this.pane = document.createElement("div");
      this.button = document.createElement("button");
      this.list = document.createElement("div");
      this.peek = document.createElement("div");
      this.drop = document.createElement("div");
      this.rows = /* @__PURE__ */ new Map();
      this.thumbs = null;
      this.on = true;
      this.timer = 0;
      this.anchor = null;
      this.drag = null;
      this.eatClick = false;
      injectStyle("nav", CSS2);
      this.app = app2;
      this.pane.className = "beeson-edit-nav";
      this.pane.setAttribute("aria-label", "Slides");
      this.button.textContent = "Slides";
      this.button.title = "Show the navigator of the slides at the left";
      this.list.className = "rows";
      this.list.setAttribute("role", "listbox");
      this.list.setAttribute("aria-label", "Slides");
      this.list.setAttribute("aria-multiselectable", "true");
      this.list.dataset.context = "navigator";
      this.drop.className = "drop";
      this.drop.hidden = true;
      this.list.append(this.drop);
      this.peek.className = "beeson-edit-peek";
      this.peek.hidden = true;
      this.peek.setAttribute("aria-hidden", "true");
      this.peek.setAttribute("inert", "");
      this.pane.append(this.list, this.peek);
      this.button.addEventListener("click", () => this.toggle());
      this.list.addEventListener("keydown", (ev) => this.onKey(ev));
      this.list.addEventListener("pointerdown", (ev) => this.onDown(ev));
      this.list.addEventListener("pointermove", (ev) => this.onMove(ev));
      this.list.addEventListener("pointerup", (ev) => this.onUp(ev));
      this.list.addEventListener("pointercancel", () => this.endDrag(false));
      this.list.addEventListener("lostpointercapture", () => this.endDrag(false));
      this.list.addEventListener("focusin", () => {
        if (this.app.selection && this.app.selection.kind !== "slides") this.selectOnly(this.app.current());
      });
      new ResizeObserver(() => this.measure()).observe(this.list);
      this.on = stored(KEY) !== "0";
      this.show(this.on);
    }
    get shown() {
      return this.on;
    }
    useThumbs(thumbs) {
      this.thumbs = thumbs;
      this.thumbs.setHosts(new Map([...this.rows].map(([s, r]) => [s, r.pic])));
      this.measure();
    }
    toggle() {
      this.show(!this.on);
      store(KEY, this.on ? "1" : "0");
      this.app.relayout();
      this.refresh();
    }
    show(on) {
      this.on = on;
      if (!on) this.hidePeek();
      document.documentElement.classList.toggle("beeson-nav", on);
      this.button.classList.toggle("on", on);
      this.button.setAttribute("aria-pressed", String(on));
    }
    slides() {
      return [...this.app.slides().querySelectorAll(":scope > section")];
    }
    // the selected slides in the order of the deck, or the current slide when no slide is selected
    selected() {
      const sel = this.app.selection;
      if (sel?.kind === "slides") {
        const items = sel.items.filter((s) => s.isConnected && s.parentElement === this.app.slides());
        if (items.length) return items;
      }
      const current = this.app.current();
      return current ? [current] : [];
    }
    // the slides set as the selection, the anchor of a range, and the slide shown
    select(slides, current = slides.at(-1) ?? null, anchor = current) {
      this.app.selection.set("slides", slides);
      this.anchor = anchor;
      if (current) this.app.showSlide(current);
      this.refresh();
    }
    selectOnly(slide) {
      if (slide) this.select([slide], slide);
    }
    // the row of slide gets the focus, e.g. after a command run in the navigator
    focus(slide = this.app.current()) {
      const row = slide ? this.rows.get(slide) : null;
      row?.el.focus({ preventScroll: true });
      row?.el.scrollIntoView({ block: "nearest" });
    }
    // the row and the thumbnail of slide, e.g. as the place of the gallery of a new slide
    rowOf(slide) {
      return slide && this.rows.get(slide)?.el || null;
    }
    written(slide) {
      const s = this.app.pairing?.elements.get(slide);
      return s?.attrs.find((a) => a.name === "data-visibility")?.value ?? null;
    }
    makeRow(slide) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "row";
      el.setAttribute("role", "option");
      el.dataset.context = "slide";
      const no = document.createElement("span");
      no.className = "no";
      no.setAttribute("aria-hidden", "true");
      const frame = document.createElement("span");
      frame.className = "frame";
      const pic = document.createElement("span");
      pic.className = "pic";
      pic.style.display = "block";
      const dots = document.createElement("span");
      dots.className = "dots";
      dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
      frame.append(pic, dots);
      const sr = (cls) => {
        const s = document.createElement("span");
        s.className = `${cls} sr`;
        return s;
      };
      const num = sr("num");
      const title = sr("title");
      const kind = sr("kind");
      el.append(no, frame, num, title, kind);
      el.addEventListener("click", (ev) => this.onClick(slide, ev));
      el.addEventListener("contextmenu", () => {
        if (!this.selected().includes(slide)) this.selectOnly(slide);
      });
      el.addEventListener("pointerenter", () => {
        this.hidePeek();
        if (!this.drag) this.timer = window.setTimeout(() => this.showPeek(slide, el), PEEK_DELAY);
      });
      el.addEventListener("pointerleave", () => this.hidePeek());
      return { el, no, pic, dots, num, title, kind };
    }
    // the rows follow the slides of the deck, their numbers, titles, steps, and hidden state, and
    // the selection. a row is kept with its thumbnail while its slide is on the page
    refresh() {
      const slides = this.slides();
      const nums = numbers(slides, (s) => this.written(s));
      const kept = new Set(slides);
      for (const [s, r] of this.rows) {
        if (kept.has(s)) continue;
        r.el.remove();
        this.rows.delete(s);
      }
      let changed = false;
      let prev = this.drop;
      slides.forEach((slide, i) => {
        let row = this.rows.get(slide);
        if (!row) {
          row = this.makeRow(slide);
          this.rows.set(slide, row);
          changed = true;
        }
        if (prev.nextSibling !== row.el) {
          prev.after(row.el);
          changed = true;
        }
        prev = row.el;
        const { title, kind } = describe(slide);
        const hidden = isHidden(slide);
        const steps2 = hasSteps(slide);
        if (row.no.textContent !== nums[i]) row.no.textContent = nums[i];
        if (row.num.textContent !== String(i + 1)) row.num.textContent = String(i + 1);
        if (row.title.textContent !== title) row.title.textContent = title;
        if (row.kind.textContent !== kind) row.kind.textContent = kind;
        row.el.classList.toggle("skip", hidden);
        row.dots.hidden = !steps2;
        const label2 = `Slide ${i + 1}${nums[i] && nums[i] !== String(i + 1) ? `, numbered ${nums[i]}` : ""}: ${title}${hidden ? ", hidden" : ""}${steps2 ? ", with steps" : ""}`;
        if (row.el.getAttribute("aria-label") !== label2) row.el.setAttribute("aria-label", label2);
        row.el.title = `Slide ${i + 1}: ${title}`;
      });
      if (changed && this.thumbs) this.thumbs.setHosts(new Map([...this.rows].map(([s, r]) => [s, r.pic])));
      this.paint();
    }
    // the current row and the selected rows are marked, the current row is kept in view, and the
    // focus follows the current slide while it is in the list
    paint() {
      const current = this.app.current();
      const sel = this.app.selection?.kind === "slides" ? new Set(this.selected()) : new Set(current ? [current] : []);
      const focusIn = this.list.contains(document.activeElement);
      for (const [slide, row] of this.rows) {
        const here = slide === current;
        row.el.setAttribute("aria-current", here ? "true" : "false");
        row.el.setAttribute("aria-selected", sel.has(slide) ? "true" : "false");
        row.el.tabIndex = here ? 0 : -1;
        if (here && !this.drag) {
          if (this.on) row.el.scrollIntoView({ block: "nearest" });
          if (focusIn && document.activeElement !== row.el) row.el.focus({ preventScroll: true });
        }
      }
      if (!current && this.rows.size) [...this.rows.values()][0].el.tabIndex = 0;
    }
    measure() {
      const first2 = this.rows.values().next().value;
      const width = first2 && !first2.el.classList.contains("skip") ? first2.pic.getBoundingClientRect().width : this.list.clientWidth - 44;
      if (width > 0) this.thumbs?.setWidth(width);
    }
    onClick(slide, ev) {
      this.hidePeek();
      if (this.eatClick) {
        this.eatClick = false;
        return;
      }
      const list = this.slides();
      const mod = this.app.platform === "mac" ? ev.metaKey : ev.ctrlKey;
      if (ev.shiftKey) {
        const anchor = this.anchor && list.includes(this.anchor) ? this.anchor : this.selected()[0] ?? slide;
        const [a, b] = [list.indexOf(anchor), list.indexOf(slide)].sort((x, y) => x - y);
        this.select(list.slice(a, b + 1), slide, anchor);
      } else if (mod) {
        const now = this.app.selection.kind === "slides" ? this.selected() : [];
        if (now.includes(slide) && now.length > 1) {
          const rest = now.filter((s) => s !== slide);
          this.select(rest, slide === this.app.current() ? rest.at(-1) : this.app.current(), this.anchor);
        } else this.select([...now, slide], slide);
      } else this.selectOnly(slide);
      this.focus(this.app.current());
    }
    // the arrows move to the previous or next slide, with Shift the selection is extended, and Home
    // and End move to the first and the last slide. a key taken by the dispatch of the registry is
    // left alone
    onKey(ev) {
      if (ev.defaultPrevented || ev.altKey || ev.metaKey || ev.ctrlKey) return;
      if (this.drag && ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        this.endDrag(false);
        return;
      }
      const slides = this.slides();
      const at = slides.indexOf(this.app.current());
      const to = { ArrowUp: at - 1, ArrowDown: at + 1, Home: 0, End: slides.length - 1 };
      const i = to[ev.key];
      if (i === void 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (i < 0 || i >= slides.length) return;
      if (ev.shiftKey) {
        const anchor = this.anchor && slides.includes(this.anchor) ? this.anchor : slides[at];
        const [a, b] = [slides.indexOf(anchor), i].sort((x, y) => x - y);
        this.select(slides.slice(a, b + 1), slides[i], anchor);
      } else this.selectOnly(slides[i]);
      this.focus(slides[i]);
    }
    rowAt(target) {
      const el = target instanceof Element ? target.closest(".row") : null;
      for (const entry of this.rows) if (entry[1].el === el) return entry;
      return null;
    }
    onDown(ev) {
      if (ev.button !== 0 || this.app.platform === "mac" && ev.ctrlKey) return;
      const hit = this.rowAt(ev.target);
      if (!hit) return;
      this.drag = { slide: hit[0], x: ev.clientX, y: ev.clientY, id: ev.pointerId, on: false, slides: [], gap: -1, ghost: null, scroll: 0 };
    }
    onMove(ev) {
      const d = this.drag;
      if (!d || ev.pointerId !== d.id) return;
      if (!d.on) {
        if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < DRAG_START) return;
        this.startDrag(d);
      }
      this.placeGhost(ev.clientX, ev.clientY);
      this.placeDrop(ev.clientY);
      const box2 = this.list.getBoundingClientRect();
      d.scroll = ev.clientY < box2.top + SCROLL_BAND ? -1 : ev.clientY > box2.bottom - SCROLL_BAND ? 1 : 0;
      if (d.scroll) this.autoScroll(ev.clientY);
    }
    startDrag(d) {
      this.hidePeek();
      d.on = true;
      if (!this.selected().includes(d.slide) || this.app.selection.kind !== "slides") this.selectOnly(d.slide);
      d.slides = this.selected();
      try {
        this.list.setPointerCapture(d.id);
      } catch {
      }
      for (const s of d.slides) this.rows.get(s)?.el.classList.add("dragged");
      const row = this.rows.get(d.slide);
      const ghost = document.createElement("div");
      ghost.className = "beeson-edit-ghost";
      const width = row?.pic.getBoundingClientRect().width || 150;
      ghost.style.width = `${width}px`;
      const pic = document.createElement("div");
      pic.className = "pic";
      ghost.append(pic);
      if (d.slides.length > 1) {
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = String(d.slides.length);
        ghost.append(count);
      }
      document.body.append(ghost);
      d.ghost = ghost;
      const stage = this.app.slides();
      drawInto(pic, d.slide, { width: stage.offsetWidth || 1920, height: stage.offsetHeight || 1080 }, width);
    }
    placeGhost(x, y) {
      const g = this.drag?.ghost;
      if (!g) return;
      g.style.left = `${x + 14}px`;
      g.style.top = `${y - 18}px`;
    }
    // the gap nearest to y, between two rows, and the line drawn in it
    placeDrop(y) {
      const d = this.drag;
      if (!d) return;
      const rows = this.slides().map((s) => this.rows.get(s).el);
      let gap = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          gap = i;
          break;
        }
      }
      d.gap = gap;
      const box2 = this.list.getBoundingClientRect();
      const before = rows[gap - 1]?.getBoundingClientRect();
      const after = rows[gap]?.getBoundingClientRect();
      const at = before && after ? (before.bottom + after.top) / 2 : after ? after.top - 2 : before ? before.bottom + 2 : box2.top;
      this.drop.style.top = `${at - box2.top + this.list.scrollTop}px`;
      this.drop.hidden = false;
    }
    autoScroll(y) {
      const d = this.drag;
      if (!d || !d.scroll) return;
      this.list.scrollTop += d.scroll * 8;
      this.placeDrop(y);
      requestAnimationFrame(() => {
        if (this.drag === d && d.scroll) this.autoScroll(y);
      });
    }
    onUp(ev) {
      const d = this.drag;
      if (!d || ev.pointerId !== d.id) return;
      if (d.on) this.placeDrop(ev.clientY);
      this.endDrag(d.on);
    }
    // a drop moves the slides of the drag to its gap through the command slide.moveTo, as one entry
    endDrag(dropped) {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      this.drop.hidden = true;
      d.ghost?.remove();
      for (const r of this.rows.values()) r.el.classList.remove("dragged");
      if (!d.on) return;
      this.eatClick = true;
      setTimeout(() => this.eatClick = false, 0);
      if (!dropped || d.gap < 0) return;
      const list = this.slides();
      const order = droppedOrder(list, d.slides, d.gap);
      if (order.every((s, i) => s === list[i])) return;
      const arg = { slides: d.slides, gap: d.gap };
      void this.app.commands.run("slide.moveTo", arg).catch((e) => this.app.fail(e));
    }
    hidePeek() {
      clearTimeout(this.timer);
      this.peek.hidden = true;
      this.peek.replaceChildren();
    }
    // a clone of the slide, scaled into the preview from its upper left, with every step shown. the
    // canvases of a backdrop are painted from the originals, since a cloned canvas is blank, and a
    // tycho viewer is left out, since its clone would start a second renderer
    showPeek(slide, row) {
      if (this.drag || isHidden(slide)) return;
      const stage = slide.parentElement;
      const width = stage.offsetWidth || 1920;
      const height = stage.offsetHeight || 1080;
      const clone = slide.cloneNode(true);
      const from = slide.querySelectorAll("canvas");
      clone.querySelectorAll("canvas").forEach((canvas, i) => {
        try {
          canvas.getContext("2d")?.drawImage(from[i], 0, 0);
        } catch {
        }
      });
      clone.querySelectorAll("aside.notes").forEach((n) => n.remove());
      clone.querySelectorAll(".backdrop .lab").forEach((l) => {
        if (!l.style.left) l.remove();
      });
      clone.querySelectorAll("tycho-viewer").forEach((v) => {
        const box2 = document.createElement("div");
        box2.className = v.className;
        box2.setAttribute("style", v.getAttribute("style") ?? "");
        v.replaceWith(box2);
      });
      clone.querySelectorAll("video").forEach((v) => {
        v.removeAttribute("autoplay");
        v.preload = "none";
      });
      for (const el of [clone, ...clone.querySelectorAll("*")]) {
        for (const name of ["id", "contenteditable", "tabindex", "hidden", "aria-hidden"]) el.removeAttribute(name);
        el.classList.remove("beeson-hover", "beeson-overflow", "current-fragment", "past", "future");
        if (el.classList.contains("fragment")) el.classList.add("visible");
      }
      const layers2 = layersOf(clone);
      showLayer(clone, layers2.length > 1 ? layers2[0] : null);
      clone.classList.add("present");
      clone.style.display = "block";
      const deck = document.createElement("div");
      deck.className = "reveal beeson-peek";
      const slides = document.createElement("div");
      slides.className = "slides";
      slides.style.cssText = `inset: 0 auto auto 0; margin: 0; width: ${width}px; height: ${height}px; transform: scale(${PEEK_WIDTH / width}); transform-origin: 0 0;`;
      slides.append(clone);
      deck.append(slides);
      const peekHeight = PEEK_WIDTH * height / width;
      const top = Math.max(52, Math.min(row.getBoundingClientRect().top, innerHeight - 44 - peekHeight));
      this.peek.style.left = `${this.pane.getBoundingClientRect().right + 8}px`;
      this.peek.style.top = `${top}px`;
      this.peek.style.height = `${peekHeight}px`;
      this.peek.replaceChildren(deck);
      this.peek.hidden = false;
    }
  };
  function install3(app2) {
    const nav2 = app2.nav;
    app2.selection.listen(() => nav2.refresh());
    app2.listen("slide", () => {
      const current = app2.current();
      if (current && app2.selection.kind === "slides" && !app2.selection.items.includes(current)) nav2.select([current], current);
    });
    document.addEventListener(
      "pointerdown",
      (ev) => {
        const target = ev.target instanceof Element ? ev.target : null;
        const active = document.activeElement;
        if (target?.closest(".reveal") && active instanceof HTMLElement && nav2.pane.contains(active)) active.blur();
      },
      true
    );
  }

  // src/editor/steps.ts
  var CANDIDATES = "h1, h2, h3, p, li, table, pre, blockquote, div.math, figure, .zone, .plate, .qr, tycho-viewer, .caption, .foot, img, video";
  var WITH_SLIDE = "h1, h2, h3, .foot";
  var OUTSIDE = "aside.notes, .backdrop";
  function candidates(slide, pairing) {
    return [...slide.querySelectorAll(CANDIDATES)].filter((el) => {
      if (!pairing.elements.get(el)?.open) return false;
      const up = el.parentElement?.closest(`${CANDIDATES}, ${OUTSIDE}, section`);
      return !up || up === slide;
    });
  }
  function stepOf(el, pairing, edits) {
    const base = stepIn(pairing.elements.get(el)?.attrs ?? []);
    const e = edits.get(el);
    return { fragment: e?.fragment ?? base.fragment, index: e?.index !== void 0 ? e.index : base.index };
  }
  function groupsOf(els, pairing, edits) {
    const steps2 = els.map((el) => ({ el, ...stepOf(el, pairing, edits) })).filter((s) => s.fragment);
    const groups = [];
    let last = null;
    for (const s of steps2.filter((s2) => s2.index !== null).sort((a, b) => a.index - b.index)) {
      if (s.index !== last) {
        groups.push([]);
        last = s.index;
      }
      groups[groups.length - 1].push(s.el);
    }
    for (const s of steps2) if (s.index === null) groups.push([s.el]);
    return groups;
  }
  var KINDS = [["h1, h2, h3", "Heading"], [".foot", "Footnote"], ["li", "Item"], ["p", "Paragraph"], ["div.math", "Formula"], ["table", "Table"], ["pre", "Code"], ["blockquote", "Quotation"], ["video", "Video"], ["tycho-viewer", "Scene"], [".qr", "QR code"], [".caption", "Caption"], ["img, figure, .zone, .plate", "Figure"]];
  function textOf(el, tex) {
    let out = "";
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out += child.nodeValue ?? "";
      else if (child instanceof Element) out += child.localName === "mjx-container" ? tex(child) ?? "" : textOf(child, tex);
    }
    return out;
  }
  function describe2(el, tex) {
    const kind = KINDS.find(([selector]) => el.matches(selector))?.[1] ?? el.localName;
    const media = el.matches("img, video") ? el : el.querySelector("img, video");
    let text = textOf(el, tex).replace(/\s+/g, " ").trim();
    if (!text && media) text = media.getAttribute("alt") || (media.getAttribute("src") ?? media.querySelector("source")?.getAttribute("src") ?? "").split("/").pop() || "";
    if (!text && el.matches("tycho-viewer")) text = el.getAttribute("src")?.split("/").pop() ?? "";
    return { kind, text: text.length > 60 ? `${text.slice(0, 60)}\u2026` : text };
  }
  var CSS3 = `
.beeson-edit-side { position: fixed; right: 0; top: 44px; bottom: 36px; z-index: 50; width: 320px; box-sizing: border-box; display: none; flex-direction: column; background: var(--bg, #000); border-left: 1px solid var(--line, #555); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; }
html.beeson-steps .beeson-edit-side { display: flex; }
.beeson-edit-side .head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-side .head span { flex: 1; font-weight: 600; }
.beeson-edit-side .head button, .beeson-edit-side select { font: inherit; font-size: 12px; padding: 2px 8px; border: 1px solid var(--line, #555); border-radius: 6px; background: var(--bg, #000); color: var(--text, #eee); cursor: pointer; }
.beeson-edit-side .head button:hover { border-color: var(--subtle, #bbb); }
.beeson-edit-side .rows { flex: 1; overflow: auto; padding: 6px 0; }
.beeson-edit-side .row { display: grid; grid-template-columns: auto auto 1fr; align-items: center; gap: 8px; padding: 5px 12px; cursor: default; }
.beeson-edit-side .row:hover { background: color-mix(in srgb, var(--violet, #96f) 18%, transparent); }
.beeson-edit-side .row .kind { color: var(--subtle, #bbb); white-space: nowrap; }
.beeson-edit-side .row .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-side .empty, .beeson-edit-side .foot { margin: 0; padding: 10px 12px; color: var(--subtle, #bbb); font-size: 12px; }
.beeson-edit-side .foot { border-top: 1px solid var(--line, #555); }
.beeson-badges { position: fixed; inset: 0; z-index: 52; pointer-events: none; }
.beeson-badge { position: absolute; transform: translate(-50%, -50%); min-width: 22px; height: 22px; padding: 0 5px; box-sizing: border-box; border-radius: 11px; background: var(--accent, #f80); color: #000; font: 600 13px/22px system-ui, sans-serif; text-align: center; }
html.beeson-editing .reveal .beeson-hover { outline: 2px solid var(--accent, #f80) !important; outline-offset: 6px; }
`;
  var Steps = class {
    constructor(ctx) {
      this.pane = document.createElement("div");
      this.badges = document.createElement("div");
      this.button = document.createElement("button");
      this.list = document.createElement("div");
      this.on = false;
      // what the rows show, so that they are built again only when it changes, since a select that
      // is being opened would be lost
      this.key = "";
      injectStyle("steps", CSS3);
      this.ctx = ctx;
      this.pane.className = "beeson-edit-side";
      this.badges.className = "beeson-badges";
      this.button.textContent = "Steps";
      this.button.title = "Show the order in which the elements of the slide appear";
      this.button.setAttribute("aria-pressed", "false");
      const head = document.createElement("div");
      head.className = "head";
      const title = document.createElement("span");
      title.textContent = "Steps";
      const each = document.createElement("button");
      each.textContent = "One by one";
      each.title = "Show every element of the slide in a step of its own, in reading order";
      const none = document.createElement("button");
      none.textContent = "All at once";
      none.title = "Show every element with the slide";
      each.addEventListener("click", () => this.setAll(true));
      none.addEventListener("click", () => this.setAll(false));
      head.append(title, each, none);
      this.list.className = "rows";
      const foot = document.createElement("p");
      foot.className = "foot";
      foot.textContent = "Elements with the same step appear together. A step is a reveal.js fragment in the file.";
      this.pane.append(head, this.list, foot);
      this.button.addEventListener("click", () => this.toggle());
    }
    toggle() {
      this.on = document.documentElement.classList.toggle("beeson-steps");
      this.button.classList.toggle("on", this.on);
      this.button.setAttribute("aria-pressed", String(this.on));
      this.ctx.layout();
      this.refresh();
    }
    get shown() {
      return this.on;
    }
    // the numbers on the slide follow its layout, and the rows are built again when the slide or
    // its steps change
    refresh() {
      this.badges.replaceChildren();
      const pairing = this.ctx.pairing();
      const slide = this.ctx.slide();
      if (!this.on || !pairing || !slide) {
        this.key = "";
        this.list.replaceChildren();
        return;
      }
      const els = candidates(slide, pairing);
      const groups = groupsOf(els, pairing, this.ctx.edits);
      const stepOf2 = (el) => groups.findIndex((g) => g.includes(el));
      for (const el of els) {
        const at = stepOf2(el);
        if (at < 0 || el.closest(`.${OFF}`)) continue;
        const rect = el.getBoundingClientRect();
        const badge = document.createElement("span");
        badge.className = "beeson-badge";
        badge.textContent = String(at + 1);
        badge.style.left = `${rect.left}px`;
        badge.style.top = `${rect.top}px`;
        this.badges.append(badge);
      }
      const described = els.map((el) => describe2(el, this.ctx.tex));
      const rows = els.map((el, i) => `${stepOf2(el)}|${described[i].kind}|${described[i].text}`);
      const key = [pairing.sections.findIndex((s) => s.live === slide), groups.length, ...rows].join("\n");
      if (key === this.key) return;
      this.key = key;
      this.list.replaceChildren();
      if (!els.length) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "This slide has no element that can be a step.";
        this.list.append(empty);
        return;
      }
      els.forEach((el, i) => {
        const at = stepOf2(el);
        const { kind, text } = described[i];
        const row = document.createElement("div");
        row.className = "row";
        const select = document.createElement("select");
        select.title = "The step at which this element appears";
        select.setAttribute("aria-label", `Step of the ${kind.toLowerCase()}${text ? `: ${text}` : ""}`);
        const option = (value, text2) => {
          const o = document.createElement("option");
          o.value = value;
          o.textContent = text2;
          select.append(o);
        };
        option("", "With slide");
        if (groups.length) option("before", "Step 1, new, before the others");
        groups.forEach((_, g) => option(String(g), `Step ${g + 1}`));
        option(String(groups.length), `Step ${groups.length + 1}, new`);
        select.value = at < 0 ? "" : String(at);
        select.addEventListener("change", () => this.setStep(el, select.value === "" ? null : select.value === "before" ? "before" : Number(select.value)));
        const kindEl = document.createElement("span");
        kindEl.className = "kind";
        kindEl.textContent = kind;
        const textEl = document.createElement("span");
        textEl.className = "text";
        textEl.textContent = text;
        row.append(select, kindEl, textEl);
        row.addEventListener("pointerenter", () => el.classList.add("beeson-hover"));
        row.addEventListener("pointerleave", () => el.classList.remove("beeson-hover"));
        this.list.append(row);
      });
    }
    // moves el to the group at position to, to a new last group with to at the count of the
    // groups, to a new first group with 'before', which shifts the others by one, or out of the
    // steps with null
    setStep(el, to) {
      const pairing = this.ctx.pairing();
      const slide = this.ctx.slide();
      if (!pairing || !slide) return;
      const els = candidates(slide, pairing);
      let groups = groupsOf(els, pairing, this.ctx.edits);
      const target = to === null || to === "before" ? to : to >= groups.length ? "new" : groups[to];
      for (const g of groups) {
        const i = g.indexOf(el);
        if (i >= 0) g.splice(i, 1);
      }
      groups = groups.filter((g) => g.length);
      if (target === "before") groups.unshift([el]);
      else if (target === "new") groups.push([el]);
      else if (target && groups.includes(target)) target.push(el);
      else if (target) groups.push([el]);
      this.write(els, groups, pairing);
    }
    setAll(each) {
      const pairing = this.ctx.pairing();
      const slide = this.ctx.slide();
      if (!pairing || !slide) return;
      const els = candidates(slide, pairing);
      this.write(els, each ? els.filter((el) => !el.matches(WITH_SLIDE)).map((el) => [el]) : [], pairing);
    }
    // the indices of the slide, numbered from the lowest index in the file, or from 1, are written
    // into the edits and onto the page. an element that is not in a group is shown with the slide,
    // and the change is one entry of the history
    write(els, groups, pairing) {
      const given = els.map((el) => stepIn(pairing.elements.get(el)?.attrs ?? []).index).filter((i) => i !== null);
      const base = given.length ? Math.min(1, ...given) : 1;
      const before = els.map((el) => ({ el, step: stepOf(el, pairing, this.ctx.edits) }));
      const after = els.map((el) => {
        const at = groups.findIndex((g) => g.includes(el));
        return { el, step: at < 0 ? { fragment: false, index: null } : { fragment: true, index: base + at } };
      });
      if (before.every((b, i) => b.step.fragment === after[i].step.fragment && b.step.index === after[i].step.index)) return;
      this.apply(after);
      this.ctx.record({ label: "steps", undo: () => this.apply(before), redo: () => this.apply(after) });
    }
    apply(states) {
      if (states.length) this.ctx.show(states[0].el);
      for (const { el, step: step2 } of states) {
        this.ctx.edits.set(el, { ...this.ctx.edits.get(el), ...step2 });
        el.classList.toggle("fragment", step2.fragment);
        el.classList.toggle("visible", step2.fragment);
        el.classList.remove("current-fragment");
        if (step2.index === null) el.removeAttribute("data-fragment-index");
        else el.setAttribute("data-fragment-index", String(step2.index));
      }
      this.ctx.markDirty();
      this.ctx.changed();
    }
  };

  // src/editor/file/files.ts
  var FILE_TYPES = [{ description: "HTML", accept: { "text/html": [".html", ".htm"] } }];
  var AUTOSAVE_KEY = "beeson-autosave";
  var AUTOSAVE_DELAY = 1500;
  var pickers = window;
  var canPick = () => typeof pickers.showOpenFilePicker === "function";
  var canWrite = () => typeof pickers.showSaveFilePicker === "function";
  var fileName = () => decodeURIComponent(location.pathname.split("/").pop() || "") || "index.html";
  var folder = () => decodeURIComponent(location.pathname).replace(/[^/]*$/, "");
  var REPLACE = () => `Replace ${fileName()} in ${folder()} with it, or set the browser to ask where to save each download`;
  var plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  var clock = () => (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  var CSS4 = `
.beeson-edit-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 65; box-sizing: border-box; width: min(600px, calc(100vw - 32px)); padding: 24px 28px; border: 1px solid var(--line, #555); border-radius: 10px; background: var(--bg, #000); color: var(--text, #eee); font: 15px/1.5 system-ui, sans-serif; box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45); }
.beeson-edit-card[hidden] { display: none; }
.beeson-edit-card h3 { margin: 0 0 8px; font: 600 18px/1.3 system-ui, sans-serif; }
.beeson-edit-card p { margin: 0 0 16px; color: var(--subtle, #bbb); }
.beeson-edit-card code { font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; color: var(--text, #eee); word-break: break-all; }
.beeson-edit-card button { font: inherit; padding: 8px 16px; border: 1px solid var(--violet, #96f); border-radius: 6px; background: transparent; color: var(--text, #eee); cursor: pointer; white-space: nowrap; }
.beeson-edit-card .row { display: flex; flex-wrap: wrap; gap: 8px; }
.beeson-edit-card .row button:not(:first-child) { border-color: var(--line, #555); }
`;
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/html" }));
    const a = make("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  async function write(to, text) {
    const writable = await to.createWritable();
    await writable.write(text);
    await writable.close();
  }
  async function pickTarget(app2) {
    if (!pickers.showSaveFilePicker) return false;
    try {
      app2.handle = await pickers.showSaveFilePicker({ suggestedName: app2.handle?.name ?? fileName(), types: FILE_TYPES });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      throw error;
    }
  }
  function pickFile() {
    return new Promise((done) => {
      const input = make("input");
      input.type = "file";
      input.style.display = "none";
      const finish = (file) => {
        input.remove();
        done(file);
      };
      input.addEventListener("change", () => finish(input.files?.[0] ?? null));
      input.addEventListener("cancel", () => finish(null));
      document.body.append(input);
      input.click();
    });
  }
  var ASK = {
    open: {
      text: "Save them into the file first, open a file without them, or go on editing.",
      save: ["Save and open\u2026", "Save the edits into the file, then choose a file"],
      discard: ["Open without saving", "Put the slides back as saved, then choose a file"]
    },
    present: {
      text: "Save them into the file first, present the saved file without them, or go on editing.",
      save: ["Save and present", "Save the edits into the file, then show the deck in a new tab"],
      discard: ["Present the saved file", "Show the deck as saved in a new tab, and keep the edits here"]
    }
  };
  function install4(app2) {
    injectStyle("files", CSS4);
    const card = make("div", "beeson-edit-card");
    const cardText = make("p");
    const cardButton = button(`Choose ${fileName()}\u2026`);
    card.append(make("h3", "", "Choose the file of this deck"), cardText, cardButton);
    card.hidden = true;
    const ask = make("div", "beeson-edit-card ask");
    const askText = make("p");
    const askSave = button("");
    const askDiscard = button("");
    const askCancel = button("Cancel", "Go on editing");
    const askRow = make("div", "row");
    askRow.append(askSave, askDiscard, askCancel);
    ask.append(make("h3", "", "The deck has unsaved changes"), askText, askRow);
    ask.hidden = true;
    let asking = null;
    const problemsCard = make("div", "beeson-edit-card problems");
    const problemsList = make("ul");
    problemsList.style.cssText = "margin: 0 0 16px; padding-left: 20px; max-height: 50vh; overflow-y: auto; color: var(--subtle, #bbb);";
    const problemsClose = button("Close");
    const problemsRow = make("div", "row");
    problemsRow.append(problemsClose);
    problemsCard.append(make("h3", "", "Texts that cannot be edited"), problemsList, problemsRow);
    problemsCard.hidden = true;
    let saving = false;
    let again = false;
    let autosaveTimer = 0;
    const problemText = (p) => `slide ${app2.slideNumber(p.slide) ?? "?"}, ${p.tag}: ${p.reason}`;
    function askFirst(action) {
      const words = ASK[action];
      askText.textContent = words.text;
      [askSave.textContent, askSave.title] = words.save;
      [askDiscard.textContent, askDiscard.title] = words.discard;
      return new Promise((done) => {
        asking = done;
        ask.hidden = false;
        askCancel.focus();
      });
    }
    function answer(choice) {
      ask.hidden = true;
      asking?.(choice);
      asking = null;
    }
    function showProblems() {
      problemsList.replaceChildren(...(app2.pairing?.problems ?? []).map((p) => make("li", "", problemText(p))));
      problemsCard.hidden = false;
      problemsClose.focus();
    }
    function closeProblems() {
      problemsCard.hidden = true;
      const which = document.querySelector(".beeson-edit-top button.which");
      if (which && !which.hidden) which.focus();
    }
    function line() {
      const plain = (text, warn = false) => ({ text, warn, title: "" });
      if (app2.state === "waiting") return plain("Choose the file of this deck to start editing");
      const pairing = app2.pairing;
      if (!pairing) return plain(app2.note?.text ?? "Loading", app2.note?.warn ?? false);
      if (!pairing.blocks.length) return plain("This file is not the deck on the page", true);
      const problems = pairing.problems;
      const parts = [app2.dirty ? "Unsaved changes" : app2.note?.text ?? "No unsaved changes"];
      if (app2.dirty && app2.note?.warn) parts.push(app2.note.text);
      if (problems.length) parts.push(`${plural(problems.length, "text")} cannot be edited`);
      if (app2.overflow) parts.push(`${plural(app2.overflow, "text")} run${app2.overflow === 1 ? "s" : ""} past the slide or into its footnote`);
      if (app2.autosave && !app2.handle && canWrite()) parts.push("autosave starts after the first save");
      return { text: parts.join(". "), warn: (app2.note?.warn ?? false) || problems.length > 0 || app2.overflow > 0, title: problems.map(problemText).join("\n") };
    }
    function open(text, fresh = true) {
      app2.tagEdits.clear();
      if (fresh) {
        app2.history.clear();
        app2.move.select(null);
      }
      try {
        app2.source = parseSource(text);
        app2.saved = text;
        app2.pairing = pair(app2.source, app2.slides(), mathLookup());
        app2.state = "loaded";
        app2.dirty = false;
        if (!app2.pairing.blocks.length) app2.pairing.problems.push({ slide: null, tag: "slides", reason: "nothing on the page was found in the file" });
      } catch (error) {
        app2.source = null;
        app2.saved = null;
        app2.pairing = null;
        app2.state = "error";
        app2.note = { text: error instanceof Error ? error.message : String(error), warn: true };
      }
      app2.typing.attach();
      app2.report();
      app2.invalidate();
      if (fresh) app2.drafts.offer();
    }
    function render() {
      if (!app2.source || !app2.pairing) throw new Error("no file is open");
      return renderDeck(app2.source, app2.pairing, mathLookup(), app2.tagEdits).text;
    }
    async function discardEdits() {
      while (app2.history.canUndo) await app2.history.undo();
      app2.history.clear();
      app2.move.select(null);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.clearTimeout(autosaveTimer);
      app2.drafts.drop();
      app2.dirty = false;
      app2.report();
    }
    async function openFile() {
      app2.note = null;
      if (app2.dirty) {
        const choice = await askFirst("open");
        if (!choice) return;
        if (choice === "save") {
          await save();
          if (app2.dirty) return;
        } else await discardEdits();
      }
      if (canPick() && pickers.showOpenFilePicker) {
        let picked;
        try {
          picked = await pickers.showOpenFilePicker({ multiple: false });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          throw error;
        }
        const text = await (await picked[0].getFile()).text();
        app2.handle = picked[0];
        open(text);
        return;
      }
      const file = await pickFile();
      if (!file) return;
      app2.handle = null;
      open(await file.text());
    }
    async function save() {
      if (saving) {
        again = true;
        return;
      }
      saving = true;
      try {
        await doSave();
      } finally {
        saving = false;
      }
      if (again) {
        again = false;
        if (app2.dirty) await save();
      }
    }
    async function doSave() {
      if (!app2.source || !app2.pairing) {
        app2.note = { text: "Choose the file of this deck first", warn: true };
        app2.report();
        return;
      }
      const rendered = renderDeck(app2.source, app2.pairing, mathLookup(), app2.tagEdits);
      if (!app2.handle && canWrite() && !await pickTarget(app2)) return;
      const n = rendered.edits.length;
      const edits = plural(n, "edit");
      let text;
      if (app2.handle) {
        await write(app2.handle, rendered.text);
        text = n ? `Saved ${edits} to ${app2.handle.name} at ${clock()}` : `Saved ${app2.handle.name} at ${clock()}`;
      } else {
        download(fileName(), rendered.text);
        text = `${n ? `Saved a copy with ${edits}` : `Saved a copy of ${fileName()}`}. ${REPLACE()}`;
      }
      app2.saved = rendered.text;
      const warnings = rendered.warnings.length ? `, ${rendered.warnings.join(", ")}` : "";
      app2.note = { text: `${text}${warnings}`, warn: rendered.warnings.length > 0 };
      if (render() === rendered.text) {
        open(rendered.text, false);
        app2.drafts.drop();
      } else {
        app2.report();
        scheduleAutosave();
      }
    }
    async function saveAs() {
      if (!app2.source || !app2.pairing) {
        app2.note = { text: "Choose the file of this deck first", warn: true };
        app2.report();
        return;
      }
      if (canWrite() && !await pickTarget(app2)) return;
      await save();
    }
    function cleanIfSaved() {
      if (!app2.source || !app2.pairing || app2.saved === null) return;
      try {
        if (render() !== app2.saved) return;
      } catch {
        return;
      }
      app2.dirty = false;
      window.clearTimeout(autosaveTimer);
      app2.drafts.drop();
      app2.report();
    }
    function scheduleAutosave() {
      window.clearTimeout(autosaveTimer);
      if (!app2.autosave || !app2.handle) return;
      autosaveTimer = window.setTimeout(() => {
        if (app2.dirty && !saving) void save().catch((e) => app2.fail(e));
      }, AUTOSAVE_DELAY);
    }
    function toggleAutosave() {
      app2.autosave = !app2.autosave;
      store(AUTOSAVE_KEY, app2.autosave ? "1" : "0");
      if (app2.dirty) scheduleAutosave();
      app2.report();
    }
    async function present() {
      if (app2.dirty) {
        const choice = await askFirst("present");
        if (!choice) return;
        if (choice === "save") {
          await save();
          if (app2.dirty) return;
        }
      }
      const params = new URLSearchParams(location.search);
      params.delete("edit");
      const query = params.toString().replace(/=(?=&|$)/g, "");
      window.open(`${location.href.split(/[?#]/)[0]}${query ? `?${query}` : ""}${location.hash}`, "_blank");
    }
    const files = {
      open,
      render,
      save,
      saveAs,
      openFile,
      present,
      toggleAutosave,
      line,
      showProblems,
      closeProblems,
      problemsShown: () => !problemsCard.hidden,
      askShown: () => !ask.hidden,
      cancelAsk: () => answer(null)
    };
    app2.files = files;
    app2.autosave = canWrite() && stored(AUTOSAVE_KEY) === "1";
    const fail2 = (e) => app2.fail(e);
    wire(cardButton, openFile, fail2);
    wire(askSave, () => answer("save"), fail2);
    wire(askDiscard, () => answer("discard"), fail2);
    wire(askCancel, () => answer(null), fail2);
    wire(problemsClose, closeProblems, fail2);
    app2.listen("report", () => {
      card.hidden = app2.state !== "waiting";
      if (app2.state !== "waiting") return;
      const where = `${fileName()} in ${folder()}, i.e. the file that is open here`;
      cardText.textContent = canWrite() ? `A browser writes only to a file that you have chosen. Choose ${where}, and your edits are saved into it.` : `This browser does not write to a file by itself. Choose ${where}. A save is then a download of a copy with your edits. Set the browser to ask where to save each download, and you choose ${fileName()} in its folder and replace it.`;
    });
    app2.listen("history", () => {
      if (app2.dirty) cleanIfSaved();
    });
    app2.listen("dirty", scheduleAutosave);
    window.addEventListener("beforeunload", (ev) => {
      if (app2.dirty) ev.preventDefault();
    });
    document.body.append(card, ask, problemsCard);
  }
  async function fetchSource(app2) {
    if (location.protocol === "file:") return false;
    try {
      const response = await fetch(location.href.split(/[?#]/)[0], { cache: "no-store" });
      if (!response.ok) return false;
      app2.files.open(await response.text());
      return true;
    } catch {
      return false;
    }
  }

  // src/editor/file/drafts.ts
  var DRAFT_KEY = `beeson-draft:${location.href.split(/[?#]/)[0]}`;
  var DRAFT_DELAY = 1e3;
  var CSS5 = `
.beeson-edit-card.recover { z-index: 66; }
`;
  function readDraft() {
    const raw = stored(DRAFT_KEY);
    if (!raw) return null;
    try {
      const draft = JSON.parse(raw);
      return typeof draft.text === "string" && typeof draft.at === "number" ? { at: draft.at, text: draft.text } : null;
    } catch {
      return null;
    }
  }
  function install5(app2) {
    injectStyle("drafts", CSS5);
    const recover = make("div", "beeson-edit-card recover");
    const recoverText = make("p");
    const restoreButton = button("Restore and save", "Write the edits into the file and show the page again");
    const copyButton = button("Download a copy", "Put a copy of the file with the edits into your downloads");
    const discardButton = button("Discard", "Forget the edits");
    const recoverRow = make("div", "row");
    recoverRow.append(restoreButton, copyButton, discardButton);
    recover.append(make("h3", "", "Edits that were not saved were found"), recoverText, recoverRow);
    recover.hidden = true;
    let draftTimer = 0;
    function keepDraft() {
      if (!app2.dirty || !app2.source || !app2.pairing) return;
      let text;
      try {
        text = app2.files.render();
      } catch (e) {
        app2.note = { text: `The edits could not be kept in this browser: ${e instanceof Error ? e.message : String(e)}`, warn: true };
        app2.report();
        return;
      }
      store(DRAFT_KEY, JSON.stringify({ at: Date.now(), text }));
    }
    function drop() {
      window.clearTimeout(draftTimer);
      store(DRAFT_KEY, null);
    }
    function offer() {
      const draft = readDraft();
      if (!draft || !app2.source || draft.text === app2.source.text) {
        if (draft) drop();
        recover.hidden = true;
        return;
      }
      const when = new Date(draft.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
      recoverText.textContent = `Edits of ${fileName()} from ${when} were kept in this browser and not saved. Restore writes the file with them and shows it again, a copy goes to your downloads, and Discard forgets them.`;
      copyButton.hidden = false;
      recover.hidden = false;
    }
    async function restore() {
      const draft = readDraft();
      if (!draft) {
        recover.hidden = true;
        return;
      }
      if (!app2.handle && canWrite() && !await pickTarget(app2)) return;
      if (app2.handle) {
        await write(app2.handle, draft.text);
        drop();
        location.reload();
        return;
      }
      copy();
    }
    function copy() {
      const draft = readDraft();
      if (draft) download(fileName(), draft.text);
      drop();
      recover.hidden = true;
      app2.note = { text: `A copy of ${fileName()} with the edits is in your downloads. Replace ${fileName()} in ${folder()} with it and open it again`, warn: false };
      app2.report();
    }
    function discard() {
      drop();
      recover.hidden = true;
      app2.report();
    }
    const drafts = {
      keepSoon: () => {
        window.clearTimeout(draftTimer);
        draftTimer = window.setTimeout(keepDraft, DRAFT_DELAY);
      },
      drop,
      hasDraft: () => readDraft() !== null,
      offer,
      offered: () => !recover.hidden,
      restore
    };
    app2.drafts = drafts;
    const fail2 = (e) => app2.fail(e);
    wire(restoreButton, restore, fail2);
    wire(copyButton, copy, fail2);
    wire(discardButton, discard, fail2);
    app2.listen("dirty", drafts.keepSoon);
    document.body.append(recover);
  }

  // src/editor/notes.ts
  var PANE_KEY = "beeson-pane";
  var CSS6 = `
.beeson-edit-pane { position: fixed; left: 0; right: 0; bottom: 36px; z-index: 0; height: var(--beeson-pane, 200px); box-sizing: border-box; display: none; background: var(--bg, #000); border-top: 1px solid var(--line, #555); color: var(--subtle, #bbb); font: 12px/1.4 system-ui, sans-serif; padding: 8px 16px; }
html.beeson-notes .beeson-edit-pane { display: block; }
html.beeson-nav .beeson-edit-pane, html.beeson-nav .beeson-edit-resize { left: 240px; }
html.beeson-steps .beeson-edit-pane, html.beeson-steps .beeson-edit-resize { right: 320px; }
.beeson-edit-resize { position: fixed; left: 0; right: 0; bottom: calc(36px + var(--beeson-pane, 200px) - 4px); height: 8px; z-index: 56; display: none; cursor: ns-resize; }
html.beeson-notes .beeson-edit-resize { display: block; }
.beeson-edit-resize:hover { background: color-mix(in srgb, var(--violet, #96f) 45%, transparent); }
.beeson-edit-resize:focus-visible { outline: none; background: color-mix(in srgb, var(--violet, #96f) 45%, transparent); }
html.beeson-editor.beeson-notes .reveal .slides section.present { overflow: visible; clip-path: inset(0 calc(-1 * var(--beeson-side, 0px)) calc(-1 * (var(--beeson-pane, 200px) / var(--beeson-scale, 1) + var(--beeson-gap, 0px))) calc(-1 * var(--beeson-side, 0px))); }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes { display: block; position: absolute; left: calc(-1 * var(--beeson-side, 0px)); right: calc(-1 * var(--beeson-side, 0px)); top: calc(100% + var(--beeson-gap, 0px)); z-index: 5; box-sizing: border-box; height: calc(var(--beeson-pane, 200px) / var(--beeson-scale, 1)); margin: 0; padding: calc(30px / var(--beeson-scale, 1)) calc(16px / var(--beeson-scale, 1)) calc(12px / var(--beeson-scale, 1)); font-size: calc(15px / var(--beeson-scale, 1)); line-height: 1.5; text-align: left; color: var(--text, #eee); background: transparent; overflow: auto; outline: 1px solid transparent; outline-offset: -1px; }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:focus { outline-color: var(--violet, #96f); }
html.beeson-editor.beeson-notes .reveal .slides section.present > aside.notes:empty::before { content: 'Click to add notes'; color: var(--subtle, #bbb); }
`;
  function install6(app2) {
    injectStyle("notes", CSS6);
    const notesButton = button("Notes", "Show the speaker notes under the slide");
    notesButton.setAttribute("aria-pressed", "false");
    const pane = make("div", "beeson-edit-pane", "Notes");
    const resizer = make("div", "beeson-edit-resize");
    resizer.title = "Drag to change the height of the notes, or focus it and press the up and down arrows";
    resizer.tabIndex = 0;
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "horizontal");
    resizer.setAttribute("aria-label", "Height of the notes");
    resizer.setAttribute("aria-valuemin", "120");
    resizer.setAttribute("aria-valuemax", "600");
    let paneHeight = 200;
    const shown3 = () => document.documentElement.classList.contains("beeson-notes");
    function setPane(height) {
      paneHeight = Math.max(120, Math.min(600, Math.round(height)));
      document.documentElement.style.setProperty("--beeson-pane", `${paneHeight}px`);
      resizer.setAttribute("aria-valuenow", String(paneHeight));
      app2.relayout();
      app2.invalidate("layout");
    }
    function ensure() {
      const slide = app2.current();
      if (!slide || !app2.pairing?.blocks.length || !shown3()) return null;
      let aside = slide.querySelector(":scope > aside.notes");
      if (!aside) {
        aside = make("aside", "notes");
        aside.setAttribute("contenteditable", "true");
        aside.setAttribute("aria-label", "Speaker notes");
        slide.append(aside);
      }
      return aside;
    }
    function toggle() {
      const on = document.documentElement.classList.toggle("beeson-notes");
      notesButton.classList.toggle("on", on);
      notesButton.setAttribute("aria-pressed", String(on));
      app2.relayout();
      app2.invalidate("layout");
      if (on) ensure()?.focus({ preventScroll: true });
    }
    resizer.addEventListener("keydown", (ev) => {
      const step2 = ev.key === "ArrowUp" ? 20 : ev.key === "ArrowDown" ? -20 : 0;
      if (!step2) return;
      ev.preventDefault();
      ev.stopPropagation();
      setPane(paneHeight + step2);
      store(PANE_KEY, String(paneHeight));
    });
    resizer.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const startY = ev.clientY;
      const startHeight = paneHeight;
      const onMove = (e) => setPane(startHeight + startY - e.clientY);
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        store(PANE_KEY, String(paneHeight));
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    app2.listen("slide", () => void ensure());
    document.body.append(pane, resizer);
    const notes = { button: notesButton, shown: shown3, toggle, ensure, setPane, height: () => paneHeight };
    app2.notes = notes;
    setPane(Number(stored(PANE_KEY)) || 200);
  }

  // src/editor/overflow.ts
  var CSS7 = `
html.beeson-editing .reveal .beeson-overflow { outline: 2px dashed var(--accent, #f80) !important; outline-offset: 6px; }
`;
  function install7(app2) {
    injectStyle("overflow", CSS7);
    app2.onRefresh(ALL, () => {
      const slide = app2.current();
      const box2 = app2.slides().getBoundingClientRect();
      let n = 0;
      if (slide && box2.width > 0) {
        const foot = slide.querySelector(":scope > .foot");
        const f = foot?.getBoundingClientRect();
        const past = (r) => r.right > box2.right + 1 || r.bottom > box2.bottom + 1 || r.left < box2.left - 1 || r.top < box2.top - 1;
        const intoFoot = (r) => !!f && f.height > 0 && r.bottom > f.top + 1 && r.top < f.bottom - 1 && r.right > f.left + 1 && r.left < f.right - 1;
        for (const el of slide.querySelectorAll(HOST)) {
          if (el.closest("aside.notes, .backdrop")) continue;
          const r = el.getBoundingClientRect();
          const out = r.width > 0 && r.height > 0 && (past(r) || el !== foot && !foot?.contains(el) && intoFoot(r));
          el.classList.toggle("beeson-overflow", out);
          if (out) n += 1;
        }
      }
      if (n !== app2.overflow) {
        app2.overflow = n;
        app2.report();
      }
    });
  }

  // src/editor/text/typing.ts
  var CSS8 = `
html.beeson-editing .reveal [contenteditable="true"] { cursor: text; outline: 1px dashed transparent; outline-offset: 6px; border-radius: 2px; }
html.beeson-editing .reveal [contenteditable="true"]:hover { outline-color: var(--subtle, #bbb); }
html.beeson-editing .reveal [contenteditable="true"]:focus { outline: 2px solid var(--violet, #96f); }
html.beeson-editing .reveal [contenteditable="true"] mjx-container { cursor: pointer; border-radius: 2px; }
html.beeson-editing .reveal [contenteditable="true"] mjx-container:hover, html.beeson-editing .reveal [contenteditable="true"] mjx-container:focus-visible { outline: 1px dashed var(--accent, #f80); outline-offset: 4px; }
`;
  function changeEnd(before, after) {
    if (before === after) return null;
    let head = 0;
    while (head < before.length && head < after.length && before[head] === after[head]) head++;
    let tail = 0;
    while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
    return after.length - tail;
  }
  function placeCaret(host, offset = null) {
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
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (left <= node.length) {
          const math = node.parentElement?.closest("mjx-container");
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
  function toggleFormat(host, tag) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed || !host.contains(range.commonAncestorContainer)) return;
    const alias = tag === "strong" ? "b" : "i";
    const same = (el) => el.localName === tag || el.localName === alias;
    const formatOf = (node) => {
      for (let el = node instanceof Element ? node : node.parentElement; el && el !== host; el = el.parentElement) if (same(el)) return el;
      return null;
    };
    const unwrap = (root) => {
      for (const el of [...root.querySelectorAll(`${tag}, ${alias}`)]) el.replaceWith(...el.childNodes);
    };
    const common = range.commonAncestorContainer;
    const texts = [];
    if (common instanceof Text) texts.push(common);
    else {
      const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const empty = node === range.startContainer && range.startOffset === node.length || node === range.endContainer && range.endOffset === 0;
        if (range.intersectsNode(node) && !empty && node.data.trim()) texts.push(node);
      }
    }
    const off = texts.length > 0 && texts.every((node) => formatOf(node));
    const outer = off ? formatOf(common) : null;
    let nodes;
    if (outer) {
      const start2 = [range.startContainer, range.startOffset];
      const tail = document.createRange();
      tail.setStart(range.endContainer, range.endOffset);
      tail.setEnd(outer, outer.childNodes.length);
      const after = outer.cloneNode(false);
      after.append(tail.extractContents());
      const head = document.createRange();
      head.setStart(outer, 0);
      head.setEnd(...start2);
      const before = outer.cloneNode(false);
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
    for (const el of [...host.querySelectorAll("strong, em, b, i")]) {
      if (!el.textContent && !el.querySelector("br, img, mjx-container")) el.remove();
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
  function insertPlain(host, text) {
    if (host.closest("pre")) {
      document.execCommand("insertText", false, text);
      return;
    }
    const lines2 = text.split(/\r?\n/);
    lines2.forEach((line, i) => {
      if (line) document.execCommand("insertText", false, line);
      if (i < lines2.length - 1) document.execCommand("insertLineBreak");
    });
  }
  function install8(app2) {
    injectStyle("typing", CSS8);
    const history2 = app2.history;
    let hosts = [];
    function markMath(root) {
      for (const c of root.querySelectorAll("mjx-container")) {
        c.setAttribute("contenteditable", "false");
        if (!app2.hostOf(c)) continue;
        c.setAttribute("tabindex", "0");
        c.setAttribute("role", "button");
        c.setAttribute("aria-label", "Formula, Enter opens its TeX");
      }
    }
    function attach() {
      const next = app2.pairing ? app2.pairing.blocks.map((b) => b.live) : [];
      for (const h of hosts) if (!next.includes(h)) h.removeAttribute("contenteditable");
      for (const h of next) if (h.getAttribute("contenteditable") !== "true") h.setAttribute("contenteditable", "true");
      hosts = next;
      for (const h of next) if (h.matches("aside.notes")) h.setAttribute("aria-label", "Speaker notes");
      app2.move.mark(app2.pairing);
      markMath(app2.slides());
      document.documentElement.classList.toggle("beeson-editing", hosts.length > 0);
      app2.notes.ensure();
    }
    async function restoreHost(host, content) {
      app2.showSlide(host);
      if (host.matches("aside.notes") && !app2.notes.shown()) app2.notes.toggle();
      const before = host.textContent ?? "";
      await setContentWithTex(host, content);
      markMath(host);
      history2.track(host);
      app2.markDirty();
      placeCaret(host, changeEnd(before, host.textContent ?? ""));
      app2.invalidate("content");
    }
    function onBeforeInput(ev) {
      const host = app2.hostOf(ev.target);
      if (!host) return;
      const type = ev.inputType;
      if (type === "historyUndo" || type === "historyRedo") {
        ev.preventDefault();
        void (type === "historyUndo" ? history2.undo() : history2.redo()).catch((e) => app2.fail(e));
        return;
      }
      if (type === "formatBold" || type === "formatItalic") {
        ev.preventDefault();
        history2.break();
        history2.beforeTyping(host);
        toggleFormat(host, type === "formatBold" ? "strong" : "em");
        history2.afterTyping(host);
        history2.break();
        app2.markDirty();
        app2.invalidate("content");
        return;
      }
      if (type === "insertParagraph" || type === "insertLineBreak") history2.break();
      history2.beforeTyping(host);
      if (type === "insertParagraph" || type === "insertLineBreak") {
        ev.preventDefault();
        insertPlain(host, "\n");
      } else if (type === "insertFromPaste") {
        ev.preventDefault();
        insertPlain(host, ev.dataTransfer?.getData("text/plain") ?? "");
      } else if (type === "insertFromDrop" || type.startsWith("format") || type.startsWith("insertOrdered") || type.startsWith("insertUnordered") || type === "insertHorizontalRule" || type === "insertLink") {
        ev.preventDefault();
      }
    }
    const typing = { attach, markMath, restoreHost };
    app2.typing = typing;
    document.addEventListener("beforeinput", onBeforeInput);
    document.addEventListener("input", (ev) => {
      const host = app2.hostOf(ev.target);
      if (!host) return;
      history2.afterTyping(host);
      app2.markDirty();
      app2.invalidate("content");
    });
    document.addEventListener("focusin", (ev) => {
      const host = app2.hostOf(ev.target);
      if (host) history2.track(host);
      app2.invalidate("selection");
    });
    document.addEventListener("focusout", () => setTimeout(() => app2.invalidate("selection"), 0));
  }

  // src/editor/text/mathpop.ts
  var CSS9 = `
.beeson-math { position: fixed; z-index: 70; display: flex; flex-direction: column; gap: 6px; width: min(640px, calc(100vw - 32px)); box-sizing: border-box; padding: 10px; border: 1px solid var(--line, #555); border-radius: 6px; background: var(--bg, #000); color: var(--text, #eee); font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); }
.beeson-math textarea { font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace; min-height: 5em; padding: 6px; border: 1px solid var(--line, #555); border-radius: 4px; background: transparent; color: inherit; resize: vertical; }
.beeson-math .row { display: flex; gap: 8px; align-items: center; }
.beeson-math button { font: inherit; padding: 4px 12px; border: 1px solid var(--line, #555); border-radius: 6px; background: transparent; color: var(--text, #eee); cursor: pointer; white-space: nowrap; }
.beeson-math button:hover { border-color: var(--subtle, #bbb); }
.beeson-math .hint { margin-left: auto; color: var(--subtle, #bbb); }
.beeson-math .error { color: var(--accent, #f80); }
.beeson-math .error:empty { display: none; }
.beeson-math .preview { padding: 8px 12px; border: 1px solid var(--line, #444); background: var(--bg, #000); color: var(--text, #fff); font-size: 32px; max-height: 240px; overflow: auto; }
.beeson-math .preview mjx-container { margin: 0 !important; }
.beeson-math .preview:empty { display: none; }
.beeson-math button:disabled { opacity: 0.5; cursor: default; }
`;
  function install9(app2) {
    injectStyle("mathpop", CSS9);
    let popover = null;
    let popoverFor = null;
    function closeMath(back = true) {
      popover?.remove();
      popover = null;
      const el = popoverFor;
      popoverFor = null;
      if (back && el?.isConnected) el.focus({ preventScroll: true });
    }
    async function setMath(container, tex) {
      const host = container.closest(HOST);
      if (!host) throw new Error("the formula is not in an editable block");
      const info = mathLookup()(container);
      const { error } = await previewTex(tex, info?.display ?? false);
      if (error) throw new Error(error);
      const before = contentWithTex(host);
      if (!await retypeset(host, container, tex)) throw new Error("MathJax does not find the formula with this TeX, and the slide is kept as it was");
      app2.typing.markMath(host);
      const after = contentWithTex(host);
      if (after !== before) app2.history.push({ label: "formula", undo: () => app2.typing.restoreHost(host, before), redo: () => app2.typing.restoreHost(host, after) });
      app2.markDirty();
    }
    function openMath(container) {
      const info = mathLookup()(container);
      if (!info) return;
      closeMath();
      const box2 = make("div", "beeson-math");
      box2.setAttribute("role", "dialog");
      box2.setAttribute("aria-modal", "true");
      box2.setAttribute("aria-label", "The TeX of the formula");
      popoverFor = container;
      const host = container.closest(HOST);
      const at = host ? [...host.querySelectorAll("mjx-container")].indexOf(container) : -1;
      const field = make("textarea");
      field.setAttribute("aria-label", "TeX of the formula");
      field.value = info.tex;
      field.rows = Math.min(12, Math.max(3, info.tex.split("\n").length + 1));
      const row = make("div", "row");
      const apply = make("button", "", "Apply");
      const cancel = make("button", "", "Cancel");
      const hint = make("span", "hint", `${info.open} \u2026 ${info.close}, \u2318 or Ctrl+Enter applies, Esc cancels`);
      const preview = make("div", "preview");
      const error = make("div", "error");
      error.setAttribute("role", "alert");
      row.append(apply, cancel, hint);
      box2.append(field, preview, row, error);
      const rect = container.getBoundingClientRect();
      box2.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 656))}px`;
      box2.style.top = `${Math.max(52, Math.min(rect.bottom + 8, window.innerHeight - 420))}px`;
      let shown3 = 0;
      let timer = 0;
      const show = async () => {
        const seq = ++shown3;
        const result = await previewTex(field.value, info.display).catch((e) => ({ node: null, error: e instanceof Error ? e.message : String(e) }));
        if (seq !== shown3) return;
        preview.replaceChildren(...result.node ? [result.node] : []);
        error.textContent = result.error ?? "";
        apply.disabled = !!result.error;
      };
      void show();
      field.addEventListener("input", () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(show, 150);
      });
      apply.addEventListener("click", async () => {
        try {
          await setMath(container, field.value);
          popoverFor = host?.querySelectorAll("mjx-container")[at] ?? null;
          closeMath();
        } catch (e) {
          error.textContent = e instanceof Error ? e.message : String(e);
        }
      });
      cancel.addEventListener("click", () => closeMath());
      field.addEventListener("keydown", (ev) => {
        if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
          ev.preventDefault();
          apply.click();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          closeMath();
        }
      });
      box2.addEventListener("keydown", (ev) => {
        if (ev.key !== "Tab") return;
        ev.preventDefault();
        const stops = [field, apply, cancel].filter((el) => !el.disabled);
        const at2 = stops.indexOf(document.activeElement);
        stops[(at2 + (ev.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
      });
      document.body.append(box2);
      popover = box2;
      field.focus();
      field.select();
    }
    const math = { isOpen: () => !!popover, open: openMath, close: closeMath, setMath };
    app2.math = math;
    document.addEventListener("click", (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      const container = target?.closest("mjx-container");
      if (container && app2.hostOf(container)) {
        ev.preventDefault();
        openMath(container);
      } else if (popover && target && !popover.contains(target)) closeMath(false);
    });
    app2.listen("slide", () => closeMath(false));
  }

  // src/editor/shell/canvas.ts
  var CSS10 = `
html.beeson-editor { --beeson-left: 6px; --beeson-right: 6px; }
html.beeson-editor.beeson-nav { --beeson-left: 246px; }
html.beeson-editor.beeson-steps { --beeson-right: 326px; }
html.beeson-editor .reveal:not(.beeson-peek) { position: relative; z-index: 1; height: calc(100% - 80px) !important; margin-top: 44px; margin-left: var(--beeson-left); width: calc(100% - var(--beeson-left) - var(--beeson-right)) !important; overflow: visible; }
html.beeson-editor.beeson-notes .reveal:not(.beeson-peek) { height: calc(100% - 80px - var(--beeson-pane, 200px)) !important; }
html.beeson-editor .reveal .progress, html.beeson-editor .reveal .slide-number { display: none !important; }
html.beeson-editing .reveal .slides section .fragment { visibility: visible !important; opacity: 1 !important; transition: none !important; }
html.beeson-editing .reveal .slides section .fragment.beeson-off { visibility: hidden !important; }
`;
  function install10(app2) {
    injectStyle("canvas", CSS10);
    const layout = () => {
      const d = app2.deck();
      if (!d) return;
      const scale = d.getScale();
      const reveal = document.querySelector(".reveal")?.getBoundingClientRect();
      const box2 = app2.slides().getBoundingClientRect();
      const root = document.documentElement.style;
      const gap = reveal ? Math.max(0, reveal.bottom - box2.bottom) / scale : 0;
      root.setProperty("--beeson-scale", String(scale));
      root.setProperty("--beeson-gap", `${gap}px`);
      const side = reveal ? Math.max(0, (reveal.width - box2.width) / 2) / scale : 0;
      root.setProperty("--beeson-side", `${side}px`);
    };
    app2.listen("resize", layout);
  }

  // src/editor/shell/toolbar.ts
  var CSS11 = `
.beeson-edit-top, .beeson-edit-bottom { position: fixed; left: 0; right: 0; z-index: 60; display: flex; align-items: center; gap: 12px; box-sizing: border-box; padding: 0 16px; background: var(--bg, #000); color: var(--text, #eee); font: 14px/1.4 system-ui, sans-serif; }
.beeson-edit-top { top: 0; height: 44px; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-top .file { font-weight: 600; white-space: nowrap; }
.beeson-edit-top .state { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--subtle, #bbb); }
.beeson-edit-top .state.warn { color: var(--accent, #f80); }
.beeson-edit-top button, .beeson-edit-bottom button { font: inherit; padding: 4px 12px; border: 1px solid var(--line, #555); border-radius: 6px; background: transparent; color: var(--text, #eee); cursor: pointer; white-space: nowrap; }
.beeson-edit-top button:hover, .beeson-edit-bottom button:hover { border-color: var(--subtle, #bbb); }
.beeson-edit-top button:disabled { opacity: 0.4; cursor: default; }
.beeson-edit-top button.on { border-color: var(--accent, #f80); color: var(--accent, #f80); }
`;
  function install11(app2) {
    injectStyle("toolbar", CSS11);
    const top = make("div", "beeson-edit-top");
    const fileEl = make("span", "file");
    const stateEl = make("span", "state");
    stateEl.setAttribute("aria-live", "polite");
    const undoButton = button("Undo", "Undo the last change, \u2318Z or Ctrl+Z");
    const redoButton = button("Redo", "Redo the change undone, \u2318\u21E7Z or Ctrl+Y");
    const openButton = button("Open\u2026", "Choose the file of this deck");
    const saveButton = button("Save", "Save the edits into the file, \u2318S or Ctrl+S");
    const saveAsButton = button("Save as\u2026", "Save the deck into another file, \u2318\u21E7S or Ctrl+Shift+S");
    const autosaveButton = button("Autosave", "Save the edits into the file after each change");
    const presentButton = button("Present", "Show the saved deck in a new tab");
    const whichButton = button("Which?", "List the texts that cannot be edited");
    whichButton.className = "which";
    whichButton.hidden = true;
    undoButton.disabled = redoButton.disabled = true;
    top.append(fileEl, stateEl, whichButton, undoButton, redoButton, openButton, saveButton, saveAsButton, autosaveButton, presentButton);
    const fail2 = (e) => app2.fail(e);
    const run2 = (id) => () => app2.commands.run(id);
    wire(openButton, run2("file.open"), fail2);
    wire(saveButton, run2("file.save"), fail2);
    wire(saveAsButton, run2("file.saveAs"), fail2);
    wire(autosaveButton, run2("file.autosave"), fail2);
    wire(presentButton, run2("file.present"), fail2);
    wire(undoButton, run2("edit.undo"), fail2);
    wire(redoButton, run2("edit.redo"), fail2);
    wire(whichButton, () => app2.files.showProblems(), fail2);
    if (!canWrite()) {
      autosaveButton.disabled = true;
      autosaveButton.title = "Autosave needs a browser that writes the file in place, i.e. Chrome or Edge";
    }
    app2.listen("history", () => {
      undoButton.disabled = !app2.history.canUndo;
      redoButton.disabled = !app2.history.canRedo;
    });
    app2.listen("report", () => {
      fileEl.textContent = app2.handle?.name ?? fileName();
      saveButton.classList.toggle("on", app2.dirty);
      autosaveButton.classList.toggle("on", app2.autosave);
      autosaveButton.setAttribute("aria-pressed", String(app2.autosave));
      whichButton.hidden = !app2.pairing?.problems.length;
      stateEl.textContent = app2.line.text;
      stateEl.title = app2.line.title;
      stateEl.classList.toggle("warn", app2.line.warn);
    });
    document.body.append(top);
  }

  // src/editor/shell/statusbar.ts
  var CSS12 = `
.beeson-edit-bottom { bottom: 0; height: 36px; font-size: 13px; color: var(--subtle, #bbb); border-top: 1px solid var(--line, #555); }
.beeson-edit-bottom button { padding: 2px 10px; font-size: 13px; }
.beeson-edit-bottom button.on { border-color: var(--violet, #96f); color: var(--text, #eee); }
.beeson-edit-bottom .count { white-space: nowrap; min-width: 9ch; text-align: center; }
.beeson-edit-bottom .beeson-layers { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.beeson-edit-bottom .beeson-layers[hidden] { display: none; }
.beeson-edit-bottom .beeson-layers > span { margin-right: 4px; }
.beeson-edit-bottom .hint { flex: 1; min-width: 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;
  function install12(app2, layers2) {
    injectStyle("statusbar", CSS12);
    const bottom = make("div", "beeson-edit-bottom");
    const prevButton = button("\u2039", "Previous slide", "Previous slide");
    const countEl = make("span", "count");
    const nextButton = button("\u203A", "Next slide", "Next slide");
    const hintEl = make("span", "hint", "Click a text or a formula to edit it, drag a figure or the \u283F handle of a block to move it, press G to jump to a slide, and Esc to leave a text and select its block");
    bottom.append(prevButton, countEl, nextButton, layers2, hintEl, app2.nav.button, app2.steps.button, app2.notes.button);
    const fail2 = (e) => app2.fail(e);
    wire(prevButton, () => app2.commands.run("navigate.previous"), fail2);
    wire(nextButton, () => app2.commands.run("navigate.next"), fail2);
    wire(app2.notes.button, () => app2.commands.run("view.notes"), fail2);
    const count = () => {
      const d = app2.deck();
      if (d) countEl.textContent = `Slide ${d.getSlidePastCount() + 1} of ${d.getTotalSlides()}`;
    };
    app2.listen("slide", count);
    app2.listen("resize", count);
    document.body.append(bottom);
  }

  // src/editor/shell/shell.ts
  function install13(_app) {
  }

  // src/editor/shell/menubar.ts
  function install14(_app) {
  }

  // src/editor/shell/keys-sheet.ts
  var BARS = ["File", "Edit", "Insert", "Format", "Arrange", "Slide", "View", "Help"];
  var CSS13 = `
.beeson-edit-keys { width: min(720px, calc(100vw - 32px)); max-height: calc(100vh - 64px); box-sizing: border-box; padding: 0; border: 1px solid var(--line, #555); border-radius: 10px; background: var(--bg, #000); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5); }
.beeson-edit-keys::backdrop { background: rgba(0, 0, 0, 0.4); }
.beeson-edit-keys .head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line, #555); }
.beeson-edit-keys h2 { margin: 0; font: 600 15px/1.4 system-ui, sans-serif; }
.beeson-edit-keys .head button { font: inherit; padding: 2px 10px; border: 1px solid var(--line, #555); border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.beeson-edit-keys .body { columns: 2 300px; column-gap: 32px; padding: 12px 16px 16px; overflow: auto; max-height: calc(100vh - 140px); }
.beeson-edit-keys section { break-inside: avoid; margin-bottom: 12px; }
.beeson-edit-keys h3 { margin: 0 0 4px; font: 600 12px/1.4 system-ui, sans-serif; color: var(--subtle, #bbb); }
.beeson-edit-keys .row { display: flex; justify-content: space-between; gap: 16px; padding: 2px 0; }
.beeson-edit-keys kbd { font: inherit; color: var(--subtle, #bbb); white-space: nowrap; }
`;
  function sheetRows(app2) {
    const platform = app2.platform;
    const commands2 = app2.commands.list().filter((c) => keysOf(c, platform).length);
    const label2 = (c) => typeof c.label === "string" ? c.label : c.label(app2);
    const barOf = (c) => c.menu?.bar ?? commands2.find((o) => o.menu && label2(o) === label2(c))?.menu?.bar ?? "Other";
    const rows = [];
    const sorted = [...commands2].sort((a, b) => (a.menu?.order ?? Infinity) - (b.menu?.order ?? Infinity));
    for (const c of sorted) {
      const bar = barOf(c);
      const keys = keysOf(c, platform).map((k) => display(k, platform));
      const row = rows.find((r) => r.bar === bar && r.label === label2(c));
      if (row) row.keys.push(...keys.filter((k) => !row.keys.includes(k)));
      else rows.push({ bar, label: label2(c), keys });
    }
    const rank = (bar) => BARS.includes(bar) ? BARS.indexOf(bar) : BARS.length;
    return rows.sort((a, b) => rank(a.bar) - rank(b.bar));
  }
  function install15(app2) {
    injectStyle("keys", CSS13);
    const sheet = make("dialog", "beeson-edit-keys");
    sheet.setAttribute("aria-labelledby", "beeson-edit-keys-title");
    const head = make("div", "head");
    const title = make("h2", "", "Keyboard Shortcuts");
    title.id = "beeson-edit-keys-title";
    const done = button("Done", "Close the list of keyboard shortcuts");
    head.append(title, done);
    const body = make("div", "body");
    sheet.append(head, body);
    let back = null;
    done.addEventListener("click", () => sheet.close());
    sheet.addEventListener("close", () => {
      if (back instanceof HTMLElement && back !== document.body && back.isConnected) back.focus();
      else document.activeElement?.blur();
    });
    sheet.addEventListener("click", (ev) => {
      if (ev.target === sheet) sheet.close();
    });
    document.body.append(sheet);
    const open = () => {
      body.replaceChildren();
      let section = null;
      let bar = "";
      for (const row of sheetRows(app2)) {
        if (row.bar !== bar || !section) {
          bar = row.bar;
          section = make("section");
          section.append(make("h3", "", bar));
          body.append(section);
        }
        const line = make("div", "row");
        line.append(make("span", "", row.label), make("kbd", "", row.keys.join(", ")));
        section.append(line);
      }
      back = document.activeElement;
      sheet.showModal();
      done.focus();
    };
    app2.commands.define({
      id: "help.keys",
      label: "Keyboard Shortcuts",
      keys: { mac: ["?"], other: ["?"] },
      menu: { bar: "Help", group: "help", order: 10 },
      run: () => {
        if (!sheet.open) open();
      }
    });
  }

  // src/editor/ui/menu.ts
  function install16(_app) {
  }

  // src/editor/ui/dialog.ts
  function install17(_app) {
  }

  // src/editor/ui/icons.ts
  function install18(_app) {
  }

  // src/editor/canvas/hit.ts
  var MOVABLE = "h1, h2, h3, p, ul, ol, dl, table, pre, blockquote, div.math, .caption, .foot, img, video, figure, .zone, .plate, .qr, tycho-viewer";
  var BY_ITSELF = "img, video, figure, .zone, .plate, .qr";
  var OUTSIDE2 = "aside.notes, .backdrop";
  var RESIZABLE = "img, video, .qr, tycho-viewer";
  var CONTAINER = "figure, .zone, .plate";
  var BAND = 6;
  function frameOf(app2) {
    const slides = app2.slides();
    const r = slides.getBoundingClientRect();
    const scale = slides.offsetWidth ? r.width / slides.offsetWidth : app2.deck()?.getScale() ?? 1;
    return { left: r.left, top: r.top, scale: scale || 1 };
  }
  var toSlide = (f, r) => ({ left: (r.left - f.left) / f.scale, top: (r.top - f.top) / f.scale, width: r.width / f.scale, height: r.height / f.scale });
  var toScreen = (f, b) => ({ left: f.left + b.left * f.scale, top: f.top + b.top * f.scale, width: b.width * f.scale, height: b.height * f.scale });
  function visualRect(el) {
    const r = el.getBoundingClientRect();
    const box2 = { left: r.left, top: r.top, width: r.width, height: r.height };
    const natural = el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : null;
    if (!natural || !natural[0] || !natural[1] || !r.width || !r.height) return box2;
    const style = getComputedStyle(el);
    if (style.objectFit !== "contain" && style.objectFit !== "scale-down") return box2;
    let s = Math.min(r.width / natural[0], r.height / natural[1]);
    if (style.objectFit === "scale-down") s = Math.min(s, 1);
    const w = natural[0] * s, h = natural[1] * s;
    const [px3, py] = style.objectPosition.split(/\s+/);
    const at = (v, room) => !v ? room / 2 : v.endsWith("%") ? parseFloat(v) / 100 * room : parseFloat(v) || 0;
    return { left: r.left + at(px3, r.width - w), top: r.top + at(py, r.height - h), width: w, height: h };
  }
  function aspectOf(el) {
    if (el.matches("tycho-viewer")) return null;
    const r = visualRect(el);
    return r.width && r.height ? r.width / r.height : null;
  }
  function movableOf(app2, target) {
    const slide = app2.current();
    const pairing = app2.pairing;
    if (!target || !slide || !pairing || !slide.contains(target) || target.closest(OUTSIDE2)) return null;
    let el = target.closest(MOVABLE);
    while (el) {
      const up = el.parentElement?.closest(MOVABLE) ?? null;
      if (!up || !slide.contains(up)) break;
      el = up;
    }
    return el && slide.contains(el) && pairing.elements.get(el)?.open ? el : null;
  }
  function movablesOf(app2) {
    const slide = app2.current();
    if (!slide) return [];
    return [...slide.querySelectorAll(MOVABLE)].filter((el) => movableOf(app2, el) === el && el.getBoundingClientRect().width > 0);
  }
  function mediaIn(figure, target) {
    const media = target?.closest("img, video") ?? null;
    return media && media !== figure && figure.contains(media) && media.parentElement?.closest(MOVABLE) === figure ? media : null;
  }
  function containerOf(app2, el) {
    const up = el.parentElement?.closest(MOVABLE) ?? null;
    return up && app2.current()?.contains(up) ? up : null;
  }
  function onCanvas(target) {
    return !!target?.closest(".reveal") && !target.closest("aside.notes");
  }
  function bandAt(app2, x, y) {
    let best = null;
    for (const el of movablesOf(app2)) {
      const r = el.getBoundingClientRect();
      const outside = x < r.left || x > r.right || y < r.top || y > r.bottom;
      const inFrame = x >= r.left - BAND && x <= r.right + BAND && y >= r.top - BAND && y <= r.bottom + BAND;
      if (!outside || !inFrame) continue;
      const d = Math.max(r.left - x, x - r.right, r.top - y, y - r.bottom);
      if (!best || d < best.d) best = { el, d };
    }
    return best?.el ?? null;
  }
  var hasText = (el) => el.matches(HOST) || !!el.querySelector(HOST);
  function install19(_app) {
  }

  // src/editor/selection.ts
  var inOrder = (items) => [...new Set(items)].sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  function mark(pairing) {
    for (const el of document.querySelectorAll(".beeson-movable")) {
      el.classList.remove("beeson-movable");
      el.removeAttribute("tabindex");
    }
    if (!pairing) return;
    for (const [el, src] of pairing.elements) {
      if (!src.open || !el.matches(BY_ITSELF) || el.closest(OUTSIDE2)) continue;
      const up = el.parentElement?.closest(MOVABLE);
      if (up && el.closest("section")?.contains(up)) continue;
      el.classList.add("beeson-movable");
      el.setAttribute("tabindex", "0");
      if (!el.hasAttribute("aria-label") && !el.hasAttribute("alt")) el.setAttribute("aria-label", "Figure: the arrow keys move it, Esc deselects it");
    }
  }
  function install20(app2) {
    let kind = "none";
    let items = [];
    const listeners = [];
    const set = (k, next) => {
      const ordered = k === "none" ? [] : inOrder(next);
      const nextKind = ordered.length ? k : "none";
      if (nextKind === kind && ordered.length === items.length && ordered.every((el, i) => el === items[i])) return;
      items = ordered;
      kind = nextKind;
      for (const fn of listeners) fn();
      app2.invalidate("selection");
    };
    const selection = {
      get kind() {
        return kind;
      },
      get items() {
        return items;
      },
      set,
      add: (item) => set(kind === "none" || kind === "text" ? "elements" : kind, [...kind === "text" ? [] : items, item]),
      toggle: (item) => {
        const base = kind === "text" ? [] : items;
        set(kind === "none" || kind === "text" ? "elements" : kind, base.includes(item) ? base.filter((i) => i !== item) : [...base, item]);
      },
      clear: () => set("none", []),
      selectAll: () => {
        if (kind === "slides") set("slides", [...app2.slides().querySelectorAll(":scope > section")]);
        else set("elements", movablesOf(app2));
      },
      listen: (fn) => void listeners.push(fn),
      has: (item) => items.includes(item),
      elements: () => kind === "elements" ? items : [],
      only: () => kind === "elements" && items.length === 1 ? items[0] : null
    };
    app2.selection = selection;
    const move = {
      select: (el) => el ? set("elements", [el]) : set("none", []),
      movableOf: (target) => movableOf(app2, target),
      mark,
      refresh: () => app2.invalidate("selection")
    };
    app2.move = move;
    document.addEventListener("focusin", (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      const host = app2.hostOf(target);
      if (host && app2.current()?.contains(host) && !host.closest("aside.notes")) set("text", [host]);
      else if (target?.classList.contains("beeson-movable")) set("elements", [target]);
    });
    app2.listen("slide", () => {
      if (kind !== "slides") set("none", []);
    });
    app2.onRefresh(["content", "structure", "slide"], () => {
      if (kind === "slides" || kind === "none") return;
      const slide = app2.current();
      const kept = items.filter((el) => el.isConnected && !!slide?.contains(el));
      if (kept.length !== items.length) set(kind, kept);
    });
  }

  // src/editor/canvas/frames.ts
  var HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  var view = { hover: null, moving: null, resizing: false, guides: [], spacing: [], readout: null, marquee: null };
  var CSS14 = `
.beeson-overlay { position: fixed; inset: 0; z-index: 51; pointer-events: none; }
.beeson-frame { position: fixed; pointer-events: none; box-sizing: border-box; border: 1px dashed var(--ed-muted, var(--subtle, #bbb)); }
.beeson-frame.selected { border: 2px solid var(--ed-select, #7048e8); }
.beeson-frame.union { border: 1px dashed var(--ed-select, #7048e8); }
.beeson-overlay [hidden] { display: none !important; }
.beeson-grip { position: fixed; width: 9px; height: 9px; margin: -5.5px 0 0 -5.5px; border-radius: 50%; border: 1.5px solid var(--ed-select, #7048e8); background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); pointer-events: auto; touch-action: none; }
.beeson-grip.fixed { border-color: #8a8a8a; background: #d9d9d9; pointer-events: none; }
.beeson-grip[data-handle=nw], .beeson-grip[data-handle=se] { cursor: nwse-resize; }
.beeson-grip[data-handle=ne], .beeson-grip[data-handle=sw] { cursor: nesw-resize; }
.beeson-grip[data-handle=n], .beeson-grip[data-handle=s] { cursor: ns-resize; }
.beeson-grip[data-handle=e], .beeson-grip[data-handle=w] { cursor: ew-resize; }
.beeson-handle { position: fixed; width: 22px; height: 22px; box-sizing: border-box; border-radius: 6px; border: 1px solid var(--ed-line, var(--line, #555)); background: var(--ed-panel, var(--bg, #000)); color: var(--ed-text, var(--text, #eee)); font: 14px/20px system-ui, sans-serif; text-align: center; cursor: move; user-select: none; pointer-events: auto; }
.beeson-handle:hover, .beeson-handle:focus-visible { border-color: var(--ed-select, #7048e8); outline: none; }
.beeson-guide { position: fixed; background: var(--ed-guide, #e8590c); }
.beeson-guide.v { width: 1px; }
.beeson-guide.h { height: 1px; }
.beeson-gap { position: fixed; box-sizing: border-box; border-color: var(--ed-guide, #e8590c); border-style: solid; border-width: 0; }
.beeson-gap.h { height: 7px; margin-top: -3px; border-left-width: 1px; border-right-width: 1px; background: linear-gradient(var(--ed-guide, #e8590c), var(--ed-guide, #e8590c)) center / 100% 1px no-repeat; }
.beeson-gap.v { width: 7px; margin-left: -3px; border-top-width: 1px; border-bottom-width: 1px; background: linear-gradient(var(--ed-guide, #e8590c), var(--ed-guide, #e8590c)) center / 1px 100% no-repeat; }
.beeson-offset { position: fixed; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 5px; background: var(--ed-guide, #e8590c); color: #fff; font: 600 12px/22px system-ui, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; }
.beeson-offset.frame { transform: translateX(-100%); }
.beeson-marquee { position: fixed; box-sizing: border-box; border: 1px solid var(--ed-select, #7048e8); background: color-mix(in srgb, var(--ed-select, #7048e8) 12%, transparent); }
html.beeson-editing .reveal .beeson-movable:focus-visible { outline: 2px solid var(--ed-select, #7048e8); outline-offset: 6px; }
html.beeson-dragging, html.beeson-dragging * { cursor: move !important; user-select: none !important; }
html.beeson-resizing, html.beeson-resizing * { user-select: none !important; }
html.beeson-band, html.beeson-band .reveal * { cursor: move; }
html.beeson-editing .reveal .slides section img, html.beeson-editing .reveal .slides section video, html.beeson-editing .reveal .slides section .zone, html.beeson-editing .reveal .slides section .plate, html.beeson-editing .reveal .slides section .qr { cursor: move; }
`;
  var div = (className, parent) => {
    const d = document.createElement("div");
    d.className = className;
    d.hidden = true;
    parent.append(d);
    return d;
  };
  var place = (d, b) => {
    d.hidden = false;
    Object.assign(d.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  };
  var grow = (b, by) => ({ left: b.left - by, top: b.top - by, width: b.width + 2 * by, height: b.height + 2 * by });
  var Frames = class {
    constructor(app2) {
      this.frames = [];
      this.guides = [];
      this.gaps = [];
      injectStyle("frames", CSS14);
      this.app = app2;
      this.layer = document.createElement("div");
      this.layer.className = "beeson-overlay";
      this.hoverFrame = div("beeson-frame", this.layer);
      this.frames.push(div("beeson-frame selected", this.layer));
      this.union = div("beeson-frame union", this.layer);
      this.guides.push(div("beeson-guide v", this.layer), div("beeson-guide h", this.layer));
      this.marquee = div("beeson-marquee", this.layer);
      this.grips = Object.fromEntries(HANDLES.map((h) => {
        const g = div("beeson-grip", this.layer);
        g.dataset.handle = h;
        return [h, g];
      }));
      this.handle = div("beeson-handle", this.layer);
      this.handle.textContent = "\u283F";
      this.handle.title = "Drag to move, double-click to put back, arrow keys nudge";
      this.handle.tabIndex = 0;
      this.handle.setAttribute("role", "button");
      this.handle.setAttribute("aria-label", "Move the block: the arrow keys nudge it, Enter puts it back");
      this.readout = div("beeson-offset", this.layer);
    }
    // the element that the handle of a block is shown at: the one dragged, under the pointer, or
    // being edited, else the one selected
    current() {
      const active = document.activeElement instanceof Element ? document.activeElement : null;
      const editing = active?.closest(HOST) ?? null;
      return view.moving?.[0] ?? view.hover ?? movableOf(this.app, editing) ?? this.app.selection.only();
    }
    // the resize handles of the one selected element: live on an image, a video, a QR code, or a
    // viewer, gray on a figure whose size is set by its layout, and none on a block of text
    gripsOf(el) {
      if (!el || this.app.selection.only() !== el) return null;
      if (el.matches(RESIZABLE)) return "live";
      return el.matches(CONTAINER) ? "fixed" : null;
    }
    draw() {
      const app2 = this.app;
      const reveal = document.querySelector(".reveal")?.getBoundingClientRect();
      if (reveal) this.layer.style.clipPath = `inset(${reveal.top}px ${innerWidth - reveal.right}px ${innerHeight - reveal.bottom}px ${reveal.left}px)`;
      if (view.hover && !view.hover.isConnected) view.hover = null;
      const selected = app2.selection.elements().filter((el) => el.isConnected);
      const boxOf = (el) => el.matches(RESIZABLE) || el.matches(CONTAINER) ? visualRect(el) : grow(visualRect(el), 6);
      const boxes = selected.map(boxOf);
      while (this.frames.length < boxes.length) this.frames.push(div("beeson-frame selected", this.layer));
      this.frames.forEach((f, i) => boxes[i] ? place(f, boxes[i]) : f.hidden = true);
      if (boxes.length > 1) {
        const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
        const right = Math.max(...boxes.map((b) => b.left + b.width)), bottom = Math.max(...boxes.map((b) => b.top + b.height));
        place(this.union, grow({ left, top, width: right - left, height: bottom - top }, 6));
      } else this.union.hidden = true;
      const only = app2.selection.only();
      const grips = view.moving && !view.resizing ? null : this.gripsOf(only);
      const tycho = !!only?.matches("tycho-viewer");
      for (const h of HANDLES) {
        const g = this.grips[h];
        if (!grips || !only || tycho && (h === "n" || h === "s")) {
          g.hidden = true;
          continue;
        }
        const b = boxes[0];
        const x = h.includes("w") ? b.left : h.includes("e") ? b.left + b.width : b.left + b.width / 2;
        const y = h.includes("n") ? b.top : h.includes("s") ? b.top + b.height : b.top + b.height / 2;
        g.hidden = false;
        g.classList.toggle("fixed", grips === "fixed");
        Object.assign(g.style, { left: `${x}px`, top: `${y}px` });
      }
      const hot = this.current();
      const framed = hot && selected.includes(hot);
      this.hoverFrame.hidden = !hot || !!framed || !!view.moving;
      if (hot && !framed && !view.moving) place(this.hoverFrame, grow(visualRect(hot), 6));
      this.handle.hidden = !hot || hot === only && !!this.gripsOf(only);
      if (!this.handle.hidden && hot) {
        const r = hot.getBoundingClientRect();
        Object.assign(this.handle.style, { left: `${r.left - 24}px`, top: `${r.top - 24}px` });
      }
      this.drawGuides();
      if (view.marquee) place(this.marquee, view.marquee);
      else this.marquee.hidden = true;
      const out = view.readout;
      this.readout.hidden = !out;
      if (out) {
        this.readout.textContent = out.text;
        this.readout.classList.toggle("frame", out.at === "frame");
        Object.assign(this.readout.style, { left: `${out.x}px`, top: `${out.y}px` });
      }
    }
    drawGuides() {
      const f = frameOf(this.app);
      const lines2 = { v: view.guides.filter((g) => g.axis === "x"), h: view.guides.filter((g) => g.axis === "y") };
      const used = { v: 0, h: 0 };
      const take = (cls) => {
        const pool = this.guides.filter((d2) => d2.classList.contains(cls));
        const d = pool[used[cls]++] ?? div(`beeson-guide ${cls}`, this.layer);
        if (!this.guides.includes(d)) this.guides.push(d);
        return d;
      };
      for (const g of lines2.v) place(take("v"), { ...toScreen(f, { left: g.at, top: g.from, width: 0, height: g.to - g.from }), width: 1 });
      for (const g of lines2.h) place(take("h"), { ...toScreen(f, { left: g.from, top: g.at, width: g.to - g.from, height: 0 }), height: 1 });
      for (const cls of ["v", "h"]) this.guides.filter((d) => d.classList.contains(cls)).slice(used[cls]).forEach((d) => d.hidden = true);
      let n = 0;
      for (const s of view.spacing) {
        for (const gap of s.gaps) {
          const d = this.gaps[n] ?? div("beeson-gap", this.layer);
          if (!this.gaps.includes(d)) this.gaps.push(d);
          n++;
          d.className = `beeson-gap ${s.axis === "x" ? "h" : "v"}`;
          const b = s.axis === "x" ? toScreen(f, { left: gap.from, top: gap.at, width: gap.to - gap.from, height: 0 }) : toScreen(f, { left: gap.at, top: gap.from, width: 0, height: gap.to - gap.from });
          place(d, s.axis === "x" ? { ...b, height: 7 } : { ...b, width: 7 });
        }
      }
      this.gaps.slice(n).forEach((d) => d.hidden = true);
    }
  };
  var installed = null;
  function overlay() {
    if (!installed) throw new Error("the frames are not installed");
    return installed;
  }
  function install21(app2) {
    const frames = new Frames(app2);
    installed = frames;
    document.body.append(frames.layer);
    app2.selection.listen(() => {
      if (!view.moving) view.readout = null;
      frames.draw();
    });
    app2.onRefresh(["content", "selection", "slide", "structure", "layout"], () => frames.draw());
    app2.listen("resize", () => frames.draw());
  }

  // src/editor/canvas/snap.ts
  var LAYOUT_GUIDES = { x: [120, 880, 1120, 1200, 1800], y: [44, 120, 920, 1030] };
  var SAME = 0.5;
  var MIN = 16;
  var start = (b, axis) => axis === "x" ? b.left : b.top;
  var size = (b, axis) => axis === "x" ? b.width : b.height;
  var end = (b, axis) => start(b, axis) + size(b, axis);
  var other = (axis) => axis === "x" ? "y" : "x";
  var edgesOf = (b, axis) => [start(b, axis), start(b, axis) + size(b, axis) / 2, end(b, axis)];
  function linesOf(targets2, axis) {
    const extent = axis === "x" ? targets2.slide.width : targets2.slide.height;
    const lines2 = [0, extent / 2, extent].map((at) => ({ at, kind: "slide", box: null }));
    for (const at of targets2.layout?.[axis] ?? []) lines2.push({ at, kind: "layout", box: null });
    for (const box2 of [...targets2.boxes, ...targets2.frames ?? []]) for (const at of edgesOf(box2, axis)) lines2.push({ at, kind: "element", box: box2 });
    return lines2;
  }
  function nearest(edges, lines2, threshold) {
    let best = null;
    for (const edge of edges) {
      for (const line of lines2) {
        const d = Math.abs(line.at - edge);
        if (d <= threshold && (!best || d < best.d)) best = { shift: line.at - edge, d };
      }
    }
    return best;
  }
  function guidesAt(box2, axis, edges, lines2, targets2) {
    const across = other(axis);
    const extent = across === "x" ? targets2.slide.width : targets2.slide.height;
    const out = /* @__PURE__ */ new Map();
    for (const line of lines2) {
      if (!edges.some((e) => Math.abs(line.at - e) < SAME)) continue;
      const key = `${line.kind === "element" ? "element" : "full"}:${Math.round(line.at * 2)}`;
      const span = line.box ? { from: Math.min(start(box2, across), start(line.box, across)), to: Math.max(end(box2, across), end(line.box, across)) } : { from: 0, to: extent };
      const had = out.get(key);
      if (had) Object.assign(had, { from: Math.min(had.from, span.from), to: Math.max(had.to, span.to) });
      else out.set(key, { axis, at: line.at, kind: line.kind, ...span });
    }
    const full = [...out.values()].filter((g) => g.kind !== "element");
    return [...out.values()].filter((g) => g.kind === "element" && !full.some((f) => Math.abs(f.at - g.at) < SAME)).concat(full);
  }
  function neighbors(box2, axis, boxes) {
    const across = other(axis);
    const overlaps = (b) => start(b, across) < end(box2, across) && end(b, across) > start(box2, across);
    const beside = boxes.filter(overlaps);
    const before = beside.filter((b) => end(b, axis) <= start(box2, axis) + SAME).sort((a, b) => end(b, axis) - end(a, axis));
    const after = beside.filter((b) => start(b, axis) >= end(box2, axis) - SAME).sort((a, b) => start(a, axis) - start(b, axis));
    return { before, after };
  }
  function spacingStarts(box2, axis, boxes) {
    const { before, after } = neighbors(box2, axis, boxes);
    const out = [];
    const [a, b] = before;
    const [c, d] = after;
    if (a && c) out.push((end(a, axis) + start(c, axis) - size(box2, axis)) / 2);
    if (a && b && end(b, axis) <= start(a, axis)) out.push(end(a, axis) + (start(a, axis) - end(b, axis)));
    if (c && d && start(d, axis) >= end(c, axis)) out.push(start(c, axis) - (start(d, axis) - end(c, axis)) - size(box2, axis));
    return out;
  }
  function spacingOf(box2, axis, boxes) {
    const { before, after } = neighbors(box2, axis, boxes);
    const across = other(axis);
    const gap = (from, to) => ({ from: end(from, axis), to: start(to, axis), at: (Math.max(start(from, across), start(to, across)) + Math.min(end(from, across), end(to, across))) / 2 });
    const [a, b] = before;
    const [c, d] = after;
    const near = [];
    if (a) near.push(gap(a, box2));
    if (c) near.push(gap(box2, c));
    const far = [];
    if (a && b && end(b, axis) <= start(a, axis)) far.push(gap(b, a));
    if (c && d && start(d, axis) >= end(c, axis)) far.push(gap(c, d));
    const width = (g) => g.to - g.from;
    for (const g of near) {
      const equal = [...near, ...far].filter((h) => h !== g && Math.abs(width(h) - width(g)) < SAME && width(g) > 0);
      if (equal.length) return { axis, gaps: [g, ...equal].sort((p, q) => p.from - q.from) };
    }
    return null;
  }
  function snapMove(box2, targets2, threshold, axes = { x: true, y: true }) {
    const shift = { x: 0, y: 0 };
    const lines2 = { x: linesOf(targets2, "x"), y: linesOf(targets2, "y") };
    for (const axis of ["x", "y"]) {
      if (!axes[axis]) continue;
      let best = nearest(edgesOf(box2, axis), lines2[axis], threshold);
      for (const at of spacingStarts(box2, axis, targets2.boxes)) {
        const d = Math.abs(at - start(box2, axis));
        if (d <= threshold && (!best || d < best.d)) best = { shift: at - start(box2, axis), d };
      }
      if (best) shift[axis] = best.shift;
    }
    const moved = { ...box2, left: box2.left + shift.x, top: box2.top + shift.y };
    const guides = [];
    const spacing = [];
    for (const axis of ["x", "y"]) {
      if (!axes[axis]) continue;
      guides.push(...guidesAt(moved, axis, edgesOf(moved, axis), lines2[axis], targets2));
      const s = spacingOf(moved, axis, targets2.boxes);
      if (s) spacing.push(s);
    }
    return { dx: shift.x, dy: shift.y, guides, spacing };
  }
  var lockedAxis = (dx, dy) => Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  var SIDES = {
    nw: { x: -1, y: -1 },
    n: { x: 0, y: -1 },
    ne: { x: 1, y: -1 },
    e: { x: 1, y: 0 },
    se: { x: 1, y: 1 },
    s: { x: 0, y: 1 },
    sw: { x: -1, y: 1 },
    w: { x: -1, y: 0 }
  };
  function anchored(from, handle, w, h, center) {
    const { x, y } = SIDES[handle];
    const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
    const left = center || x === 0 ? cx - w / 2 : x === 1 ? from.left : from.left + from.width - w;
    const top = center || y === 0 ? cy - h / 2 : y === 1 ? from.top : from.top + from.height - h;
    return { left, top, width: w, height: h };
  }
  function resizeBox(from, handle, dx, dy, o) {
    const { x, y } = SIDES[handle];
    const k = o.center ? 2 : 1;
    let w = from.width;
    let h = from.height;
    if (o.aspect) {
      const a = o.aspect;
      if (x && y) w = from.width * (1 + k * (x * dx * from.width + y * dy * from.height) / (from.width ** 2 + from.height ** 2));
      else if (x) w = from.width + k * x * dx;
      else h = from.height + k * y * dy;
      if (x) h = w / a;
      else w = h * a;
      if (w < MIN || h < MIN) [w, h] = a >= 1 ? [MIN * a, MIN] : [MIN, MIN / a];
    } else if (x) w = Math.max(MIN, from.width + k * x * dx);
    return anchored(from, handle, w, h, o.center);
  }
  function snapResize(from, handle, box2, targets2, threshold, o) {
    const sides = SIDES[handle];
    const moving = (b, axis) => {
      const sign = sides[axis];
      if (!sign || !o.aspect && axis === "y") return [];
      return o.center ? [start(b, axis), end(b, axis)] : [sign === 1 ? end(b, axis) : start(b, axis)];
    };
    const lines2 = { x: linesOf(targets2, "x"), y: linesOf(targets2, "y") };
    let best = null;
    for (const axis of ["x", "y"]) {
      for (const edge of moving(box2, axis)) {
        for (const line of lines2[axis]) {
          const d = Math.abs(line.at - edge);
          if (d <= threshold && (!best || d < best.d)) best = { axis, edge, at: line.at, d };
        }
      }
    }
    let out = box2;
    if (best) {
      const { axis, edge, at } = best;
      const span = o.center ? 2 * Math.abs(at - (start(box2, axis) + size(box2, axis) / 2)) : Math.abs(at - (edge === end(box2, axis) ? start(box2, axis) : end(box2, axis)));
      let w = box2.width, h = box2.height;
      if (axis === "x") {
        w = Math.max(MIN, span);
        if (o.aspect) h = w / o.aspect;
      } else {
        h = Math.max(MIN, span);
        if (o.aspect) w = h * o.aspect;
      }
      out = anchored(from, handle, w, h, o.center);
    }
    const guides = [];
    for (const axis of ["x", "y"]) guides.push(...guidesAt(out, axis, moving(out, axis), lines2[axis], targets2));
    return { box: out, guides };
  }
  function install22(_app) {
  }

  // src/editor/canvas/drag.ts
  var CLICK = 3;
  var SNAP = 8;
  var px2 = (v) => {
    const n = parseFloat(v ?? "");
    return Number.isFinite(n) ? n : null;
  };
  function placeOf2(el) {
    const style = el.style;
    const [x, y] = (style.translate ?? "").split(/\s+/).map((p) => px2(p));
    const translate = x === null || x === void 0 ? null : { x, y: y ?? 0 };
    return { translate: translate && (translate.x || translate.y) ? translate : null, width: el.matches(RESIZABLE) ? px2(style.width) : null };
  }
  var samePlace = (a, b) => (a.translate?.x ?? 0) === (b.translate?.x ?? 0) && (a.translate?.y ?? 0) === (b.translate?.y ?? 0) && a.width === b.width;
  function writePlace(app2, el, p) {
    const style = el.style;
    const t = p.translate && (p.translate.x || p.translate.y) ? { x: Math.round(p.translate.x), y: Math.round(p.translate.y) } : null;
    style.translate = t ? `${t.x}px ${t.y}px` : "";
    const edit = { ...app2.tagEdits.get(el), translate: t };
    if (el.matches(RESIZABLE)) {
      const w = p.width === null ? null : Math.round(p.width);
      style.width = w === null ? "" : `${w}px`;
      if (w !== null || edit.style?.width !== void 0 || /(^|;)\s*width\s*:/.test(el.getAttribute("style") ?? "")) edit.style = { ...edit.style, width: w === null ? null : `${w}px` };
    }
    app2.tagEdits.set(el, edit);
    app2.markDirty();
  }
  function record(app2, label2, changes) {
    const moved = changes.filter((c) => !samePlace(c.from, c.to));
    if (!moved.length) return moved;
    const apply = (way) => {
      app2.showSlide(moved[0].el);
      for (const c of moved) writePlace(app2, c.el, c[way]);
      app2.selection.set("elements", moved.map((c) => c.el));
      app2.invalidate("content");
    };
    app2.history.push({ label: label2, undo: () => apply("from"), redo: () => apply("to") });
    return moved;
  }
  var union = (boxes) => {
    const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
    return { left, top, width: Math.max(...boxes.map((b) => b.left + b.width)) - left, height: Math.max(...boxes.map((b) => b.top + b.height)) - top };
  };
  function contentRect(el) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const k = el.offsetWidth ? r.width / el.offsetWidth : 1;
    const p = (v) => (parseFloat(v) || 0) * k;
    return { left: r.left + p(s.paddingLeft), top: r.top + p(s.paddingTop), width: r.width - p(s.paddingLeft) - p(s.paddingRight), height: r.height - p(s.paddingTop) - p(s.paddingBottom) };
  }
  function install23(app2) {
    const frames = overlay();
    let press = null;
    const mac = () => app2.platform === "mac";
    const commandHeld = (ev) => mac() ? ev.metaKey : ev.ctrlKey;
    const freeMove = (ev) => mac() ? ev.metaKey || ev.altKey : ev.altKey;
    const freeResize = (ev) => mac() ? ev.metaKey : ev.altKey;
    const aboutCenter = (ev) => mac() ? ev.altKey : ev.ctrlKey;
    const leaveText = () => {
      const host = app2.hostOf(document.activeElement);
      if (host) host.blur();
    };
    const targetsFor = (els) => {
      const f = frameOf(app2);
      const others = movablesOf(app2).filter((o) => !els.some((el) => el === o || el.contains(o) || o.contains(el)));
      const frames_ = [];
      for (const el of els) {
        const up = containerOf(app2, el);
        if (up) frames_.push(toSlide(f, contentRect(up)));
      }
      const slides = app2.slides();
      return {
        boxes: others.map((o) => toSlide(f, visualRect(o))).filter((b) => b.width > 0 && b.height > 0),
        frames: frames_,
        slide: { width: slides.offsetWidth || 1920, height: slides.offsetHeight || 1080 },
        layout: LAYOUT_GUIDES
      };
    };
    const start2 = (kind, ev, el, els, click) => {
      const f = frameOf(app2);
      const p = {
        kind,
        x: ev.clientX,
        y: ev.clientY,
        moved: false,
        el,
        els,
        click,
        from: new Map(els.map((e) => [e, placeOf2(e)])),
        base: els.length ? union(els.map((e) => toSlide(f, visualRect(e)))) : { left: 0, top: 0, width: 0, height: 0 }
      };
      press = p;
      view.hover = null;
      return p;
    };
    const pressElement = (ev, el, target) => {
      ev.preventDefault();
      leaveText();
      const sel = app2.selection;
      const add = ev.shiftKey || commandHeld(ev);
      let click = null;
      if (add) {
        if (sel.has(el)) click = () => sel.toggle(el);
        else sel.add(el);
      } else if (sel.has(el)) {
        const several = sel.elements().length > 1;
        const media = mediaIn(el, target);
        click = () => {
          if (several) sel.set("elements", [el]);
          else if (media) sel.set("elements", [media]);
        };
      } else sel.set("elements", [el]);
      start2("move", ev, el, sel.elements().filter((e) => !sel.elements().some((o) => o !== e && o.contains(e))), click);
    };
    const onDown = (ev) => {
      if (ev.button !== 0 || press) return;
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target) return;
      const sel = app2.selection;
      const grip = target.closest(".beeson-grip");
      if (grip && !grip.classList.contains("fixed")) {
        const el2 = sel.only();
        if (!el2) return;
        ev.preventDefault();
        ev.stopPropagation();
        Object.assign(start2("resize", ev, el2, [el2], null), { handle: grip.dataset.handle, aspect: aspectOf(el2) });
        document.documentElement.classList.add("beeson-resizing");
        return;
      }
      if (target === frames.handle) {
        const el2 = frames.current();
        if (el2) pressElement(ev, el2, null);
        return;
      }
      if (!onCanvas(target)) return;
      const inner = sel.only();
      if (inner && inner.matches(RESIZABLE) && containerOf(app2, inner) && inner.contains(target)) {
        pressElement(ev, inner, target);
        return;
      }
      const el = movableOf(app2, target);
      const host = app2.hostOf(target);
      if (el && host) {
        if (ev.shiftKey || commandHeld(ev)) pressElement(ev, el, target);
        return;
      }
      if (el && (target.closest(BY_ITSELF) || !hasText(el))) {
        if (el.matches(BY_ITSELF)) pressElement(ev, el, target);
        else if (!sel.has(el)) sel.set("elements", [el]);
        return;
      }
      const band = bandAt(app2, ev.clientX, ev.clientY);
      if (band) {
        pressElement(ev, band, null);
        return;
      }
      ev.preventDefault();
      leaveText();
      const add = ev.shiftKey || commandHeld(ev);
      const initial = add ? sel.elements().slice() : [];
      if (!add) sel.clear();
      start2("marquee", ev, null, [], null).initial = initial;
    };
    const onMove = (ev) => {
      const p = press;
      if (!p) {
        hover(ev);
        return;
      }
      if (!p.moved && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < CLICK) return;
      p.moved = true;
      const f = frameOf(app2);
      if (p.kind === "marquee") {
        const left = Math.min(p.x, ev.clientX), top = Math.min(p.y, ev.clientY);
        const box2 = { left, top, width: Math.abs(ev.clientX - p.x), height: Math.abs(ev.clientY - p.y) };
        view.marquee = box2;
        const touched = movablesOf(app2).filter((el) => {
          const r = visualRect(el);
          return r.left <= box2.left + box2.width && r.left + r.width >= box2.left && r.top <= box2.top + box2.height && r.top + r.height >= box2.top;
        });
        app2.selection.set("elements", [...p.initial ?? [], ...touched]);
        frames.draw();
        return;
      }
      let dx = (ev.clientX - p.x) / f.scale;
      let dy = (ev.clientY - p.y) / f.scale;
      if (p.kind === "resize") {
        resize(p, ev, dx, dy);
        return;
      }
      const lock = ev.shiftKey ? lockedAxis(dx, dy) : null;
      if (lock === "x") dy = 0;
      if (lock === "y") dx = 0;
      const moved = { ...p.base, left: p.base.left + dx, top: p.base.top + dy };
      const snap = freeMove(ev) ? null : snapMove(moved, targetsFor(p.els), SNAP / f.scale, { x: lock !== "y", y: lock !== "x" });
      dx += snap?.dx ?? 0;
      dy += snap?.dy ?? 0;
      for (const el of p.els) {
        const from = p.from.get(el);
        writeLive(el, { translate: { x: (from.translate?.x ?? 0) + dx, y: (from.translate?.y ?? 0) + dy }, width: from.width });
      }
      view.moving = p.els;
      view.guides = snap?.guides ?? [];
      view.spacing = snap?.spacing ?? [];
      const t = p.el ? placeOf2(p.el).translate : null;
      const seen2 = union(p.els.map(visualRect));
      view.readout = { text: `${t?.x ?? 0}, ${t?.y ?? 0}`, x: seen2.left + seen2.width + 6, y: seen2.top + seen2.height + 10, at: "frame" };
      document.documentElement.classList.add("beeson-dragging");
      frames.draw();
      app2.invalidate("content");
    };
    const writeLive = (el, p) => {
      const style = el.style;
      const t = p.translate && (Math.round(p.translate.x) || Math.round(p.translate.y)) ? p.translate : null;
      style.translate = t ? `${Math.round(t.x)}px ${Math.round(t.y)}px` : "";
      if (el.matches(RESIZABLE)) style.width = p.width === null ? "" : `${Math.round(p.width)}px`;
    };
    const resize = (p, ev, dx, dy) => {
      const el = p.els[0];
      const f = frameOf(app2);
      const o = { aspect: p.aspect ?? null, center: aboutCenter(ev) };
      let box2 = resizeBox(p.base, p.handle, dx, dy, o);
      view.guides = [];
      if (!freeResize(ev)) {
        const snapped = snapResize(p.base, p.handle, box2, targetsFor([el]), SNAP / f.scale, o);
        box2 = snapped.box;
        view.guides = snapped.guides;
      }
      el.style.width = `${Math.round(box2.width)}px`;
      const seen2 = toSlide(f, visualRect(el));
      const h = p.handle;
      const shift = (a) => {
        const [s, w] = a === "x" ? ["left", "width"] : ["top", "height"];
        const side = a === "x" ? h.includes("w") ? -1 : h.includes("e") ? 1 : 0 : h.includes("n") ? -1 : h.includes("s") ? 1 : 0;
        if (o.center || side === 0) return box2[s] + box2[w] / 2 - (seen2[s] + seen2[w] / 2);
        return side === 1 ? box2[s] - seen2[s] : box2[s] + box2[w] - (seen2[s] + seen2[w]);
      };
      const now = placeOf2(el).translate ?? { x: 0, y: 0 };
      writeLive(el, { translate: { x: now.x + shift("x"), y: now.y + shift("y") }, width: box2.width });
      view.moving = [el];
      view.resizing = true;
      const after = toSlide(f, visualRect(el));
      view.readout = { text: `${Math.round(after.width)} \xD7 ${Math.round(after.height)}`, x: ev.clientX + 14, y: ev.clientY + 18, at: "pointer" };
      frames.draw();
      app2.invalidate("content");
    };
    const onUp = (ev) => {
      const p = press;
      if (!p) return;
      press = null;
      document.documentElement.classList.remove("beeson-dragging", "beeson-resizing");
      view.moving = null;
      view.resizing = false;
      view.guides = [];
      view.spacing = [];
      view.marquee = null;
      view.readout = null;
      if (p.kind !== "marquee") {
        if (ev && p.moved) {
          const changes = p.els.map((el) => {
            const to = placeOf2(el);
            writePlace(app2, el, to);
            return { el, from: p.from.get(el), to };
          });
          record(app2, p.kind === "resize" ? "resize" : "move", changes);
        } else if (p.moved) {
          for (const el of p.els) writeLive(el, p.from.get(el));
        } else p.click?.();
      }
      frames.draw();
      app2.invalidate("content");
    };
    const hover = (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (target && (target === frames.handle || target.closest(".beeson-grip"))) return;
      const el = movableOf(app2, target);
      const band = el ? null : onCanvas(target) ? bandAt(app2, ev.clientX, ev.clientY) : null;
      document.documentElement.classList.toggle("beeson-band", !!band);
      const next = el ?? band;
      if (next) {
        if (next !== view.hover) {
          view.hover = next;
          frames.draw();
        }
      } else if (view.hover && !near(view.hover, ev)) {
        view.hover = null;
        frames.draw();
      }
    };
    const near = (el, ev) => {
      const r = el.getBoundingClientRect();
      return ev.clientX >= r.left - 28 && ev.clientX <= r.right + 6 && ev.clientY >= r.top - 28 && ev.clientY <= r.bottom + 6;
    };
    const reset = () => {
      const el = frames.current();
      if (!el) return;
      const from = placeOf2(el);
      const to = { ...from, translate: null };
      writePlace(app2, el, to);
      record(app2, "move", [{ el, from, to }]);
      if (!app2.selection.has(el)) app2.selection.set("elements", [el]);
      frames.draw();
    };
    frames.handle.addEventListener("dblclick", reset);
    frames.handle.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      reset();
    });
    frames.handle.addEventListener("focus", () => {
      const el = frames.current();
      if (el && !app2.selection.has(el)) app2.selection.set("elements", [el]);
    });
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", () => onUp(null), true);
    document.addEventListener("dragstart", (ev) => {
      if (ev.target instanceof Element && movableOf(app2, ev.target)) ev.preventDefault();
    });
    app2.listen("slide", () => {
      view.hover = null;
      if (press) onUp(null);
    });
  }

  // src/editor/commands/file.ts
  async function presentAt(app2, fromStart) {
    const d = app2.deck();
    const current = app2.current();
    const { h, v } = !fromStart && d && current ? d.getIndices(current) : { h: 0, v: 0 };
    const to = v ? `#/${h}/${v}` : h ? `#/${h}` : "";
    const hash = location.hash;
    const at = (fragment) => history.replaceState(history.state, "", fragment || location.pathname + location.search);
    at(to);
    try {
      await app2.files.present();
    } finally {
      if (location.hash === to) at(hash);
    }
  }
  function install24(app2) {
    const c = app2.commands;
    const both = (...keys) => ({ mac: keys, other: keys });
    c.define({
      id: "file.open",
      label: "Open\u2026",
      keys: both("Mod+O"),
      in: OUTSIDE_DIALOGS,
      menu: { bar: "File", group: "open", order: 10 },
      run: (a) => a.files.openFile()
    });
    c.define({
      id: "file.save",
      label: "Save",
      keys: both("Mod+S"),
      in: EVERYWHERE,
      menu: { bar: "File", group: "save", order: 20 },
      toolbar: { group: "save", order: 50, icon: "save" },
      run: (a) => a.files.save()
    });
    c.define({
      id: "file.saveAs",
      label: "Save As\u2026",
      keys: both("Mod+Shift+S"),
      in: EVERYWHERE,
      menu: { bar: "File", group: "save", order: 21 },
      run: (a) => a.files.saveAs()
    });
    c.define({
      id: "file.autosave",
      label: "Autosave",
      menu: { bar: "File", group: "save", order: 22 },
      enabled: () => canWrite(),
      checked: (a) => a.autosave,
      run: (a) => a.files.toggleAutosave()
    });
    c.define({
      id: "file.present",
      label: "Present",
      keys: both("Mod+Enter"),
      in: OUTSIDE_DIALOGS,
      menu: { bar: "File", group: "present", order: 30 },
      toolbar: { group: "present", order: 40, icon: "play" },
      run: (a) => presentAt(a, false)
    });
    c.define({
      id: "file.presentStart",
      label: "Present from Start",
      keys: both("Mod+Shift+Enter"),
      in: OUTSIDE_DIALOGS,
      menu: { bar: "File", group: "present", order: 31 },
      run: (a) => presentAt(a, true)
    });
  }

  // src/editor/commands/edit.ts
  var IN = OUTSIDE_DIALOGS.filter((r) => r !== "field");
  function titled(label2) {
    return label2.replace(/(^|\s)(\p{Ll})/gu, (_, space, letter) => space + letter.toUpperCase());
  }
  function install25(app2) {
    const c = app2.commands;
    c.define({
      id: "edit.undo",
      label: (a) => a.history.undoLabel ? `Undo ${titled(a.history.undoLabel)}` : "Undo",
      keys: { mac: ["Mod+Z"], other: ["Mod+Z"] },
      in: IN,
      menu: { bar: "Edit", group: "history", order: 10 },
      toolbar: { group: "history", order: 10, icon: "undo" },
      enabled: (a) => a.history.canUndo,
      run: (a) => a.history.undo()
    });
    c.define({
      id: "edit.redo",
      label: (a) => a.history.redoLabel ? `Redo ${titled(a.history.redoLabel)}` : "Redo",
      keys: { mac: ["Mod+Shift+Z", "Mod+Y"], other: ["Mod+Y", "Mod+Shift+Z"] },
      in: IN,
      menu: { bar: "Edit", group: "history", order: 11 },
      toolbar: { group: "history", order: 11, icon: "redo" },
      enabled: (a) => a.history.canRedo,
      run: (a) => a.history.redo()
    });
  }

  // src/editor/commands/view.ts
  var theme = () => window.Beeson?.theme;
  var FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
  var shown2 = (el) => el instanceof HTMLElement && el.getClientRects().length > 0;
  var first = (_, el) => [...el.querySelectorAll(FOCUSABLE)].find(shown2)?.focus();
  var PANES = [
    { name: "menubar", el: () => document.querySelector(".beeson-edit-menubar"), enter: first },
    { name: "toolbar", el: () => document.querySelector(".beeson-edit-top"), enter: first },
    {
      name: "navigator",
      el: () => document.querySelector(".beeson-edit-nav"),
      enter: (app2, el) => shown2(el.querySelector('[aria-current="true"]')) ? el.querySelector('[aria-current="true"]').focus() : first(app2, el)
    },
    {
      name: "canvas",
      el: () => document.querySelector(".reveal"),
      enter: () => {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      }
    },
    { name: "notes", el: (app2) => app2.notes.shown() ? app2.notes.ensure() : null, enter: (_, el) => el.focus() },
    { name: "inspector", el: () => document.querySelector(".beeson-edit-side"), enter: first },
    { name: "status", el: () => document.querySelector(".beeson-edit-bottom"), enter: first }
  ];
  function paneOf(app2) {
    const active = document.activeElement;
    const notes = PANES.findIndex((p) => p.name === "notes");
    if (active?.closest("aside.notes")) return notes;
    const i = PANES.findIndex((p) => p.name !== "canvas" && p.name !== "notes" && !!active && !!p.el(app2)?.contains(active));
    return i >= 0 ? i : PANES.findIndex((p) => p.name === "canvas");
  }
  function cyclePane(app2, step2) {
    const from = paneOf(app2);
    for (let n = 1; n < PANES.length; n++) {
      const pane = PANES[(from + step2 * n + PANES.length * n) % PANES.length];
      const el = pane.el(app2);
      if (!el || pane.name !== "canvas" && pane.name !== "notes" && !shown2(el)) continue;
      pane.enter(app2, el);
      return;
    }
  }
  function install26(app2) {
    const c = app2.commands;
    const pane = (order) => ({ bar: "View", group: "panes", order });
    c.define({ id: "view.navigator", label: "Navigator", menu: pane(10), checked: (a) => a.nav.shown, run: (a) => a.nav.toggle() });
    c.define({ id: "view.notes", label: "Notes", menu: pane(11), checked: (a) => a.notes.shown(), run: (a) => a.notes.toggle() });
    c.define({ id: "view.steps", label: "Steps", menu: pane(12), toolbar: { group: "inspector", order: 61, icon: "steps" }, checked: (a) => a.steps.shown, run: (a) => a.steps.toggle() });
    c.define({
      id: "view.slideDark",
      label: "Slide in Dark Mode",
      keys: { mac: ["D"], other: ["D"] },
      menu: { bar: "View", group: "mode", order: 20 },
      enabled: () => !!theme(),
      checked: () => theme()?.get() === "dark",
      run: () => theme()?.toggle()
    });
    const go2 = (order) => ({ bar: "View", group: "pane", order });
    c.define({ id: "view.nextPane", label: "Next Pane", keys: { mac: ["F6"], other: ["F6"] }, in: OUTSIDE_DIALOGS, menu: go2(50), run: (a) => cyclePane(a, 1) });
    c.define({ id: "view.previousPane", label: "Previous Pane", keys: { mac: ["Shift+F6"], other: ["Shift+F6"] }, in: OUTSIDE_DIALOGS, menu: go2(51), run: (a) => cyclePane(a, -1) });
  }

  // src/editor/commands/navigate.ts
  var CSS15 = `
.beeson-edit-goto { position: fixed; top: 56px; left: 50%; z-index: 70; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--line, #555); border-radius: 8px; background: var(--bg, #000); color: var(--text, #eee); font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); }
.beeson-edit-goto[hidden] { display: none; }
.beeson-edit-goto input { width: 6ch; font: inherit; padding: 2px 6px; border: 1px solid var(--line, #555); border-radius: 4px; background: transparent; color: inherit; }
`;
  var sections = (app2) => [...app2.slides().querySelectorAll(":scope > section")];
  function go(app2, to) {
    const all = sections(app2);
    const current = app2.current()?.closest(".slides > section");
    const at = current ? all.indexOf(current) : -1;
    const i = Math.max(0, Math.min(all.length - 1, to(at, all.length)));
    if (all[i] && i !== at) app2.showSlide(all[i]);
  }
  function gotoField(app2) {
    injectStyle("goto", CSS15);
    const box2 = make("div", "beeson-edit-goto");
    const input = make("input", "jump-to-slide-input");
    input.type = "text";
    input.inputMode = "numeric";
    input.setAttribute("aria-label", "Slide number");
    box2.append(make("span", "", "Go to slide"), input);
    box2.hidden = true;
    let back = null;
    const close = (restore) => {
      if (box2.hidden) return;
      box2.hidden = true;
      if (restore && back instanceof HTMLElement && back.isConnected) back.focus();
      else input.blur();
    };
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const n = Number.parseInt(input.value, 10);
        close(false);
        if (n >= 1) go(app2, (_, count) => Math.min(n, count) - 1);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        close(true);
      }
    });
    input.addEventListener("blur", () => close(false));
    document.body.append(box2);
    return () => {
      back = document.activeElement;
      input.value = "";
      box2.hidden = false;
      input.focus();
    };
  }
  function install27(app2) {
    const c = app2.commands;
    const both = (...keys) => ({ mac: keys, other: keys });
    const view2 = (order) => ({ bar: "View", group: "go", order });
    const free = (a) => a.selection.kind !== "elements";
    c.define({ id: "navigate.next", label: "Next Slide", keys: both("PageDown"), menu: view2(40), run: (a) => go(a, (at) => at + 1) });
    c.define({ id: "navigate.previous", label: "Previous Slide", keys: both("PageUp"), menu: view2(41), run: (a) => go(a, (at) => at - 1) });
    c.define({ id: "navigate.first", label: "First Slide", keys: both("Home"), in: ["canvas"], menu: view2(42), run: (a) => go(a, () => 0) });
    c.define({ id: "navigate.last", label: "Last Slide", keys: both("End"), in: ["canvas"], menu: view2(43), run: (a) => go(a, (_, count) => count - 1) });
    const open = gotoField(app2);
    c.define({ id: "navigate.goTo", label: "Go to Slide\u2026", keys: { mac: ["G", "Ctrl+Mod+G"], other: ["G"] }, menu: view2(44), run: () => open() });
    c.define({ id: "navigate.nextArrow", label: "Next Slide", keys: both("ArrowRight", "ArrowDown"), in: ["canvas"], enabled: free, run: (a) => go(a, (at) => at + 1) });
    c.define({ id: "navigate.previousArrow", label: "Previous Slide", keys: both("ArrowLeft", "ArrowUp"), in: ["canvas"], enabled: free, run: (a) => go(a, (at) => at - 1) });
  }

  // src/editor/commands/arrange.ts
  var PAUSE2 = 1e3;
  function onCanvas2() {
    const a = document.activeElement;
    return !a || a === document.body || a.classList.contains("beeson-handle") || !!a.closest(".reveal .slides") && !a.closest(HOST);
  }
  function caretAtEnd(el) {
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const s = getSelection();
    s?.removeAllRanges();
    s?.addRange(range);
  }
  var run = null;
  var samePlace2 = (a, b) => (a.translate?.x ?? 0) === (b.translate?.x ?? 0) && (a.translate?.y ?? 0) === (b.translate?.y ?? 0) && a.width === b.width;
  function nudge(app2, dx, dy) {
    const els = app2.selection.elements();
    if (!els.length) return;
    const now = performance.now();
    const same = !!run && now - run.at < PAUSE2 && run.changes.length === els.length && run.changes.every((c, i) => c.el === els[i] && samePlace2(placeOf2(c.el), c.to));
    const changes = els.map((el) => {
      const from = placeOf2(el);
      writePlace(app2, el, { ...from, translate: { x: (from.translate?.x ?? 0) + dx, y: (from.translate?.y ?? 0) + dy } });
      return { el, from, to: placeOf2(el) };
    });
    if (same && run) {
      run.at = now;
      run.changes.forEach((c, i) => c.to = changes[i].to);
    } else run = { at: now, changes: record(app2, "move", changes) };
    const boxes = els.map(visualRect);
    const t = placeOf2(els[0]).translate;
    view.readout = { text: `${t?.x ?? 0}, ${t?.y ?? 0}`, x: Math.max(...boxes.map((b) => b.left + b.width)) + 6, y: Math.max(...boxes.map((b) => b.top + b.height)) + 10, at: "frame" };
    app2.invalidate("content");
  }
  function step(app2, back) {
    const list = movablesOf(app2);
    if (!list.length) return;
    const sel = app2.selection.elements();
    const at = sel.length ? list.indexOf(sel[back ? 0 : sel.length - 1]) : -1;
    const next = at < 0 ? list[back ? list.length - 1 : 0] : list[(at + (back ? -1 : 1) + list.length) % list.length];
    app2.selection.set("elements", [next]);
    if (next.classList.contains("beeson-movable")) next.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
  }
  var ARROWS = [["left", "ArrowLeft", -1, 0], ["right", "ArrowRight", 1, 0], ["up", "ArrowUp", 0, -1], ["down", "ArrowDown", 0, 1]];
  function commands() {
    const list = [
      {
        id: "selection.all",
        label: "Select All",
        keys: { mac: ["Mod+A"], other: ["Mod+A"] },
        in: ["canvas"],
        menu: { bar: "Edit", group: "select", order: 10 },
        context: ["canvas"],
        enabled: (app2) => !!app2.current() && onCanvas2(),
        run: (app2) => app2.selection.selectAll()
      },
      {
        // Esc on an image selected inside its figure selects the figure, and else clears
        id: "selection.clear",
        label: "Deselect",
        keys: { mac: ["Escape"], other: ["Escape"] },
        in: ["canvas"],
        menu: { bar: "Edit", group: "select", order: 11 },
        enabled: (app2) => app2.selection.kind === "elements" || app2.selection.kind === "text",
        run: (app2) => {
          const only = app2.selection.only();
          const up = only?.matches(RESIZABLE) ? containerOf(app2, only) : null;
          const a = document.activeElement;
          if (a instanceof HTMLElement && (app2.selection.has(a) || a.classList.contains("beeson-handle"))) a.blur();
          if (up) app2.selection.set("elements", [up]);
          else app2.selection.clear();
        }
      },
      {
        id: "selection.leaveText",
        label: "Select Block",
        keys: { mac: ["Escape"], other: ["Escape"] },
        in: ["text"],
        enabled: (app2) => !!app2.hostOf(document.activeElement),
        run: (app2) => {
          const host = app2.hostOf(document.activeElement);
          host.blur();
          app2.selection.set("elements", [movableOf(app2, host) ?? host]);
        }
      },
      {
        // Return puts the caret at the end of the text of a block, and selects the image of a figure
        id: "selection.editText",
        label: "Edit Text",
        keys: { mac: ["Enter"], other: ["Enter"] },
        in: ["canvas"],
        context: ["element"],
        enabled: (app2) => {
          const el = app2.selection.only();
          if (!el || document.activeElement?.classList.contains("beeson-handle")) return false;
          return el.matches(HOST) || !!el.querySelector(HOST) || !!mediaIn(el, el.querySelector("img, video"));
        },
        run: (app2) => {
          const el = app2.selection.only();
          const hosts = el.matches(HOST) ? [el] : [...el.querySelectorAll(HOST)];
          const host = hosts.at(-1);
          if (host) caretAtEnd(host);
          else {
            const media = [...el.querySelectorAll("img, video")].find((m) => m.getBoundingClientRect().width > 0);
            if (media) app2.selection.set("elements", [media]);
          }
        }
      },
      {
        id: "selection.next",
        label: "Select Next Element",
        keys: { mac: ["Tab"], other: ["Tab"] },
        in: ["canvas"],
        enabled: (app2) => onCanvas2() && movablesOf(app2).length > 0,
        run: (app2) => step(app2, false)
      },
      {
        id: "selection.previous",
        label: "Select Previous Element",
        keys: { mac: ["Shift+Tab"], other: ["Shift+Tab"] },
        in: ["canvas"],
        enabled: (app2) => onCanvas2() && movablesOf(app2).length > 0,
        run: (app2) => step(app2, true)
      },
      {
        id: "arrange.resetPosition",
        label: "Reset Position",
        menu: { bar: "Arrange", group: "reset", order: 10 },
        context: ["element"],
        enabled: (app2) => app2.selection.elements().some((el) => placeOf2(el).translate),
        run: (app2) => {
          const changes = app2.selection.elements().map((el) => {
            const from = placeOf2(el);
            const to = { ...from, translate: null };
            writePlace(app2, el, to);
            return { el, from, to };
          });
          record(app2, "move", changes);
        }
      },
      {
        id: "arrange.resetSize",
        label: "Reset Size",
        menu: { bar: "Arrange", group: "reset", order: 11 },
        context: ["element"],
        enabled: (app2) => app2.selection.elements().some((el) => placeOf2(el).width !== null),
        run: (app2) => {
          const changes = app2.selection.elements().map((el) => {
            const from = placeOf2(el);
            const to = { ...from, width: null };
            writePlace(app2, el, to);
            return { el, from, to };
          });
          record(app2, "resize", changes);
        }
      }
    ];
    for (const [name, key, x, y] of ARROWS) {
      for (const far of [false, true]) {
        list.push({
          id: `arrange.nudge.${name}${far ? ".far" : ""}`,
          label: `Nudge ${name[0].toUpperCase()}${name.slice(1)}${far ? " by 10" : ""}`,
          keys: { mac: [`${far ? "Shift+" : ""}${key}`], other: [`${far ? "Shift+" : ""}${key}`] },
          in: ["canvas"],
          enabled: (app2) => app2.selection.elements().length > 0,
          run: (app2) => nudge(app2, x * (far ? 10 : 1), y * (far ? 10 : 1))
        });
      }
    }
    return list;
  }
  function install28(app2) {
    for (const c of commands()) app2.commands.define(c);
    app2.selection.listen(() => run = null);
  }

  // src/editor/commands/slide.ts
  var MARK = "<!--beeson-->";
  var LABELS = { title: "Title", section: "Section", content: "Content", narrow: "Content, Narrow", wide: "Content, Wide", figure: "Figure", split: "Split", closing: "Closing" };
  var CSS16 = `
html.beeson-editor .reveal:not(.beeson-peek) .slides section :is(h1, h2, p)[contenteditable="true"]:empty::before { color: var(--muted, #888); pointer-events: none; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section :is(h1, h2)[contenteditable="true"]:empty::before { content: "Title"; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section p.sub[contenteditable="true"]:empty::before { content: "Subtitle"; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section p.who[contenteditable="true"]:empty::before { content: "Author"; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section p.caption[contenteditable="true"]:empty::before { content: "Caption"; }
html.beeson-editor .reveal:not(.beeson-peek) .slides section > p[contenteditable="true"]:empty::before, html.beeson-editor .reveal:not(.beeson-peek) .slides section .panel > p[contenteditable="true"]:empty::before { content: "Text"; }
.beeson-edit-gallery { --g-bg: var(--ed-panel, #fbfbfd); --g-text: var(--ed-text, #1d1d1f); --g-muted: var(--ed-muted, #6e6e73); --g-line: var(--ed-line, #d2d2d7); --g-select: var(--ed-select, #7a5af8); }
@media (prefers-color-scheme: dark) {
  .beeson-edit-gallery { --g-bg: var(--ed-panel, #2c2c2e); --g-text: var(--ed-text, #f2f2f7); --g-muted: var(--ed-muted, #a1a1a6); --g-line: var(--ed-line, #48484a); --g-select: var(--ed-select, #9b82ff); }
}
.beeson-edit-gallery { position: fixed; z-index: 80; margin: 0; padding: 12px 14px 14px; width: 456px; box-sizing: border-box; border: 1px solid var(--g-line); border-radius: 12px; background: var(--g-bg); color: var(--g-text); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28); font: 12px/1.3 system-ui, sans-serif; }
.beeson-edit-gallery .head { margin: 0 0 10px 2px; font-size: 13px; font-weight: 600; }
.beeson-edit-gallery .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 10px; }
.beeson-edit-gallery .tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 4px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.beeson-edit-gallery .tile .pic { display: block; width: 92px; aspect-ratio: 16 / 9; border-radius: 4px; outline: 1px solid var(--g-line); background: var(--bg, #000); }
.beeson-edit-gallery .tile:hover .pic { outline: 2px solid var(--g-select); }
.beeson-edit-gallery .tile:focus-visible { outline: none; background: color-mix(in srgb, var(--g-select) 16%, transparent); }
.beeson-edit-gallery .tile:focus-visible .pic { outline: 2px solid var(--g-select); }
.beeson-edit-gallery .tile span { text-align: center; }
`;
  function docOf(app2) {
    return app2.doc;
  }
  var navOf = (app2) => app2.nav;
  var sections2 = (app2) => [...app2.slides().querySelectorAll(":scope > section")];
  var ready = (app2) => !!app2.pairing?.root;
  var targets = (app2) => ready(app2) ? navOf(app2).selected() : [];
  function placeAfter(app2) {
    const last = navOf(app2).selected().at(-1) ?? null;
    return { root: app2.slides(), before: last?.nextElementSibling ?? null };
  }
  function land(app2, slides, current, focusNav) {
    const nav2 = navOf(app2);
    nav2.select(slides, current);
    if (focusNav) nav2.focus(current);
  }
  function caretInto(slide) {
    const block = slide.querySelector('h1[contenteditable="true"], h2[contenteditable="true"]') ?? slide.querySelector('[contenteditable="true"]');
    if (!block) return;
    block.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(block);
    range.collapse(true);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  async function newSlide(app2, layout) {
    const { before } = placeAfter(app2);
    const slide = await docOf(app2).insertSlide(layout, before);
    navOf(app2).select([slide], slide);
    caretInto(slide);
    return slide;
  }
  function nextLayout(app2) {
    const s = navOf(app2).selected().at(-1);
    if (!s || s.matches(".title, .section, .closing, .figure, .split")) return "content";
    return s.classList.contains("narrow") ? "narrow" : s.classList.contains("wide") ? "wide" : "content";
  }
  async function applyOrder(app2, desired) {
    const doc2 = docOf(app2);
    const root = app2.slides();
    for (let i = 0; i < desired.length; i++) {
      const live = sections2(app2);
      if (live[i] !== desired[i]) await doc2.move(desired[i], root, live[i], "move slide");
    }
  }
  function shifted(list, moved, up) {
    const out = [...list];
    const idx = up ? out.map((_, i) => i) : out.map((_, i) => out.length - 1 - i);
    for (const i of idx) {
      const j = up ? i - 1 : i + 1;
      if (j < 0 || j >= out.length || !moved.has(out[i]) || moved.has(out[j])) continue;
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  var canShift = (app2, up) => {
    const list = sections2(app2);
    const t = targets(app2);
    return t.length > 0 && shifted(list, new Set(t), up).some((s, i) => s !== list[i]);
  };
  function clipText(app2, slides) {
    const doc2 = docOf(app2);
    const eol = app2.source?.crlf ? "\r\n" : "\n";
    return [MARK, ...slides.map((s) => doc2.elementText(s))].join(eol);
  }
  function slidesIn(text) {
    const at = text.indexOf(MARK);
    if (at < 0 || text.slice(0, at).trim()) return null;
    const body = text.slice(at + MARK.length);
    const out = [];
    let depth = 0;
    let start2 = 0;
    for (const t of tokenize(body)) {
      if (t.type === "start" && t.name === "section" && !t.selfClosing) {
        if (depth++ === 0) start2 = t.start;
      } else if (t.type === "end" && t.name === "section" && depth > 0 && --depth === 0) out.push(body.slice(start2, t.end));
    }
    return out;
  }
  function freshIds(app2, text) {
    const doc2 = docOf(app2);
    let out = text;
    for (const id of new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))) {
      if (!document.getElementById(id)) continue;
      const next = doc2.uniqueId(id);
      out = out.split(`id="${id}"`).join(`id="${next}"`).split(`data-plot="${id}"`).join(`data-plot="${next}"`);
    }
    return out;
  }
  var copied = "";
  function copySlides(app2, data) {
    const text = clipText(app2, targets(app2));
    copied = text;
    if (data) {
      data.setData("text/plain", text);
      data.setData("text/html", text);
    } else void navigator.clipboard?.writeText(text).catch(() => {
    });
    return text;
  }
  async function deleteSlides(app2, slides, focusNav) {
    const list = sections2(app2);
    const gone = new Set(slides);
    const lastAt = list.indexOf(slides.at(-1));
    const next = list.slice(lastAt + 1).find((s) => !gone.has(s)) ?? [...list.slice(0, list.indexOf(slides[0]))].reverse().find((s) => !gone.has(s)) ?? null;
    const doc2 = docOf(app2);
    for (const s of [...slides].reverse()) await doc2.remove(s, "delete slide");
    if (next) land(app2, [next], next, focusNav);
  }
  async function pasteSlides(app2, text, focusNav) {
    const texts = slidesIn(text);
    if (!texts?.length) return false;
    const { root, before } = placeAfter(app2);
    const nodes = await docOf(app2).insert(texts.map((t) => freshIds(app2, t)), root, before, "paste slides");
    land(app2, nodes, nodes[0], focusNav);
    return true;
  }
  var SAMPLE = { h1: "Title of the talk", h2: "Title", "p.sub": "Subtitle", "p.who": "Name", "p.caption": "Caption of the figure", p: "A sentence of the text." };
  function sampleSlide(app2, layout) {
    const box2 = document.createElement("div");
    box2.innerHTML = layoutText(layout, { eol: "\n", step: "  " });
    const slide = box2.firstElementChild;
    for (const [sel, text] of Object.entries(SAMPLE)) for (const el of slide.querySelectorAll(sel)) if (!el.textContent) el.textContent = text;
    for (const el of slide.querySelectorAll(".zone, .plate")) el.style.outline = "4px dashed color-mix(in srgb, var(--muted) 70%, transparent)";
    for (const list of slide.querySelectorAll("ul.outline")) for (const t of ["Chapter one", "Chapter two"]) list.append(Object.assign(document.createElement("li"), { textContent: t }));
    const backdrop = slide.querySelector(".backdrop");
    const cls = layout === "content" || layout === "narrow" || layout === "wide" ? null : layout;
    const original = cls ? sections2(app2).find((s) => s.classList.contains(cls) && s.querySelector(":scope > .backdrop canvas"))?.querySelector(":scope > .backdrop") : null;
    if (backdrop && original) {
      const copy = original.cloneNode(true);
      const from = original.querySelectorAll("canvas");
      copy.querySelectorAll("canvas").forEach((c, i) => {
        c.style.width = `${from[i].offsetWidth}px`;
        c.style.height = `${from[i].offsetHeight}px`;
        try {
          c.getContext("2d")?.drawImage(from[i], 0, 0);
        } catch {
        }
      });
      backdrop.replaceWith(copy);
    }
    return slide;
  }
  var gallery = null;
  function closeGallery(back = true) {
    if (!gallery) return;
    const g = gallery;
    gallery = null;
    const anchor = g.anchor;
    g.close();
    g.remove();
    if (back && anchor?.isConnected) anchor.focus({ preventScroll: true });
  }
  function openGallery(app2, anchor) {
    closeGallery(false);
    const dialog = document.createElement("dialog");
    dialog.className = "beeson-edit-gallery";
    dialog.setAttribute("aria-label", "New slide");
    dialog.anchor = anchor ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const head = document.createElement("div");
    head.className = "head";
    head.textContent = "New Slide";
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-label", "Layouts");
    const stage = app2.slides();
    const deck = { width: stage.offsetWidth || 1920, height: stage.offsetHeight || 1080 };
    const tiles = LAYOUTS.map((layout) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.dataset.layout = layout;
      tile.setAttribute("role", "option");
      const pic = document.createElement("span");
      pic.className = "pic";
      const name = document.createElement("span");
      name.textContent = LABELS[layout];
      tile.append(pic, name);
      tile.addEventListener("click", () => {
        closeGallery(false);
        void app2.commands.run(`slide.new.${layout}`).catch((e) => app2.fail(e));
      });
      grid.append(tile);
      return { tile, pic, layout };
    });
    dialog.append(head, grid);
    document.body.append(dialog);
    dialog.show();
    for (const t of tiles) drawInto(t.pic, sampleSlide(app2, t.layout), deck, 92);
    place2(dialog, dialog.anchor ?? null, navOf(app2).rowOf(app2.current()));
    dialog.addEventListener("keydown", (ev) => {
      const i = tiles.findIndex((t) => t.tile === document.activeElement);
      const step2 = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
      if (ev.key === "Escape") closeGallery();
      else if (ev.key in step2) tiles[Math.min(tiles.length - 1, Math.max(0, i + step2[ev.key]))].tile.focus();
      else if (ev.key === "Home" || ev.key === "End") tiles[ev.key === "Home" ? 0 : tiles.length - 1].tile.focus();
      else if (ev.key === "Tab") tiles[(i + (ev.shiftKey ? tiles.length - 1 : 1)) % tiles.length].tile.focus();
      else return;
      ev.preventDefault();
      ev.stopPropagation();
    });
    const outside = (ev) => {
      if (!gallery) document.removeEventListener("pointerdown", outside, true);
      else if (!gallery.contains(ev.target)) {
        document.removeEventListener("pointerdown", outside, true);
        closeGallery(false);
      }
    };
    document.addEventListener("pointerdown", outside, true);
    gallery = dialog;
    (tiles.find((t) => t.layout === nextLayout(app2)) ?? tiles[0]).tile.focus();
  }
  function place2(dialog, anchor, row) {
    const w = dialog.offsetWidth;
    const h = dialog.offsetHeight;
    const a = anchor && !anchor.closest(".beeson-edit-nav") ? anchor.getBoundingClientRect() : null;
    let x;
    let y;
    if (a && a.bottom < innerHeight / 3) {
      x = a.left;
      y = a.bottom + 6;
    } else {
      const r = (row ?? anchor)?.getBoundingClientRect();
      x = r ? r.right + 10 : 260;
      y = r ? r.top - 8 : 60;
    }
    dialog.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
    dialog.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
  }
  function install29(app2) {
    injectStyle("slide", CSS16);
    const c = app2.commands;
    const inNav = () => app2.region() === "navigator";
    const slideMenu = (order, group = "slide") => ({ bar: "Slide", group, order });
    const defs = [
      {
        id: "slide.new",
        label: "New Slide",
        keys: { mac: ["Ctrl+M"], other: ["Ctrl+M"] },
        menu: slideMenu(10),
        context: ["slide", "navigator", "canvas"],
        enabled: ready,
        undoable: true,
        run: async (a) => void await newSlide(a, nextLayout(a))
      },
      {
        id: "slide.newAfter",
        label: "New Slide",
        keys: { mac: ["Enter"], other: ["Enter"] },
        in: ["navigator"],
        enabled: ready,
        undoable: true,
        run: async (a) => void await newSlide(a, nextLayout(a))
      },
      {
        id: "slide.gallery",
        label: "Add Slide",
        toolbar: { group: "slide", order: 10, icon: "add-slide" },
        enabled: ready,
        run: (a, arg) => openGallery(a, arg instanceof HTMLElement ? arg : null)
      },
      ...LAYOUTS.map(
        (layout, i) => ({
          id: `slide.new.${layout}`,
          label: LABELS[layout],
          menu: { bar: "Insert", group: "slide", order: 10 + i, submenu: "New Slide" },
          enabled: ready,
          undoable: true,
          run: async (a) => void await newSlide(a, layout)
        })
      ),
      {
        id: "slide.duplicate",
        label: "Duplicate Slide",
        keys: { mac: ["Mod+D"], other: ["Mod+D"] },
        in: ["navigator"],
        menu: slideMenu(20),
        context: ["slide"],
        enabled: (a) => targets(a).length > 0,
        undoable: true,
        run: async (a) => {
          const focus = inNav();
          const doc2 = docOf(a);
          const copies = [];
          for (const s of targets(a)) copies.push(await doc2.duplicate(s));
          land(a, copies, copies.at(-1) ?? null, focus);
        }
      },
      {
        id: "slide.delete",
        label: (a) => targets(a).length > 1 ? "Delete Slides" : "Delete Slide",
        keys: { mac: ["Backspace", "Delete"], other: ["Delete", "Backspace"] },
        in: ["navigator"],
        menu: slideMenu(30),
        context: ["slide"],
        enabled: (a) => targets(a).length > 0 && targets(a).length < sections2(a).length,
        undoable: true,
        run: (a) => deleteSlides(a, targets(a), inNav())
      },
      {
        id: "slide.hide",
        label: (a) => targets(a).length && targets(a).every(isHidden) ? "Show Slide" : "Hide Slide",
        keys: { mac: ["Mod+Shift+H"] },
        in: ["navigator", "canvas"],
        menu: slideMenu(40),
        context: ["slide", "canvas"],
        enabled: (a) => targets(a).length > 0,
        undoable: true,
        run: (a) => {
          const t = targets(a);
          const hide = !t.every(isHidden);
          for (const s of t) docOf(a).hide(s, hide);
          navOf(a).refresh();
        }
      },
      {
        id: "slide.moveUp",
        label: "Move Slide Up",
        keys: { mac: ["Alt+ArrowUp"], other: ["Alt+ArrowUp"] },
        in: ["navigator"],
        menu: slideMenu(50, "move"),
        context: ["slide"],
        enabled: (a) => canShift(a, true),
        undoable: true,
        run: async (a) => {
          const t = targets(a);
          await applyOrder(a, shifted(sections2(a), new Set(t), true));
          land(a, t, a.current(), inNav());
        }
      },
      {
        id: "slide.moveDown",
        label: "Move Slide Down",
        keys: { mac: ["Alt+ArrowDown"], other: ["Alt+ArrowDown"] },
        in: ["navigator"],
        menu: slideMenu(51, "move"),
        context: ["slide"],
        enabled: (a) => canShift(a, false),
        undoable: true,
        run: async (a) => {
          const t = targets(a);
          await applyOrder(a, shifted(sections2(a), new Set(t), false));
          land(a, t, a.current(), inNav());
        }
      },
      {
        id: "slide.moveTo",
        label: (a) => targets(a).length > 1 ? "Move Slides" : "Move Slide",
        enabled: ready,
        undoable: true,
        run: async (a, arg) => {
          const { slides, gap } = arg;
          await applyOrder(a, droppedOrder(sections2(a), slides, gap));
          land(a, slides, a.current(), true);
        }
      },
      {
        id: "slide.cut",
        label: "Cut",
        context: ["slide"],
        enabled: (a) => targets(a).length > 0 && targets(a).length < sections2(a).length,
        undoable: true,
        run: async (a, arg) => {
          copySlides(a, arg instanceof DataTransfer ? arg : null);
          await deleteSlides(a, targets(a), inNav());
        }
      },
      {
        id: "slide.copy",
        label: "Copy",
        context: ["slide"],
        enabled: (a) => targets(a).length > 0,
        run: (a, arg) => void copySlides(a, arg instanceof DataTransfer ? arg : null)
      },
      {
        id: "slide.paste",
        label: "Paste",
        context: ["slide", "navigator"],
        enabled: ready,
        undoable: true,
        run: async (a, arg) => {
          let text = typeof arg === "string" ? arg : "";
          if (!text) text = await navigator.clipboard?.readText().catch(() => "") || copied;
          await pasteSlides(a, text, inNav());
        }
      }
    ];
    for (const d of defs) c.define(d);
    const onClip = (ev) => {
      if (ev.defaultPrevented || app2.region() !== "navigator" || !ready(app2)) return;
      if (ev.type === "paste") {
        const text = ev.clipboardData?.getData("text/plain") || ev.clipboardData?.getData("text/html") || "";
        if (!slidesIn(text)?.length) return;
        ev.preventDefault();
        void c.run("slide.paste", text).catch((e) => app2.fail(e));
        return;
      }
      ev.preventDefault();
      void c.run(ev.type === "cut" ? "slide.cut" : "slide.copy", ev.clipboardData).catch((e) => app2.fail(e));
    };
    for (const type of ["copy", "cut", "paste"]) document.addEventListener(type, onClip);
  }

  // src/editor/commands/delete.ts
  function selectedElements(app2) {
    return app2.selection.elements().filter((el) => el.isConnected && !el.matches(".reveal .slides > section") && !!app2.pairing?.elements.has(el));
  }
  function install30(app2) {
    app2.commands.define({
      id: "element.delete",
      label: "Delete",
      keys: { mac: ["Backspace", "Delete"], other: ["Delete", "Backspace"] },
      in: ["canvas"],
      menu: { bar: "Edit", group: "delete", order: 40 },
      context: ["element"],
      enabled: (a) => selectedElements(a).length > 0,
      undoable: true,
      run: async (a) => {
        const doc2 = docOf(a);
        const els = selectedElements(a);
        const outer = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
        a.selection.clear();
        for (const el of outer.reverse()) await doc2.remove(el, "delete");
      }
    });
  }

  // src/editor/model/fragments.ts
  var WRAPPERS = [
    [/* @__PURE__ */ new Set(["tr"]), '<table><tbody class="slides">', "</tbody></table>"],
    [/* @__PURE__ */ new Set(["td", "th"]), '<table><tbody><tr class="slides">', "</tr></tbody></table>"],
    [/* @__PURE__ */ new Set(["thead", "tbody", "tfoot", "caption", "colgroup"]), '<table class="slides">', "</table>"]
  ];
  var DEFAULT = ['<div class="reveal"><div class="slides">', "</div></div>"];
  function rootTag(text) {
    return /^(?:\s|<!--[\s\S]*?-->)*<([a-zA-Z][\w-]*)/.exec(text)?.[1].toLowerCase() ?? null;
  }
  function parseFragment(text, crlf, home) {
    const tag = rootTag(text);
    if (!tag) throw new Error("the new content does not start with an element");
    const wrapper = WRAPPERS.find(([tags]) => tags.has(tag));
    const [open, close] = wrapper ? [wrapper[1], wrapper[2]] : DEFAULT;
    const source = parseSource(open + text + close);
    source.crlf = crlf;
    source.fragment = { home };
    if (!fragmentRoot(source)) throw new Error(`the new ${tag} is not read as one element`);
    return source;
  }
  function fragmentRoot(source) {
    return source.slides.children.find((c) => c.kind === "element") ?? null;
  }
  var emptyPairing = () => ({ blocks: [], byLive: /* @__PURE__ */ new Map(), elements: /* @__PURE__ */ new Map(), inner: /* @__PURE__ */ new Map(), sections: [], problems: [], root: null });
  function pairFragment(source, live, math) {
    const root = fragmentRoot(source);
    if (!root) throw new Error("the fragment does not have an element");
    const out = emptyPairing();
    pairElement(root, live, live.parentElement?.closest("section") ?? null, math, out);
    return out;
  }
  function mergePairing(into, from) {
    into.blocks.push(...from.blocks);
    for (const [k, v] of from.byLive) into.byLive.set(k, v);
    for (const [k, v] of from.elements) into.elements.set(k, v);
    for (const [k, v] of from.inner) into.inner.set(k, v);
    into.sections.push(...from.sections);
    into.sections.sort((a, b) => a.live.compareDocumentPosition(b.live) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    into.problems.push(...from.problems);
  }

  // src/editor/model/doc.ts
  var generated2 = (n) => n instanceof Element && n.hasAttribute("data-generated");
  function nextKept(el) {
    let n = el.nextSibling;
    while (generated2(n)) n = n.nextSibling;
    return n;
  }
  function prevKept(el) {
    let n = el.previousSibling;
    while (generated2(n)) n = n.previousSibling;
    return n;
  }
  function normalizeEdit(edit) {
    const out = { ...edit };
    if (edit.classes && "fragment" in edit.classes) {
      const { fragment, ...rest } = edit.classes;
      out.classes = rest;
      out.fragment = fragment;
    }
    const index = edit.attrs?.["data-fragment-index"];
    if (index !== void 0 && (index === null || /^\s*-?\d+\s*$/.test(index))) {
      const { "data-fragment-index": _, ...rest } = edit.attrs;
      out.attrs = rest;
      out.index = index === null ? null : Number(index);
    }
    const translate = edit.style?.translate;
    const parsed = translate ? translateIn(`translate: ${translate}`) : null;
    if (translate === null || parsed) {
      const { translate: _, ...rest } = edit.style;
      out.style = rest;
      out.translate = parsed;
    }
    for (const key of ["classes", "attrs", "style"]) if (out[key] && !Object.keys(out[key]).length) delete out[key];
    return out;
  }
  function inverseEdit(before, edit) {
    const out = { order: { attrs: Object.keys(before.attrs), classes: before.classes, style: Object.keys(before.style) } };
    const pick = (keys, value) => Object.fromEntries(keys.map((k) => [k, value(k)]));
    if (edit.classes) out.classes = pick(Object.keys(edit.classes), (c) => before.classes.includes(c));
    if (edit.fragment !== void 0) out.fragment = before.classes.includes("fragment");
    if (edit.attrs) out.attrs = pick(Object.keys(edit.attrs), (n) => before.attrs[n] ?? null);
    if (edit.index !== void 0) {
      const v = before.attrs["data-fragment-index"];
      out.index = v === void 0 ? null : Number(v);
    }
    if (edit.style) out.style = pick(Object.keys(edit.style), (n) => before.style[n] ?? null);
    if (edit.translate !== void 0) {
      const v = before.style.translate;
      out.translate = v === void 0 ? null : translateIn(`translate: ${v}`);
    }
    return out;
  }
  function applyLive(el, edit) {
    for (const [c, on] of Object.entries(edit.classes ?? {})) el.classList.toggle(c, on);
    if (edit.fragment !== void 0) el.classList.toggle("fragment", edit.fragment);
    for (const [n, v] of Object.entries(edit.attrs ?? {})) {
      if (v === null) el.removeAttribute(n);
      else el.setAttribute(n, v);
    }
    if (edit.index !== void 0) {
      if (edit.index === null) el.removeAttribute("data-fragment-index");
      else el.setAttribute("data-fragment-index", String(edit.index));
    }
    const style = el.style;
    if (!style) return;
    for (const [n, v] of Object.entries(edit.style ?? {})) {
      if (v === null) style.removeProperty(n);
      else style.setProperty(n, v);
    }
    if (edit.translate !== void 0) style.translate = edit.translate ? translateText(edit.translate) : "";
  }
  function renameIds(text, fresh) {
    let out = text;
    for (const m of new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m2) => m2[1]))) {
      const id = fresh(m);
      out = out.split(`id="${m}"`).join(`id="${id}"`).split(`data-plot="${m}"`).join(`data-plot="${id}"`);
    }
    return out;
  }
  var Doc = class {
    constructor(host) {
      this.host = host;
    }
    need() {
      const source = this.host.source();
      const pairing = this.host.pairing();
      if (!source || !pairing) throw new Error("no file is open");
      return { source, pairing };
    }
    srcOf(el) {
      const { pairing } = this.need();
      const s = pairing.elements.get(el) ?? pairing.inner.get(el);
      if (!s) throw new Error(`the ${el.localName} is not in the file`);
      return s;
    }
    eol() {
      return this.need().source.crlf ? "\r\n" : "\n";
    }
    style() {
      return textStyle(this.need().source.text);
    }
    // the text of the file with the edits of the page
    render() {
      const { source, pairing } = this.need();
      return renderDeck(source, pairing, this.host.math(), this.host.tags).text;
    }
    // the text of the unit of el, i.e. its lead, the element with its edits, and the end comment of
    // its marker pair, and the text of the element alone
    unitText(el) {
      const u = this.unit(el);
      return u.lead + u.body + u.trail;
    }
    elementText(el) {
      return this.unit(el).body;
    }
    unit(el) {
      const { source, pairing } = this.need();
      const u = renderUnit(pairing, this.host.math(), this.host.tags, el, source);
      if (!u) throw new Error(`the ${el.localName} is not in the file`);
      return u;
    }
    // the state of the start tag of el with its edits, i.e. its classes, attributes, and declarations
    tagState(el) {
      const s = this.srcOf(el);
      return stateOf(s.attrs, this.host.tags.get(el) ?? {});
    }
    // sets the given classes, attributes, and declarations of the start tag of el. the inverse sets
    // the values before the edit, hence it holds after a save as well
    setTag(el, edit, label2 = "tag") {
      const s = this.srcOf(el);
      if (!s.open) throw new Error(`the ${el.localName} does not have a start tag in the file`);
      const e = normalizeEdit(edit);
      const back = inverseEdit(this.tagState(el), e);
      this.applyTag(el, e);
      this.host.record({ label: label2, undo: () => this.applyTag(el, back), redo: () => this.applyTag(el, e) });
    }
    applyTag(el, edit) {
      this.host.tags.set(el, mergeEdit(this.host.tags.get(el), edit));
      applyLive(el, edit);
      this.refresh();
    }
    hide(slide, hidden = true) {
      this.setTag(slide, { attrs: { "data-visibility": hidden ? "hidden" : null } }, hidden ? "hide" : "show");
    }
    // inserts the units of texts into parent before the node before, as one entry of the history. a
    // text is an element without the white space before it, which is that of the units of parent
    async insert(texts, parent, before = null, label2 = "insert") {
      const nodes = [];
      let ref = before;
      for (const text of [...typeof texts === "string" ? [texts] : texts].reverse()) {
        ref = await this.place(text, parent, ref);
        nodes.unshift(ref);
      }
      let recs = [];
      this.host.record({
        label: label2,
        undo: async () => {
          recs = nodes.map((n) => this.detach(n));
          await this.after(parent);
        },
        redo: async () => {
          for (const r of [...recs].reverse()) await this.attach(r, false);
          await this.after(parent);
        }
      });
      return nodes;
    }
    // a new slide of the layout before the slide before, or at the end
    async insertSlide(layout, before = null) {
      const { pairing } = this.need();
      if (!pairing.root) throw new Error("the deck does not have a div.slides element");
      const base = this.childIndent(pairing.root);
      const [slide] = await this.insert(layoutText(layout, this.style(), base), pairing.root, before, `new ${layout} slide`);
      return slide;
    }
    // a new element of the kind in parent before the node before, or at the end
    async insertElement(kind, parent, before = null, options = {}) {
      const o = kind === "plot" && !options.id ? { ...options, id: this.uniqueId("plot") } : options;
      return this.insert(elementText(kind, this.style(), this.childIndent(parent), o), parent, before, `new ${kind}`);
    }
    // a copy of el after it, with each id renamed
    async duplicate(el) {
      const parent = el.parentElement;
      if (!parent) throw new Error("the element is not on the page");
      const text = renameIds(this.elementText(el), (id) => this.uniqueId(id));
      const [copy] = await this.insert(text, parent, nextKept(el), "duplicate");
      return copy;
    }
    async remove(el, label2 = "remove") {
      let rec = this.detach(el);
      await this.after(rec.parent);
      this.host.record({
        label: label2,
        undo: () => this.attach(rec),
        redo: async () => {
          rec = this.detach(el);
          await this.after(rec.parent);
        }
      });
    }
    // moves el into parent before the node before, or at the end
    async move(el, parent, before = null, label2 = "move") {
      const { pairing } = this.need();
      if (el === parent || el.contains(parent)) throw new Error("an element is not moved into itself");
      if (!pairing.elements.has(parent) || pairing.byLive.has(parent)) throw new Error(`the ${parent.localName} does not take elements`);
      if (!el.parentElement) throw new Error("the element is not on the page");
      const from = { parent: el.parentElement, next: nextKept(el) };
      const put = async (p, n) => {
        p.insertBefore(el, n && n !== el && n.parentNode === p ? n : null);
        await this.after(el);
      };
      await put(parent, before);
      this.host.record({ label: label2, undo: () => put(from.parent, from.next), redo: () => put(parent, before) });
    }
    // el replaced by an element of the tag with the same attributes and content, and with the edit
    // applied to its start tag, e.g. a p made an h3
    async retag(el, tag, edit = {}, label2 = "retag") {
      const parent = el.parentElement;
      if (!parent) throw new Error("the element is not on the page");
      const u = this.unit(el);
      const old = el.localName;
      let body = u.body.replace(new RegExp(`^<${old}(?=[\\s/>])`, "i"), `<${tag}`).replace(new RegExp(`</${old}(\\s*)>$`, "i"), `</${tag}$1>`);
      const start2 = tokenize(body).find((t) => t.type === "start");
      const e = normalizeEdit(edit);
      if (start2?.type === "start" && Object.keys(e).length) {
        const open = renderTag(body, start2, start2.attrs, e);
        if (open !== null) body = body.slice(0, start2.start) + open + body.slice(start2.end);
      }
      const node = await this.place(body + u.trail, parent, el, u.lead);
      let rec = this.detach(el);
      await this.after(parent);
      let back = null;
      this.host.record({
        label: label2,
        undo: async () => {
          await this.attach(rec, false);
          back = this.detach(node);
          await this.after(parent);
        },
        redo: async () => {
          if (back) await this.attach(back, false);
          rec = this.detach(el);
          await this.after(parent);
        }
      });
      return node;
    }
    // the content of a block set to a text with each formula as its TeX, as one entry of the history
    async setContent(block, content, label2 = "content") {
      const before = contentWithTex(block);
      const put = async (c) => {
        if (this.host.restore) await this.host.restore(block, c);
        else await setContentWithTex(block, c);
        this.host.changed();
      };
      await put(content);
      this.host.record({ label: label2, undo: () => put(before), redo: () => put(content) });
    }
    // takes el off the page, with the text of its unit. its unit is then left out of the file
    detach(el) {
      const parent = el.parentElement;
      if (!parent) throw new Error("the element is not on the page");
      const u = this.unit(el);
      const rec = { node: el, parent, prev: prevKept(el), next: nextKept(el), text: u.lead + u.body + u.trail };
      el.remove();
      detached.add(el);
      return rec;
    }
    // puts an element taken off the page back. after a save it is no longer in the file, and it is
    // then paired with the text of its unit as a fragment
    async attach(rec, refresh = true) {
      const { pairing, source } = this.need();
      const { node, parent } = rec;
      const at = rec.next?.parentNode === parent ? rec.next : rec.prev?.parentNode === parent ? rec.prev.nextSibling : rec.prev ? null : parent.firstChild;
      parent.insertBefore(node, at);
      detached.delete(node);
      if (!pairing.elements.has(node)) mergePairing(pairing, pairFragment(parseFragment(rec.text, source.crlf, parent), node, this.host.math()));
      if (refresh) await this.after(node);
    }
    // an id that is not on the page or in the file, from base
    uniqueId(base) {
      const stem = base.replace(/-\d+$/, "");
      const text = this.host.source()?.text ?? "";
      for (let i = 1; ; i++) {
        const id = `${stem}-${i}`;
        if (!document.getElementById(id) && !text.includes(`id="${id}"`)) return id;
      }
    }
    // the indentation of the children of parent in the file
    childIndent(parent) {
      const space = childSpace(this.srcOf(parent), this.eol(), this.style().step);
      return space.slice(space.lastIndexOf("\n") + 1);
    }
    // the new element made from text and paired as a fragment, inserted before the node before. lead
    // is the white space and the comments before it, by default those of the units of parent
    async place(text, parent, before, lead) {
      const { source, pairing } = this.need();
      const container = pairing.elements.get(parent);
      if (!container || pairing.byLive.has(parent)) throw new Error(`the ${parent.localName} does not take elements`);
      const fragment = parseFragment((lead ?? childSpace(container, this.eol(), this.style().step)) + text, source.crlf, parent);
      const node = document.importNode(fragmentRoot(fragment).node, true);
      parent.insertBefore(node, before && before.parentNode === parent ? before : null);
      const mj = window.MathJax;
      if (mj?.typesetPromise) await mj.typesetPromise([node]);
      mergePairing(pairing, pairFragment(fragment, node, this.host.math()));
      await this.after(node);
      return node;
    }
    refresh() {
      const page = window;
      page.Beeson?.refreshChrome?.();
      page.Reveal?.sync?.();
      page.Reveal?.layout?.();
      this.host.changed();
    }
    // the backdrops, plots, surfaces, and QR codes under root drawn, the running heads and the
    // outlines filled again, and the slides of reveal.js read again
    async after(root) {
      const page = window;
      if (root.isConnected) page.Beeson?.mount?.(root);
      this.refresh();
    }
  };

  // src/editor/main.ts
  var app = new App();
  var doc = new Doc({
    source: () => app.source,
    pairing: () => app.pairing,
    tags: app.tagEdits,
    math: mathLookup,
    record: (e) => app.history.push(e),
    changed: () => {
      app.typing.attach();
      app.markDirty();
      app.invalidate("structure");
    },
    restore: (host, content) => app.typing.restoreHost(host, content)
  });
  app.doc = doc;
  var nav = new Navigator(app);
  var steps = new Steps({
    pairing: () => app.pairing,
    slide: () => app.current(),
    edits: app.tagEdits,
    markDirty: () => app.markDirty(),
    layout: () => app.relayout(),
    show: (el) => app.showSlide(el),
    record: (e) => app.history.push(e),
    tex: (el) => mathLookup()(el)?.tex ?? null,
    changed: () => app.invalidate("content")
  });
  var layers = new Layers(() => app.current(), () => {
    app.selection.clear();
    app.invalidate("slide");
  });
  app.nav = nav;
  app.steps = steps;
  app.layers = layers;
  app.onRefresh(["content", "selection", "slide", "structure", "layout"], () => {
    layers.refresh();
    steps.refresh();
    nav.refresh();
  });
  install10(app);
  install11(app);
  install6(app);
  install12(app, layers.box);
  install4(app);
  install5(app);
  install7(app);
  install8(app);
  install9(app);
  install20(app);
  install24(app);
  install25(app);
  install26(app);
  install27(app);
  installKeys(app);
  install18(app);
  install16(app);
  install17(app);
  install13(app);
  install14(app);
  install(app);
  install15(app);
  install19(app);
  install22(app);
  install21(app);
  install23(app);
  install28(app);
  install3(app);
  install2(app);
  install29(app);
  install30(app);
  var revealReady = () => new Promise((done) => {
    const tick = () => app.deck()?.isReady() ? done() : setTimeout(tick, 50);
    tick();
  });
  async function init() {
    document.body.append(nav.pane, steps.pane, steps.badges);
    document.documentElement.classList.add("beeson-editor");
    app.report();
    await revealReady();
    const d = app.deck();
    if (d) {
      d.configure({ transition: "none", backgroundTransition: "none", fragments: false, keyboard: { 27: null, 79: null, 66: null, 86: null, 190: null, 70: null, 191: null, 83: null } });
      d.on("slidechanged", () => {
        app.emit("slide");
        app.invalidate();
      });
      d.on("resize", () => {
        app.emit("resize");
        app.invalidate();
      });
      app.relayout();
    }
    await mathReady();
    if (!await fetchSource(app)) {
      app.state = "waiting";
      app.report();
    }
  }
  function status() {
    app.flush();
    return {
      state: app.state,
      // true where the file is written in place, false where a save is a download
      supported: canWrite(),
      dirty: app.dirty,
      file: app.handle?.name ?? null,
      blocks: app.pairing?.blocks.length ?? 0,
      sections: app.pairing?.sections.length ?? 0,
      // the elements whose step or place was changed since the last save
      tags: app.tagEdits.size,
      problems: (app.pairing?.problems ?? []).map((p) => ({ slide: app.slideNumber(p.slide), tag: p.tag, reason: p.reason })),
      message: app.line.text,
      undo: app.history.canUndo,
      redo: app.history.canRedo,
      autosave: app.autosave,
      overflow: app.overflow,
      draft: app.drafts.hasDraft(),
      recover: app.drafts.offered(),
      pane: app.notes.height()
    };
  }
  var BeesonEditor = {
    ready: init(),
    // a fresh text starts the history anew, and false opens it as the text of a save
    open: (text, fresh = true) => {
      app.files.open(text, fresh);
      return status();
    },
    render: () => app.files.render(),
    status,
    save: () => app.files.save(),
    saveAs: () => app.files.saveAs(),
    setMath: (container, tex) => app.math.setMath(container, tex),
    undo: () => app.history.undo(),
    redo: () => app.history.redo(),
    toggleAutosave: () => app.files.toggleAutosave(),
    restoreDraft: () => app.drafts.restore(),
    setPane: (height) => app.notes.setPane(height),
    // the file written by save, for a test with a handle of the origin private file system
    attach: (h) => {
      app.handle = h;
    },
    // a command of the registry run by its id, and its label, switch, and enabled state
    exec: (id, arg) => app.commands.run(id, arg),
    state: (id) => app.commands.state(id),
    doc,
    version: "0.9.0-beta.1"
  };
  window.BeesonEditor = BeesonEditor;
})();
