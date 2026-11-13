// the citations of src/citations.ts and theme/beeson.css: the numbers of the citations of a slide,
// under node, and the citations and the references of test/pages/tex/index.html in Chrome, at each
// step, in both modes, above a footnote, after a citation is added, and in the print view

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckSettled, deckUrl, launch, printView } from '../scripts/chrome.mjs';
import { deckTex } from '../scripts/tex.mjs';
import { citedOf } from '../src/citations.ts';

const PAGE = 'test/pages/tex/index.html';

test('the citations of a slide are numbered from 1 in the order of their first citation', () => {
  const known = (key) => key !== 'lost';
  assert.deepEqual(citedOf([['a'], ['b'], ['a']], known), { labels: ['1', '2', '1'], missing: [false, false, false], keys: ['a', 'b'] });
  // two papers at one place are written in the order of their numbers
  assert.deepEqual(citedOf([['a'], ['b', 'a'], ['c', 'd']], known), { labels: ['1', '1,2', '3,4'], missing: [false, false, false], keys: ['a', 'b', 'c', 'd'] });
  // a key that is not in the bibliography is written in place of a number, and it is not counted
  assert.deepEqual(citedOf([['lost'], ['a', 'lost'], ['b']], known), { labels: ['lost', '1,lost', '2'], missing: [true, true, false], keys: ['a', 'b'] });
  assert.deepEqual(citedOf([['a', 'a'], []], known), { labels: ['1', ''], missing: [false, false], keys: ['a'] });
  assert.deepEqual(citedOf([], known), { labels: [], missing: [], keys: [] });
});

test('the tex.js of the deck holds the references of the cited entries, and the key without an entry is named', () => {
  const fresh = deckTex(PAGE);
  assert.deepEqual(Object.keys(fresh.tex.references), ['gomez2004', 'koon2000', 'szebehely1967']);
  assert.deepEqual(fresh.missing, ['lost1999']);
});

// the citations and the references of the slide root: the number of each citation, and each
// reference with its text, its link, and whether it is shown
const CITED = (root) => `((at) => {
  const refs = at.querySelector(':scope > .refs');
  return {
    labels: [...at.querySelectorAll('cite[data-key]')].map((cite) => cite.dataset.n ?? null),
    refs: [...(refs?.children ?? [])].map((ref) => ({
      text: ref.textContent,
      venue: ref.querySelector('em')?.textContent ?? '',
      link: ref.querySelector('a')?.getAttribute('href') ?? '',
      shown: getComputedStyle(ref).visibility === 'visible' && getComputedStyle(ref).opacity === '1',
    })),
  };
})(${root})`;

const KOON = { text: '1Koon et al., Chaos 10 (2000)', venue: 'Chaos', link: 'https://doi.org/10.1063/1.166509' };
const GOMEZ = { text: '2Gómez et al., Nonlinearity 17 (2004)', venue: 'Nonlinearity', link: 'https://doi.org/10.1088/0951-7715/17/5/002' };
const SZEBEHELY = { text: '3Szebehely, Academic Press (1967)', venue: 'Academic Press', link: '' };
// the citation in the notes is not numbered
const LABELS = ['1', '2', '1,2', '3', 'lost1999', null];
// at the start and after each of the two steps: a reference is shown with the step of its citation
const STEPS = [[true, false, false], [true, true, false], [true, true, true]].map((shown) => ({
  labels: LABELS,
  refs: [KOON, GOMEZ, SZEBEHELY].map((ref, k) => ({ ...ref, shown: shown[k] })),
}));

const slide = (title) => `[...document.querySelectorAll('.slides section')].find((s) => s.querySelector('h2').textContent === ${JSON.stringify(title)})`;
const settle = () => new Promise((done) => setTimeout(done, 600));

for (const mode of ['dark', 'light']) {
  test(`a citation is a number, and its reference is shown in the footnote line with its step, in the ${mode} mode`, { timeout: 60000 }, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.goto(deckUrl(PAGE, `theme=${mode}`));
    await page.waitFor(deckSettled);
    await page.evaluate(`Reveal.slide(Reveal.getIndices(${slide('Citations')}).h)`);
    const seen = [];
    for (let k = 0; k < STEPS.length; k++) {
      if (k) await page.evaluate('Reveal.next()');
      await settle();
      seen.push(await page.evaluate(CITED('Reveal.getCurrentSlide()')));
    }
    assert.deepEqual(seen, STEPS);
    // a step back hides the reference of its citation again
    await page.evaluate('Reveal.prev()');
    await settle();
    assert.deepEqual(await page.evaluate(CITED('Reveal.getCurrentSlide()')), STEPS[1]);

    const look = await page.evaluate(`(() => {
      const root = Reveal.getCurrentSlide(), cite = root.querySelector('cite'), lost = root.querySelector('cite[data-key="lost1999"]');
      const number = getComputedStyle(cite, '::after'), words = getComputedStyle(cite.parentElement), refs = root.querySelector(':scope > .refs');
      const probe = document.createElement('div');
      probe.className = 'foot';
      root.append(probe);
      const foot = getComputedStyle(probe);
      const out = {
        content: number.content,
        small: parseFloat(number.fontSize) < 0.6 * parseFloat(words.fontSize),
        raised: number.verticalAlign,
        upright: number.fontStyle,
        // the references are set as a footnote is, at its line, and the three of this slide are on two lines
        asFoot: ['color', 'fontSize', 'lineHeight', 'left', 'position'].every((name) => getComputedStyle(refs)[name] === foot[name]),
        bottom: getComputedStyle(refs).bottom,
        lines: Math.round(refs.offsetHeight / parseFloat(foot.lineHeight)),
        lost: { missing: lost.dataset.missing !== undefined, red: getComputedStyle(lost, '::after').color !== number.color },
        generated: refs.hasAttribute('data-generated'),
      };
      probe.remove();
      return out;
    })()`);
    assert.deepEqual(look, { content: '"1"', small: true, raised: 'super', upright: 'normal', asFoot: true, bottom: '50px', lines: 2, lost: { missing: true, red: true }, generated: true });
    assert.deepEqual(page.errors, []);
  });
}

test('the references of a slide with a footnote are under the footnote, and a slide without a citation does not have references', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(PAGE, 'still'));
  await page.waitFor(deckSettled);
  await page.evaluate(`Reveal.slide(Reveal.getIndices(${slide('Under a footnote')}).h)`);
  await settle();
  const seen = await page.evaluate(`(() => {
    const root = Reveal.getCurrentSlide(), refs = root.querySelector(':scope > .refs'), foot = root.querySelector('.foot');
    return {
      cited: ${CITED('root')},
      // in the px of the slide: the references end at the line of a footnote, 50 px above the edge
      refsBottom: refs.offsetTop + refs.offsetHeight,
      footBottom: foot.offsetTop + foot.offsetHeight,
      refsTop: refs.offsetTop,
      none: ${slide('Macros')}.querySelector('.refs') === null && ${slide('Theorems')}.querySelector('.refs') === null,
    };
  })()`);
  assert.deepEqual(seen.cited, { labels: ['1'], refs: [{ text: '1Gómez et al., Nonlinearity 17 (2004)', venue: 'Nonlinearity', link: GOMEZ.link, shown: true }] });
  assert.equal(seen.refsBottom, 1080 - 50);
  assert.equal(seen.footBottom, seen.refsTop);
  assert.ok(seen.none);
  assert.deepEqual(page.errors, []);
});

test('the citations are numbered again after one is added to a slide or taken off it', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(deckUrl(PAGE, 'still'));
  await page.waitFor(deckSettled);
  await page.evaluate(`Reveal.slide(Reveal.getIndices(${slide('Under a footnote')}).h)`);
  const added = await page.evaluate(`(() => {
    const root = Reveal.getCurrentSlide();
    root.querySelector('h2').insertAdjacentHTML('beforeend', '<cite data-key="koon2000"></cite>');
    Beeson.mount(root);
    return ${CITED('root')};
  })()`);
  assert.deepEqual(added.labels, ['1', '2']);
  assert.deepEqual(added.refs.map((ref) => ref.text), ['1Koon et al., Chaos 10 (2000)', '2Gómez et al., Nonlinearity 17 (2004)']);
  const gone = await page.evaluate(`(() => {
    const root = Reveal.getCurrentSlide(), foot = root.querySelector('.foot');
    for (const cite of root.querySelectorAll('cite')) cite.remove();
    Beeson.mount(root);
    return { refs: root.querySelector('.refs') === null, footBottom: foot.offsetTop + foot.offsetHeight };
  })()`);
  // without a citation, the footnote is at its line again
  assert.deepEqual(gone, { refs: true, footBottom: 1080 - 50 });
  assert.deepEqual(page.errors, []);
});

test('the print view shows the references of each step on its page', { timeout: 60000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await printView(page, deckUrl(PAGE, 'print-pdf&still'));
  const pages = await page.evaluate(`[...document.querySelectorAll('.pdf-page section')].filter((s) => s.querySelector('cite')).map((s) => ({ cited: ${CITED('s')}, foot: !!s.querySelector('.foot') }))`);
  // the last page of the slide is the step at which the theme restores the dimmed steps
  assert.deepEqual(pages.filter((p) => !p.foot).map((p) => p.cited), [...STEPS, STEPS[2]]);
  assert.deepEqual(pages.filter((p) => p.foot).map((p) => p.cited.refs.map((ref) => [ref.text, ref.shown])), [[['1Gómez et al., Nonlinearity 17 (2004)', true]]]);
  // on a page, the footnote is above the references as in the show
  const stacked = await page.evaluate(`(() => {
    const s = [...document.querySelectorAll('.pdf-page section')].find((s) => s.querySelector('.foot')), refs = s.querySelector(':scope > .refs'), foot = s.querySelector('.foot');
    return foot.offsetTop + foot.offsetHeight === refs.offsetTop && refs.offsetHeight > 0;
  })()`);
  assert.ok(stacked);
  assert.deepEqual(page.errors, []);
});
