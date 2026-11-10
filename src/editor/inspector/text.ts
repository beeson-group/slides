// the Text pane of the Format tab, for a text with the caret or a selected block, as the Text tab
// of Keynote: the paragraph style in a pop-up, the Format Painter of PowerPoint, the formats of the
// words with Change Case, the tone swatches, the kind of list, and the link. every control runs a command of commands/text.ts by its id, and a
// control of a command that is not defined is drawn disabled. by the scope rule, only the styles
// of the type scale and the tones of the theme are offered

import type { App } from '../app.ts';
import { styleWhy } from '../text/blocks.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { openMenu, type MenuItem } from '../ui/menu.ts';
import { button, glyph, keepFocus, row, section, segmented, type Control, type Run } from './controls.ts';

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

// the name of a block that is not in the paragraph styles, e.g. a heading
function tagName(app: App): string {
  const host = app.selection.kind === 'text' ? app.selection.items[0] : app.selection.only();
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
    text.textContent = on ? app.commands.label(on) : tagName(app);
    b.disabled = !ids.some((id) => app.commands.enabled(id));
    b.title = (b.disabled && styleWhy(app, 'Paragraph Style')) || 'Paragraph Style';
  };
  sync();
  return { el: b, sync };
}

// a swatch of each tone, in the color that the tone has on the slide in its mode
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
    for (const { b, tone, token } of buttons) {
      const id = `text.tone.${tone}`;
      const s = app.commands.get(id) ? app.commands.state(id) : null;
      b.style.setProperty('--swatch', style?.getPropertyValue(token).trim() || 'transparent');
      b.disabled = !s?.enabled;
      b.setAttribute('aria-pressed', String(!!s?.checked && !b.disabled));
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
        { command: 'text.bold', text: () => make('span', 'b', 'B'), title: 'Bold' },
        { command: 'text.italic', text: () => make('span', 'i', 'I'), title: 'Italic' },
        { command: 'text.strike', text: () => make('span', 's', 'S'), title: 'Strikethrough' },
        { command: 'text.code', text: () => make('span', 'mono', '{ }'), title: 'Code' },
        { command: 'text.superscript', text: script('x', '2', 'sup'), title: 'Superscript' },
        { command: 'text.subscript', text: script('x', '2', 'sub'), title: 'Subscript' },
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
        { command: 'text.list.none', icon: 'list-none', title: 'Paragraphs' },
        { command: 'text.list.ul', icon: 'list-dash', title: 'Dashes' },
        { command: 'text.list.ol', icon: 'list-number', title: 'Numbers' },
      ], 'List'), segmented(app, run, [
        { command: 'text.outdent', icon: 'outdent', title: 'Decrease Indent Level' },
        { command: 'text.indent', icon: 'indent', title: 'Increase Indent Level' },
      ], 'Indent level')]),
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
