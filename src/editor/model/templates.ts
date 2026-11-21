import { eolOf } from './units.ts';

export type Layout = 'title' | 'section' | 'content' | 'narrow' | 'wide' | 'figure' | 'split' | 'closing';
export const LAYOUTS: Layout[] = ['title', 'section', 'content', 'narrow', 'wide', 'figure', 'split', 'closing'];
export type NewLayout = Layout | 'titleOnly';
export const NEW_LAYOUTS: NewLayout[] = [...LAYOUTS, 'titleOnly'];

export type ElementKind = 'text' | 'image' | 'video' | 'table' | 'formula' | 'code' | 'qr' | 'backdrop' | 'shape';
export const ELEMENT_KINDS: ElementKind[] = ['text', 'image', 'video', 'table', 'formula', 'code', 'qr', 'backdrop', 'shape'];

export type TextStyle = { eol: string; step: string };

export function textStyle(text: string): TextStyle {
  let step: string | null = null;
  for (const m of text.matchAll(/^([ \t]+)</gm)) if (step === null || m[1].length < step.length) step = m[1];
  return { eol: eolOf(text), step: step && step.startsWith('\t') ? '\t' : (step ?? '  ') };
}

const attr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function lines(rows: [number, string][], style: TextStyle, base: string): string {
  return rows.map(([depth, row], i) => (i ? base + style.step.repeat(depth) : '') + row).join(style.eol);
}

export function layoutText(layout: NewLayout, style: TextStyle, base = ''): string {
  const titleText: [number, string][] = [[1, '<div class="title-text">'], [2, '<h1></h1>'], [2, '<p class="sub"></p>'], [2, '<p class="who"></p>'], [1, '</div>']];
  switch (layout) {
    case 'title':
      return lines([[0, '<section class="title">'], [1, '<div class="backdrop" data-trajectories="brand/transfer.js" data-duration="20" data-cx="-0.84" data-cy="0" data-half="1.128"></div>'], ...titleText, [0, '</section>']], style, base);
    case 'closing':
      return lines([[0, '<section class="closing">'], [1, '<div class="backdrop" data-backdrop="tubes" data-cx="0.42" data-cy="0" data-half="0.6"></div>'], ...titleText, [0, '</section>']], style, base);
    case 'section':
      return lines(
        [[0, '<section class="section">'], [1, '<div class="sec">'], [2, '<h2></h2>'], [2, '<ol class="outline" data-auto></ol>'], [1, '</div>'], [1, '<div class="backdrop" data-backdrop="wideRibbon" data-cx="0.2" data-cy="0" data-half="1.3"></div>'], [0, '</section>']],
        style,
        base,
      );
    case 'figure':
      return lines([[0, '<section class="figure">'], [1, '<div class="plate"></div>'], [1, '<h2></h2>'], [1, '<p class="caption"></p>'], [0, '</section>']], style, base);
    case 'split':
      return lines([[0, '<section class="split">'], [1, '<div class="text-column">'], [2, '<h2></h2>'], [2, '<p></p>'], [1, '</div>'], [1, '<div class="figure-box"></div>'], [0, '</section>']], style, base);
    case 'titleOnly':
      return lines([[0, '<section>'], [1, '<h2></h2>'], [0, '</section>']], style, base);
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

export type ElementOptions = { src?: string; alt?: string; pictures?: string[]; poster?: string; tex?: string; language?: string; qr?: string; columns?: number; rows?: number; backdrop?: string };

export function elementText(kind: ElementKind, style: TextStyle, base: string, options: ElementOptions = {}): string[] {
  const o = options;
  switch (kind) {
    case 'text':
      return ['<p></p>'];
    case 'image':
      return [lines([[0, '<figure class="figure-box">'], ...(o.pictures ?? [`<img src="${attr(o.src ?? 'media/image.png')}" alt="${attr(o.alt ?? '')}">`]).map((t) => [1, t] as [number, string]), [0, '</figure>']], style, base)];
    case 'video': {
      const src = o.src ?? 'media/video.mp4';
      const poster = o.poster ?? src.replace(/\.[^./]*$/, '.png');
      return [lines([[0, '<div class="figure-box">'], [1, `<video src="${attr(src)}" poster="${attr(poster)}" muted loop data-autoplay></video>`], [0, '</div>']], style, base)];
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
    case 'shape':
      return ['<div class="shape rounded" style="width: 240px; height: 240px"></div>'];
    case 'backdrop':
      return [`<div class="backdrop" data-backdrop="${attr(o.backdrop ?? 'tubes')}" data-cx="0.42" data-cy="0" data-half="0.6"></div>`];
  }
}

const SAMPLE_WORDS: Partial<Record<NewLayout, [string, string][]>> & { all: [string, string][] } = {
  title: [['<h1></h1>', 'Title of the talk'], ['<p class="sub"></p>', 'Subtitle of the talk'], ['<p class="who"></p>', 'Name of the speaker']],
  closing: [['<h1></h1>', 'Thank you'], ['<p class="sub"></p>', 'Questions'], ['<p class="who"></p>', '']],
  section: [['<h2></h2>', 'Title of the section']],
  figure: [['<h2></h2>', 'Title of the figure'], ['<p class="caption"></p>', 'Caption of the figure, at the lower left']],
  split: [['<h2></h2>', 'Title'], ['<p></p>', 'A sentence on the black text column.']],
  all: [['<h2></h2>', 'Title of the slide'], ['<p></p>', 'A paragraph of the text column, which is set in the width of the layout and runs over a few lines.']],
};

const BOX = 'style="background: color-mix(in srgb, var(--muted) 34%, var(--bg)); background-clip: content-box"';

export function sampleText(layout: NewLayout): string {
  const style = { eol: '\n', step: '  ' };
  let text = layoutText(layout, style);
  for (const [empty, words] of [...(SAMPLE_WORDS[layout] ?? []), ...SAMPLE_WORDS.all]) {
    text = text.replace(empty, words ? empty.replace('></', `>${words}</`) : '');
  }
  text = text
    .replace('<ol class="outline" data-auto></ol>', '<ol class="outline"><li class="now">Chapter one</li><li>Chapter two</li></ol>')
    .replace(/<div class="(backdrop|plate|figure-box)"[^>]*>/g, (_, cls: string) => `<div class="${cls}" ${BOX}>`);
  text = text.replace(/<ul>\s*<li><\/li>\s*<\/ul>/, '<ul><li>A first point</li><li>A second point</li></ul>');
  const place = layout === 'content' ? 'figure-box' : layout === 'narrow' ? 'backdrop' : null;
  return place ? text.replace('</section>', `  <div class="${place}" ${BOX}></div>\n</section>`) : text;
}
