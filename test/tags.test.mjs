// the start tag of an element with its step or its translation changed: only the attribute that
// changes is written, and the other bytes of the tag are kept

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTag, stepIn, translateIn } from '../src/editor/tags.ts';
import { tokenize } from '../src/editor/tokens.ts';

const tagOf = (html) => tokenize(html).find((t) => t.type === 'start');
const render = (html, edit) => {
  const tag = tagOf(html);
  const out = renderTag(html, tag, tag.attrs, edit);
  return out === null ? null : out + html.slice(tag.end);
};

test('a step is added to a tag without attributes, and read back', () => {
  assert.equal(render('<li>a</li>', { fragment: true, index: 2 }), '<li class="fragment" data-fragment-index="2">a</li>');
  assert.deepEqual(stepIn(tagOf('<li class="fragment" data-fragment-index="2">').attrs), { fragment: true, index: 2 });
  assert.deepEqual(stepIn(tagOf('<li class="x">').attrs), { fragment: false, index: null });
});

test('the class fragment is added to and removed from the classes of the file, which keep their order', () => {
  assert.equal(render('<p class="wide  note">a</p>', { fragment: true }), '<p class="wide note fragment">a</p>');
  assert.equal(render("<p class='fragment'>a</p>", { fragment: false, index: null }), '<p>a</p>');
  assert.equal(render('<p class="fragment wide" data-fragment-index="1" id="x">a</p>', { fragment: false, index: null }), '<p class="wide" id="x">a</p>');
  assert.equal(render('<p class="fragment" data-fragment-index="1">a</p>', { fragment: true, index: 1 }), null);
});

test('an index is changed in place, with the spacing and the other attributes of the tag kept', () => {
  assert.equal(render('<li   class="fragment"\n    data-fragment-index="3"  >a</li>', { index: 1 }), '<li   class="fragment"\n    data-fragment-index="1"  >a</li>');
  assert.equal(render('<li class="fragment" data-fragment-index=3>a</li>', { index: 3 }), null);
});

test('a translation is put into the style, next to the declarations that are there, and taken out again', () => {
  assert.equal(render('<img src="a.png">', { translate: { x: 40, y: -20.25 } }), '<img src="a.png" style="translate: 40px -20px">');
  assert.equal(render('<img src="a.png"/>', { translate: { x: 1, y: 2 } }), '<img src="a.png" style="translate: 1px 2px"/>');
  assert.equal(render('<div class="zone" style="translate: 40px -20px; opacity: .5">', { translate: { x: 0, y: 8 } }), '<div class="zone" style="opacity: .5; translate: 0px 8px">');
  assert.equal(render('<div class="zone" style="translate: 40px -20px">', { translate: null }), '<div class="zone">');
  assert.equal(render('<div class="zone" style="translate: 40px -20px">', { translate: { x: 40, y: -20 } }), null);
  assert.deepEqual(translateIn('color: red; translate: 12px'), { x: 12, y: 0 });
  assert.equal(translateIn('color: red'), null);
});

test('a step and a translation in one edit are written in one tag', () => {
  assert.equal(render('<p>a</p>', { fragment: true, index: 1, translate: { x: 5, y: 5 } }), '<p class="fragment" data-fragment-index="1" style="translate: 5px 5px">a</p>');
});

// defect 6 of the save model: a value was decoded only for &quot; and &amp;, hence another
// reference in a rewritten attribute was escaped a second time
test('a character reference in a rewritten class or style is kept', () => {
  assert.equal(
    render('<p style="font-family: &#39;A&#39;; translate: 1px 2px">a</p>', { translate: { x: 3, y: 4 } }),
    '<p style="font-family: &#39;A&#39;; translate: 3px 4px">a</p>',
  );
  assert.equal(render('<p class="x&#45;y">a</p>', { fragment: true }), '<p class="x&#45;y fragment">a</p>');
  assert.deepEqual(stepIn(tagOf('<p class="&#102;ragment">').attrs), { fragment: true, index: null });
});

test('an attribute is set, changed in place, made bare, and removed, with the other bytes kept', () => {
  assert.equal(render('<section>', { attrs: { 'data-visibility': 'hidden' } }), '<section data-visibility="hidden">');
  assert.equal(render("<section  data-visibility='uncounted' id=a>", { attrs: { 'data-visibility': 'hidden' } }), "<section  data-visibility='hidden' id=a>");
  assert.equal(render('<section data-visibility="hidden" id="a">', { attrs: { 'data-visibility': null } }), '<section id="a">');
  assert.equal(render('<section data-visibility="hidden">', { attrs: { 'data-visibility': 'hidden' } }), null);
  assert.equal(render('<video src="a.mp4">', { attrs: { muted: '', loop: '' } }), '<video src="a.mp4" muted loop>');
  assert.equal(render('<video muted src="a.mp4">', { attrs: { muted: '' } }), null);
  assert.equal(render('<img alt="a">', { attrs: { alt: 'Tom & "Jerry"' } }), '<img alt="Tom &amp; &quot;Jerry&quot;">');
  assert.equal(render("<img alt='a'>", { attrs: { alt: "it's" } }), "<img alt='it&#39;s'>");
  assert.equal(render('<img alt="&#39;a&#39;">', { attrs: { alt: "'a'" } }), null);
});

test('a class is added and removed by name, and a whole class value replaces the classes', () => {
  assert.equal(render('<p class="a  b">x</p>', { classes: { c: true, a: false } }), '<p class="b c">x</p>');
  assert.equal(render('<p class="a">x</p>', { classes: { a: true, b: false } }), null);
  assert.equal(render('<p class="a">x</p>', { classes: { a: false } }), '<p>x</p>');
  assert.equal(render('<p class="a">x</p>', { attrs: { class: 'b c' } }), '<p class="b c">x</p>');
  // the field fragment is laid over the map
  assert.equal(render('<p>x</p>', { classes: { fragment: false }, fragment: true }), '<p class="fragment">x</p>');
});

test('a declaration is set in place, added last, and removed, with the others kept in their order', () => {
  assert.equal(render('<img style="width: 50%; rotate: 0deg">', { style: { width: '600px' } }), '<img style="width: 600px; rotate: 0deg">');
  assert.equal(render('<img style="width: 50%">', { style: { rotate: '15deg' } }), '<img style="width: 50%; rotate: 15deg">');
  assert.equal(render('<img style="width: 50%; rotate: 15deg">', { style: { width: null } }), '<img style="rotate: 15deg">');
  assert.equal(render('<img style="width:  50%">', { style: { width: '50%' } }), null);
  assert.equal(render('<img style="width: 5px">', { style: { width: null } }), '<img>');
  // the field translate is laid over the map, and put last as before
  assert.equal(render('<img style="translate: 1px 1px; width: 5px">', { style: { translate: '9px 9px' }, translate: { x: 2, y: 3 } }), '<img style="width: 5px; translate: 2px 3px">');
});

test('the index of a step is laid over the attribute of the map', () => {
  assert.equal(render('<p data-fragment-index="1">x</p>', { attrs: { 'data-fragment-index': '5' }, index: 2 }), '<p data-fragment-index="2">x</p>');
  assert.equal(render('<p data-fragment-index="1">x</p>', { attrs: { 'data-fragment-index': '5' } }), '<p data-fragment-index="5">x</p>');
});

test('the state of a tag after an edit is read with every value decoded', async () => {
  const { stateOf, mergeEdit } = await import('../src/editor/tags.ts');
  const tag = tagOf('<p class="a&#45;b fragment" data-x="&lt;1" style="width: 5px; translate: 1px 2px">');
  assert.deepEqual(stateOf(tag.attrs), {
    classes: ['a-b', 'fragment'],
    attrs: { class: 'a-b fragment', 'data-x': '<1', style: 'width: 5px; translate: 1px 2px' },
    style: { width: '5px', translate: '1px 2px' },
  });
  const edit = mergeEdit({ classes: { c: true }, translate: { x: 3, y: 4 } }, { classes: { fragment: false }, attrs: { 'data-x': null } });
  assert.deepEqual(edit, { classes: { c: true, fragment: false }, translate: { x: 3, y: 4 }, attrs: { 'data-x': null } });
  assert.deepEqual(stateOf(tag.attrs, edit), {
    classes: ['a-b', 'c'],
    attrs: { class: 'a-b c', style: 'width: 5px; translate: 3px 4px' },
    style: { width: '5px', translate: '3px 4px' },
  });
});
