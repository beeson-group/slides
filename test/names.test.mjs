// the names of the glossary in the theme, the editor, and the demo deck. each class and attribute
// renamed for the glossary is read and written only by its new name, and the old name is not
// kept as an alias, since a talk carries its own copy of theme/

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const sources = (dir) =>
  readdirSync(join(root, dir), { recursive: true })
    .filter((f) => f.endsWith('.ts'))
    // with forward slashes on Windows too, since the paths are matched against OTHER
    .map((f) => `${dir}/${f.replaceAll('\\', '/')}`);

// the files of the theme, the editor, and the demo deck, the compiled bundles included
const FILES = ['theme/beeson.css', 'theme/beeson.js', 'theme/editor.js', 'index.html', ...sources('src')];

// each old name, the pattern of its use as a class, an attribute, a custom property, or a label,
// and the new name. the drag ghost of the editor, the faint path of a plot (its JSON key ghost),
// the quiet zone of a QR code, and the inspector panel of the editor are other words and stay
const OLD = [
  ['zone', /(?<![\w$}?])\.zone(?![\w-])|class="(?:[^"]* )?zone[ "]|["']zone["']/, 'figure-box'],
  ['panel', /(?<!inspector > )(?<![\w$}?])\.panel(?![\w\-.[:])|class="panel"|["']panel["']|--panel\b/, 'text-column'],
  ['data-scene', /data-scene\b|dataset\.scene\b/, 'data-backdrop'],
  ['lab', /(?<![\w$}?])\.lab(?![\w-])|class="lab"|["']lab["']/, 'label'],
  ['data-strands', /data-strands|dataset\.strands|Beeson\.strands|--strand-/, 'data-trajectories'],
  ['data-surface-stage', /data-surface-stage|surfaceStage|data-stage\b|dataset\.stage\b/, 'data-surface-state'],
  ['data-surface-marks', /data-surface-marks|surfaceMarks/, 'data-surface-points'],
  ['veil', /(?<![\w$}?])\.veil(?![\w-])|["']veil["']/, 'fill-translucent'],
  ['ghost', /(?<![\w$}?])\.ghost(?![\w-])|["']ghost["']|\|ghost\|/, 'faint'],
  ['paper', /(?<![\w$}?])\.paper(?![\w-])|["']paper["']|--paper\b|figure\.paper/, 'white-figure'],
  ['Chapters Table', /Chapters Table/, 'Slide Sorter'],
  ['glue', /glue/i, 'attach'],
  ['card', /(?<!dis)card/i, 'dialog, step, chooser, or scrub-heading'],
  ['block', /class="(?:[^"]* )?block[ "]|(?<![\w$.-])\.block(?![\w-])|cls: ["']block["']|["']block["'], ["']sec["']/, 'title-text'],
  ['layer', /beeson-layers|layers\.ts|LayerSwitch|Layer of the slide|showLayer|\b(?:last|another|first|the) layer of the slide|cut into layers|one layer at a time|layersOf\((?:slide|clone)\)/i, 'the steps shown on the slide'],
  ['JSON block', /JSON block/, 'JSON script'],
  ['the surface states flat, wells, bowl, and sum', /data-surface-state="(?:flat|wells|bowl|sum)"/, 'zero, gravitational, centrifugal, and effective'],
];

// the files where an old word means something else, e.g. the JSON key ghost of a plot
const OTHER = { ghost: /^src\/(plot|orbits|switcher)\.ts$|^theme\/beeson\.js$/ };

// the uses of block in the editor that do not mean a text element: a blockquote, a CSS display, a
// block arrow of a shape, a blocked request, the block option of scrollIntoView, and the
// error-correction blocks of a QR code, whose encoder is bundled into editor.js
const OTHER_BLOCK = /blockquote|inline-block|display(?::\s*|\s*=\s*['"]|\s*:\s*['"])block|Block Arrow|\bblocked\b|onblocked|block:\s*['"](?:nearest|center|start|end)['"]|\bBLOCKS\b/g;

test('the editor does not call a text element a block', () => {
  const files = [...sources('src/editor'), 'theme/editor.js'];
  const hits = files.flatMap((f) =>
    read(f)
      .split('\n')
      .map((line, i) => [line, i])
      .filter(([line]) => /block/i.test(line.replace(OTHER_BLOCK, '')))
      .map(([line, i]) => `${f}:${i + 1}: ${line.trim().slice(0, 120)}`),
  );
  assert.deepEqual(hits, []);
});

test('the modules of the editor are named after the glossary', () => {
  const old = ['src/editor/model/glue.ts', 'src/editor/layers.ts', 'src/editor/text/blocks.ts'];
  assert.deepEqual(old.filter((f) => existsSync(join(root, f))), []);
});

test('a surface function does not name its heights, and its states are named after the math', async () => {
  const { surfaceFunction } = await import('../src/surfaces.ts');
  const f = surfaceFunction('effective-potential', { mu: '0.05' });
  assert.equal('layers' in f, false);
  assert.deepEqual(Object.keys(f.states), ['zero', 'gravitational', 'centrifugal', 'effective', 'extrema', 'cut']);
  assert.equal(f.initial, 'zero');
  const hits = ['src/surfaces.ts', 'src/surface.ts'].filter((s) => /layer/i.test(read(s)));
  assert.deepEqual(hits, []);
});

// the retired words of the glossary in REFERENCE.md, AGENTS.md, and the skills. the error-correction
// block of a QR code and the block arrow of a shape are other words and stay
const PROSE = [
  /\bGhosted\b/, /marks of Markdown/, /closing mark\b/, /\bits mark\b/, /each mark is drawn/,
  /cut into layers/, /one layer at a time/, /on a layer that hides/, /\bglue/i, /(?<!dis)\bcards?\b/i,
  /JSON block/, /the paper is cut/, /paper color/, /terms and the marks/, /title block/, /class="block"/,
  /`block`/, /inline blocks/, /Format tab/, /Steps tab/, /\bblocks?\b/i,
];

test('REFERENCE.md, AGENTS.md, and the skills use the words of the glossary', () => {
  const docs = ['REFERENCE.md', 'AGENTS.md', ...readdirSync(join(root, '.agents/skills'), { recursive: true }).filter((f) => f.endsWith('.md')).map((f) => join('.agents/skills', f))];
  const hits = docs.flatMap((f) =>
    read(f)
      .replace(/error-correction block|double block arrow|block arrow/gi, '')
      .split('\n')
      .map((line, i) => [line, i])
      .flatMap(([line, i]) => PROSE.filter((p) => p.test(line)).map((p) => `${f}:${i + 1}: ${p}`)),
  );
  assert.deepEqual(hits, []);
});

for (const [name, pattern, now] of OLD) {
  test(`the theme, the editor, and the demo deck do not read or write ${name}, which is ${now}`, () => {
    const hits = FILES.filter((f) => !OTHER[name]?.test(f)).flatMap((f) =>
      read(f)
        .split('\n')
        .map((line, i) => [line, i])
        .filter(([line]) => pattern.test(line))
        .map(([line, i]) => `${f}:${i + 1}: ${line.trim().slice(0, 120)}`),
    );
    assert.deepEqual(hits, []);
  });
}

test('the module of the built-in backdrops is src/backdrops.ts, and that of the trajectories is src/trajectories.ts', () => {
  assert.deepEqual(['src/scenes.ts', 'src/strands.ts'].filter((f) => existsSync(join(root, f))), []);
  assert.deepEqual(['src/backdrops.ts', 'src/trajectories.ts'].filter((f) => !existsSync(join(root, f))), []);
});

test('the theme styles the new classes and custom properties', () => {
  const css = read('theme/beeson.css');
  const missing = ['.figure-box', 'section.split .text-column', 'section.title .title-text', '.scrub-heading', '.backdrop .label', '.surface .label', '.shape.fill-translucent', 'section .faint', '.white-figure', '--text-column:', '--white-figure:', '--trajectory-1:'].filter((s) => !css.includes(s));
  assert.deepEqual(missing, []);
});

test('the demo deck uses the new names', () => {
  const deck = read('index.html');
  const missing = ['class="figure-box"', 'data-backdrop="', 'class="label"', 'data-trajectories="', 'data-surface-state="', 'class="title-text"', 'data-surface-state="gravitational"'].filter((s) => !deck.includes(s));
  assert.deepEqual(missing, []);
});
