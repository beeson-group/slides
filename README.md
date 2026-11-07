# slides

This repository is an HTML slide template for the talks of the Beeson group, built on reveal.js 6 with the theme `beeson`. A deck is one `index.html`, and you open it with a double click, without a server or a toolchain. The same file is exported to a PDF with one page per step and published as a GitHub Pages site. The theme is black by default, and you switch to a warm paper light mode with the key `d`. Behind the slides are orbits of the circular restricted three-body problem, computed with a small engine ported from Claudio Vestini's website.

The demo deck, `index.html`, is also the documentation of every layout class. Open it, and press `s` for the speaker view.

## Start a talk

1. Press "Use this template" on GitHub, or copy the folders `theme/` and `brand/` next to a new `index.html`.
2. Write the slides in `index.html` as `section` elements, one per slide, with the layout classes listed in the demo and in `AGENTS.md`. Link the theme, the vendored fonts, and MathJax in the head of the file, and call `Beeson.start({})` with the options of reveal.js in the foot.
3. Give each element its step once the slide is complete: `class="fragment"` with a `data-fragment-index`. During the talk, a new element is faded in, and the earlier ones are dimmed to 45 percent. All of them are restored to full opacity once the slide is complete.
4. Export the PDF with `npm run pdf` after `npm ci`, or open `index.html?print-pdf` in Chrome and print to PDF. The PDF is printed with one page per step.

The mode is kept per browser in local storage. To fix it for a venue, add the URL parameter `?theme=light`. To draw every backdrop complete at once for a screenshot, add `?still`.

## Backdrops

Set the drawing of a `backdrop` with its attribute `data-scene`. Each drawing is computed in the browser by the code in `src/scenes.ts`, and the demo deck shows most of them.

| Name | Drawing |
|---|---|
| `nest` | The Lyapunov families of L1 and L2 with the distant retrograde orbits about the Moon |
| `dro` | The distant retrograde family |
| `mark` | One distant retrograde orbit |
| `l1`, `l2` | The Lyapunov family of one libration point |
| `lyapunovs` | The Lyapunov families of L1 and L2 |
| `halo` | The L2 halo family continued to a near rectilinear orbit |
| `rosette` | A family of 7:2 resonant orbits |
| `hill` | Zero-velocity curves of the Jacobi constant |
| `tubes` | The stable and unstable tubes of orbits at L1 and L2 |
| `lace` | The unstable tube of an L1 orbit and the stable tube of an L2 orbit about the Moon |
| `ribbon`, `wideRibbon` | The tubes of a small and a larger L1 orbit toward the Earth, after Amlan Sinha's figures in the group deck and in [Phantom Pathways](https://amlan-sinha.github.io/art-of-science/art-1/) |
| `spiral` | An illustrative low-thrust flight and a near rectilinear orbit in the inertial frame, after [Cosmic Choreography](https://amlan-sinha.github.io/art-of-science/art-2/) by Amlan Sinha |
| `transfer` | A low-energy transfer through L1 |
| `sheaf` | Lunar transfers from a low Earth orbit |
| `torus` | Quasi-periodic strands about distant retrograde orbits |

## Figures

For a figure made with matplotlib, use the styles `beeson-dark.mplstyle` and `beeson-light.mplstyle` in `styles/`. The palette, the typeface, and a transparent background are set in these styles. Export one file per mode and mark the images `for-dark` and `for-light`, so that the right one is shown in each mode. Give a white raster figure the class `paper`, and it is framed. Give a black-on-white line plot the class `invert`, and it is inverted in dark mode.

Math is typeset in SVG with MathJax 4 and the STIX Two Math font, both vendored. The macros of a deck are defined in `theme/macros.js`.

To embed a scene of tycho, the Typed Celestial HTML Observer, call `build_embed` of pytycho, the Python package of tycho, and paste the inline `tycho-viewer` element into a slide. The scene and its data are in two inline blocks of this element. The runtime is vendored once in `theme/vendor/tycho/`, copied by hand from a build of pytycho, since tycho is not on npm. The viewer is set to the mode of the deck, the scene is played only while its slide is shown, and the keys used in the viewer are not passed to the deck. Pass `kiosk=True` for a viewer without controls. Run `demo/tycho-scene.py` to write the viewer of the demo deck. This script is also the example to start from.

## Agent skills

The skill `refine-slides` is in `.claude/skills/`, and you do not have to install anything. Open Claude Code or Codex in a clone of this repository, and ask in plain words, e.g. "the slides are too wordy, tighten them up" or "go through the deck and fix whatever looks off". With this skill, an agent looks at every slide at its last step, and moves what it cuts into the speaker notes or into backup slides. In Claude Code the skill is read from this folder, and in Codex or any other agent it is reached through the pointer in `AGENTS.md`.

If you copied `theme/` and `brand/` by hand, copy `.claude/`, `AGENTS.md`, `scripts/`, and `package.json` as well. You can then run `npm run check` and `npm run pdf` without `npm ci`.

## Maintain the theme

The theme is maintained with npm and Node 22 or later, on macOS, Linux, or Windows. The commands are these.

```sh
npm ci                 # the dependencies
npm run vendor         # reveal.js, the notes plugin, the fonts, and MathJax into theme/vendor/ (tycho is copied by hand)
npm run build          # src/*.ts into theme/beeson.js with esbuild
npm run typecheck      # tsc --noEmit
npm test               # the orbit engine, the build, the vendor script, the Chrome lookup, the mode flip, and the crop of the backdrops under node --test
npm run check          # every slide of index.html in both modes, screenshots and console errors
npm run pdf            # index.html to slides.pdf, with a check of the page count
```

For `npm test`, `npm run check`, and `npm run pdf`, Chrome is looked up at its default location on macOS and Windows, and on the `PATH` on Linux. Edge is used on Windows when Chrome is missing. To use another browser build, set `CHROME_PATH` to its executable.

The compiled `theme/beeson.js` is committed, hence none of this is required for a talk. The same commands are run on Ubuntu, macOS, and Windows on every push with the workflow `.github/workflows/check.yml`, and the repository root is published on GitHub Pages with `pages.yml`.

## License

The code and the theme are under the MIT license. The Princeton marks and the group logo in `brand/` are trademarks and are outside this license, see `brand/NOTICE.md`.
