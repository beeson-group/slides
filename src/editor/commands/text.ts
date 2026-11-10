// the commands of the text of a slide: the keys of its structure in a text, i.e. Return, Backspace,
// Delete, Tab, and Shift+Tab, and the Format menu with the formats of the words, their tones, the
// paragraph styles, the lists, and the links. a key of a disabled command is left to the browser,
// e.g. Return in a heading, which typing.ts writes as a br. a format is set in a text, or on the
// whole text of the blocks selected on the canvas

import type { App, Region } from '../app.ts';
import type { Command } from '../commands.ts';
import * as blocks from '../text/blocks.ts';
import * as inline from '../text/inline.ts';
import { openLink, applyLink } from '../text/link.ts';

const TEXT: Region[] = ['text'];
const FORMAT: Region[] = ['text', 'canvas'];

const TONE_LABELS: Record<inline.Tone, string> = { accent: 'Accent', violet: 'Violet', blue: 'Blue', red: 'Red', subtle: 'Subtle', muted: 'Muted' };
const STYLE_LABELS: Record<blocks.ParagraphStyle, string> = { body: 'Body', small: 'Small', subheading: 'Subheading', caption: 'Caption', footnote: 'Footnote' };
const LIST_LABELS: Record<blocks.ListKind, string> = { none: 'Paragraphs', ul: 'Dashes', ol: 'Numbers' };

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
  // gives the address as arg, e.g. { href: '#/7' }
  define({
    id: 'text.link',
    label: (a) => (inline.linkAt(a) ? 'Edit Link…' : 'Add Link…'),
    keys: { mac: ['Mod+K'], other: ['Mod+K'] },
    in: FORMAT,
    menu: menu('link', 80),
    context: ['text'],
    enabled: inline.canLink,
    run: (a, arg) => {
      const href = (arg as { href?: unknown } | undefined)?.href;
      return typeof href === 'string' ? applyLink(a, href) : openLink(a);
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
