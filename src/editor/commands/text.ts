// the commands of the text of a slide: the keys of its structure in a text, i.e. Return, Backspace,
// Delete, Tab, and Shift+Tab, and the Format menu with the formats of the words, their tones, the
// paragraph styles, the lists, the links, Change Case, and Copy Style and Paste Style with the
// Format Painter of the Text pane. the Substitutions of the Edit menu switch the smart quotes,
// dashes, and links of text/substitute.ts. a key of a disabled command is left to the browser,
// e.g. Return in a heading, which typing.ts writes as a br. a format is set in a text, or on the
// whole text of the blocks selected on the canvas. with the caret outside a word, a format, a
// tone, or a style is kept by text/carry.ts for the text typed next

import type { App, Region } from '../app.ts';
import type { Command } from '../commands.ts';
import * as blocks from '../text/blocks.ts';
import * as carry from '../text/carry.ts';
import * as inline from '../text/inline.ts';
import * as flow from '../text/flow.ts';
import { openLink, applyLink, type LinkKind } from '../text/link.ts';
import { isSmart, setSmart, type Smart } from '../text/substitute.ts';
import { injectStyle } from '../ui/dom.ts';
import { CONTAINER } from '../canvas/hit.ts';
import { modeOf, type Mode } from './figure.ts';
import * as notes from '../notes.ts';

const TEXT: Region[] = ['text'];
const FORMAT: Region[] = ['text', 'canvas'];

// whether the caret, the selected text, or a selected block is in a code box, which does not hold
// the styles of a text that Paste Style and the Format Painter set
function inCode(app: App): boolean {
  if (app.selection.kind === 'text') {
    const n = window.getSelection()?.anchorNode;
    return !!(n instanceof Element ? n : n?.parentElement)?.closest('pre');
  }
  return app.selection.elements().some((el) => !!el.closest('pre'));
}

const TONE_LABELS: Record<inline.Tone, string> = { accent: 'Accent', violet: 'Violet', blue: 'Blue', red: 'Red', subtle: 'Subtle', muted: 'Muted' };
const STYLE_LABELS: Record<blocks.ParagraphStyle, string> = { body: 'Body', small: 'Small', subheading: 'Subheading', caption: 'Caption', footnote: 'Footnote' };
const LIST_LABELS: Record<blocks.ListKind, string> = { none: 'Paragraphs', ul: 'Dashes', ol: 'Numbers' };
// the labels of Change Case in PowerPoint, each written in its case
const CASE_LABELS: [inline.Case, string][] = [['sentence', 'Sentence case.'], ['lower', 'lowercase'], ['upper', 'UPPERCASE'], ['title', 'Capitalize Each Word'], ['toggle', 'tOGGLE cASE']];

// the brush of the Format Painter at the pointer while it is armed, with its tip at the hot spot
const BRUSH = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><g fill='none' stroke-linejoin='round'><path d='M6 3.5h10v4H6z M16 5.5h1.5v4H11v2.5' stroke='white' stroke-width='3'/><path d='M9.75 12h2.5v5.5h-2.5z' fill='white' stroke='white' stroke-width='2.5'/><path d='M6 3.5h10v4H6z M16 5.5h1.5v4H11v2.5' stroke='black' stroke-width='1.5'/><path d='M9.75 12h2.5v5.5h-2.5z' fill='black' stroke='black' stroke-width='1'/></g><path d='M1.5 1.5v6' stroke='black' stroke-width='1.5'/></svg>`;
const CSS = `
html.beeson-painting .reveal .slides, html.beeson-painting .reveal .slides * { cursor: url("data:image/svg+xml,${encodeURIComponent(BRUSH)}") 2 2, copy !important; }
`;

// tabIn focuses the formula of the block after the caret, or before it with back, and else puts
// the caret beside the focused formula, or leaves it where it is
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

export function install(app: App): void {
  flow.install(app);
  carry.install(app);
  const c = app.commands;
  const define = (command: Command) => c.define(command);
  const menu = (group: string, order: number, submenu?: string) => ({ bar: 'Format', group, order, ...(submenu ? { submenu } : {}) });

  // in the speaker notes, Return and Backspace act on an item of a dash list of notes.ts
  const inNotes = (a: App) => a.region() === 'notes';
  define({
    id: 'text.newParagraph',
    label: 'New Paragraph',
    keys: { mac: ['Enter'], other: ['Enter'] },
    in: [...TEXT, 'notes'],
    undoable: true,
    enabled: (a) => (inNotes(a) ? notes.canSplitNotesItem(a) : blocks.canSplit(a)),
    run: (a) => (inNotes(a) ? notes.splitNotesItem(a) : blocks.split(a)),
  });
  define({
    id: 'text.joinBackward',
    label: 'Join Paragraphs',
    keys: { mac: ['Backspace'], other: ['Backspace'] },
    in: [...TEXT, 'notes'],
    undoable: true,
    enabled: (a) => (inNotes(a) ? notes.canJoinNotesItem(a) : blocks.canJoinBack(a)),
    run: (a) => (inNotes(a) ? notes.joinNotesItem(a) : blocks.joinBackward(a)),
  });
  define({ id: 'text.joinForward', label: 'Join Paragraphs', keys: { mac: ['Delete'], other: ['Delete'] }, in: TEXT, undoable: true, enabled: blocks.canJoinAhead, run: blocks.joinForward });

  const format = (name: inline.FormatName, label: string, order: number, keys: Command['keys'], submenu?: string, regions = FORMAT) =>
    define({
      id: `text.${name}`,
      label,
      keys,
      in: regions,
      menu: menu(submenu ? 'script' : 'font', order, submenu),
      undoable: true,
      enabled: (a) => inline.inlineTargets(a, name === 'bold' || name === 'italic').length > 0 || carry.canFormat(a, name === 'bold' || name === 'italic'),
      checked: (a) => (carry.canFormat(a, true) ? carry.formatOn(a, name) : inline.isOn(a, name)),
      run: (a) => (carry.canFormat(a, true) ? carry.toggleFormat(a, name) : inline.toggle(a, name)),
      ...(name === 'bold' || name === 'italic' ? { context: ['text' as const] } : {}),
    });
  // bold and italic are taken in the speaker notes too
  format('bold', 'Bold', 10, { mac: ['Mod+B'], other: ['Mod+B'] }, undefined, [...FORMAT, 'notes']);
  format('italic', 'Italic', 11, { mac: ['Mod+I'], other: ['Mod+I'] }, undefined, [...FORMAT, 'notes']);
  format('code', 'Code', 12, {});
  // the key of Word for a Mac and of Google Slides on a Mac, and the key of Google Slides elsewhere,
  // since neither Keynote nor PowerPoint for Windows gives Strikethrough a key
  format('strike', 'Strikethrough', 13, { mac: ['Mod+Shift+X'], other: ['Alt+Shift+5'] });
  // Keynote's keys of Baseline on a Mac, and those of Google Docs elsewhere, since Ctrl+Shift+= is
  // a zoom of the browser
  format('superscript', 'Superscript', 20, { mac: ['Ctrl+Mod++', 'Ctrl+Mod+='], other: ['Mod+.'] }, 'Baseline');
  format('subscript', 'Subscript', 21, { mac: ['Ctrl+Mod+-'], other: ['Mod+,'] }, 'Baseline');

  define({
    id: 'text.bigger',
    label: 'Bigger',
    keys: { mac: ['Mod+Shift+>'], other: ['Mod+Shift+>'] },
    in: FORMAT,
    menu: menu('size', 30),
    undoable: true,
    enabled: (a) => blocks.canStep(a, true) || carry.canStep(a, true) || carry.canSizeCode(a, true),
    why: (a) => blocks.styleWhy(a, 'Bigger', true),
    run: (a) => (carry.canSizeCode(a, true) ? carry.sizeCode(a, true) : carry.canStyle(a) ? carry.chooseStyle(a, (s) => blocks.stepped(s, true)) : blocks.setStyle(a, (s) => blocks.stepped(s, true))),
  });
  define({
    id: 'text.smaller',
    label: 'Smaller',
    keys: { mac: ['Mod+Shift+<'], other: ['Mod+Shift+<'] },
    in: FORMAT,
    menu: menu('size', 31),
    undoable: true,
    enabled: (a) => blocks.canStep(a, false) || carry.canStep(a, false) || carry.canSizeCode(a, false),
    why: (a) => blocks.styleWhy(a, 'Smaller', false),
    run: (a) => (carry.canSizeCode(a, false) ? carry.sizeCode(a, false) : carry.canStyle(a) ? carry.chooseStyle(a, (s) => blocks.stepped(s, false)) : blocks.setStyle(a, (s) => blocks.stepped(s, false))),
  });

  define({
    id: 'text.tone.text',
    label: 'Text',
    in: FORMAT,
    menu: menu('tone', 40, 'Text Color'),
    undoable: true,
    undo: 'Text Color',
    enabled: (a) => inline.inlineTargets(a).length > 0 || carry.canFormat(a),
    checked: (a) => (carry.canFormat(a) ? carry.toneOf(a) === null : inline.inlineTargets(a).length > 0 && inline.toneAt(a) === null),
    run: (a) => (carry.canFormat(a) ? carry.chooseTone(a, null) : inline.setTone(a, null)),
  });
  inline.TONES.forEach((tone, i) =>
    define({
      id: `text.tone.${tone}`,
      label: TONE_LABELS[tone],
      in: FORMAT,
      menu: menu('tone', 41 + i, 'Text Color'),
      undoable: true,
      undo: 'Text Color',
      enabled: (a) => inline.inlineTargets(a).length > 0 || carry.canFormat(a),
      checked: (a) => (carry.canFormat(a) ? carry.toneOf(a) : inline.toneAt(a)) === tone,
      run: (a) => (carry.canFormat(a) ? carry.chooseTone(a, tone) : inline.setTone(a, tone)),
    }));

  blocks.PARAGRAPH_STYLES.forEach((style, i) =>
    define({
      id: `text.style.${style}`,
      label: STYLE_LABELS[style],
      in: FORMAT,
      menu: menu('style', 50 + i, 'Paragraph Style'),
      undoable: true,
      undo: 'Paragraph Style',
      enabled: (a) => blocks.canStyle(a, style) || carry.canStyle(a),
      why: (a) => blocks.styleWhy(a, STYLE_LABELS[style]) ?? `${STYLE_LABELS[style]} is not available, since a list item takes only Body and Small`,
      checked: (a) => (carry.canStyle(a) ? carry.styleOf(a) : blocks.paragraphStyle(a)) === style,
      run: (a) => (carry.canStyle(a) ? carry.chooseStyle(a, style) : blocks.setStyle(a, style)),
    }));

  (['none', 'ul', 'ol'] as const).forEach((kind, i) =>
    define({
      id: `text.list.${kind}`,
      label: LIST_LABELS[kind],
      in: [...TEXT, 'notes'],
      menu: menu('list', 60 + i, 'List'),
      undoable: true,
      undo: 'List Style',
      enabled: (a) => (notes.notesListKind(a) ? notes.canSetNotesList(a, kind) : blocks.canSetList(a, kind) || carry.canList(a)),
      why: (a) => blocks.listWhy(a, LIST_LABELS[kind]),
      checked: (a) => (notes.notesListKind(a) ?? (carry.canList(a) ? carry.listOf(a) : blocks.listKind(a))) === kind,
      run: (a) => (notes.notesListKind(a) ? notes.setNotesList(a, kind) : carry.canList(a) ? carry.chooseList(a, kind) : blocks.setList(a, kind)),
    }));
  // Tab is taken in every item of a list, also where it does not change the level, so that it
  // does not move the focus out of the text. ⌘] and ⌘[ are Keynote's keys, shown in the menu, and
  // Ctrl+] and Ctrl+[ those of Google Docs elsewhere, where the menu shows Tab and Shift+Tab, since
  // ] and [ are typed with AltGr on a German or an Italian keyboard
  define({ id: 'text.indent', label: 'Increase Indent Level', keys: { mac: ['Mod+]', 'Tab'], other: ['Tab', 'Mod+]'] }, in: TEXT, menu: menu('list', 70, 'List'), undoable: true, enabled: (a) => blocks.inList(a) || flow.canLevel(a), run: (a) => flow.level(a, true) });
  define({ id: 'text.outdent', label: 'Decrease Indent Level', keys: { mac: ['Mod+[', 'Shift+Tab'], other: ['Shift+Tab', 'Mod+['] }, in: TEXT, menu: menu('list', 71, 'List'), undoable: true, enabled: (a) => blocks.inList(a) || flow.canLevel(a), run: (a) => flow.level(a, false) });
  // Tab and Shift+Tab in a text outside a list and a table keep the focus in the text, as a text
  // box of Keynote takes them. a tab is not typed, since the theme draws it as a space. the key
  // stops at each formula of the block, which Enter opens, and goes on from the last to the text
  for (const back of [false, true]) {
    const key = back ? 'Shift+Tab' : 'Tab';
    define({ id: back ? 'text.tabBack' : 'text.tab', label: key, keys: { mac: [key], other: [key] }, in: TEXT, enabled: (a) => !document.activeElement?.closest('td, th') && !blocks.inList(a) && !flow.canLevel(a), run: (a) => tabIn(a, back) });
  }

  // the link opens its dialog, which makes the change one entry of the history. a test or a script
  // gives the address as arg, e.g. { href: '#/7' }, or the kind of link shown first, e.g.
  // { kind: 'email' }
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

  // the kinds of Change Case of PowerPoint, and its Shift+F3, which goes from lowercase to UPPERCASE
  // to Capitalize Each Word. it is taken only in a text, where it is Change Case in PowerPoint for
  // Windows too, since elsewhere it is Find Previous on Windows and Linux
  CASE_LABELS.forEach(([kind, label], i) =>
    define({
      id: `text.case.${kind}`,
      label,
      in: FORMAT,
      menu: menu('case', 84 + i / 10, 'Change Case'),
      enabled: inline.canPaint,
      // one entry named Change Case for every kind, as in the Edit menu of PowerPoint
      run: (a) => a.history.transact('change case', () => inline.changeCase(a, kind)),
    }));
  // at the head of the submenu, so that its key is seen there and in the sheet of shortcuts
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

  // PowerPoint's Ctrl+Space elsewhere, which is the switch of the input source on a Mac
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
}

type Define = (command: Command) => Command;
type MenuOf = (group: string, order: number, submenu?: string) => Command['menu'];

// the style of a figure that Copy Style takes and Paste Style sets, as the Image pane sets it: the
// classes paper and invert of an image, null when taken from a video, and the mode it is shown in
type FigureStyle = { paper: boolean | null; invert: boolean | null; mode: Mode };
type Copied = { text: inline.TextStyle } | { figure: FigureStyle };

// the images and videos of the selected elements: a selected one, or the one shown in a selected
// figure, zone, or plate
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
  return { paper: image ? el.classList.contains('paper') : null, invert: image ? el.classList.contains('invert') : null, mode: modeOf(el) };
}

// the style of the selected figure, else of the text or the block
function readCopied(app: App): Copied | null {
  const [figure] = figuresOf(app);
  if (figure) return { figure: readFigure(figure) };
  const text = inline.readStyle(app);
  return text ? { text } : null;
}

// the mode on every figure, and paper and invert on an image, each class changed only where it
// differs
function pasteFigure(app: App, style: FigureStyle): void {
  for (const el of figuresOf(app)) {
    const classes: Record<string, boolean> = { 'for-dark': style.mode === 'dark', 'for-light': style.mode === 'light' };
    if (el.localName === 'img') {
      if (style.paper !== null) classes.paper = style.paper;
      if (style.invert !== null) classes.invert = style.invert;
    }
    const changed = Object.fromEntries(Object.entries(classes).filter(([name, on]) => el.classList.contains(name) !== on));
    if (Object.keys(changed).length) app.doc.setTag(el, { classes: changed }, 'paste style');
  }
}

// the Copy Style and Paste Style of Keynote with its keys on a Mac, and with the keys of the Format
// Painter of PowerPoint for Windows elsewhere, and the Format Painter of the Text pane. the style of
// a text goes to a text or a block, and the style of a figure to a figure. a click on the painter
// takes the style of the selection, and the next text, block, or figure clicked or selected on the
// slide is given it. with sticky, as after a double click on the painter, it stays armed until it
// is clicked again or Esc is pressed. the switches Smart Quotes, Smart Dashes, and Smart Web and
// Email Links are in the Substitutions of the Edit menu
function installStyles(app: App, define: Define, menu: MenuOf): void {
  injectStyle('text-styles', CSS);
  let copied: Copied | null = null;
  // a text style is pasted on a text outside a code box, and the style of a figure on a figure
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
    run: (a) => (!copied ? undefined : 'figure' in copied ? pasteFigure(a, copied.figure) : inline.pasteStyle(a, copied.text)),
  });
  // a script or the double click gives { sticky: true }, which arms the painter until it is
  // switched off. without it, a run switches the painter. an armed painter stays live, so that a
  // click switches it off
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

  // the style is set once the press on the slide is released and the browser has put the caret or
  // the range, or once a block is selected by the click
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
}
