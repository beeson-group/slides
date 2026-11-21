import type { App, Region } from '../app.ts';
import type { Command } from '../commands.ts';
import * as textElements from '../text/elements.ts';
import * as carry from '../text/carry.ts';
import * as inline from '../text/inline.ts';
import * as flow from '../text/flow.ts';
import { renameSection } from '../text/outline.ts';
import { openLink, applyLink, type LinkKind } from '../text/link.ts';
import { isSmart, setSmart, type Smart } from '../text/substitute.ts';
import { injectStyle } from '../ui/dom.ts';
import { CONTAINER } from '../canvas/hit.ts';
import { modeOf, type Mode } from './figure.ts';
import { isShape, isShapeTone, setShapeTone, toneOfShape } from './shape.ts';
import * as notes from '../notes.ts';
import { kindsOf, type Kind } from '../../kinds.ts';

export const deckKinds = (): Record<string, Kind> => kindsOf((window as { beesonTex?: { theorems?: Record<string, Kind> } }).beesonTex?.theorems ?? {});

export function theoremOf(app: App): HTMLElement | null {
  const els = app.selection.kind === 'text' ? app.selection.items.slice(0, 1) : app.selection.elements();
  const el = els.length === 1 ? els[0].closest('p.theorem') : null;
  return el instanceof HTMLElement && !!app.pairing?.elements.has(el) ? el : null;
}

const TEXT: Region[] = ['text'];
const FORMAT: Region[] = ['text', 'canvas'];

function inCode(app: App): boolean {
  if (app.selection.kind === 'text') {
    const n = window.getSelection()?.anchorNode;
    return !!(n instanceof Element ? n : n?.parentElement)?.closest('pre');
  }
  return app.selection.elements().some((el) => !!el.closest('pre'));
}

const TONE_LABELS: Record<inline.Tone, string> = { accent: 'Accent', violet: 'Violet', blue: 'Blue', red: 'Red', subtle: 'Subtle', muted: 'Muted', text: 'Text' };
async function marked(app: App, fn: () => void | Promise<void>): Promise<void> {
  const kept = app.history.keep(() => flow.mark(app));
  await fn();
  kept();
}

const STYLE_LABELS: Record<textElements.ParagraphStyle, string> = { body: 'Body', small: 'Small', subheading: 'Subheading', caption: 'Caption', footnote: 'Footnote' };
const LIST_LABELS: Record<textElements.ListKind, string> = { none: 'Paragraphs', ul: 'Arrows', dots: 'Dots', dashes: 'Dashes', ol: 'Numbers' };
const CASE_LABELS: [inline.Case, string][] = [['sentence', 'Sentence case.'], ['lower', 'lowercase'], ['upper', 'UPPERCASE'], ['title', 'Capitalize Each Word'], ['toggle', 'tOGGLE cASE']];

const BRUSH = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><g fill='none' stroke-linejoin='round'><path d='M6 3.5h10v4H6z M16 5.5h1.5v4H11v2.5' stroke='white' stroke-width='3'/><path d='M9.75 12h2.5v5.5h-2.5z' fill='white' stroke='white' stroke-width='2.5'/><path d='M6 3.5h10v4H6z M16 5.5h1.5v4H11v2.5' stroke='black' stroke-width='1.5'/><path d='M9.75 12h2.5v5.5h-2.5z' fill='black' stroke='black' stroke-width='1'/></g><path d='M1.5 1.5v6' stroke='black' stroke-width='1.5'/></svg>`;
const CSS = `
html.beeson-painting .reveal .slides, html.beeson-painting .reveal .slides * { cursor: url("data:image/svg+xml,${encodeURIComponent(BRUSH)}") 2 2, copy !important; }
`;

function tabIn(app: App, back: boolean): void {
  const active = document.activeElement;
  const host = active && app.hostOf(active);
  if (!host) return;
  const s = getSelection();
  const at = document.createRange();
  if (active!.matches('mjx-container')) at.selectNode(active!);
  else if (s?.rangeCount) at.setStart(s.focusNode!, s.focusOffset);
  else return;
  const formulas = [...host.querySelectorAll('mjx-container[tabindex]')];
  const next = back ? formulas.reverse().find((f) => at.comparePoint(f, 0) < 0) : formulas.find((f) => at.comparePoint(f, 0) > 0);
  if (next) return (next as HTMLElement).focus();
  if (!active!.matches('mjx-container')) return;
  (host as HTMLElement).focus({ preventScroll: true });
  const r = document.createRange();
  if (back) r.setStartBefore(active!);
  else r.setStartAfter(active!);
  s?.removeAllRanges();
  s?.addRange(r);
}

const ALIGNED = 'h1, h2, h3, p, ul, ol, .caption, div.math';
function alignTargets(app: App): Element[] {
  const pairing = app.pairing;
  if (!pairing) return [];
  const els = app.selection.kind === 'elements' ? app.selection.elements().flatMap((el) => (el.matches('div.shape') ? [...el.children] : [el])) : [...flow.spanTargets(app).map((t) => t.host), textElements.textTarget(app)?.host].filter((el): el is Element => !!el);
  const out = new Set<Element>();
  for (const el of els) {
    const textEl = el.localName === 'li' ? el.closest('ul, ol') : el;
    if (textEl?.matches(ALIGNED) && pairing.elements.get(textEl)?.open && !textEl.closest('td, th, aside.notes')) out.add(textEl);
  }
  return [...out];
}

const inShape = (el: Element): boolean => !!el.parentElement?.matches('div.shape');
const centered = (el: Element): boolean => (inShape(el) ? !el.classList.contains('left') : el.classList.contains('center'));

function setCenter(app: App, on: boolean): void {
  for (const el of alignTargets(app)) {
    const classes: Record<string, boolean> = inShape(el) ? { left: !on, center: false } : { center: on };
    if (Object.entries(classes).some(([c, v]) => el.classList.contains(c) !== v)) app.doc.setTag(el, { classes }, 'align');
  }
  app.markDirty();
  app.invalidate('content');
}

export function install(app: App): void {
  flow.install(app);
  carry.install(app);
  const c = app.commands;
  const define = (command: Command) => c.define(command);
  const menu = (group: string, order: number, submenu?: string) => ({ bar: 'Format', group, order, ...(submenu ? { submenu } : {}) });

  const inNotes = (a: App) => a.region() === 'notes';
  define({
    id: 'text.newParagraph',
    label: 'New Paragraph',
    keys: { mac: ['Enter'], other: ['Enter'] },
    in: [...TEXT, 'notes'],
    undoable: true,
    enabled: (a) => (inNotes(a) ? notes.canSplitNotesItem(a) : textElements.canSplit(a)),
    run: (a) => (inNotes(a) ? notes.splitNotesItem(a) : textElements.split(a)),
  });
  define({
    id: 'text.joinBackward',
    label: (a) => {
      const kind = inNotes(a) ? null : textElements.joinKind(a);
      return kind === 'unlist' ? 'Remove Bullet' : kind === 'outdent' ? c.label('text.outdent') : 'Join Paragraphs';
    },
    keys: { mac: ['Backspace'], other: ['Backspace'] },
    in: [...TEXT, 'notes'],
    undoable: true,
    enabled: (a) => (inNotes(a) ? notes.canJoinNotesItem(a) : textElements.canJoinBack(a)),
    run: (a) => (!inNotes(a) && textElements.joinKind(a) === 'drop' ? textElements.joinBackward(a) : marked(a, () => (inNotes(a) ? notes.joinNotesItem(a) : textElements.joinBackward(a)))),
  });
  define({ id: 'text.joinForward', label: 'Join Paragraphs', keys: { mac: ['Delete'], other: ['Delete'] }, in: TEXT, undoable: true, enabled: textElements.canJoinAhead, run: textElements.joinForward });

  const onMath = (a: App) => {
    const host = a.hostOf(document.activeElement);
    return host ? host.matches('div.math') : a.selection.elements().some((el) => el.matches('div.math'));
  };
  const format = (name: inline.FormatName, label: string, order: number, keys: Command['keys'], submenu?: string, regions = FORMAT) =>
    define({
      id: `text.${name}`,
      label,
      keys,
      in: regions,
      menu: menu(submenu ? 'script' : 'font', order, submenu),
      undoable: true,
      enabled: (a) => !onMath(a) && (inline.inlineTargets(a, name === 'bold' || name === 'italic').length > 0 || carry.canFormat(a, name === 'bold' || name === 'italic')),
      checked: (a) => (carry.canFormat(a, true) ? carry.formatOn(a, name) : inline.isOn(a, name)),
      run: (a) => (carry.canFormat(a, true) ? carry.toggleFormat(a, name) : inline.toggle(a, name)),
      ...(name === 'bold' || name === 'italic' ? { context: ['text' as const] } : {}),
    });
  format('bold', 'Bold', 10, { mac: ['Mod+B'], other: ['Mod+B'] }, undefined, [...FORMAT, 'notes']);
  format('italic', 'Italic', 11, { mac: ['Mod+I'], other: ['Mod+I'] }, undefined, [...FORMAT, 'notes']);
  format('underline', 'Underline', 11.5, { mac: ['Mod+U'], other: ['Mod+U'] });
  format('code', 'Code', 12, {});
  format('strike', 'Strikethrough', 13, { mac: ['Mod+Shift+X'], other: ['Alt+Shift+5'] });
  format('superscript', 'Superscript', 20, { mac: ['Ctrl+Mod++', 'Ctrl+Mod+='], other: ['Mod+.'] }, 'Baseline');
  format('subscript', 'Subscript', 21, { mac: ['Ctrl+Mod+-'], other: ['Mod+,'] }, 'Baseline');

  define({
    id: 'text.bigger',
    label: 'Bigger',
    keys: { mac: ['Mod+Shift+>'], other: ['Mod+Shift+>'] },
    in: FORMAT,
    menu: menu('size', 30),
    undoable: true,
    enabled: (a) => textElements.canStep(a, true) || carry.canStep(a, true) || carry.canSizeCode(a, true),
    why: (a) => textElements.styleWhy(a, 'Bigger', true),
    run: (a) => (carry.canSizeCode(a, true) ? carry.sizeCode(a, true) : carry.canStyle(a) ? carry.chooseStyle(a, (s) => textElements.stepped(s, true)) : textElements.setStyle(a, (s) => textElements.stepped(s, true))),
  });
  define({
    id: 'text.smaller',
    label: 'Smaller',
    keys: { mac: ['Mod+Shift+<'], other: ['Mod+Shift+<'] },
    in: FORMAT,
    menu: menu('size', 31),
    undoable: true,
    enabled: (a) => textElements.canStep(a, false) || carry.canStep(a, false) || carry.canSizeCode(a, false),
    why: (a) => textElements.styleWhy(a, 'Smaller', false),
    run: (a) => (carry.canSizeCode(a, false) ? carry.sizeCode(a, false) : carry.canStyle(a) ? carry.chooseStyle(a, (s) => textElements.stepped(s, false)) : textElements.setStyle(a, (s) => textElements.stepped(s, false))),
  });

  const boxes = (a: App) => a.selection.elements().filter(isShape);
  const words = (a: App, shapes: Element[]) => inline.inlineTargets(a).filter((t) => !shapes.some((el) => el.contains(t.host)));
  inline.TONES.forEach((tone, i) =>
    define({
      id: `text.tone.${tone}`,
      label: TONE_LABELS[tone],
      in: FORMAT,
      menu: menu('tone', tone === 'text' ? 40 : 41 + i, 'Text Color'),
      undoable: true,
      undo: 'Text Color',
      enabled: (a) => (boxes(a).length ? isShapeTone(tone) : inline.inlineTargets(a).length > 0 || carry.canFormat(a)),
      checked: (a) => {
        const shapes = boxes(a), rest = words(a, shapes);
        const on = carry.canFormat(a) ? (carry.toneOf(a) ?? 'text') === tone : rest.length ? (tone === 'text' ? inline.textColored(a, rest) : inline.toneAt(a, rest) === tone) : shapes.length > 0;
        return on && shapes.every((el) => toneOfShape(el) === tone);
      },
      run: (a) => {
        const shapes = boxes(a);
        if (!shapes.length) return carry.canFormat(a) ? carry.chooseTone(a, tone) : inline.setTone(a, tone);
        setShapeTone(a, shapes, tone);
        inline.setTone(a, tone, words(a, shapes));
      },
    }));

  textElements.PARAGRAPH_STYLES.forEach((style, i) =>
    define({
      id: `text.style.${style}`,
      label: STYLE_LABELS[style],
      in: FORMAT,
      menu: menu('style', 50 + i, 'Paragraph Style'),
      undoable: true,
      undo: 'Paragraph Style',
      enabled: (a) => textElements.canStyle(a, style) || carry.canStyle(a),
      why: (a) => textElements.styleWhy(a, STYLE_LABELS[style]) ?? `${STYLE_LABELS[style]} is not available, since a list item takes only Body and Small`,
      checked: (a) => (carry.canStyle(a) ? carry.styleOf(a) : textElements.paragraphStyle(a)) === style,
      run: (a) => (carry.canStyle(a) ? carry.chooseStyle(a, style) : textElements.setStyle(a, style)),
    }));

  (['none', 'ul', 'dots', 'dashes', 'ol'] as const).forEach((kind, i) =>
    define({
      id: `text.list.${kind}`,
      label: LIST_LABELS[kind],
      in: [...TEXT, 'notes'],
      menu: menu('list', 60 + i, 'List'),
      undoable: true,
      undo: 'List Style',
      enabled: (a) => (notes.notesListKind(a) ? notes.canSetNotesList(a, kind) : textElements.canSetList(a, kind) || carry.canList(a)),
      why: (a) => textElements.listWhy(a, LIST_LABELS[kind]),
      checked: (a) => (notes.notesListKind(a) ?? (carry.canList(a) ? carry.listOf(a) : textElements.listKind(a))) === kind,
      run: async (a) => {
        const kept = a.history.keep(() => flow.mark(a));
        await (notes.notesListKind(a) ? notes.setNotesList(a, kind) : carry.canList(a) ? carry.chooseList(a, kind) : textElements.setList(a, kind));
        kept();
      },
    }));
  (['left', 'center'] as const).forEach((align, i) =>
    define({
      id: `text.align.${align}`,
      label: align === 'left' ? 'Align Left' : 'Center',
      ...(align === 'center' ? { keys: { mac: ['Mod+Shift+|'] } } : {}),
      in: FORMAT,
      menu: menu('align', 65 + i, 'Alignment'),
      undoable: true,
      undo: 'Alignment',
      enabled: (a) => alignTargets(a).length > 0,
      checked: (a) => {
        const els = alignTargets(a);
        return els.length > 0 && els.every((el) => centered(el) === (align === 'center'));
      },
      run: (a) => setCenter(a, align === 'center'),
    }));
  define({ id: 'text.renameSection', label: 'Rename Section', undoable: true, enabled: (a) => !!a.pairing, run: (a, arg) => renameSection(a, arg) });
  define({ id: 'text.list.start', label: 'Start At', in: TEXT, undoable: true, enabled: (a) => !!textElements.startList(a), run: (a, arg) => textElements.setStart(a, Number((arg as { start?: unknown } | undefined)?.start)) });
  define({ id: 'text.indent', label: 'Increase Indent Level', keys: { mac: ['Mod+]', 'Tab'], other: ['Tab', 'Mod+]'] }, in: TEXT, menu: menu('list', 70, 'List'), undoable: true, enabled: (a) => textElements.inList(a) || flow.canLevel(a), run: (a) => marked(a, () => flow.level(a, true)) });
  define({ id: 'text.outdent', label: 'Decrease Indent Level', keys: { mac: ['Mod+[', 'Shift+Tab'], other: ['Shift+Tab', 'Mod+['] }, in: TEXT, menu: menu('list', 71, 'List'), undoable: true, enabled: (a) => textElements.inList(a) || flow.canLevel(a), run: (a) => marked(a, () => flow.level(a, false)) });
  for (const back of [false, true]) {
    const key = back ? 'Shift+Tab' : 'Tab';
    define({ id: back ? 'text.tabBack' : 'text.tab', label: key, keys: { mac: [key], other: [key] }, in: TEXT, enabled: (a) => !document.activeElement?.closest('td, th') && !textElements.inList(a) && !flow.canLevel(a), run: (a) => tabIn(a, back) });
  }

  define({
    id: 'text.link',
    label: (a) => (inline.linkAt(a) ? 'Edit Link…' : 'Add Link…'),
    keys: { mac: ['Mod+K'], other: ['Mod+K'] },
    in: FORMAT,
    menu: menu('link', 80),
    context: ['text'],
    enabled: inline.canLink,
    run: (a, arg) => {
      const { href, kind } = (arg ?? {}) as { href?: unknown; kind?: LinkKind };
      return typeof href === 'string' ? applyLink(a, href) : openLink(a, kind);
    },
  });
  define({
    id: 'text.removeLink',
    label: 'Remove Link',
    in: FORMAT,
    menu: menu('link', 81),
    undoable: true,
    enabled: (a) => inline.linkAt(a) !== null,
    run: inline.removeLink,
  });

  CASE_LABELS.forEach(([kind, label], i) =>
    define({
      id: `text.case.${kind}`,
      label,
      in: FORMAT,
      menu: menu('case', 84 + i / 10, 'Change Case'),
      enabled: inline.canPaint,
      run: (a) => a.history.transact('change case', () => inline.changeCase(a, kind)),
    }));
  define({
    id: 'text.case.cycle',
    label: 'Change Case',
    keys: { mac: ['Shift+F3'], other: ['Shift+F3'] },
    in: TEXT,
    menu: menu('case-cycle', 83.9, 'Change Case'),
    undoable: true,
    enabled: inline.canPaint,
    run: (a) => inline.changeCase(a, 'cycle'),
  });

  installStyles(app, define, menu);

  define({
    id: 'text.clear',
    label: 'Clear Formatting',
    keys: { mac: ['Mod+\\'], other: ['Mod+Space', 'Mod+\\'] },
    in: [...FORMAT, 'notes'],
    menu: menu('clear', 90),
    context: ['text'],
    undoable: true,
    enabled: (a) => inline.inlineTargets(a, true).length > 0,
    run: inline.clearFormatting,
  });

  type Arg = { el?: Element; value?: string };
  const target = (a: App, arg?: unknown) => {
    const el = (arg as Arg | undefined)?.el;
    return el?.isConnected && el.matches('p.theorem') ? el : theoremOf(a);
  };
  const theoremAttr = (id: string, label: string, name: string, now: (el: Element) => string) =>
    define({
      id,
      label,
      undoable: true,
      enabled: (a) => !!theoremOf(a),
      run: (a, arg) => {
        const el = target(a, arg);
        const value = ((arg as Arg | undefined)?.value ?? '').trim();
        if (!el || value === now(el)) return;
        a.doc.setTag(el, { attrs: { [name]: value || null } }, label);
        a.invalidate('content');
      },
    });
  theoremAttr('theorem.kind', 'Theorem Kind', 'data-kind', (el) => el.getAttribute('data-kind') || 'theorem');
  theoremAttr('theorem.name', 'Theorem Name', 'data-name', (el) => el.getAttribute('data-name') ?? '');
}

type Define = (command: Command) => Command;
type MenuOf = (group: string, order: number, submenu?: string) => Command['menu'];

type FigureStyle = { whiteFigure: boolean | null; invert: boolean | null; mode: Mode };
type Copied = { text: inline.TextStyle; center: boolean | null } | { figure: FigureStyle };

function figuresOf(app: App): Element[] {
  if (app.selection.kind !== 'elements') return [];
  const open = (m: Element) => !!app.pairing?.elements.get(m)?.open;
  return app.selection.elements().flatMap((el) => {
    if (el.matches('img, video')) return open(el) ? [el] : [];
    if (!el.matches(CONTAINER)) return [];
    const found = [...el.querySelectorAll('img, video')].filter((m) => m.getBoundingClientRect().width > 0 && open(m));
    return found.length === 1 ? found : [];
  });
}

function readFigure(el: Element): FigureStyle {
  const image = el.localName === 'img';
  return { whiteFigure: image ? el.classList.contains('white-figure') : null, invert: image ? el.classList.contains('invert') : null, mode: modeOf(el) };
}

function readCopied(app: App): Copied | null {
  const [figure] = figuresOf(app);
  if (figure) return { figure: readFigure(figure) };
  const text = inline.readStyle(app);
  const [textEl] = alignTargets(app);
  return text ? { text, center: textEl ? centered(textEl) : null } : null;
}

function pasteFigure(app: App, style: FigureStyle): void {
  for (const el of figuresOf(app)) {
    const classes: Record<string, boolean> = { 'for-dark': style.mode === 'dark', 'for-light': style.mode === 'light' };
    if (el.localName === 'img') {
      if (style.whiteFigure !== null) classes['white-figure'] = style.whiteFigure;
      if (style.invert !== null) classes.invert = style.invert;
    }
    const changed = Object.fromEntries(Object.entries(classes).filter(([name, on]) => el.classList.contains(name) !== on));
    if (Object.keys(changed).length) app.doc.setTag(el, { classes: changed }, 'paste style');
  }
}

function installStyles(app: App, define: Define, menu: MenuOf): void {
  injectStyle('text-styles', CSS);
  let copied: Copied | null = null;
  const canPaste = (a: App) => (copied && 'figure' in copied ? figuresOf(a).length > 0 : !!copied && !inCode(a) && inline.canPaint(a));
  const painter = { armed: false, sticky: false };
  const arm = (on: boolean, sticky = false) => {
    painter.armed = on;
    painter.sticky = on && sticky;
    document.documentElement.classList.toggle('beeson-painting', on);
    app.invalidate('selection');
  };

  define({
    id: 'text.copyStyle',
    label: 'Copy Style',
    keys: { mac: ['Mod+Alt+C'], other: ['Mod+Shift+C'] },
    in: FORMAT,
    menu: menu('copy-style', 86),
    enabled: (a) => readCopied(a) !== null,
    run: (a) => {
      copied = readCopied(a);
    },
  });
  define({
    id: 'text.pasteStyle',
    label: 'Paste Style',
    keys: { mac: ['Mod+Alt+V'], other: ['Mod+Shift+V'] },
    in: FORMAT,
    menu: menu('copy-style', 87),
    undoable: true,
    enabled: canPaste,
    run: (a) => {
      if (!copied) return;
      if ('figure' in copied) return pasteFigure(a, copied.figure);
      if (copied.center !== null) setCenter(a, copied.center);
      return inline.pasteStyle(a, copied.text);
    },
  });
  define({
    id: 'text.formatPainter',
    label: 'Format Painter',
    in: FORMAT,
    enabled: (a) => painter.armed || figuresOf(a).length > 0 || (!inCode(a) && inline.readStyle(a) !== null),
    checked: () => painter.armed,
    run: (a, arg) => {
      const sticky = (arg as { sticky?: unknown } | undefined)?.sticky === true;
      if (painter.armed && !sticky) return arm(false);
      if (!painter.armed) copied = readCopied(a);
      if (copied) arm(true, sticky);
    },
  });

  document.addEventListener('pointerup', (ev) => {
    if (!painter.armed || !(ev.target instanceof Element) || !ev.target.closest('.reveal .slides')) return;
    setTimeout(() => {
      if (!painter.armed) return;
      const paint = canPaste(app);
      if (!painter.sticky) arm(false);
      if (paint) void app.commands.run('text.pasteStyle').catch((e) => app.fail(e));
    }, 0);
  }, true);
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && painter.armed) arm(false);
  }, true);

  const smart = (kind: Smart, label: string, order: number) =>
    define({
      id: `text.smart.${kind}`,
      label,
      menu: { bar: 'Edit', group: 'substitutions', order, submenu: 'Substitutions' },
      checked: () => isSmart(kind),
      run: () => setSmart(kind, !isSmart(kind)),
    });
  smart('quotes', 'Smart Quotes', 90);
  smart('dashes', 'Smart Dashes', 91);
  smart('links', 'Smart Web and Email Links', 92);
  smart('markdown', 'Markdown Formatting', 93);
  smart('tex', 'TeX Formulas', 94);
}
