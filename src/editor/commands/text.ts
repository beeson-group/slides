// the commands of the text of a slide: the keys of its structure in a text, i.e. Return, Backspace,
// Delete, Tab, and Shift+Tab, and the Format menu with the formats of the words, their tones, the
// paragraph styles, the lists, the links, Change Case, and Copy Style and Paste Style with the
// Format Painter of the Text pane. the Substitutions of the Edit menu switch the smart quotes and
// dashes of text/substitute.ts. a key of a disabled command is left to the browser, e.g. Return in
// a heading, which typing.ts writes as a br. a format is set in a text, or on the whole text of
// the blocks selected on the canvas

import type { App, Region } from '../app.ts';
import type { Command } from '../commands.ts';
import * as blocks from '../text/blocks.ts';
import * as inline from '../text/inline.ts';
import { openLink, applyLink, type LinkKind } from '../text/link.ts';
import { isSmart, setSmart, type Smart } from '../text/substitute.ts';
import { injectStyle } from '../ui/dom.ts';

const TEXT: Region[] = ['text'];
const FORMAT: Region[] = ['text', 'canvas'];

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

export function install(app: App): void {
  const c = app.commands;
  const define = (command: Command) => c.define(command);
  const menu = (group: string, order: number, submenu?: string) => ({ bar: 'Format', group, order, ...(submenu ? { submenu } : {}) });

  define({ id: 'text.newParagraph', label: 'New Paragraph', keys: { mac: ['Enter'], other: ['Enter'] }, in: TEXT, undoable: true, enabled: blocks.canSplit, run: blocks.split });
  define({ id: 'text.joinBackward', label: 'Join Paragraphs', keys: { mac: ['Backspace'], other: ['Backspace'] }, in: TEXT, undoable: true, enabled: blocks.canJoinBack, run: blocks.joinBackward });
  define({ id: 'text.joinForward', label: 'Join Paragraphs', keys: { mac: ['Delete'], other: ['Delete'] }, in: TEXT, undoable: true, enabled: blocks.canJoinAhead, run: blocks.joinForward });

  const format = (name: inline.FormatName, label: string, order: number, keys: Command['keys'], submenu?: string, regions = FORMAT) =>
    define({
      id: `text.${name}`,
      label,
      keys,
      in: regions,
      menu: menu(submenu ? 'script' : 'font', order, submenu),
      undoable: true,
      enabled: (a) => inline.inlineTargets(a, name === 'bold' || name === 'italic').length > 0,
      checked: (a) => inline.isOn(a, name),
      run: (a) => inline.toggle(a, name),
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
    enabled: (a) => blocks.canStep(a, true),
    run: (a) => blocks.setStyle(a, (s) => blocks.stepped(s, true)),
  });
  define({
    id: 'text.smaller',
    label: 'Smaller',
    keys: { mac: ['Mod+Shift+<'], other: ['Mod+Shift+<'] },
    in: FORMAT,
    menu: menu('size', 31),
    undoable: true,
    enabled: (a) => blocks.canStep(a, false),
    run: (a) => blocks.setStyle(a, (s) => blocks.stepped(s, false)),
  });

  define({
    id: 'text.tone.text',
    label: 'Text',
    in: FORMAT,
    menu: menu('tone', 40, 'Text Color'),
    undoable: true,
    enabled: (a) => inline.inlineTargets(a).length > 0,
    checked: (a) => inline.inlineTargets(a).length > 0 && inline.toneAt(a) === null,
    run: (a) => inline.setTone(a, null),
  });
  inline.TONES.forEach((tone, i) =>
    define({
      id: `text.tone.${tone}`,
      label: TONE_LABELS[tone],
      in: FORMAT,
      menu: menu('tone', 41 + i, 'Text Color'),
      undoable: true,
      enabled: (a) => inline.inlineTargets(a).length > 0,
      checked: (a) => inline.toneAt(a) === tone,
      run: (a) => inline.setTone(a, tone),
    }));

  blocks.PARAGRAPH_STYLES.forEach((style, i) =>
    define({
      id: `text.style.${style}`,
      label: STYLE_LABELS[style],
      in: FORMAT,
      menu: menu('style', 50 + i, 'Paragraph Style'),
      undoable: true,
      enabled: blocks.canStyle,
      checked: (a) => blocks.paragraphStyle(a) === style,
      run: (a) => blocks.setStyle(a, style),
    }));

  (['none', 'ul', 'ol'] as const).forEach((kind, i) =>
    define({
      id: `text.list.${kind}`,
      label: LIST_LABELS[kind],
      in: TEXT,
      menu: menu('list', 60 + i, 'List'),
      undoable: true,
      enabled: (a) => blocks.canSetList(a, kind),
      checked: (a) => blocks.listKind(a) === kind,
      run: (a) => blocks.setList(a, kind),
    }));
  // Tab is taken in every item of a list, also where it does not change the level, so that it
  // does not move the focus out of the text
  define({ id: 'text.indent', label: 'Increase Indent Level', keys: { mac: ['Tab'], other: ['Tab'] }, in: TEXT, menu: menu('list', 70, 'List'), undoable: true, enabled: blocks.inList, run: blocks.indent });
  define({ id: 'text.outdent', label: 'Decrease Indent Level', keys: { mac: ['Shift+Tab'], other: ['Shift+Tab'] }, in: TEXT, menu: menu('list', 71, 'List'), undoable: true, enabled: blocks.inList, run: blocks.outdent });

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
  define({
    id: 'text.case.cycle',
    label: 'Change Case',
    keys: { mac: ['Shift+F3'], other: ['Shift+F3'] },
    in: TEXT,
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

// the Copy Style and Paste Style of Keynote with its keys on a Mac, and with the keys of the Format
// Painter of PowerPoint for Windows elsewhere, and the Format Painter of the Text pane. a click on
// the painter takes the style of the selection, and the next text or block clicked or selected on
// the slide is given it. with sticky, as after a double click on the painter, it stays armed until
// it is clicked again or Esc is pressed. the switches Smart Quotes and Smart Dashes are in the
// Substitutions of the Edit menu
function installStyles(app: App, define: Define, menu: MenuOf): void {
  injectStyle('text-styles', CSS);
  let copied: inline.TextStyle | null = null;
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
    enabled: (a) => inline.readStyle(a) !== null,
    run: (a) => {
      copied = inline.readStyle(a);
    },
  });
  define({
    id: 'text.pasteStyle',
    label: 'Paste Style',
    keys: { mac: ['Mod+Alt+V'], other: ['Mod+Shift+V'] },
    in: FORMAT,
    menu: menu('copy-style', 87),
    undoable: true,
    enabled: (a) => copied !== null && inline.canPaint(a),
    run: (a) => (copied ? inline.pasteStyle(a, copied) : undefined),
  });
  // a script or the double click gives { sticky: true }, which arms the painter until it is
  // switched off. without it, a run switches the painter
  define({
    id: 'text.formatPainter',
    label: 'Format Painter',
    in: FORMAT,
    enabled: (a) => painter.armed || inline.readStyle(a) !== null,
    checked: () => painter.armed,
    run: (a, arg) => {
      const sticky = (arg as { sticky?: unknown } | undefined)?.sticky === true;
      if (painter.armed && !sticky) return arm(false);
      if (!painter.armed) copied = inline.readStyle(a);
      if (copied) arm(true, sticky);
    },
  });

  // the style is set once the press on the slide is released and the browser has put the caret or
  // the range, or once a block is selected by the click
  document.addEventListener('pointerup', (ev) => {
    if (!painter.armed || !(ev.target instanceof Element) || !ev.target.closest('.reveal .slides')) return;
    setTimeout(() => {
      if (!painter.armed) return;
      const paint = inline.canPaint(app);
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
}
