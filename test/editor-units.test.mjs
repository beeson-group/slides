// the units of a container, the text of new slides and elements, and the scope rule, all without
// a browser

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { tokenize } from '../src/editor/tokens.ts';
import { childrenIn, eolOf, indentAt, placeLead, spaceOf, unitsOf } from '../src/editor/model/units.ts';
import { ELEMENT_KINDS, LAYOUTS, elementText, layoutText, textStyle } from '../src/editor/model/templates.ts';
import { attributeProblem, declarationProblem, editProblems, textProblems, themeClasses } from '../src/editor/model/scope.ts';

// the units of the content of the first element of the text
function unitsIn(text) {
  const tokens = tokenize(text);
  const open = tokens.find((t) => t.type === 'start');
  const close = tokens.findLast((t) => t.type === 'end' && t.name === open.name);
  const content = { start: open.end, end: close.start };
  return { content, ...unitsOf(text, childrenIn(tokens, content), content) };
}

const slice = (text, r) => text.slice(r.start, r.end);
const pieces = (text, u) => [...u.units.map((x) => text.slice(x.lead.start, x.end)), slice(text, u.tail)];

function assertPartition(text) {
  const u = unitsIn(text);
  assert.equal(pieces(text, u).join(''), slice(text, u.content));
  return u;
}

test('a unit is an element with the white space and the comments before it', () => {
  const text = '<div class="slides">\n\n<!-- 1. title -->\n<section>a</section>\n\n<!-- 2. two -->\n<!-- more -->\n<section>b</section>\n\n</div>';
  const u = assertPartition(text);
  assert.deepEqual(pieces(text, u), ['\n\n<!-- 1. title -->\n<section>a</section>', '\n\n<!-- 2. two -->\n<!-- more -->\n<section>b</section>', '\n\n']);
  assert.equal(slice(text, u.units[1].range), '<section>b</section>');
  assert.equal(slice(text, u.units[1].lead), '\n\n<!-- 2. two -->\n<!-- more -->\n');
});

test('a marker pair around one element is one unit, up to its end comment', () => {
  const text = '<section>\n  <h2>A</h2>\n  <!-- tycho-viewer start, written by demo/tycho-scene.py -->\n  <tycho-viewer src="a"></tycho-viewer>\n<!-- tycho-viewer end -->\n  <p>b</p>\n</section>';
  const u = assertPartition(text);
  assert.equal(u.units.length, 3);
  assert.equal(text.slice(u.units[1].lead.start, u.units[1].end), '\n  <!-- tycho-viewer start, written by demo/tycho-scene.py -->\n  <tycho-viewer src="a"></tycho-viewer>\n<!-- tycho-viewer end -->');
  assert.equal(slice(text, u.units[1].range), '<tycho-viewer src="a"></tycho-viewer>');
  assert.equal(slice(text, u.units[2].lead), '\n  ');
});

test('a start comment without its end comment is only the lead of its element', () => {
  const text = '<div>\n  <!-- x start -->\n  <p>a</p>\n  <!-- y end -->\n  <p>b</p>\n</div>';
  const u = assertPartition(text);
  assert.equal(text.slice(u.units[0].lead.start, u.units[0].end), '\n  <!-- x start -->\n  <p>a</p>');
  assert.equal(slice(text, u.units[1].lead), '\n  <!-- y end -->\n  ');
});

test('the tail is the white space and the comments after the last element', () => {
  const text = '<ul>\n  <li>a</li>\n  <!-- later -->\n</ul>';
  const u = assertPartition(text);
  assert.equal(slice(text, u.tail), '\n  <!-- later -->\n');
  const empty = unitsIn('<ul></ul>');
  assert.deepEqual(empty.units, []);
  assert.equal(empty.tail.start, empty.tail.end);
});

test('the units of a CRLF file and of void and nested elements cover the content', () => {
  const text = '<section>\r\n  <h2>A <em>b</em></h2>\r\n  <img src="a.png">\r\n  <div><div>c</div></div>\r\n</section>';
  const u = assertPartition(text);
  assert.deepEqual(u.units.map((x) => slice(text, x.range)), ['<h2>A <em>b</em></h2>', '<img src="a.png">', '<div><div>c</div></div>']);
  assert.equal(slice(text, u.tail), '\r\n');
});

test('the units of the demo deck cover its slides byte for byte', () => {
  const text = readFileSync(new URL('../test-deck.html', import.meta.url), 'utf8');
  const tokens = tokenize(text);
  const open = tokens.find((t) => t.type === 'start' && t.attrs.some((a) => a.name === 'class' && a.value === 'slides'));
  let depth = 0;
  const close = tokens.find((t) => {
    if (t.start < open.end || t.name !== 'div') return false;
    if (t.type === 'start') depth++;
    else if (t.type === 'end' && depth-- === 0) return true;
    return false;
  });
  const content = { start: open.end, end: close.start };
  const u = unitsOf(text, childrenIn(tokens, content), content);
  assert.equal(pieces(text, u).join(''), slice(text, content));
  assert.ok(u.units.length >= 10);
  for (const x of u.units) assert.match(slice(text, x.range), /^<section/);
});

test('the white space of a lead is placed in another container', () => {
  assert.equal(eolOf('a\r\nb'), '\r\n');
  assert.equal(eolOf('a\nb'), '\n');
  assert.equal(spaceOf('\n\n  <!-- c -->\n  '), '\n\n  ');
  assert.equal(indentAt('<a>\n    <b>', 9), '    ');
  assert.equal(placeLead('\n      ', '\n  ', '\n'), '\n  ');
  assert.equal(placeLead('\n\n  <!-- a -->\n  ', '\n  ', '\n'), '\n\n  <!-- a -->\n  ');
  assert.equal(placeLead('\n\n<!-- a -->\n<!-- b -->\n', '\r\n    ', '\r\n'), '\r\n    <!-- a -->\r\n    <!-- b -->\r\n    ');
});

test('a slide of each layout is written in the style of its file', () => {
  const lf = textStyle('<div>\n  <p>a</p>\n</div>');
  const crlf = textStyle('<div>\r\n\t<p>a</p>\r\n</div>');
  assert.deepEqual(lf, { eol: '\n', step: '  ' });
  assert.deepEqual(crlf, { eol: '\r\n', step: '\t' });
  for (const layout of LAYOUTS) {
    const text = layoutText(layout, lf);
    assert.match(text, /^<section[ >]/);
    assert.match(text, /<\/section>$/);
    assert.ok(!text.includes('\r'));
    const tab = layoutText(layout, crlf);
    assert.ok(!/[^\r]\n/.test(tab));
    assert.equal(tab.replace(/\r\n\t*/g, ''), text.replace(/\n */g, ''));
  }
  assert.equal(layoutText('content', lf), '<section>\n  <h2></h2>\n  <p></p>\n  <ul>\n    <li></li>\n  </ul>\n</section>');
  assert.equal(layoutText('wide', lf, '  '), '<section class="wide">\n    <h2></h2>\n    <p></p>\n    <ul>\n      <li></li>\n    </ul>\n  </section>');
});

test('an element of each kind is written in the style of its file', () => {
  const style = textStyle('<a>\n  <b></b>\n</a>');
  for (const kind of ELEMENT_KINDS) {
    const units = elementText(kind, style, '  ');
    assert.equal(units.length, 1);
    for (const u of units) assert.match(u, /^<[a-z]/);
  }
  assert.equal(elementText('image', style, '  ', { src: 'a "b".png' })[0], '<figure class="figure-box">\n    <img src="a &quot;b&quot;.png" alt="">\n  </figure>');
  assert.match(elementText('table', style, '', { columns: 3, rows: 2 })[0], /<tr><th><\/th><th><\/th><th><\/th><\/tr>\n    <tr><td>/);
});

test('the classes of a stylesheet are read without comments, numbers, and addresses', () => {
  const css = '/* .nope */ .reveal .slides section.wide > .figure-box, a.b-c:hover { margin: .5em; background: url(x.png); content: ".q"; }';
  assert.deepEqual(themeClasses(css).sort(), ['b-c', 'figure-box', 'reveal', 'slides', 'wide']);
  const theme = new Set(themeClasses(readFileSync(new URL('../theme/beeson.css', import.meta.url), 'utf8')));
  for (const c of ['wide', 'narrow', 'figure-box', 'plate', 'backdrop', 'qr', 'math', 'caption', 'dots', 'dashes']) assert.ok(theme.has(c), c);
  for (const c of ['shape', 'rounded', 'ellipse', 'triangle', 'arrow', 'arrow-both', 'brace', 'plus', 'equals', 'round-s', 'round-l', 'fill-none', 'fill-ground', 'fill-translucent', 'weight-6', 'weight-8', 'no-outline', 'flip-x', 'flip-y', 'left']) assert.ok(theme.has(c), c);
});

test('the scope rule allows the writes of AGENTS.md and names the others', () => {
  const theme = new Set(['figure-box', 'small']);
  const attrs = tokenize('<p class="figure-box" style="translate: 1px 2px">').find((t) => t.type === 'start').attrs;
  assert.deepEqual(editProblems('p', attrs, { classes: { small: true, fragment: true }, attrs: { 'data-tone': 'violet' } }, theme), []);
  assert.deepEqual(editProblems('p', attrs, { classes: { mine: true }, attrs: { title: 'x' }, style: { color: 'red' } }, theme), ['the class mine', 'the attribute title', 'the declaration color']);
  assert.equal(declarationProblem('img', [], 'width', '40%'), null);
  assert.equal(declarationProblem('div', ['qr'], 'width', '300px'), null);
  // a text block takes a width in px from its grips, and an image or a video a height as well
  assert.equal(declarationProblem('p', [], 'width', '300px'), null);
  assert.match(declarationProblem('p', [], 'width', '40%'), /width/);
  assert.equal(declarationProblem('img', [], 'height', '300px'), null);
  assert.match(declarationProblem('div', ['qr'], 'height', '300px'), /height/);
  // a shape is placed and sized in its style, in px
  assert.equal(declarationProblem('div', ['shape', 'ellipse'], 'width', '300px'), null);
  assert.equal(declarationProblem('div', ['shape'], 'height', '160px'), null);
  assert.match(declarationProblem('div', ['shape'], 'height', '40%'), /height 40% on a shape/);
  assert.equal(declarationProblem('div', ['backdrop'], 'height', '1080px'), null);
  assert.equal(declarationProblem('pre', [], 'font-size', '18px'), null);
  assert.equal(declarationProblem('td', [], 'text-align', 'right'), null);
  assert.equal(declarationProblem('th', [], 'width', '240px'), null);
  assert.match(declarationProblem('td', [], 'width', '40%'), /width 40% on a td/);
  assert.equal(attributeProblem('id'), 'the attribute id');
  assert.equal(attributeProblem('id', true), null);
  const all = new Set(themeClasses(readFileSync(new URL('../theme/beeson.css', import.meta.url), 'utf8')));
  for (const layout of LAYOUTS) assert.deepEqual(textProblems(layoutText(layout, textStyle('')), all), [], layout);
  for (const kind of ELEMENT_KINDS) for (const u of elementText(kind, textStyle(''), '')) assert.deepEqual(textProblems(u, all), [], kind);
});
