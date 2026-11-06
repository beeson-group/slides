# AGENTS.md

This repository is the slide template of the Beeson group. A reveal.js theme named `beeson` is in `theme/`, and a demo deck that documents every layout class is in `index.html`. The brand marks are in `brand/`, the matplotlib styles in `styles/`, and the maintainer tooling in `src/`, `scripts/`, and `.github/`. A talk made from the template is one `index.html` next to `theme/` and `brand/`.

## Vocabulary

- A slide is a `section` element, and its layout is given by a class. With `title` or `closing`, the slide is a plate with the backdrop behind a block of words at the lower left. With `section`, the words are at the left and the outline of the talk is under them. Without a class, the slide is a content slide with a text column of 1000 px at the left margin and a `zone` or `backdrop` at the right, and `narrow` or `wide` changes the width of the column. With `figure`, the slide is a plate with a `backdrop` or a `plate` figure, the head at the top, and the `caption` at the lower left. With `split`, the black `panel` is at the left and a `zone` at the right.
- A backdrop is the orbit drawing behind a slide, a `div.backdrop` with the attributes `data-scene`, `data-cx`, `data-cy`, and `data-half`, where `data-half` is the half height of the window in rotating-frame units. Optional `lab` spans are the labels of L1, L2, the Moon, and the Earth. On a content slide, the backdrop is drawn complete, and on a title, section, or closing slide, or where it has `data-live`, it is animated. The word is not scene, which is tycho's exported 3D view, and not background.
- A step is the stage at which an element appears, i.e. reveal's fragment: `class="fragment"` with a `data-fragment-index`. Design the complete slide first, then assign the steps. The word is not build.
- A plate is a layout in which the backdrop or figure fills the slide and the words sit as a block at the lower left.
- The chrome is the running head (`run`, filled by the theme from the last section slide), the slide number at the bottom right, the footnote line (`foot`) at the bottom left, and the 3 px progress line. The theme does not have a title bar, a rule under a title, bullets, cards, all-caps labels, or eyebrows. A list item is marked by a short orange dash.

## Writing a slide

- One `h2` per slide, a title slide has an `h1`. Keep the text column under 66 characters per line, and prefer one paragraph and a few list items to many items.
- Give an image for each mode with `for-dark` and `for-light`, a white raster figure the class `paper`, and a black-on-white line plot the class `invert`.
- Write math in MathJax delimiters, `\(` `\)` inline and `\[` `\]` display, inside a `div.math` for a display, and put shared macros into `theme/macros.js`.
- Put speaker notes in an `aside.notes`.
- Two slides that share an element carry `data-auto-animate`, and the shared element the same `data-id`. The element then glides between the two slides.
- Embed a tycho scene with the element written by pytycho's `build_embed`, as in `demo/tycho-scene.py`, and vendor the runtime once in `theme/vendor/tycho/`.

## Commands

```sh
npm ci && npm run vendor && npm run build   # dependencies, vendored files, theme/beeson.js
npm run typecheck && npm test               # types, and the orbit engine under node --test
npm run check                               # screenshots of every slide in both modes, console errors
npm run pdf                                 # slides.pdf, one page per step, with a page count check
```

## Conventions

- The compiled `theme/beeson.js` is committed, since a talk must open without a toolchain. Rebuild it after every change under `src/`.
- Everything a deck loads is vendored under `theme/vendor/` with its license, and nothing is fetched from the network at show time.
- The orbit engine is a port of `orbits.ts` of claudiovestini.com (MIT). Nothing in this repository may derive from DyLAN code.
- The Princeton marks and the group logo in `brand/` are outside the MIT license, see `brand/NOTICE.md`.
- Colors are the custom properties in `theme/beeson.css`: `--bg`, `--text`, `--subtle`, `--muted`, `--line`, `--accent`, `--violet`, and `--data-1` to `--data-8`. The typeface is STIX Two Text at 22, 28, 36, 48, 64, and 96 px on the 1920 by 1080 design size. Orange marks motion and progress, and violet marks structure.
