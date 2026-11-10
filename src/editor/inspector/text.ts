// the Text pane of the Format tab, for a text with the caret or a selected block, as the Text tab
// of Keynote: the paragraph style in a pop-up, the formats of the words, the tone swatches, the
// kind of list, and the link. every control runs a command of commands/text.ts by its id, and a
// control of a command that is not defined is drawn disabled. by the scope rule, only the styles
// of the type scale and the tones of the theme are offered

import type { App } from '../app.ts';
import { make } from '../ui/dom.ts';
import { openMenu, type MenuItem } from '../ui/menu.ts';
import { button, glyph, keepFocus, row, section, segmented, type Control, type Run } from './controls.ts';

const STYLES = ['body', 'small', 'subheading', 'caption', 'footnote'];
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
  return [
    stylePopup(app),
    section('Font', [
      row([segmented(app, run, [
        { command: 'text.bold', text: () => make('span', 'b', 'B'), title: 'Bold' },
        { command: 'text.italic', text: () => make('span', 'i', 'I'), title: 'Italic' },
        { command: 'text.code', text: () => make('span', 'mono', '{ }'), title: 'Code' },
        { command: 'text.superscript', text: script('x', '2', 'sup'), title: 'Superscript' },
        { command: 'text.subscript', text: script('x', '2', 'sub'), title: 'Subscript' },
      ], 'Font')]),
      row([segmented(app, run, [
        { command: 'text.smaller', icon: 'minus', text: 'Smaller' },
        { command: 'text.bigger', icon: 'plus', text: 'Bigger' },
      ], 'Size')], 'Size'),
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
