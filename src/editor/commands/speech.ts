// the submenu Speech of the Edit menu and of the menu of a text, as in Keynote: Start Speaking reads
// aloud the selected text, else the text of the selected elements, else the text of the slide in
// the order of the file, with the speechSynthesis of the browser. a formula is not read. neither
// command changes the file or the history, and both are dimmed in a browser without speechSynthesis

import type { App } from '../app.ts';
import { HOST } from '../app.ts';

const synth = (): SpeechSynthesis | undefined => (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;

// the text of el without its formulas, with a line break read as a space
function said(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('mjx-container').forEach((m) => m.remove());
  copy.querySelectorAll('br').forEach((b) => b.replaceWith(' '));
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function textOf(app: App): string {
  const sel = app.selection;
  const range = getSelection();
  if (sel.kind === 'text' && range && !range.isCollapsed && sel.items[0]?.contains(range.anchorNode)) return range.toString().trim();
  const slide = app.current();
  const els = sel.kind === 'elements' && sel.items.length
    ? [...sel.items]
    : [...(slide?.querySelectorAll(HOST) ?? [])].filter((b) => !b.closest('aside.notes') && b.getClientRects().length);
  return els.filter((el) => !els.some((o) => o !== el && o.contains(el))).map(said).filter(Boolean).join(' ');
}

export function install(app: App): void {
  const menu = (order: number) => ({ bar: 'Edit', group: 'substitutions', order, submenu: 'Speech' });
  app.commands.define({
    id: 'edit.startSpeaking',
    label: 'Start Speaking',
    keys: { mac: ['Mod+Alt+Shift+S'] },
    in: ['canvas', 'text'],
    menu: menu(100),
    context: ['text'],
    enabled: (a) => !!synth() && !!a.current(),
    run: (a) => {
      const s = synth();
      const text = textOf(a);
      if (!s || !text) return;
      s.cancel();
      s.speak(new SpeechSynthesisUtterance(text));
    },
  });
  app.commands.define({
    id: 'edit.stopSpeaking',
    label: 'Stop Speaking',
    menu: menu(101),
    context: ['text'],
    enabled: () => !!synth()?.speaking,
    run: () => synth()?.cancel(),
  });
}
