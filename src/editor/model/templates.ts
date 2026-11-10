// the text of a new slide of each of the eight layouts and of a new element of each kind, written
// in the line endings and the indentation of the file of the deck. a placeholder is empty in the
// text, and the editor shows its prompt from its own stylesheet. the skeletons follow the
// vocabulary of AGENTS.md. pure, without the DOM

import { eolOf } from './units.ts';

export type Layout = 'title' | 'section' | 'content' | 'narrow' | 'wide' | 'figure' | 'split' | 'closing';
export const LAYOUTS: Layout[] = ['title', 'section', 'content', 'narrow', 'wide', 'figure', 'split', 'closing'];

export type ElementKind = 'text' | 'image' | 'video' | 'table' | 'formula' | 'code' | 'qr' | 'plot' | 'backdrop';
export const ELEMENT_KINDS: ElementKind[] = ['text', 'image', 'video', 'table', 'formula', 'code', 'qr', 'plot', 'backdrop'];

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
    default:
      return lines([[0, layout === 'content' ? '<section>' : `<section class="${layout}">`], [1, '<h2></h2>'], [1, '<p></p>'], [0, '</section>']], style, base);
  }
}

export type ElementOptions = { src?: string; alt?: string; poster?: string; tex?: string; language?: string; qr?: string; id?: string; columns?: number; rows?: number; scene?: string };

// the units of a new element of the kind, each without the white space before it, in the order in
// which they are inserted. base is the indentation of the children of the container, and a plot is
// two units, its div and its JSON block
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
    case 'plot': {
      const id = attr(o.id ?? 'plot-1');
      const json: [number, string][] = [
        [0, `<script type="application/json" id="${id}">{`],
        [1, '"duration": 2,'],
        [1, '"panels": [{ "id": "main", "x": { "range": [0, 1] }, "y": { "range": [0, 1] } }],'],
        [1, '"marks": [{ "id": "line", "panel": "main", "kind": "trace" }],'],
        [1, '"tabs": [{ "name": "data", "values": [0, 1], "data": { "line": [[0, 0], [1, 1]] } }]'],
        [0, '}</script>'],
      ];
      return [`<div class="plot zone" data-plot="${id}"></div>`, lines(json, style, base)];
    }
    case 'backdrop':
      return [`<div class="backdrop" data-scene="${attr(o.scene ?? 'nest')}" data-cx="0.97" data-cy="0" data-half="0.5"></div>`];
  }
}
