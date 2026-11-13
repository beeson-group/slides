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
];

// the files where an old word means something else, e.g. the JSON key ghost of a plot
const OTHER = { ghost: /^src\/(plot|orbits|switcher)\.ts$|^theme\/beeson\.js$/ };

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
  const missing = ['.figure-box', 'section.split .text-column', '.backdrop .label', '.surface .label', '.shape.fill-translucent', 'section .faint', '.white-figure', '--text-column:', '--white-figure:', '--trajectory-1:'].filter((s) => !css.includes(s));
  assert.deepEqual(missing, []);
});

test('the demo deck uses the new names', () => {
  const deck = read('index.html');
  const missing = ['class="figure-box"', 'data-backdrop="', 'class="label"', 'data-trajectories="', 'data-surface-state="'].filter((s) => !deck.includes(s));
  assert.deepEqual(missing, []);
});
