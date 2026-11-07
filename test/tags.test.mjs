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
