export const allowable = ['notes', 'heading', 'copy', 'move', 'outside'];
export const notesWords = 40;

export const slideFacts = `(() => {
  const slide = Reveal.getCurrentSlide();
  const frame = document.querySelector('.reveal .slides').getBoundingClientRect();
  const scale = frame.width / Reveal.getConfig().width;
  const notes = slide.querySelector(':scope > aside.notes');
  const titled = slide.matches('.title, .section, .closing') || slide.querySelector('h1');
  const box = titled ? null : slide.querySelector('h2')?.getBoundingClientRect();
  return {
    allow: slide.dataset.allow ?? null,
    words: notes ? notes.textContent.split(/\\s+/).filter(Boolean).length : 0,
    layout: ['narrow', 'wide', 'figure', 'split'].find((name) => slide.classList.contains(name)) ?? 'content',
    heading: box ? { left: (box.left - frame.left) / scale, top: (box.top - frame.top) / scale } : null,
  };
})()`;

export const stepsMeasured = `typeof Element.prototype.checkVisibility === 'function' && typeof document.getAnimations === 'function'`;

export const stepSettled = `(async () => {
  const slides = document.querySelector('.reveal .slides');
  const running = () => document.getAnimations().filter((animation) => animation.playState === 'running'
    && Number.isFinite(animation.effect?.getComputedTiming().endTime)
    && slides.contains(animation.effect.target));
  for (const animation of running()) if (animation.playbackRate) animation.finish();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return !running().length;
})()`;

export const stepWatch = String.raw`(() => {
  const kinds = 'h1, h2, h3, h4, p, li, td, th, .foot, figcaption, .caption, .math, table, figure, .figure-box, img, .tikz, .qr';
  const texts = 'h1, h2, h3, h4, p, li, td, th, .foot, figcaption, .caption, .math';
  const inside = 'svg, canvas, pre, aside, .plot, .surface, .backdrop, tycho-viewer, mjx-container, .label';
  const unclass = (tex) => {
    const at = tex.search(/\\class\s*\{[^}]*\}\s*\{/);
    if (at < 0) return tex;
    const open = tex.indexOf('{', tex.indexOf('}', at));
    let depth = 0;
    let end = open;
    for (; end < tex.length; end++) {
      if (tex[end] === '{') depth++;
      else if (tex[end] === '}' && --depth === 0) break;
    }
    return tex.slice(0, at) + unclass(tex.slice(open + 1, end) + tex.slice(end + 1));
  };
  let last = null;
  window.beesonStep = () => {
    const slide = Reveal.getCurrentSlide();
    const frame = document.querySelector('.reveal .slides').getBoundingClientRect();
    const scale = frame.width / Reveal.getConfig().width;
    const sources = new Map((window.MathJax?.startup?.document?.getMathItemsWithin(slide) ?? []).map((item) => [item.typesetRoot, item.math]));
    const textOf = (el) => {
      let text = '';
      const walk = (node) => {
        if (node.nodeType === 3) text += node.data;
        else if (node.nodeName === 'MJX-CONTAINER') text += ' ' + unclass(sources.get(node) ?? '') + ' ';
        else if (node.nodeName === 'IMG') text += ' ' + node.getAttribute('src') + ' ';
        else if (node.nodeType === 1 && !node.matches('svg, canvas, aside, script, style')) node.childNodes.forEach(walk);
      };
      walk(el);
      return text.replace(/\s+/g, ' ').trim();
    };
    const now = new Map();
    for (const el of slide.querySelectorAll(kinds)) {
      if (el.parentElement.closest(inside) || el.parentElement.closest(kinds)) continue;
      const box = el.getBoundingClientRect();
      const shown = (box.width > 0 || box.height > 0) && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      now.set(el, { text: textOf(el), shown, left: (box.left - frame.left) / scale, top: (box.top - frame.top) / scale });
    }
    const outside = [...slide.querySelectorAll(texts)].filter((el) => !el.parentElement.closest(inside) && !el.parentElement.closest(texts)).flatMap((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const box = range.getBoundingClientRect();
      const x = (box.left - frame.left) / scale;
      const y = (box.top - frame.top) / scale;
      const out = Math.max(-x, -y, x + box.width / scale - Reveal.getConfig().width, y + box.height / scale - Reveal.getConfig().height);
      return out > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ? [{ text: textOf(el), out }] : [];
    });
    const before = last?.slide === slide ? last.seen : null;
    last = { slide, seen: now };
    const { h, v, f } = Reveal.getIndices();
    const found = { h, v: v ?? 0, step: (f ?? -1) + 1, allow: slide.dataset.allow ?? null, copies: [], moves: [], outside };
    if (!before) return found;
    const was = (el) => before.get(el)?.shown ?? false;
    for (const [el, at] of now) {
      if (!was(el)) continue;
      if (!at.shown) {
        const copy = at.text && [...now].some(([other, then]) => other !== el && then.shown && !was(other) && then.text === at.text);
        if (copy) found.copies.push(at.text);
        continue;
      }
      const dx = at.left - before.get(el).left;
      const dy = at.top - before.get(el).top;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 1 && !el.closest('.grow, .shrink, [data-fly-from]')) {
        found.moves.push({ text: at.text || el.nodeName.toLowerCase(), dx, dy });
      }
    }
    return found;
  };
  return true;
})()`;

const quote = (text) => JSON.stringify(text.length > 48 ? text.slice(0, 47) + '…' : text);
const shift = (dx, dy) => [
  Math.abs(dy) >= 0.5 && `${Math.abs(dy).toFixed(0)} px ${dy > 0 ? 'lower' : 'higher'}`,
  Math.abs(dx) >= 0.5 && `${Math.abs(dx).toFixed(0)} px more to the ${dx > 0 ? 'right' : 'left'}`,
].filter(Boolean).join(' and ');

export function allowedOf(allow) {
  const names = (allow ?? '').split(/\s+/).filter(Boolean);
  return { names, unknown: names.filter((name) => !allowable.includes(name)) };
}

export function notesProblem(facts) {
  if (facts.words <= notesWords) return null;
  return { kind: 'notes', text: `the speaker notes have ${facts.words} words, over ${notesWords}: keep only what the speaker needs and the slide does not show, i.e. numbers, answers to likely questions, and lines to say` };
}

export function headingProblems(slides) {
  const problems = [];
  const layouts = Map.groupBy(slides.filter((slide) => slide.heading), (slide) => slide.layout);
  for (const [layout, group] of layouts) {
    const places = Map.groupBy(group, (slide) => `${Math.round(slide.heading.left)},${Math.round(slide.heading.top)}`);
    const common = [...places.values()].reduce((most, same) => (same.length > most.length ? same : most))[0].heading;
    for (const slide of group) {
      const dx = slide.heading.left - common.left;
      const dy = slide.heading.top - common.top;
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) continue;
      problems.push({ slide, kind: 'heading', text: `the heading is ${shift(dx, dy)} than on most slides of the layout ${layout}, whose heading is ${Math.round(common.left)} px from the left and ${Math.round(common.top)} px from the top: take the padding-top or the translate off the slide and its heading, and fit the content under the heading` });
    }
  }
  return problems;
}

export function stepProblems(found) {
  return [
    ...found.copies.map((text) => ({ kind: 'copy', text: `at step ${found.step}, a copy of ${quote(text)} is shown as this one is hidden: write it once, keep it shown, and change only what changes, e.g. with data-highlight or a stack` })),
    ...found.moves.map(({ text, dx, dy }) => ({ kind: 'move', text: `at step ${found.step}, ${quote(text)} is placed ${shift(dx, dy)} than at the step before: keep it at one place at every step` })),
  ];
}

export function outsideProblems(found) {
  return found.outside.map(({ text, out }) => ({ kind: 'outside', text: `at the last step, ${quote(text)} runs ${out.toFixed(0)} px off the slide: shorten it, or move it into the 1920 by 1080 px of the slide` }));
}
