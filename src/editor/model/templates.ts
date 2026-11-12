// the text of a new slide of each of the eight layouts and of a new element of each kind, written
// in the line endings and the indentation of the file of the deck. a placeholder is empty in the
// text, and the editor shows its prompt from its own stylesheet. the skeletons follow the
// vocabulary of AGENTS.md. pure, without the DOM

import { eolOf } from './units.ts';

export type Layout = 'title' | 'section' | 'content' | 'narrow' | 'wide' | 'figure' | 'split' | 'closing';
export const LAYOUTS: Layout[] = ['title', 'section', 'content', 'narrow', 'wide', 'figure', 'split', 'closing'];

export type ElementKind = 'text' | 'image' | 'video' | 'table' | 'formula' | 'code' | 'qr' | 'backdrop';
export const ELEMENT_KINDS: ElementKind[] = ['text', 'image', 'video', 'table', 'formula', 'code', 'qr', 'backdrop'];

// the line ending of a file and one step of its indentation
export type TextStyle = { eol: string; step: string };

// the style of the text of a deck. the step is the smallest indentation of a line that starts
// with a tag, two spaces when no line is indented
export function textStyle(text: string): TextStyle {
  let step: string | null = null;
  for (const m of text.matchAll(/^([ \t]+)</gm)) if (step === null || m[1].length < step.length) step = m[1];
  return { eol: eolOf(text), step: step && step.startsWith('\t') ? '\t' : (step ?? '  ') };
}

const attr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// the lines of a skeleton, each given with its depth below the first line, joined at base
function lines(rows: [number, string][], style: TextStyle, base: string): string {
  return rows.map(([depth, row], i) => (i ? base + style.step.repeat(depth) : '') + row).join(style.eol);
}

// a section of the layout, without the white space before it. base is the indentation of the
// slides of the file, empty in the demo deck
export function layoutText(layout: Layout, style: TextStyle, base = ''): string {
  const block: [number, string][] = [[1, '<div class="block">'], [2, '<h1></h1>'], [2, '<p class="sub"></p>'], [2, '<p class="who"></p>'], [1, '</div>']];
  switch (layout) {
    case 'title':
      return lines([[0, '<section class="title">'], [1, '<div class="backdrop" data-strands="brand/transfer.js" data-duration="20" data-cx="-0.84" data-cy="0" data-half="1.128"></div>'], ...block, [0, '</section>']], style, base);
    case 'closing':
      return lines([[0, '<section class="closing">'], [1, '<div class="backdrop" data-scene="tubes" data-cx="0.42" data-cy="0" data-half="0.6"></div>'], ...block, [0, '</section>']], style, base);
    case 'section':
      return lines(
        [[0, '<section class="section">'], [1, '<div class="sec">'], [2, '<h2></h2>'], [2, '<ul class="outline" data-auto></ul>'], [1, '</div>'], [1, '<div class="backdrop" data-scene="wideRibbon" data-cx="0.2" data-cy="0" data-half="1.3"></div>'], [0, '</section>']],
        style,
        base,
      );
    case 'figure':
      return lines([[0, '<section class="figure">'], [1, '<div class="plate"></div>'], [1, '<h2></h2>'], [1, '<p class="caption"></p>'], [0, '</section>']], style, base);
    case 'split':
      return lines([[0, '<section class="split">'], [1, '<div class="panel">'], [2, '<h2></h2>'], [2, '<p></p>'], [1, '</div>'], [1, '<div class="zone"></div>'], [0, '</section>']], style, base);
    // a content slide holds a dash list under its paragraph, as a slide of Title & Bullets in
    // Keynote holds the bullet placeholder of its thumbnail
    default:
      return lines(
        [
          [0, layout === 'content' ? '<section>' : `<section class="${layout}">`],
          [1, '<h2></h2>'],
          [1, '<p></p>'],
          [1, '<ul>'],
          [2, '<li></li>'],
          [1, '</ul>'],
          [0, '</section>'],
        ],
        style,
        base,
      );
  }
}

export type ElementOptions = { src?: string; alt?: string; poster?: string; tex?: string; language?: string; qr?: string; columns?: number; rows?: number; scene?: string };

// the units of a new element of the kind, each without the white space before it, in the order in
// which they are inserted. base is the indentation of the children of the container
export function elementText(kind: ElementKind, style: TextStyle, base: string, options: ElementOptions = {}): string[] {
  const o = options;
  switch (kind) {
    case 'text':
      return ['<p></p>'];
    case 'image':
      return [lines([[0, '<figure class="zone">'], [1, `<img src="${attr(o.src ?? 'media/image.png')}" alt="${attr(o.alt ?? '')}">`], [0, '</figure>']], style, base)];
    case 'video': {
      const src = o.src ?? 'media/video.mp4';
      const poster = o.poster ?? src.replace(/\.[^./]*$/, '.png');
      return [lines([[0, '<div class="zone">'], [1, `<video src="${attr(src)}" poster="${attr(poster)}" muted loop data-autoplay></video>`], [0, '</div>']], style, base)];
    }
    case 'table': {
      const columns = Math.max(1, o.columns ?? 2);
      const rows = Math.max(1, o.rows ?? 2);
      const row = (cell: string) => `<tr>${`<${cell}></${cell}>`.repeat(columns)}</tr>`;
      const body: [number, string][] = Array.from({ length: rows }, (_, i) => [2, row(i ? 'td' : 'th')]);
      return [lines([[0, '<table>'], [1, '<tbody>'], ...body, [1, '</tbody>'], [0, '</table>']], style, base)];
    }
    case 'formula':
      return [`<div class="math">\\[${o.tex ?? 'x'}\\]</div>`];
    case 'code':
      return [`<pre><code class="language-${attr(o.language ?? 'python')}"></code></pre>`];
    case 'qr':
      return [`<div class="qr" data-qr="${attr(o.qr ?? 'https://example.com')}"></div>`];
    case 'backdrop':
      return [`<div class="backdrop" data-scene="${attr(o.scene ?? 'nest')}" data-cx="0.97" data-cy="0" data-half="0.5"></div>`];
  }
}

// the words of the placeholders of the samples, by the tag and the class of the empty element
const SAMPLE_WORDS: Partial<Record<Layout, [string, string][]>> & { all: [string, string][] } = {
  title: [['<h1></h1>', 'Title of the talk'], ['<p class="sub"></p>', 'Subtitle of the talk'], ['<p class="who"></p>', 'Name of the speaker']],
  closing: [['<h1></h1>', 'Thank you'], ['<p class="sub"></p>', 'Questions'], ['<p class="who"></p>', '']],
  section: [['<h2></h2>', 'Title of the section']],
  figure: [['<h2></h2>', 'Title of the figure'], ['<p class="caption"></p>', 'Caption of the figure, at the lower left']],
  split: [['<h2></h2>', 'Title'], ['<p></p>', 'A sentence on the black panel.']],
  all: [['<h2></h2>', 'Title of the slide'], ['<p></p>', 'A paragraph of the text column, which is set in the width of the layout and runs over a few lines.']],
};

// the gray box of a sample where a figure or a backdrop goes, inside the padding of a plate
const BOX = 'style="background: color-mix(in srgb, var(--muted) 34%, var(--bg)); background-clip: content-box"';

// the text of a sample slide of the layout for the tiles of the layout chooser: the skeleton of
// layoutText with placeholder words, two items in its list, and a gray box in place of each figure
// and backdrop. a content slide and a narrow slide are written without a figure, hence their
// samples get a gray zone and a gray backdrop at the place of the layout, and a wide slide is
// without one, since its text column runs over this place. a sample does not depend on the deck,
// and it is drawn but never written into a file
export function sampleText(layout: Layout): string {
  const style = { eol: '\n', step: '  ' };
  let text = layoutText(layout, style);
  for (const [empty, words] of [...(SAMPLE_WORDS[layout] ?? []), ...SAMPLE_WORDS.all]) {
    text = text.replace(empty, words ? empty.replace('></', `>${words}</`) : '');
  }
  text = text
    .replace('<ul class="outline" data-auto></ul>', '<ul class="outline"><li class="now">Chapter one</li><li>Chapter two</li></ul>')
    .replace(/<div class="(backdrop|plate|zone)"[^>]*>/g, (_, cls: string) => `<div class="${cls}" ${BOX}>`);
  text = text.replace(/<ul>\s*<li><\/li>\s*<\/ul>/, '<ul><li>A first point</li><li>A second point</li></ul>');
  const place = layout === 'content' ? 'zone' : layout === 'narrow' ? 'backdrop' : null;
  return place ? text.replace('</section>', `  <div class="${place}" ${BOX}></div>\n</section>`) : text;
}
