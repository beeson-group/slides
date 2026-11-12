// the scope rule of the editor: the only classes, attributes, and declarations that it writes into
// a tag, so that a deck edited in the editor still follows AGENTS.md. a class is one of the theme,
// read from theme/beeson.css with themeClasses, or one of the fragments of reveal.js. pure, without
// the DOM

import { tokenize } from '../tokens.ts';
import { stateOf, type TagEdit } from '../tags.ts';

// the classes of the fragments of reveal.js, i.e. a step and its effects
export const REVEAL_CLASSES = [
  'fragment', 'fade-in', 'fade-out', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'fade-in-then-out',
  'fade-in-then-semi-out', 'semi-fade-out', 'current-visible', 'grow', 'shrink', 'strike', 'highlight-red',
  'highlight-green', 'highlight-blue', 'highlight-current-red', 'highlight-current-green', 'highlight-current-blue',
];

// the data attributes of AGENTS.md and REFERENCE.md, those of reveal.js that the theme gives a
// meaning, and data-group and data-locked, which are new and named among the open decisions
export const DATA_ATTRS = [
  'data-at', 'data-auto', 'data-auto-animate', 'data-autoplay', 'data-azimuth', 'data-cx', 'data-cy', 'data-duration',
  'data-dx', 'data-dy', 'data-elevation', 'data-final', 'data-fragment-index', 'data-function', 'data-half',
  'data-heads', 'data-highlight', 'data-id', 'data-keep', 'data-keep-theme', 'data-line-numbers', 'data-live',
  'data-loop', 'data-mu', 'data-plot', 'data-plot-frame', 'data-plot-panels', 'data-plot-paused', 'data-plot-play',
  'data-plot-show', 'data-plot-tab', 'data-plot-tabs', 'data-qr', 'data-run', 'data-scene', 'data-stage',
  'data-stagger', 'data-strands', 'data-strands-color', 'data-strands-colormap', 'data-strands-ramp',
  'data-strands-select', 'data-strands-shade', 'data-surface-accent', 'data-surface-marks', 'data-surface-stage',
  'data-surface-violet', 'data-tone', 'data-turn', 'data-unhighlight', 'data-zoom', 'data-zscale',
  'data-visibility', 'data-timing', 'data-transition', 'data-group', 'data-locked', 'data-autoslide',
  'data-guides',
];

// the standard attributes that the editor writes
export const STANDARD_ATTRS = ['alt', 'src', 'poster', 'href', 'muted', 'loop', 'colspan', 'rowspan'];

// the attributes written only in the text of new content, e.g. the id renamed in a duplicated or
// pasted slide
export const TEMPLATE_ATTRS = ['id', 'type'];

// the attributes of the svg of a line or an arrow of commands/line.ts, by tag
export const LINE_ATTRS: Record<string, string[]> = {
  svg: ['width', 'height'],
  line: ['x1', 'y1', 'x2', 'y2', 'marker-start', 'marker-end'],
  marker: ['orient'],
  path: ['d'],
};

// the elements whose width is set in a style, by tag or by class, and those whose height is set as
// well, which a resize stretches
const SIZED_TAGS = new Set(['img', 'video', 'tycho-viewer']);
const STRETCHED_TAGS = new Set(['img', 'video']);
// the text blocks whose width is set in a style in px, as a text box of Keynote and PowerPoint
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'p', 'ul', 'ol']);
const textBlock = (tag: string, classes: string[]) => TEXT_TAGS.has(tag) || (tag === 'div' && classes.includes('math')) || classes.includes('caption');
const PX = /^\d+px$/;

// the declarations of the mask and the flip of an image, written by canvas/mask.ts, with the form
// of their values. object-fit contain keeps the aspect of a picture whose box was resized in Edit
// Mask, which theme/beeson.css otherwise stretches to the width and the height of its style, and
// the inset of an oval picture is rounded to its ellipse
const NUMBER = '-?\\d+(\\.\\d+)?';
const AT = `(${NUMBER}(%|px)|0)`;
const MASK_DECLARATIONS: Record<string, RegExp> = {
  scale: new RegExp(`^${NUMBER}( ${NUMBER})?$`),
  'clip-path': new RegExp(`^inset\\(${NUMBER}%( round 50%)?\\)$`),
  'object-position': new RegExp(`^${AT} ${AT}$`),
  'object-fit': /^(cover|contain)$/,
};

// the class names in the selectors of a stylesheet. the comments, the strings, and the innermost
// blocks, i.e. the declarations, are cut first, so that e.g. url(a.png) is not read as a class
export function themeClasses(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"|'[^']*'/g, '').replace(/\{[^{}]*\}/g, '{}');
  const out = new Set<string>();
  for (const m of text.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)) out.add(m[1]);
  return [...out];
}

// the reason a declaration is out of the scope rule on an element, or null when it is in it
export function declarationProblem(tag: string, classes: string[], name: string, value: string): string | null {
  if (name === 'translate' || name === 'rotate') return null;
  // the order of the layers of commands/order.ts, which is geometry as an offset is
  if (name === 'z-index') return /^-?\d+$/.test(value.trim()) ? null : `z-index ${value} on a ${tag}`;
  if (name === 'position') return value.trim() === 'relative' ? null : `position ${value} on a ${tag}`;
  // the width of a column is written in px on the cells of the first row of a table
  if (name === 'width' && (tag === 'td' || tag === 'th')) return /^\d+px$/.test(value.trim()) ? null : `width ${value} on a ${tag}`;
  // a shape is placed and sized in its style, as a box of Keynote and PowerPoint
  if ((name === 'width' || name === 'height') && tag === 'div' && classes.includes('shape')) return PX.test(value.trim()) ? null : `${name} ${value} on a shape`;
  if (name === 'width' && (SIZED_TAGS.has(tag) || classes.includes('qr'))) return null;
  // the box of a backdrop resized by its grips
  if ((name === 'width' || name === 'height') && tag === 'div' && classes.includes('backdrop')) return PX.test(value.trim()) ? null : `${name} ${value} on a backdrop`;
  if (name === 'width') return textBlock(tag, classes) && PX.test(value.trim()) ? null : `width on a ${tag}`;
  if (name === 'height') return STRETCHED_TAGS.has(tag) && PX.test(value.trim()) ? null : `height ${value} on a ${tag}`;
  if (name === 'font-size') return tag === 'pre' && /^(22|18)px$/.test(value.trim()) ? null : `font-size ${value} on a ${tag}`;
  if (name === 'text-align') return (tag === 'td' || tag === 'th') && value.trim() === 'right' ? null : `text-align ${value} on a ${tag}`;
  if (MASK_DECLARATIONS[name]) return tag === 'img' && MASK_DECLARATIONS[name].test(value.trim()) ? null : `${name} ${value} on a ${tag}`;
  return `the declaration ${name}`;
}

// the reason an attribute is out of the scope rule, or null when it is in it. start is the number
// of the first item of a numbered list, which the theme draws
export function attributeProblem(name: string, template = false, tag = '', value = ''): string | null {
  if (name === 'start') return tag === 'ol' && /^\d+$/.test(value) ? null : `the attribute ${name}`;
  if (name === 'class' || name === 'style' || DATA_ATTRS.includes(name) || STANDARD_ATTRS.includes(name)) return null;
  if (LINE_ATTRS[tag]?.includes(name)) return null;
  if (template && TEMPLATE_ATTRS.includes(name)) return null;
  return `the attribute ${name}`;
}

// the classes of the theme that are not written on a slide: center, which reveal.js reads on a
// section in its print layout
export const NOT_ON_SLIDE = ['center'];

// a class of the theme or of reveal.js, or the language of a code box
const allowedClass = (name: string, theme: Set<string>, tag = '') =>
  !(tag === 'section' && NOT_ON_SLIDE.includes(name)) && (theme.has(name) || REVEAL_CLASSES.includes(name) || /^language-[\w-]+$/.test(name));
const classProblem = (name: string, tag: string) => (tag === 'section' && NOT_ON_SLIDE.includes(name) ? `the class ${name} on a section` : `the class ${name}`);

// the writes of edit on an element with the tag and the attributes of the file that are out of the
// scope rule, each as a sentence. theme is the set of the classes of themeClasses
export function editProblems(tag: string, fileAttrs: Parameters<typeof stateOf>[0], edit: TagEdit, theme: Set<string>): string[] {
  const out: string[] = [];
  const before = stateOf(fileAttrs);
  const after = stateOf(fileAttrs, edit);
  for (const c of after.classes) if (!before.classes.includes(c) && !allowedClass(c, theme, tag)) out.push(classProblem(c, tag));
  for (const [name, value] of Object.entries(after.attrs)) {
    if (before.attrs[name] === value) continue;
    const problem = attributeProblem(name, false, tag, value);
    if (problem) out.push(problem);
  }
  for (const [name, value] of Object.entries(after.style)) {
    if (before.style[name] === value) continue;
    const problem = declarationProblem(tag, after.classes, name, value);
    if (problem) out.push(problem);
  }
  return out;
}

// the writes of a text of new content that are out of the scope rule, read from each start tag
export function textProblems(html: string, theme: Set<string>): string[] {
  const out: string[] = [];
  for (const t of tokenize(html)) {
    if (t.type !== 'start') continue;
    const s = stateOf(t.attrs);
    for (const c of s.classes) if (!allowedClass(c, theme, t.name)) out.push(`the class ${c} on a ${t.name}`);
    for (const [name, value] of Object.entries(s.attrs)) {
      const problem = attributeProblem(name, true, t.name, value);
      if (problem) out.push(`${problem} on a ${t.name}`);
    }
    for (const [name, value] of Object.entries(s.style)) {
      const problem = declarationProblem(t.name, s.classes, name, value);
      if (problem) out.push(problem);
    }
  }
  return out;
}
