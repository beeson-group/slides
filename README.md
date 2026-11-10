# slides

The template is in beta, at version 0.9.0-beta.1. The names of its classes and data attributes may still change before version 1.0.

This repository is the HTML slide template of the Beeson group, built on reveal.js with the theme `beeson`. A talk is one `index.html`, which you open with a double click, without a server or a toolchain. The same file is exported to a PDF with one page per step and to PowerPoint with one click per step. Behind the slides are orbits of the circular restricted three-body problem, computed in the browser.

The demo deck in `index.html` shows every layout and element of the theme, and it is published at [beeson-group.github.io/slides](https://beeson-group.github.io/slides/).

## Start a talk

1. Press "Use this template" on GitHub, and write the talk over the demo deck in `index.html`.
2. Set the layout of each slide with a class on its `section`, as in the table below.
3. Once a slide is complete, give each element its step, i.e. `class="fragment"` with a `data-fragment-index`.
4. Run `npm ci`, then `npm run pdf` for `slides.pdf` and `npm run pptx` for `slides.pptx`.

| Class | Layout |
|---|---|
| `title`, `closing` | A plate with the backdrop behind a block of words at the lower left |
| `section` | The words at the left, the outline of the talk under them, and the backdrop at the right |
| no class | A text column of 1000 px at the left, and a figure or a backdrop at the right |
| `figure` | A plate with a figure, the heading at the top, and the caption at the lower left |
| `split` | The black panel at the left, and a figure at the right |

During a talk, press `d` to flip between the dark and the light mode, `s` for the speaker view, `p` for the pointer, `f` to enter or leave full screen, and Esc for the overview. To fix the light mode for a venue, add `?theme=light` to the address. Full screen hides the tabs and the address bar. When you make the window full screen from the system, e.g. with the green button in Safari on macOS, the deck is put into full screen at your next key or click. Browsers let a page enter full screen only on a key or a click.

Title, section, and closing slides are not numbered, and the slides after the closing slide are the appendix, numbered A1, A2, and so on. To leave another slide out of the count, give it `data-visibility="uncounted"`. A slide out of the count is also left out of the pacing of the speaker view and out of the scrubber.

Move the mouse near the bottom edge of the window to magnify the progress line into a scrubber, which stays open while the mouse is over it. In the scrubber, each numbered slide has a tick with its number, and with the time at which it starts when the deck sets `totalTime` or `defaultTiming` in `Beeson.start`. The times are counted as for the pacing of the speaker view, with the seconds of a slide in its `data-timing`. Rest the mouse over a tick to see the title of its slide, and click to jump to the first step of this slide. A key closes the scrubber, and away from the bottom the progress line is drawn as before.

## Edit in the browser

To edit a deck on the slides themselves, press `e` in the deck, or add `?edit` to its address. You can change the words, the formulas, the notes, the steps, and the places of the figures, and only your edits are written into `index.html` at a save. In Chrome and Edge, the edits are saved into the file itself, and in Firefox and Safari, a save is a download of a copy of the file. Set Safari or Firefox to ask where to save each download, and you replace `index.html` with the copy in the dialog of the save. You can also add, duplicate, delete, hide, and reorder slides, change their layout, and insert text boxes, formulas, tables, images, videos, QR codes, code boxes, footnotes, lines, and arrows, as described in [REFERENCE.md](REFERENCE.md) under The editor.

## Elements

The backdrops, surfaces, plots, figures, videos, QR codes, stepped math, and code boxes are described in [REFERENCE.md](REFERENCE.md), together with the formats of their files and the limits of each browser. The vocabulary and the conventions of the theme are written in `AGENTS.md`, for Claude Code and Codex. Ask either of them to tighten or review the slides, and the skill `refine-slides` in `.claude/skills/` is then followed.

## Maintain the theme

The theme is maintained with Node 22 or later, on macOS, Linux, or Windows.

```sh
npm ci && npm run vendor && npm run build   # dependencies, vendored files, theme/beeson.js and theme/editor.js
npm run typecheck && npm test               # types and unit tests
npm run check                               # every slide in both modes, with screenshots and console errors
```

The compiled `theme/beeson.js` and `theme/editor.js` are committed, hence none of these commands is needed for a talk. The same commands are run on Ubuntu and Windows at every push, and the deck is checked in Chrome and Safari on macOS.

## License

The code and the theme are under the MIT license. The Princeton marks and the group logo in `brand/` are trademarks and are outside this license, see `brand/NOTICE.md`.
