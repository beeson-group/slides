# AGENTS.md

This repository is the slide template of the Beeson group. The reveal.js theme `beeson` is in `theme/`, and a demo deck with an example of every layout class is in `index.html`. The in-place editor of a deck, loaded with the URL parameter `edit`, is in `src/editor/` and compiled to `theme/editor.js`. The brand marks are in `brand/`, the matplotlib styles in `styles/`, and the maintainer tooling in `src/`, `scripts/`, and `.github/`. A talk made from the template is one `index.html` next to `theme/` and `brand/`.

## Vocabulary

- A slide is a `section` element, and its layout is set with a class. With `title` or `closing`, the slide is a plate with the backdrop behind a block of words at the lower left. With `section`, the words are at the left and the outline of the talk is under them. Without a class, the slide is a content slide with a text column of 1000 px at the left margin and a `zone` or a full-height `backdrop` at the right. Set the width of the column with `narrow` or `wide`. With `figure`, the slide is a plate with a `backdrop` or a `plate` figure, the head at the top, and the `caption` at the lower left. With `split`, the black `panel` is at the left and a `zone` at the right.
- A backdrop is the orbit drawing behind a slide, a `div.backdrop` with the attributes `data-scene`, `data-cx`, `data-cy`, and `data-half`, where `data-half` is the half height of the window in rotating-frame units. A drawing may run off the slide, but choose the window so that it is not cut at an edge of its box inside the slide. Optional `lab` spans are the labels of L1, L2, the Moon, and the Earth. On a content slide, the backdrop is drawn complete, and on a title, section, or closing slide, or with the attribute `data-live`, it is animated. The word is not background, and not scene, which is a 3D view exported from tycho (the Typed Celestial HTML Observer).
- A surface is the graph z = f(x, y) of a function of `src/surfaces.ts` over a rectangle, a `div.surface` with `data-function` and the parameters of the function. It is drawn with three.js under a camera that turns slowly and is turned by a drag. Its stage, i.e. what is drawn at a step, is set with `data-surface-stage` on a fragment of its slide, and its marks are labeled with `lab` spans with `data-at`.
- A step is the stage at which an element is shown, i.e. a reveal.js fragment: `class="fragment"` with a `data-fragment-index`. Design the complete slide first, then assign the steps. With `?edit`, the steps of a slide are set in the Steps pane, which writes the class and the index into the tags of the slide. The word is not build.
- A plot is an animated 2D figure in a `div.plot`, drawn as SVG from the inline JSON block named by its `data-plot`, with panels, marks, and tabs in the format given in the README. The word is not chart or graph.
- A plate is a layout with the backdrop or figure over the whole slide and the words in a block at the lower left.
- A block is an element whose text is edited in place with `?edit`: a heading, a paragraph, a list item, a cell, a caption, the `foot`, the `math` div, a `lab` span, or the notes. At a save, each edited block is written into its place in `index.html`, and every byte outside it is kept. A block that the editor cannot match to the file is skipped, counted in the state of its toolbar, and listed on the card of its button Which?. On a deck with a skipped block, `npm run check` fails. While a deck is edited, every backdrop is drawn complete, every step is shown, and the slides change without a transition. A figure, or a block together with its list or table, is moved by dragging, snapped to the edges and centers of the other elements and of the slide unless Alt is held. While Shift is held, the drag is locked to one axis. The offset is written as the declaration `translate` of the `style` of its tag, in slide pixels, and it is shown at the lower right of the frame while the element is moved. Esc leaves a text and selects its block, which the arrow keys nudge, and nudges less than a second apart are one entry of the history. Every change is in one history, undone with ⌘Z and redone with ⌘⇧Z. The unsaved edits are kept in the storage of the browser and offered on a card when the deck is opened again, and Open or Present with unsaved changes asks whether to save them first. With Notes on, every slide gets an empty `aside.notes` to type into, which is written only once it has text. A bold or an italic set with ⌘B or ⌘I is written as `strong` or `em`. In the deck, the key E opens the same slide with `edit`.
- The chrome is the running head (`run`, filled automatically from the last section slide), the slide number at the bottom right, the footnote line (`foot`) at the bottom left, and the 3 px progress line. A title bar, a rule under a title, bullets, cards, all-caps labels, and eyebrows are not part of the theme. A list item is marked with a short orange dash.

## Writing a slide

- Use one `h2` per slide, and an `h1` on a title slide. Keep the text column under 66 characters per line, and prefer one paragraph and a few list items to many items.
- Give an image for each mode with `for-dark` and `for-light`, a white raster figure the class `paper`, and a black-on-white line plot the class `invert`.
- Write math in MathJax delimiters, `\(` `\)` inline and `\[` `\]` display, inside a `div.math` for a display, and put shared macros into `theme/macros.js`.
- Reveal a display in four steps: the lead-in sentence, the display, the sentence in which it is explained, and a step in which a symbol is colored. Mark the symbol with `\class{name}{...}`, and give the later fragment `data-highlight="name"`, so that the class is colored orange once the fragment is shown, or violet with `data-tone="violet"`. Give the display `data-keep` to hold it at full opacity through the next step, or `data-keep="N"` to hold it through the step of index N.
- Put a plot in a `zone` or a `plate`, with its JSON block next to it. Reveal its panels and marks with `data-plot-show` and switch its tab with `data-plot-tab`, both on fragments of its slide.
- Put speaker notes in an `aside.notes`.
- Put a surface where a backdrop would go, and load `theme/vendor/three/three.js` before `theme/beeson.js`.
- Put a video in a `zone` or a `plate`, with a `poster` and an MP4 source, and add `data-autoplay` to play it while its slide is shown.
- To glide an element between two slides, give both slides `data-auto-animate`, and give the element the same `data-id` on each.
- Embed a tycho scene with the element from `build_embed` of pytycho, as in `demo/tycho-scene.py`, and vendor the runtime once in `theme/vendor/tycho/`.

## Commands

```sh
npm ci && npm run vendor && npm run build   # dependencies, vendored files, theme/beeson.js and theme/editor.js
npm run typecheck && npm test               # types, then the orbit engine, the surfaces, the build, the vendor script, the browser lookup, the mode flip, the crop of the backdrops, the print view, the PowerPoint file, the plots, the stepped math, and the editor under node --test
npm run check                               # screenshots of every slide in both modes, console errors, problems in the page, a poster on every video, the phone layout, a pixel ratio of 1.25, the editor on the deck
npm run check -- --browser firefox          # the same in Firefox or Safari over WebDriver, without the console, the phone layout, and the pixel ratio
npm run pdf                                 # slides.pdf, one page per step, with a page count check
npm run pptx                                # slides.pptx, one click per step, with videos and speaker notes
```

## Conventions

- The compiled `theme/beeson.js` and `theme/editor.js` are committed, since a talk must be usable without a toolchain. Rebuild them after every change under `src/`. Nothing of the editor is loaded without `?edit`, and it does not fetch anything either.
- Everything loaded in a deck is vendored under `theme/vendor/` with its license, and nothing is fetched from the network at show time.
- The orbit engine is a port of `orbits.ts` of claudiovestini.com (MIT). Do not derive anything in this repository from DyLAN code.
- The Princeton marks and the group logo in `brand/` are outside the MIT license, see `brand/NOTICE.md`.
- Colors are the custom properties in `theme/beeson.css`: `--bg`, `--text`, `--subtle`, `--muted`, `--line`, `--accent`, `--violet`, and `--data-1` to `--data-8`. The typeface is STIX Two Text at 22, 28, 36, 48, 64, and 96 px on the 1920 by 1080 design size. Body text is 48 px, i.e. the 24 points asked for by the AIAA on a slide 7.5 in high, and captions, tables, and code are 36 px. Orange is used for motion and progress, and violet for structure.
- Write a talk over the demo deck in `index.html`, and do not copy `theme/` or `brand/` into another folder, since `index.html` is the default deck of `npm run check`, `npm run pdf`, and `npm run pptx`.
- Read a PowerPoint file from its XML, and do not script PowerPoint, Keynote, or any other desktop app.

## Skills

When someone asks to tighten, shorten, clean up, polish, fix, or review existing slides, follow `.claude/skills/refine-slides/SKILL.md`.
