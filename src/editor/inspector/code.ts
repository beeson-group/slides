// the Code pane of the Format tab, for a selected code box or a code box with the caret: the
// language of its code, the numbers of its lines, its line steps, and its size. the steps are
// typed into a field, e.g. 1-2|3|4-5, or edited in a list of the groups, in which the lines
// selected in the box are added as a new group and a group is removed. a group pointed at in the
// list dims the other lines of the box

import type { App } from '../app.ts';
import { stepAt } from '../layers.ts';
import { modelOf } from '../steps.ts';
import { COMMON, PLAIN, codeAt, dimLines, hljsOf, languageOf, languages, nameOf, selectedLines, stepsOf } from '../commands/code.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { closeMenus, menuOpen, openMenu, type MenuItem } from '../ui/menu.ts';
import { GLYPHS, button, checkbox, glyph, keepFocus, note, section, textField, type Control, type Run } from './controls.ts';

GLYPHS.remove ??= ['M6.5 6.5l7 7', 'M13.5 6.5l-7 7'];

const STYLE = `
.beeson-edit-inspector .ed-lang { width: 100%; justify-content: space-between; }
.beeson-edit-inspector .ed-groups { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.beeson-edit-inspector .ed-groups li { display: flex; align-items: center; gap: 8px; min-height: 26px; padding: 0 4px 0 6px; border-radius: 6px; }
.beeson-edit-inspector .ed-groups li:hover { background: var(--ed-hover); }
.beeson-edit-inspector .ed-groups .n { flex: 0 0 auto; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 9px; background: var(--ed-control); box-shadow: inset 0 0 0 1px var(--ed-control-line); font: 600 11px/18px var(--ed-font); font-variant-numeric: tabular-nums; text-align: center; }
.beeson-edit-inspector .ed-groups .lines { flex: 1; min-width: 0; font: 12px/1.3 ui-monospace, Menlo, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.beeson-edit-inspector .ed-groups .at { color: var(--ed-muted); font-size: 11px; white-space: nowrap; }
.beeson-edit-inspector .ed-groups button { width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--ed-muted); display: flex; align-items: center; justify-content: center; cursor: default; }
.beeson-edit-inspector .ed-groups button:hover { background: var(--ed-pressed); color: var(--ed-text); }
.beeson-edit-inspector .ed-groups .empty { color: var(--ed-muted); }
`;

// the menu of the language: Automatic, Plain Text, the common languages, and every language of
// highlight.js in a submenu
function languageButton(app: App, run: Run, code: () => Element | null): Control {
  const b = make('button', 'beeson-edit-select ed-lang');
  b.type = 'button';
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-label', 'Language of the code');
  b.title = 'Language of the code, whose words are colored by highlight.js';
  const text = make('span', 'value');
  b.append(text, icon('chevron-down', 10));
  const now = () => {
    const c = code();
    return c ? languageOf(app, c) : null;
  };
  const open = (keyboard: boolean) => {
    const c = code();
    if (!c) return;
    const value = now();
    const pick = (language: string | null): MenuItem => ({ label: nameOf(language), checked: value === language, run: () => void run('code.language', { el: c, language }) });
    const known = new Set(languages().map(([n]) => n));
    const common = COMMON.filter(([n]) => known.has(n)).map(([n]) => pick(n));
    const items: MenuItem[] = [pick(null), pick(PLAIN), { rule: true }, ...common];
    if (hljsOf()) items.push({ rule: true }, { label: 'All Languages', items: () => languages().map(([n]) => pick(n)) });
    if (value && value !== PLAIN && !COMMON.some(([n]) => n === value)) items.splice(3, 0, pick(value), { rule: true });
    openMenu(app, items, { anchor: b.getBoundingClientRect(), placement: 'below', owner: b, keyboard, label: 'Language', className: 'select' });
  };
  b.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (menuOpen() && b.getAttribute('aria-expanded') === 'true') closeMenus();
    else open(false);
  });
  b.addEventListener('click', (ev) => {
    if (ev.detail === 0) open(true);
  });
  const sync = () => {
    b.disabled = !code();
    text.textContent = nameOf(now());
  };
  sync();
  return { el: b, sync };
}

// the groups of the line steps of the box, each with its lines, when it is lit, and a button that
// removes it
function groupList(app: App, run: Run, code: () => Element | null): Control {
  const el = make('ul', 'ed-groups');
  el.setAttribute('aria-label', 'Line steps');
  let key = '';
  const sync = () => {
    const c = code();
    const groups = c ? stepsOf(app, c).groups : [];
    // a group after the first is lit at its step of the slide, as the Steps tab lists it
    const m = c ? modelOf(app, c.closest('section')) : null;
    const steps = groups.map((_, k) => {
      const i = m ? m.lines.findIndex((l) => l?.code === c && l.group === k) : -1;
      return m && i >= 0 ? stepAt(m.plan, i) + 1 : k;
    });
    const now = `${groups.join('|')}#${steps.join(',')}`;
    if (now === key && el.childElementCount) return;
    key = now;
    dimLines(null, null);
    if (!groups.length) {
      el.replaceChildren(make('li', 'empty', 'No line steps. Select lines in the code and add them.'));
      return;
    }
    el.replaceChildren(...groups.map((g, k) => {
      const li = make('li');
      const n = make('span', 'n', String(k + 1));
      const lines = make('span', 'lines', `${g.includes(',') || g.includes('-') ? 'Lines' : 'Line'} ${g.replace(/-/g, '–').replace(/,/g, ', ')}`);
      const at = make('span', 'at', k ? `Step ${steps[k]}` : 'With the slide');
      const x = make('button');
      x.type = 'button';
      x.title = `Remove the line step ${k + 1}`;
      x.setAttribute('aria-label', x.title);
      x.append(glyph('remove', 14));
      keepFocus(x);
      x.addEventListener('click', () => void run('code.removeGroup', { el: c, index: k }));
      li.title = k ? `The lines lit at step ${steps[k]} of the slide` : 'The lines lit when the slide is shown';
      li.append(n, lines, at, x);
      li.addEventListener('pointerenter', () => dimLines(c, g));
      li.addEventListener('pointerleave', () => dimLines(null, null));
      return li;
    }));
  };
  sync();
  return { el, sync };
}

export function codePane(app: App, run: Run): Control[] {
  injectStyle('code-pane', STYLE);
  const built = codeAt(app);
  const code = () => (built?.isConnected ? built : codeAt(app));
  const field = textField(app, {
    label: 'Line Steps',
    name: 'line-steps',
    placeholder: 'e.g. 1-2|3|4-5',
    value: () => {
      const c = code();
      return c ? stepsOf(app, c).groups.join('|') : null;
    },
    enabled: () => !!code(),
    commit: (text) => run('code.lines', { el: code(), value: text }),
  });
  const add = button(app, run, { command: 'code.addGroup', text: 'Add Selected Lines', title: 'Add the lines selected in the code as the next line step' });
  const lines = () => {
    const c = code();
    const s = c ? selectedLines(c) : null;
    return s ? (s[0] === s[1] ? `Line ${s[0]} is selected in the code.` : `Lines ${s[0]}–${s[1]} are selected in the code.`) : '';
  };
  return [
    section('Language', [
      languageButton(app, run, code),
      note(() => (hljsOf() ? '' : 'The deck does not load theme/vendor/reveal/highlight.js, hence its code is not colored.'), () => true),
    ]),
    section('Lines', [
      checkbox(app, run, 'code.numbers', 'Number the lines'),
      note(() => app.commands.state('code.numbers').why ?? ''),
      field,
      groupList(app, run, code),
      add,
      note(lines),
      note(() => 'The first step is lit with the slide, and each next one at a click.'),
    ]),
    section('Size', [
      checkbox(app, run, 'code.small', 'Small'),
      note(() => 'The code is set at 22 px, or at 18 px when Small, for a longer box.'),
    ]),
  ];
}
