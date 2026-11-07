// the tokenizer of the editor: every byte of a file is in one token, raw text runs to the end tag
// of its element, and the attributes and the classes of a start tag are read

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classesOf, tokenize } from '../src/editor/tokens.ts';

const joined = (html) => tokenize(html).map((t) => html.slice(t.start, t.end)).join('');

test('the tokens cover the file without a gap, with LF and with CRLF', () => {
  const html = '<!doctype html>\n<html>\n<body class="a  b">\n<p id=x data-y>a &lt; b < c <br/>d</p>\n<!-- note --><!-->\n<script>if (a < b) { s = "</div>" }</script>\n</body>\n</html>\n';
  assert.equal(joined(html), html);
  const crlf = html.replace(/\n/g, '\r\n');
  assert.equal(joined(crlf), crlf);
  assert.deepEqual(
    tokenize(html).map((t) => t.type),
    ['other', 'text', 'start', 'text', 'start', 'text', 'start', 'text', 'start', 'text', 'end', 'text', 'comment', 'comment', 'text', 'start', 'text', 'end', 'text', 'end', 'text', 'end', 'text'],
  );
});

test('a start tag gives its name in lowercase, its attributes, and its classes', () => {
  const [tag] = tokenize('<DIV Class="sec  wide" data-cx=0.5 hidden title=\'a > b\'>');
  assert.equal(tag.type, 'start');
  assert.equal(tag.name, 'div');
  assert.deepEqual(
    tag.attrs.map((a) => [a.name, a.value]),
    [['class', 'sec  wide'], ['data-cx', '0.5'], ['hidden', null], ['title', 'a > b']],
  );
  assert.deepEqual(classesOf(tag), ['sec', 'wide']);
  assert.equal(tokenize('<br/>')[0].selfClosing, true);
});

test('the text of a script runs to its end tag, and a character reference in it is not decoded', () => {
  const html = '<script type="application/octet-stream">AAA</scripts>&amp;</script><p>&amp;</p>';
  const tokens = tokenize(html);
  assert.equal(tokens[1].type, 'text');
  assert.equal(tokens[1].raw, true);
  assert.equal(html.slice(tokens[1].start, tokens[1].end), 'AAA</scripts>&amp;');
  assert.equal(tokens[2].type, 'end');
  assert.equal(tokens[4].raw, false);
});

test('a < that does not open markup is text', () => {
  const tokens = tokenize('<p>a < b and <3</p>');
  assert.deepEqual(tokens.map((t) => t.type), ['start', 'text', 'end']);
});
