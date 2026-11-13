// the TikZ figures of a deck: the style of styles/beeson-tikz.sty, whose colors are the custom
// properties of theme/beeson.css in each mode

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const STY = readFileSync('styles/beeson-tikz.sty', 'utf8');
const CSS = readFileSync('theme/beeson.css', 'utf8');

// the custom properties of a mode, from the rules of :root and of html[data-theme="mode"] in their order
const properties = (mode) => {
  const values = {};
  for (const [, selectors, body] of CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = selectors.split(',').map((s) => s.trim());
    if (!list.includes(':root') && !list.includes(`html[data-theme="${mode}"]`)) continue;
    for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) values[name] = value.trim().toLowerCase();
  }
  return values;
};
// the colors that the style defines in a mode, from the two branches of \ifbeeson@dark
const colors = (mode) => {
  const [, dark, light] = /\\ifbeeson@dark([\s\S]*?)\\else([\s\S]*?)\\fi/.exec(STY);
  return Object.fromEntries([...(mode === 'dark' ? dark : light).matchAll(/\\definecolor\{(\w+)\}\{HTML\}\{([0-9A-Fa-f]{6})\}/g)].map(([, name, hex]) => [name, `#${hex.toLowerCase()}`]));
};
// each color of the style, with the custom property of the theme that it is taken from. ink is
// --text, since text is a key of TikZ
const TOKENS = { bg: 'bg', ink: 'text', subtle: 'subtle', muted: 'muted', line: 'line', accent: 'accent', violet: 'violet', blue: 'blue', red: 'red', ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`data${n}`, `data-${n}`])) };

for (const mode of ['dark', 'light']) {
  test(`the colors of the TikZ style in the ${mode} mode are those of the theme`, () => {
    const css = properties(mode);
    const sty = colors(mode);
    assert.deepEqual(Object.keys(sty).sort(), Object.keys(TOKENS).sort());
    for (const [name, property] of Object.entries(TOKENS)) assert.equal(sty[name], css[property], `${name} against --${property}`);
  });
}

test('the TikZ style is light unless it is loaded with the option dark, and it holds the look of a figure', () => {
  assert.match(STY, /\\ProvidesPackage\{beeson-tikz\}/);
  assert.match(STY, /\\DeclareOption\{dark\}\{\\beeson@darktrue\}/);
  assert.match(STY, /\\DeclareOption\{light\}\{\\beeson@darkfalse\}/);
  assert.match(STY, /\\ExecuteOptions\{light\}/);
  // at 3.6 px per TeX point, lines of 2 px and curves of 3 px
  assert.match(STY, /line width=0\.5556pt/);
  assert.match(STY, /every axis plot\/\.append style=\{line width=0\.8333pt\}/);
  assert.match(STY, /cycle list=\{\{accent\},\{blue\},\{violet\}\}/);
  assert.match(STY, /part\/\.style=/);
});
