# AGENTS.md

This repository is the slide template of the Beeson group. The reveal.js theme `beeson` is in `theme/`, and a demo deck with an example of every layout class is in `index.html`. The brand marks are in `brand/`, the matplotlib styles in `styles/`, and the maintainer tooling in `src/`, `scripts/`, and `.github/`. A talk made from the template is one `index.html` next to `theme/` and `brand/`.

## Vocabulary

- A slide is a `section` element, and its layout is set with a class. With `title` or `closing`, the slide is a plate with the backdrop behind a block of words at the lower left. With `section`, the words are at the left and the outline of the talk is under them. Without a class, the slide is a content slide with a text column of 1000 px at the left margin and a `zone` or a full-height `backdrop` at the right. Set the width of the column with `narrow` or `wide`. With `figure`, the slide is a plate with a `backdrop` or a `plate` figure, the head at the top, and the `caption` at the lower left. With `split`, the black `panel` is at the left and a `zone` at the right.
- A backdrop is the orbit drawing behind a slide, a `div.backdrop` with the attributes `data-scene`, `data-cx`, `data-cy`, and `data-half`, where `data-half` is the half height of the window in rotating-frame units. A drawing may run off the slide, but choose the window so that it is not cut at an edge of its box inside the slide. Optional `lab` spans are the labels of L1, L2, the Moon, and the Earth. On a content slide, the backdrop is drawn complete, and on a title, section, or closing slide, or with the attribute `data-live`, it is animated. The word is not background, and not scene, which is a 3D view exported from tycho (the Typed Celestial HTML Observer).
- A surface is the graph z = f(x, y) of a function of `src/surfaces.ts` over a rectangle, a `div.surface` with `data-function` and the parameters of the function. It is drawn with three.js under a camera that turns slowly and is turned by a drag. Its stage, i.e. what is drawn at a step, is set with `data-surface-stage` on a fragment of its slide, and its marks are labeled with `lab` spans with `data-at`.
- A step is the stage at which an element is shown, i.e. a reveal.js fragment: `class="fragment"` with a `data-fragment-index`. Design the complete slide first, then assign the steps. The word is not build.
- A plate is a layout with the backdrop or figure over the whole slide and the words in a block at the lower left.
- The chrome is the running head (`run`, filled automatically from the last section slide), the slide number at the bottom right, the footnote line (`foot`) at the bottom left, and the 3 px progress line. A title bar, a rule under a title, bullets, cards, all-caps labels, and eyebrows are not part of the theme. A list item is marked with a short orange dash.

## Writing a slide

- Use one `h2` per slide, and an `h1` on a title slide. Keep the text column under 66 characters per line, and prefer one paragraph and a few list items to many items.
- Give an image for each mode with `for-dark` and `for-light`, a white raster figure the class `paper`, and a black-on-white line plot the class `invert`.
- Write math in MathJax delimiters, `\(` `\)` inline and `\[` `\]` display, inside a `div.math` for a display, and put shared macros into `theme/macros.js`.
- Put speaker notes in an `aside.notes`.
- Put a surface where a backdrop would go, and load `theme/vendor/three/three.js` before `theme/beeson.js`.
- Put a video in a `zone` or a `plate`, with a `poster` and an MP4 source, and add `data-autoplay` to play it while its slide is shown.
- To glide an element between two slides, give both slides `data-auto-animate`, and give the element the same `data-id` on each.
- Embed a tycho scene with the element from `build_embed` of pytycho, as in `demo/tycho-scene.py`, and vendor the runtime once in `theme/vendor/tycho/`.

## Commands

```sh
npm ci && npm run vendor && npm run build   # dependencies, vendored files, theme/beeson.js
npm run typecheck && npm test               # types, then the orbit engine, the surfaces, the build, the vendor script, the browser lookup, the mode flip, the crop of the backdrops, the print view, and the PowerPoint file under node --test
npm run check                               # screenshots of every slide in both modes, console errors, problems in the page, a poster on every video, the phone layout, a pixel ratio of 1.25
npm run check -- --browser firefox          # the same in Firefox or Safari over WebDriver, without the console, the phone layout, and the pixel ratio
npm run pdf                                 # slides.pdf, one page per step, with a page count check
npm run pptx                                # slides.pptx, one click per step, with videos and speaker notes
```

## Conventions

- The compiled `theme/beeson.js` is committed, since a talk must be usable without a toolchain. Rebuild it after every change under `src/`.
- Everything loaded in a deck is vendored under `theme/vendor/` with its license, and nothing is fetched from the network at show time.
- The orbit engine is a port of `orbits.ts` of claudiovestini.com (MIT). Do not derive anything in this repository from DyLAN code.
- The Princeton marks and the group logo in `brand/` are outside the MIT license, see `brand/NOTICE.md`.
- Colors are the custom properties in `theme/beeson.css`: `--bg`, `--text`, `--subtle`, `--muted`, `--line`, `--accent`, `--violet`, and `--data-1` to `--data-8`. The typeface is STIX Two Text at 22, 28, 36, 48, 64, and 96 px on the 1920 by 1080 design size. Body text is 48 px, i.e. the 24 points asked for by the AIAA on a slide 7.5 in high, and captions, tables, and code are 36 px. Orange is used for motion and progress, and violet for structure.
- Write a talk over the demo deck in `index.html`, and do not copy `theme/` or `brand/` into another folder, since `index.html` is the default deck of `npm run check`, `npm run pdf`, and `npm run pptx`.
- Read a PowerPoint file from its XML, and do not script PowerPoint, Keynote, or any other desktop app.

## Skills

When someone asks to tighten, shorten, clean up, polish, fix, or review existing slides, follow `.claude/skills/refine-slides/SKILL.md`.
