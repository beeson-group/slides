// Shift+Tab and Tab across slides in the outline view, as in PowerPoint. Shift+Tab on a body
// paragraph or a first-level item makes it the title of a new content slide after its slide, which
// takes the nested items of the item and the text blocks after it. Tab on the title of a slide of
// text makes it the last first-level item of the slide before, with the blocks of its body after
// it. each is one entry of the history, and a block keeps the text of its unit in the file

import type { App } from '../app.ts';
import { textStyle } from '../model/templates.ts';
import { ownTex } from '../text/blocks.ts';

// the blocks of a text column that a promoted line takes with it, and that a demoted slide holds
const TEXT = 'p, h3, ul, ol';
// the blocks that the outline view lists in a text column, after which a demoted title is put
const LINES = 'p, h3, h4, ul, ol, .col, div.math, table, pre, .qr, img, video, figure';
const SPECIAL = '.title, .section, .closing, .figure, .split';

const paired = (app: App, el: Element | null): boolean => !!el && !!app.pairing?.elements.has(el);
// an element of the file that takes elements, i.e. that is not an edited block
const container = (app: App, el: Element | null): el is Element => !!el && paired(app, el) && !app.pairing!.byLive.has(el);
const kept = (el: Element) => !el.hasAttribute('data-generated');

// one entry of the history, after whose undo and redo the slide current before and after it is
// shown, since the slide made or removed by it was current
async function keepSlide(app: App, label: string, fn: () => Promise<{ slide: Element; line: Element }>): Promise<{ slide: Element; line: Element }> {
  const put = (s: Element | null) => void (s?.isConnected && app.showSlide(s));
  return app.history.keeping(label, () => app.current(), put, async () => {
    const moved = await fn();
    app.showSlide(moved.slide);
    return moved;
  });
}

function eol(app: App): string {
  return app.source?.crlf ? '\r\n' : '\n';
}

// the indentation of the line of el in the file
function indentOf(app: App, el: Element): string {
  const unit = app.doc.unitText(el);
  const lead = unit.slice(0, unit.indexOf(app.doc.elementText(el)));
  return /[ \t]*$/.exec(lead.slice(lead.lastIndexOf('\n') + 1))?.[0] ?? '';
}

// the text of a unit, whose lines after the first are indented by from, indented by to
function shift(app: App, text: string, from: string, to: string): string {
  return from === to ? text : text.split(eol(app) + from).join(eol(app) + to);
}

// the next sibling of el that is in the file, before which a block is inserted after el
function nextPaired(app: App, el: Element): Element | null {
  let n = el.nextElementSibling;
  while (n && !paired(app, n)) n = n.nextElementSibling;
  return n;
}

// the text blocks of the file after el in its parent, up to the first block of another kind
function textAfter(app: App, el: Element): Element[] {
  const out: Element[] = [];
  for (let n = el.nextElementSibling; n; n = n.nextElementSibling) {
    if (!kept(n)) continue;
    if (!n.matches(TEXT) || !paired(app, n)) break;
    out.push(n);
  }
  return out;
}

// a body paragraph or a first-level item of a list of the file, which Shift+Tab promotes
function promotable(app: App, el: Element): boolean {
  const slide = el.closest('section');
  const parent = el.parentElement;
  if (!slide || !paired(app, el) || !container(app, parent)) return false;
  if (el.localName === 'p') return [...el.classList].every((c) => c === 'fragment' || c === 'small');
  return el.localName === 'li' && parent.matches('ul, ol') && !parent.parentElement?.closest('li') && container(app, parent.parentElement);
}

// Shift+Tab: the new slide with its title, or null when el is not promoted
export async function promote(app: App, el: Element): Promise<{ slide: Element; line: Element } | null> {
  if (!promotable(app, el)) return null;
  const slide = el.closest('section')!;
  const root = app.slides();
  const list = el.localName === 'li' ? el.parentElement! : null;
  const step = textStyle(app.source?.text ?? '').step;
  const base = indentOf(app, slide);
  const n = eol(app);
  // the items of the new list: the nested items of el and the items after it in its list
  const items: string[] = [];
  if (list) {
    const own = document.createElement('template');
    own.innerHTML = app.doc.elementText(el);
    const from = indentOf(app, el);
    for (const sub of own.content.firstElementChild!.querySelectorAll(':scope > :is(ul, ol) > li')) {
      const lead = sub.previousSibling instanceof Text ? /[ \t]*$/.exec(sub.previousSibling.data)![0] : from;
      items.push(shift(app, sub.outerHTML, lead, base + step + step));
    }
  }
  const followers = list ? [...list.children].slice([...list.children].indexOf(el) + 1).filter((li) => li.localName === 'li' && paired(app, li)) : [];
  for (const li of followers) items.push(shift(app, app.doc.elementText(li), indentOf(app, li), base + step + step));
  const blocks = textAfter(app, list ?? el);
  // a locked element is not moved, hence nothing is promoted that would carry one along
  if ([el, ...followers, ...blocks].some((b) => b.closest('[data-locked]'))) return null;
  const lines = [`<section>`, `${base}${step}<h2>${ownTex(el)}</h2>`];
  if (items.length) lines.push(`${base}${step}<${list!.localName}>`, ...items.map((i) => `${base}${step}${step}${i}`), `${base}${step}</${list!.localName}>`);
  for (const b of blocks) lines.push(`${base}${step}${shift(app, app.doc.elementText(b), indentOf(app, b), base + step)}`);
  lines.push(`${base}</section>`);
  // a list left without items goes with them
  const whole = !!list && list.querySelector(':scope > li') === el;
  return keepSlide(app, 'Promote to Slide', async () => {
    const [made] = await app.doc.insert(lines.join(n), root, nextPaired(app, slide), 'promote');
    for (const b of [...blocks].reverse()) await app.doc.remove(b, 'promote');
    if (whole) await app.doc.remove(list!, 'promote');
    else for (const x of [...followers].reverse().concat(el)) await app.doc.remove(x, 'promote');
    return { slide: made, line: made.querySelector('h2')! };
  });
}

// the slide of a title that Tab demotes, and the text column of the slide before it that takes it
function demotion(app: App, title: Element): { slide: Element; column: Element } | null {
  const slide = title.parentElement;
  if (title.localName !== 'h2' || !slide?.matches('section') || slide.matches(SPECIAL) || !paired(app, title)) return null;
  const body = [...slide.children].filter(kept);
  if (!body.every((b) => b === title || (b.matches(TEXT) && paired(app, b) && !b.closest('[data-locked]')))) return null;
  const before = slide.previousElementSibling;
  if (!before?.matches('section') || before.matches('.title, .section, .closing, .figure')) return null;
  const column = before.querySelector(':scope > .panel') ?? before;
  return container(app, column) ? { slide, column } : null;
}

// Tab: the item made of the title, or null when the title is not demoted
export async function demote(app: App, title: Element): Promise<{ slide: Element; line: Element } | null> {
  const d = demotion(app, title);
  if (!d) return null;
  const { slide, column } = d;
  const step = textStyle(app.source?.text ?? '').step;
  const n = eol(app);
  const children = [...column.children].filter((c) => kept(c) && paired(app, c));
  const last = children.filter((c) => c.matches(LINES) && !c.matches('h1, h2')).at(-1) ?? null;
  // a locked list does not take the title as an item
  if (last?.closest('[data-locked]')) return null;
  const anchor = last ?? children.find((c) => c.matches('h2')) ?? null;
  const ind = children[0] ? indentOf(app, children[0]) : indentOf(app, column) + step;
  const item = `<li>${ownTex(title)}</li>`;
  const body = [...slide.children].filter((b) => kept(b) && b !== title);
  const texts = body.map((b) => shift(app, app.doc.elementText(b), indentOf(app, b), ind));
  return keepSlide(app, 'Demote Slide', async () => {
    let line: Element | undefined;
    const into = last?.matches('ul, ol') && container(app, last) ? last : null;
    if (into) [line] = await app.doc.insert(item, into, null, 'demote');
    // the item starts the first list of the body, or else a list of its own
    else if (body[0]?.matches('ul, ol')) texts[0] = texts[0].replace(/^<[^>]*>/, (open) => `${open}${n}${ind}${step}${item}`);
    else texts.unshift(`<ul>${n}${ind}${step}${item}${n}${ind}</ul>`);
    const made = texts.length ? await app.doc.insert(texts, column, anchor ? nextPaired(app, anchor) : children[0] ?? null, 'demote') : [];
    line ??= made[0].querySelector('li')!;
    await app.doc.remove(slide, 'demote');
    return { slide: column.closest('section')!, line };
  });
}
