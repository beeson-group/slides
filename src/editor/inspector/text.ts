// the Text pane of the Format tab, for a text with the caret or a selected block, as the Text tab
// of Keynote: the paragraph style in a pop-up, the Format Painter of PowerPoint, the formats of the
// words with Change Case, the tone swatches, the kind of list, and the link. every control runs a command of commands/text.ts by its id, and a
// control of a command that is not defined is drawn disabled. by the scope rule, only the styles
// of the type scale and the tones of the theme are offered

import type { App } from '../app.ts';
import { listKind, selectedBlocks, startList, styleOf, styleWhy } from '../text/blocks.ts';
import { around, FORMATS, inlineTargets, isTone, type FormatName } from '../text/inline.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { openMenu, type MenuItem } from '../ui/menu.ts';
import { button, glyph, keepFocus, numberField, row, section, segmented, type Control, type Run } from './controls.ts';

const STYLES = ['body', 'small', 'subheading', 'caption', 'footnote'];
const CASES = ['sentence', 'lower', 'upper', 'title', 'toggle'];
const SVG = 'http://www.w3.org/2000/svg';

const CSS = `
.beeson-edit-inspector .ed-seg .s { font: 14px/1 Georgia, "Times New Roman", serif; text-decoration: line-through; }
.beeson-edit-inspector .ed-btn.painter[aria-pressed="true"] { background: var(--ed-select); color: var(--ed-on-select); }
.beeson-edit-inspector .ed-btn.case .aa { font: 14px/1 Georgia, "Times New Roman", serif; }
`;

// the brush of the Format Painter, on the grid of the glyphs of controls.ts
function brush(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('beeson-icon');
  for (const [d, fill] of [['M4 3.5h10.5v4H4z', 'none'], ['M14.5 5.5h1.75v4h-6.5v2.5', 'none'], ['M8.5 12h2.5v5h-2.5z', 'currentColor']]) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  }
  return svg;
}

// the Format Painter: a click arms it for one paste of the style of the selection, and a double
// click keeps it armed until it is clicked again, as in PowerPoint
function painter(app: App, run: Run): Control {
  const b = make('button', 'ed-btn painter');
  b.type = 'button';
  b.dataset.command = 'text.formatPainter';
  b.title = 'Format Painter';
  b.append(brush(), make('span', '', 'Format Painter'));
  keepFocus(b);
  b.addEventListener('click', (ev) => void run('text.formatPainter', ev.detail === 2 ? { sticky: true } : undefined));
  const sync = () => {
    const s = app.commands.get('text.formatPainter') ? app.commands.state('text.formatPainter') : null;
    b.disabled = !s?.enabled;
    b.setAttribute('aria-pressed', String(!!s?.checked));
  };
  sync();
  return { el: b, sync };
}

// the button Aa of PowerPoint, which opens the kinds of Change Case
function changeCase(app: App): Control {
  const b = make('button', 'ed-btn case');
  b.type = 'button';
  b.title = 'Change Case';
  b.setAttribute('aria-haspopup', 'menu');
  b.append(make('span', 'aa', 'Aa'), make('span', '', 'Change Case'), glyph('chevron-down', 14));
  const ids = CASES.map((c) => `text.case.${c}`).filter((id) => app.commands.get(id));
  const open = (keyboard: boolean) => {
    const items: MenuItem[] = ids.map((command) => ({ command }));
    openMenu(app, items, { anchor: b.getBoundingClientRect(), placement: 'below', owner: b, keyboard, label: 'Change Case', onClose: () => sync() });
  };
  keepFocus(b);
  b.addEventListener('pointerdown', () => open(false));
  b.addEventListener('click', (ev) => {
    if (ev.detail === 0) open(true);
  });
  const sync = () => {
    b.disabled = !ids.some((id) => app.commands.enabled(id));
  };
  sync();
  return { el: b, sync };
}
const TONES: [string, string, string][] = [
  ['text', 'Text', '--text'],
  ['subtle', 'Subtle', '--subtle'],
  ['muted', 'Muted', '--muted'],
  ['accent', 'Accent', '--accent'],
  ['violet', 'Violet', '--violet'],
  ['blue', 'Blue', '--blue'],
  ['red', 'Red', '--red'],
];

// for several selected blocks, a value of each text of the blocks outside a formula, as the mixed
// state of a control of Keynote is read, and else null
function perText<T>(app: App, value: (host: Element, text: Node) => T): T[] | null {
  if (app.selection.kind !== 'elements' || app.selection.elements().length < 2) return null;
  return inlineTargets(app, true).flatMap(({ host, range }) => {
    const out: T[] = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (range.intersectsNode(n) && n.textContent!.trim() && !n.parentElement?.closest('mjx-container')) out.push(value(host, n));
    }
    return out;
  });
}

// a format on every text of several blocks, on none, or on some
function formatState(app: App, name: FormatName): () => boolean | 'mixed' | null {
  return () => {
    const on = perText(app, (host, n) => !!around(host, n, FORMATS[name].match));
    if (!on) return app.commands.get(`text.${name}`) ? app.commands.state(`text.${name}`).checked : null;
    return on.length > 0 && on.every(Boolean) ? true : on.some(Boolean) ? 'mixed' : false;
  };
}

// the tones of the texts of several blocks, with text for the text color of the theme
const tonesOf = (app: App): Set<string> | null => {
  const tones = perText(app, (host, n) => around(host, n, isTone)?.classList[0].slice(5) ?? 'text');
  return tones && new Set(tones);
};

// the kind of list of each of several blocks, or null when they share one or one has none
function listState(app: App, kind: string): () => boolean | 'mixed' | null {
  return () => {
    const els = app.selection.kind === 'elements' ? app.selection.elements() : [];
    if (els.length < 2 || listKind(app) !== null) return app.commands.get(`text.list.${kind}`) ? app.commands.state(`text.list.${kind}`).checked : null;
    const kinds = els.map((el) => (el.matches('ul, ol') ? el.localName : el.localName === 'p' ? 'none' : null));
    return kinds.includes(null) ? null : kinds.includes(kind) ? 'mixed' : false;
  };
}

// the name of a block that is not in the paragraph styles, e.g. a heading
function tagName(app: App, block?: Element): string {
  const host = block ?? (app.selection.kind === 'text' ? app.selection.items[0] : app.selection.only());
  const el = host?.closest('h1, h2, h3, li, td, th, p, div') ?? host;
  switch (el?.localName) {
    case 'h1': return 'Title';
    case 'h2': return 'Heading';
    case 'h3': return 'Subheading';
    case 'li': return 'List Item';
    case 'td': case 'th': return 'Table Cell';
    default: return 'Body';
  }
}

function stylePopup(app: App): Control {
  const b = make('button', 'ed-popup');
  b.type = 'button';
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', 'Paragraph Style');
  b.title = 'Paragraph Style';
  const text = make('span');
  b.append(text, glyph('chevron-down', 16));
  const ids = STYLES.map((s) => `text.style.${s}`).filter((id) => app.commands.get(id));
  const open = (keyboard: boolean) => {
    const items: MenuItem[] = ids.map((command) => ({ command }));
    openMenu(app, items, { anchor: b.getBoundingClientRect(), placement: 'below', owner: b, keyboard, label: 'Paragraph Style', className: 'select', onClose: () => sync() });
  };
  keepFocus(b);
  b.addEventListener('pointerdown', () => open(false));
  b.addEventListener('click', (ev) => {
    if (ev.detail === 0) open(true);
  });
  const sync = () => {
    const on = ids.find((id) => app.commands.state(id).checked);
    // several blocks of different styles show Mixed, as in Keynote
    const blocks = app.selection.kind === 'elements' && app.selection.elements().length > 1 ? selectedBlocks(app) : [];
    const names = new Set(blocks.map((el) => {
      const s = styleOf(app, el);
      return s && app.commands.get(`text.style.${s}`) ? app.commands.label(`text.style.${s}`) : tagName(app, el);
    }));
    text.textContent = names.size > 1 ? 'Mixed' : on ? app.commands.label(on) : tagName(app);
    b.disabled = !ids.some((id) => app.commands.enabled(id));
    b.title = (b.disabled && styleWhy(app, 'Paragraph Style')) || 'Paragraph Style';
  };
  sync();
  return { el: b, sync };
}

// a swatch of each tone, in the color that the tone has on the slide in its mode
// Start at of a numbered list. the shown number typed into the field is entered with Return, Tab,
// or a click outside it, which keeps the start of a list cut off by the editor, and a typed number
// that is not whole is refused
function startField(app: App, run: Run): Control {
  const field = numberField(app, {
    label: 'Start at',
    unit: '',
    min: 1,
    refuse: true,
    same: true,
    value: () => startList(app)?.start ?? null,
    enabled: () => app.commands.enabled('text.list.start'),
    why: () => 'Start at is set only on a numbered list',
    command: 'text.list.start',
    commit: (n) => run('text.list.start', { start: n }),
  });
  const input = field.input;
  let typed = false;
  input.addEventListener('focus', () => (typed = false));
  input.addEventListener('input', () => (typed = true));
  // read in the capture phase, before the field enters or refuses the value
  const read = (leave: boolean) => {
    const v = Number(input.value.trim().replace(',', '.'));
    if (input.disabled || !input.value.trim()) return;
    if (!Number.isInteger(v)) input.value = '';
    else if (leave && typed && v === startList(app)?.start) void run('text.list.start', { start: v });
  };
  input.addEventListener('blur', () => read(true), true);
  // the field enters a whole number at Return itself, after which a blur does not enter it again
  input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    read(false);
    typed = false;
  }, true);
  return field;
}

function swatches(app: App, run: Run): Control {
  const el = make('div', 'ed-swatches');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Text color');
  const buttons = TONES.map(([tone, label, token]) => {
    const b = make('button');
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.dataset.command = `text.tone.${tone}`;
    keepFocus(b);
    b.addEventListener('click', () => void run(`text.tone.${tone}`));
    el.append(b);
    return { b, tone, token };
  });
  const sync = () => {
    const slide = app.current() ?? document.querySelector('.reveal');
    const style = slide ? getComputedStyle(slide) : null;
    const tones = tonesOf(app);
    for (const { b, tone, token } of buttons) {
      const id = `text.tone.${tone}`;
      const s = app.commands.get(id) ? app.commands.state(id) : null;
      b.style.setProperty('--swatch', style?.getPropertyValue(token).trim() || 'transparent');
      b.disabled = !s?.enabled;
      const on = tones && tones.size > 1 ? (tones.has(tone) ? 'mixed' : 'false') : String(!!s?.checked);
      b.setAttribute('aria-pressed', b.disabled ? 'false' : on);
    }
  };
  sync();
  return { el, sync };
}

const script = (base: string, mark: string, tag: 'sup' | 'sub') => () => {
  const span = make('span', 'script', base);
  span.append(make(tag, '', mark));
  return span;
};

export function textPane(app: App, run: Run): Control[] {
  injectStyle('inspector-text', CSS);
  return [
    stylePopup(app),
    section(null, [row([painter(app, run)])]),
    section('Font', [
      row([segmented(app, run, [
        { command: 'text.bold', text: () => make('span', 'b', 'B'), title: 'Bold', pressed: formatState(app, 'bold') },
        { command: 'text.italic', text: () => make('span', 'i', 'I'), title: 'Italic', pressed: formatState(app, 'italic') },
        { command: 'text.strike', text: () => make('span', 's', 'S'), title: 'Strikethrough', pressed: formatState(app, 'strike') },
        { command: 'text.code', text: () => make('span', 'mono', '{ }'), title: 'Code', pressed: formatState(app, 'code') },
        { command: 'text.superscript', text: script('x', '2', 'sup'), title: 'Superscript', pressed: formatState(app, 'superscript') },
        { command: 'text.subscript', text: script('x', '2', 'sub'), title: 'Subscript', pressed: formatState(app, 'subscript') },
      ], 'Font')]),
      row([segmented(app, run, [
        { command: 'text.smaller', icon: 'minus', text: 'Smaller' },
        { command: 'text.bigger', icon: 'plus', text: 'Bigger' },
      ], 'Size')], 'Size'),
      row([changeCase(app)], 'Case'),
    ]),
    section('Text Color', [row([swatches(app, run)])]),
    section('Bullets & Lists', [
      row([segmented(app, run, [
        { command: 'text.list.none', icon: 'list-none', title: 'Paragraphs', pressed: listState(app, 'none') },
        { command: 'text.list.ul', icon: 'list-dash', title: 'Dashes', pressed: listState(app, 'ul') },
        { command: 'text.list.ol', icon: 'list-number', title: 'Numbers', pressed: listState(app, 'ol') },
      ], 'List'), segmented(app, run, [
        { command: 'text.outdent', icon: 'outdent', title: 'Decrease Indent Level' },
        { command: 'text.indent', icon: 'indent', title: 'Increase Indent Level' },
      ], 'Indent level')]),
      row([startField(app, run)]),
    ]),
    section('Link', [
      row([
        button(app, run, { command: 'text.link', icon: 'link', text: 'Link…' }),
        button(app, run, { command: 'text.removeLink', text: 'Remove Link' }),
      ]),
      row([button(app, run, { command: 'text.clear', text: 'Clear Formatting' })]),
    ]),
  ];
}
