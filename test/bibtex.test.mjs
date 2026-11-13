// the BibTeX parser of src/bibtex.ts: the types and the fields of the entries, the values in braces
// and in quotes, the strings of @string, the accents, the place of an entry in the source, and the
// entries that are skipped with their reason. the plain text of TeX text of src/accents.ts

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainText } from '../src/accents.ts';
import { plain, readBibtex } from '../src/bibtex.ts';

const KOON = `@article{koon2000,
  author  = {Koon, Wang Sang and Lo, Martin W. and Marsden, Jerrold E. and Ross, Shane D.},
  title   = {Heteroclinic connections between periodic orbits and resonance transitions in celestial mechanics},
  journal = {Chaos},
  volume  = {10},
  number  = 2,
  pages   = {427--469},
  year    = 2000,
  doi     = {10.1063/1.166509},
}`;

test('an entry is read with its type, its key, and its fields, with the names in lowercase', () => {
  const { entries, skipped } = readBibtex(`% a comment before the entries\n\n${KOON}\n`);
  assert.deepEqual(skipped, []);
  assert.equal(entries.length, 1);
  const [koon] = entries;
  assert.equal(koon.type, 'article');
  assert.equal(koon.key, 'koon2000');
  assert.deepEqual(Object.keys(koon.fields), ['author', 'title', 'journal', 'volume', 'number', 'pages', 'year', 'doi']);
  assert.equal(koon.fields.author, 'Koon, Wang Sang and Lo, Martin W. and Marsden, Jerrold E. and Ross, Shane D.');
  assert.equal(koon.fields.number, '2');
  assert.equal(koon.fields.year, '2000');
  assert.equal(plain(koon, 'pages'), '427–469');
  assert.equal(plain(koon, 'note'), '');
});

test('a value is read in braces, in quotes, and as a number, and its line breaks become spaces', () => {
  const { entries, skipped } = readBibtex(`@Book{szebehely1967,
  AUTHOR = "Szebehely, Victor",
  Title = "Theory of Orbits: The Restricted Problem
           of {Three} Bodies",
  publisher = {Academic Press}, address="New York", year = 1967}
@misc(parens, title = {A title with a "quote" and a {nested {brace}}}, note = "a {"}quote{"} in quotes")`);
  assert.deepEqual(skipped, []);
  assert.deepEqual(entries.map((e) => [e.type, e.key]), [['book', 'szebehely1967'], ['misc', 'parens']]);
  assert.deepEqual(entries[0].fields, {
    author: 'Szebehely, Victor',
    title: 'Theory of Orbits: The Restricted Problem of {Three} Bodies',
    publisher: 'Academic Press',
    address: 'New York',
    year: '1967',
  });
  assert.equal(entries[1].fields.title, 'A title with a "quote" and a {nested {brace}}');
  assert.equal(entries[1].fields.note, 'a {"}quote{"} in quotes');
  assert.equal(plain(entries[1], 'note'), 'a "quote" in quotes');
});

test('a string of @string and a month are put into a value, and the parts of a value are joined at #', () => {
  const { entries, skipped } = readBibtex(`@string{cmda = "Celestial Mechanics and Dynamical Astronomy"}
@STRING(aas = {AAS/AIAA })
@preamble{"\\newcommand{\\noop}[1]{}"}
@comment{@article{hidden, title = {never read}}}
@article{a, journal = cmda, month = jun, year = 2004}
@inproceedings{b, booktitle = aas # "Astrodynamics Specialist Conference" # ", " # 2019, month = "July"}
@article{c, journal = CMDA, publisher = unknown}`);
  assert.deepEqual(skipped, []);
  assert.deepEqual(entries.map((e) => e.key), ['a', 'b', 'c']);
  assert.deepEqual(entries[0].fields, { journal: 'Celestial Mechanics and Dynamical Astronomy', month: 'June', year: '2004' });
  assert.equal(entries[1].fields.booktitle, 'AAS/AIAA Astrodynamics Specialist Conference, 2019');
  assert.equal(entries[1].fields.month, 'July');
  // the name of a string is read without its case, and a name that is not a string is kept
  assert.deepEqual(entries[2].fields, { journal: 'Celestial Mechanics and Dynamical Astronomy', publisher: 'unknown' });
});

test('the accents and the special letters of TeX become characters in the plain text', () => {
  const cases = [
    ["G{\\'o}mez", 'Gómez'],
    ["G\\'omez", 'Gómez'],
    ["G\\'{o}mez", 'Gómez'],
    ['Poincar{\\\'e}', 'Poincaré'],
    ['M{\\"u}ller and Schr\\"odinger', 'Müller and Schrödinger'],
    ['Fran{\\c c}ois and Fran\\c{c}ois', 'François and François'],
    ['Dvo{\\v r}{\\\'a}k', 'Dvořák'],
    ['Erd{\\H o}s', 'Erdős'],
    ['Sim{\\\'o} and Masdemont and {\\`A}ngel Jorba', 'Simó and Masdemont and Àngel Jorba'],
    ["Mart{\\'\\i}nez", 'Martínez'],
    ['Stra{\\ss}e, {\\O}rsted, {\\L}ukasiewicz, {\\AA}ngstr{\\"o}m', 'Straße, Ørsted, Łukasiewicz, Ångström'],
    ['Gau\\ss{} law', 'Gauß law'],
    ['A {B}ig \\emph{Title} with \\textbf{bold} words', 'A Big Title with bold words'],
    ['Earth--Moon \\& Sun~--- a ``quoted\'\' title', 'Earth–Moon & Sun — a “quoted” title'],
    ['the $\\mathcal{L}_2$ point, 50\\% and \\$5', 'the $\\mathcal{L}_2$ point, 50% and $5'],
    ['a set \\{x\\} and  two\n  lines', 'a set {x} and two lines'],
  ];
  for (const [tex, text] of cases) assert.equal(plainText(tex), text, tex);
});

test('the place of an entry in the source is given, so that its source can be shown and replaced', () => {
  const source = `${KOON}\r\n\r\n@book{szebehely1967,\r\n  title = {Theory of Orbits},\r\n}\r\ntext between the entries\r\n@misc{last, year = 2020}`;
  const { entries } = readBibtex(source);
  assert.deepEqual(entries.map((e) => e.line), [1, 12, 16]);
  assert.equal(source.slice(entries[0].start, entries[0].end), KOON);
  assert.equal(source.slice(entries[1].start, entries[1].end), '@book{szebehely1967,\r\n  title = {Theory of Orbits},\r\n}');
  assert.equal(source.slice(entries[2].start, entries[2].end), '@misc{last, year = 2020}');
});

test('an entry that is not read is skipped with its reason, and the entries after it are read', () => {
  const { entries, skipped } = readBibtex(`@article{open,
  title = {A brace that is not closed,
  year = 2001
}

@article{second, title = {Read}}
@article{second, title = {The same key again}}
@article{novalue, title, year = 2002}
@article{, title = {No key}}
@article{third, title = "A quote that is not closed, year = 2003}
@book{fourth, title = {Read as well}}`);
  assert.deepEqual(entries.map((e) => e.key), ['second', 'fourth']);
  assert.deepEqual(skipped, [
    { line: 1, text: '@article{open,', reason: 'a brace is not closed' },
    { line: 7, text: '@article{second, title = {The same key again}}', reason: 'the key second is the key of an entry above' },
    { line: 8, text: '@article{novalue, title, year = 2002}', reason: 'the field title does not have a value' },
    { line: 9, text: '@article{, title = {No key}}', reason: 'the entry does not have a key' },
    { line: 10, text: '@article{third, title = "A quote that is not closed, year = 2003}', reason: 'a quote is not closed' },
  ]);
});
