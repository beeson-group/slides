import type { App } from '../app.ts';
import { contentWithTex } from '../math.ts';
import { injectStyle } from '../ui/dom.ts';
import { OUTLINE } from './elements.ts';

injectStyle('outline-field', `
.beeson-outline-field { position: fixed; z-index: 60; box-sizing: border-box; margin: 0; padding: 0 6px; border: 2px solid var(--ed-select); border-radius: 4px; background: var(--ed-panel); color: var(--ed-text); outline: none; }
`);

const sectionsOf = (app: App): Element[] => [...app.slides().querySelectorAll('section.section:not(:has(> section))')];
const headingOf = (slide: Element): Element | null => slide.querySelector('h2') ?? slide.querySelector('h1');

function plainText(el: Element): string {
  const t = document.createElement('template');
  t.innerHTML = contentWithTex(el);
  return (t.content.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const escapeHtml = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function outlineItem(el: Element, target: Element | null): HTMLElement | null {
  const li = target?.closest('li');
  return el.matches(OUTLINE) && li instanceof HTMLElement && li.parentElement === el ? li : null;
}

function headingAt(app: App, li: Element): Element | null {
  const k = [...li.parentElement!.children].indexOf(li);
  const slide = sectionsOf(app)[k];
  return slide ? headingOf(slide) : null;
}

export async function renameSection(app: App, arg: unknown): Promise<void> {
  const { heading, name, list } = (arg ?? {}) as { heading?: Element; name?: string; list?: Element };
  if (!heading?.isConnected || typeof name !== 'string' || !name.trim() || name.trim() === plainText(heading)) return;
  await app.doc.setContent(heading, escapeHtml(name.trim()), 'rename section');
  if (!list?.isConnected || list.closest('section') === heading.closest('section')) return;
  (document.activeElement as HTMLElement | null)?.blur();
  getSelection()?.removeAllRanges();
  app.showSlide(list);
  app.selection.set('elements', [list]);
}

export function editItem(app: App, li: HTMLElement): void {
  const heading = headingAt(app, li);
  const list = li.parentElement;
  if (!heading || !app.pairing?.elements.has(heading)) return;
  document.querySelector('.beeson-outline-field')?.remove();
  const r = li.getBoundingClientRect();
  const s = getComputedStyle(li);
  const scale = li.offsetHeight ? r.height / li.offsetHeight : 1;
  const pad = parseFloat(s.paddingLeft) * scale;
  const field = document.createElement('input');
  field.className = 'beeson-outline-field';
  field.value = plainText(heading);
  field.setAttribute('aria-label', 'Name of the section');
  Object.assign(field.style, {
    left: `${r.left + pad - 8}px`,
    top: `${r.top}px`,
    width: `${Math.max(r.width - pad + 16, 160)}px`,
    height: `${r.height}px`,
    font: `${parseFloat(s.fontSize) * scale}px ${s.fontFamily}`,
  });
  let done = false;
  const close = (keep: boolean) => {
    if (done) return;
    done = true;
    const name = field.value;
    field.remove();
    if (keep) void app.commands.run('text.renameSection', { heading, name, list }).catch((e) => app.fail(e));
  };
  field.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopPropagation();
    close(ev.key === 'Enter');
  });
  field.addEventListener('blur', () => close(true));
  document.body.append(field);
  field.focus();
  field.select();
}
