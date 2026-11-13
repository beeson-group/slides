// the house form of a reference of src/reference.ts: the family names of the authors, the venue, the
// volume, and the year of an entry of the bibliography, e.g. Koon et al., Chaos 10 (2000), its link,
// and the search of the bibliography by author, year, title, and key

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBibtex } from '../src/bibtex.ts';
import { matches, namesOf, referenceOf, referenceParts, referenceText } from '../src/reference.ts';

const entry = (source) => readBibtex(source).entries[0];
const shown = (source) => referenceText(referenceOf(entry(source)));
const families = (author) => namesOf(author).names.map((name) => name.family);

const KOON = `@article{koon2000,
  author = {Koon, Wang Sang and Lo, Martin W. and Marsden, Jerrold E. and Ross, Shane D.},
  title = {Heteroclinic connections between periodic orbits and resonance transitions in celestial mechanics},
  journal = {Chaos}, volume = {10}, number = {2}, pages = {427--469}, year = {2000},
  doi = {10.1063/1.166509},
}`;

test('the names of the authors are read in both orders, with a particle, a suffix, and a name in braces', () => {
  assert.deepEqual(namesOf('Koon, Wang Sang and Lo, Martin W.'), { names: [{ family: 'Koon', given: 'Wang Sang' }, { family: 'Lo', given: 'Martin W.' }], others: false });
  assert.deepEqual(namesOf('Wang Sang Koon and J. E. Marsden and others'), { names: [{ family: 'Koon', given: 'Wang Sang' }, { family: 'Marsden', given: 'J. E.' }], others: true });
  assert.deepEqual(families('Ludwig van Beethoven and de la Vall{\\\'e}e Poussin, Charles and Charles Louis Xavier Joseph de la Vall{\\\'e}e Poussin'), ['van Beethoven', 'de la Vallée Poussin', 'de la Vallée Poussin']);
  assert.deepEqual(families("G{\\'o}mez, Gerard and Jorba, {\\`A}ngel and Barrow-Green, June"), ['Gómez', 'Jorba', 'Barrow-Green']);
  assert.deepEqual(namesOf('King, Jr., Martin Luther').names, [{ family: 'King', given: 'Martin Luther' }]);
  assert.deepEqual(families('{Jet Propulsion Laboratory} and {Simon and Schuster}\n  AND Plato'), ['Jet Propulsion Laboratory', 'Simon and Schuster', 'Plato']);
  assert.deepEqual(namesOf(''), { names: [], others: false });
});

test('a reference shows one author, two authors with an ampersand, and the first of more with et al.', () => {
  const by = (author) => referenceOf(entry(`@article{k, author = {${author}}, journal = {Chaos}, volume = 10, year = 2000}`)).authors;
  assert.equal(by('Koon, Wang Sang'), 'Koon');
  assert.equal(by('Koon, Wang Sang and Lo, Martin W.'), 'Koon & Lo');
  assert.equal(by('Koon, Wang Sang and Lo, Martin W. and Marsden, Jerrold E.'), 'Koon et al.');
  assert.equal(by('Koon, Wang Sang and others'), 'Koon et al.');
  assert.equal(referenceOf(entry('@book{b, editor = {Szebehely, Victor}, publisher = {Reidel}, year = 1979}')).authors, 'Szebehely');
});

test('a reference is the authors, the venue, the volume, and the year in parentheses', () => {
  assert.deepEqual(referenceOf(entry(KOON)), {
    authors: 'Koon et al.',
    title: 'Heteroclinic connections between periodic orbits and resonance transitions in celestial mechanics',
    venue: 'Chaos',
    volume: '10',
    year: '2000',
    doi: '10.1063/1.166509',
  });
  assert.equal(shown(KOON), 'Koon et al., Chaos 10 (2000)');
  // the venue is the only part in italics
  assert.deepEqual(referenceParts(referenceOf(entry(KOON))), ['Koon et al., ', 'Chaos', ' 10 (2000)']);
  assert.equal(shown('@book{s, author = {Szebehely, Victor}, title = {Theory of Orbits}, publisher = {Academic Press}, year = 1967}'), 'Szebehely, Academic Press (1967)');
  assert.equal(shown('@phdthesis{r, author = {Ross, Shane D.}, title = {Cylindrical manifolds}, school = {California Institute of Technology}, year = 2004}'), 'Ross, California Institute of Technology (2004)');
  assert.equal(shown('@article{k, author = {Koon, W. S. and Lo, M. W.}, journal = {Chaos}, volume = 10}'), 'Koon & Lo, Chaos 10');
  assert.equal(shown('@article{k, author = {Koon, W. S.}, year = 2000, volume = 3}'), 'Koon (2000)');
  assert.equal(shown('@misc{k, title = {Horizons System}, year = 2024}'), 'Horizons System (2024)');
  assert.equal(shown('@misc{k, howpublished = {NASA Technical Report}, year = 1968}'), 'NASA Technical Report (1968)');
  assert.equal(shown('@misc{k}'), 'k');
});

test('the venue is the first of the journal, the title of the book, the publisher, the school, and how the entry was published', () => {
  const venue = (fields) => referenceOf(entry(`@misc{k, ${fields}}`)).venue;
  const all = 'howpublished = {a talk}, school = {a school}, publisher = {a publisher}, booktitle = {a book}, journal = {a journal}';
  assert.equal(venue(all), 'a journal');
  assert.equal(venue(all.replace(', journal = {a journal}', '')), 'a book');
  assert.equal(venue('howpublished = {a talk}, school = {a school}, publisher = {a publisher}'), 'a publisher');
  assert.equal(venue('howpublished = {a talk}, school = {a school}'), 'a school');
  assert.equal(venue('howpublished = {a talk}'), 'a talk');
  // the short name of a journal of biblatex comes before its name, and an eprint of arXiv is a venue
  assert.equal(venue('journal = {Celestial Mechanics and Dynamical Astronomy}, shortjournal = {Celest. Mech. Dyn. Astron.}'), 'Celest. Mech. Dyn. Astron.');
  assert.equal(venue('journaltitle = {Chaos}'), 'Chaos');
  assert.equal(venue('institution = {Jet Propulsion Laboratory}'), 'Jet Propulsion Laboratory');
  assert.equal(venue('eprint = {2301.01234}, archiveprefix = {arXiv}'), 'arXiv:2301.01234');
  assert.equal(venue('title = {Only a title}'), undefined);
});

test('the year is read from a date, and the link of a reference is its DOI or its URL', () => {
  const of = (fields) => referenceOf(entry(`@article{k, author = {Koon, W. S.}, journal = {Chaos}, ${fields}}`));
  assert.equal(of('date = {2000-06-01}').year, '2000');
  assert.equal(of('year = {2000}, date = {1999}').year, '2000');
  assert.equal(of('doi = {https://doi.org/10.1063/1.166509}').doi, '10.1063/1.166509');
  assert.equal(of('doi = {doi:10.1063/1.166509}').doi, '10.1063/1.166509');
  assert.equal(of('doi = {10.1007/s10569-004-0405-\\_2}').doi, '10.1007/s10569-004-0405-_2');
  assert.equal(of('url = {https://arxiv.org/abs/2301.01234}').url, 'https://arxiv.org/abs/2301.01234');
  assert.equal(of('url = {javascript:alert(1)}').url, undefined);
  assert.equal(of('year = 2000').doi, undefined);
});

test('an entry is found by its authors, its year, the words of its title, its venue, and its key, without the accents', () => {
  const koon = entry(KOON);
  for (const query of ['', 'koon', 'KOON 2000', 'marsden ross', 'hetero transit', 'chaos', 'koon2000', 'wang sang']) assert.ok(matches(koon, query), query);
  for (const query of ['gomez', 'koon 2001', 'heteroclinic orbits moon']) assert.ok(!matches(koon, query), query);
  const gomez = entry("@article{g, author = {G{\\'o}mez, Gerard and Sim{\\'o}, Carles}, title = {Connecting orbits and invariant manifolds in the spatial restricted three-body problem}, journal = {Nonlinearity}, year = 2004}");
  assert.ok(matches(gomez, 'gomez simo'));
  assert.ok(matches(gomez, 'Gómez'));
  assert.ok(matches(gomez, 'three-body nonlin'));
});
