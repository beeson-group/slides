# slides

This repository is an HTML slide template for the talks of the Beeson group, built on reveal.js 6 with the theme `beeson`. A deck is one `index.html`, and you open it with a double click, without a server or a toolchain. The same file is exported to a PDF with one page per step, exported to PowerPoint with one click per step, and published as a GitHub Pages site. The theme is black by default, and you switch to a warm paper light mode with the key `d`. Behind the slides are orbits of the circular restricted three-body problem, computed with a small engine ported from Claudio Vestini's website.

The demo deck, `index.html`, is also the documentation of every layout class. Open it, and press `s` for the speaker view.

## Start a talk

1. Press "Use this template" on GitHub, or copy the folders `theme/` and `brand/` next to a new `index.html`.
2. Write the slides in `index.html` as `section` elements, one per slide, with the layout classes listed in the demo and in `AGENTS.md`. Link the theme, the vendored fonts, and MathJax in the head of the file, and call `Beeson.start({})` with the options of reveal.js in the foot.
3. Give each element its step once the slide is complete: `class="fragment"` with a `data-fragment-index`. During the talk, a new element is faded in, and the earlier ones are dimmed to 45 percent. All of them are restored to full opacity once the slide is complete.
4. Export the PDF with `npm run pdf` after `npm ci`, or open `index.html?print-pdf` in a browser on a computer and print to PDF. The PDF is printed with one page per step.

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
| a file in `data-strands` | The polylines of a file next to the deck, described below |

A backdrop can also be drawn from a file of polylines, e.g. the members of families computed elsewhere. Name the file in `data-strands` in place of `data-scene`, with its path relative to the deck. The demo deck draws `demo/broucke-sample.js`, a few members of Broucke's families 7 and 11 of the elliptic restricted three-body problem, which is also the example to start from.

The file is a JSON object with a list `families` of records and an optional list `bodies`. Each record is an object with a list `points` of `[x, y]` pairs, and optionally with a list `t` or `theta` of the time or the true anomaly at each point. The strand of a record is traced on this clock, or at a uniform speed along its length without one. The other keys of a record are free, e.g. `family`, `branch`, `frame`, and `e` in the sample, and you select and color the records by them. Each entry of `bodies` has the positions of the primary and the secondary as `m1` and `m2` in an object per frame, and the mass ratio as `mu`, e.g. `{"family": 7, "mu": 0.012155, "pulsating": {"m1": [-0.01215, 0], "m2": [0.98784, 0]}}`. A body entry is matched to every record with the same values for the numbers and strings of the entry. A body is drawn as a dot only where it is fixed in the frame of the drawn records, hence the primary and the secondary are left out of the inertial frame.

A deck opened with a double click cannot read a JSON file, since the browser refuses the request. Wrap the JSON in `Beeson.strands(` and `);`, and name the `.js` file in `data-strands`. A plain JSON file can be named only in a deck served from a web server. With a missing or malformed file, the backdrop is left empty, and one warning is printed in the console.

- With `data-strands-select`, you choose the records to draw, e.g. `family=7,frame=pulsating`. A term is `key=value`, `key=a|b` for either value, or `key<number`, `key<=number`, `key>number`, or `key>=number`. The terms of a group are separated by commas, and a record is drawn when it passes every term of one of the groups, which are separated by semicolons.
- With `data-strands-color`, you give each value of a key, e.g. `family`, a pair of colors of the palette, in the order of the first record of each value in the file. The palette is the eight colors `--strand-1` to `--strand-8` in `theme/beeson.css`, defined for each mode, and the pairs are `--strand-1` with `--strand-2`, `--strand-3` with `--strand-4`, and so on.
- With `data-strands-ramp`, you color each strand from the first color of its pair at the smallest value of a key, e.g. `e`, among the drawn records of the pair, to the second color at the largest.
- With `data-heads`, you set the size of the moving heads to `full`, `small`, or `none`. A backdrop of a file is drawn without heads by default, and a named drawing with full heads.

Without `data-half`, the window of a backdrop of a file is fitted to its drawing with the fill of `tubes` on the closing slide. In the window, 93 percent of the drawing is held, measured along each strand with every strand counted alike. The drawing is also kept 40 px clear of each side of the box that is inside the slide.

## Browsers

You can show a deck in the current Chrome, Edge, Firefox, and Safari, and in the browsers built on their engines, on a computer, a phone, or a tablet. This holds for both modes, the steps, the speaker view, and the viewer of tycho, whether you open the file with a double click or from a web server. All browsers on iOS are built on the engine of Safari. These are the limits.

- In Safari on a Mac, the paper size of the deck is ignored, and the PDF is printed on the paper chosen in the print dialog. Choose a paper of 16:9, or export with `npm run pdf`. The backdrops are also printed fainter than in the other browsers.
- On an iPhone, fullscreen is not available, since the fullscreen API is missing there.
- On a phone or a tablet, the speaker view is opened with the key `s`, hence you need a keyboard. A deck is opened from a web server, such as the site of the repository, since a double click on a file does not apply there. Printing is not tested.
- In every browser, `\require{bbm}`, `\require{bboldx}`, and `\require{dsfont}` show the error "Extension failed to load", since the fonts of these three extensions of MathJax are not vendored.

## PowerPoint

At some conferences, a speaker is given a laptop that shows only PowerPoint and PDF files. For such a room, run `npm run pptx`, which writes `slides.pptx` next to `slides.pdf`. Each step of the deck is a full-slide image, and a click in PowerPoint is a step of the deck. The text cannot be edited in this file, and the backdrops are static.

Each video is placed over its image as a PowerPoint video, and it is started when its step is shown. The steps with a video are placed on one PowerPoint slide, hence the video goes on playing through them. PowerPoint needs an MP4 file, and the export fails on a video without one. The speaker notes are copied to the PowerPoint notes. Keynote opens a `.pptx`, hence a separate Keynote export is not needed.

## Figures

For a figure made with matplotlib, use the styles `beeson-dark.mplstyle` and `beeson-light.mplstyle` in `styles/`. The palette, the typeface, and a transparent background are set in these styles. Export one file per mode and mark the images `for-dark` and `for-light`, so that the right one is shown in each mode. Give a white raster figure the class `paper`, and it is framed. Give a black-on-white line plot the class `invert`, and it is inverted in dark mode.

Math is typeset in SVG with MathJax 4 and the STIX Two Math font, both vendored. The macros of a deck are defined in `theme/macros.js`.

To show a video, put it in a `zone` or a `plate`, and add `data-autoplay` to play it while its slide is shown. Give every video a `poster`, since the poster is printed in the PDF and `npm run check` fails without one. Run `demo/clip.py` to redraw the clip of the demo deck, which is also the example to start from.

To embed a scene of tycho, the Typed Celestial HTML Observer, call `build_embed` of pytycho, the Python package of tycho, and paste the inline `tycho-viewer` element into a slide. The scene and its data are in two inline blocks of this element. The runtime is vendored once in `theme/vendor/tycho/`, copied by hand from a build of pytycho, since tycho is not on npm. The viewer is set to the mode of the deck, the scene is played only while its slide is shown, and the keys used in the viewer are not passed to the deck. In a PDF and in PowerPoint, the viewer is replaced by a still of the scene. Pass `kiosk=True` for a viewer without controls. Run `demo/tycho-scene.py` to write the viewer of the demo deck. This script is also the example to start from.

## Agent skills

The skill `refine-slides` is in `.claude/skills/`, and you do not have to install anything. Open Claude Code or Codex in a clone of this repository, and ask in plain words, e.g. "the slides are too wordy, tighten them up" or "go through the deck and fix whatever looks off". With this skill, an agent looks at every slide at its last step, and moves what it cuts into the speaker notes or into backup slides. In Claude Code the skill is read from this folder, and in Codex or any other agent it is reached through the pointer in `AGENTS.md`.

If you copied `theme/` and `brand/` by hand, copy `.claude/`, `AGENTS.md`, `scripts/`, and `package.json` as well. You can then run `npm run check`, `npm run pdf`, and `npm run pptx` without `npm ci`.

## Maintain the theme

The theme is maintained with npm and Node 22 or later, on macOS, Linux, or Windows. The commands are these.

```sh
npm ci                 # the dependencies
npm run vendor         # reveal.js, the notes plugin, the fonts, and MathJax into theme/vendor/ (tycho is copied by hand)
npm run build          # src/*.ts into theme/beeson.js with esbuild
npm run typecheck      # tsc --noEmit
npm test               # the orbit engine, the backdrops from files, the build, the vendor script, the browser lookup, the mode flip, the crop of the backdrops, the print view, and the PowerPoint file under node --test
npm run check          # every slide of index.html in both modes, screenshots, console errors, and a poster on every video
npm run pdf            # index.html to slides.pdf, with a check of the page count
npm run pptx           # index.html to slides.pptx, with one click per step
```

For `npm test`, `npm run check`, `npm run pdf`, and `npm run pptx`, Chrome is looked up at its default location on macOS and Windows, and on the `PATH` on Linux. Edge is used on Windows when Chrome is missing. To use another browser build, set `CHROME_PATH` to its executable.

To run the check in another engine, use `npm run check -- --browser firefox` or `npm run check -- --browser safari`. Firefox is driven with `geckodriver`, which is looked up in `GECKOWEBDRIVER` and on the `PATH`, and `FIREFOX_PATH` selects another Firefox build. Safari is driven with `safaridriver`, which you enable once with `sudo safaridriver --enable`. Quit Safari before a run, since a session cannot be started in a Safari that is already open. A page from `file://` is refused under automation, hence the deck is served from a local port in Safari, and a double click is not covered by this check. The problems in the page are reported in all three browsers, but the console is read only in Chrome, and the phone layout and a pixel ratio of 1.25 are checked only in Chrome. On Linux, run Firefox under `xvfb-run`, since WebGL in software is available there only in a window.

The compiled `theme/beeson.js` is committed, hence none of this is required for a talk. The same commands are run on Ubuntu, macOS, and Windows on every push with the workflow `.github/workflows/check.yml`. The check is also run in Firefox on Ubuntu and in Safari on macOS. The repository root is published on GitHub Pages with `pages.yml`.

## License

The code and the theme are under the MIT license. The Princeton marks and the group logo in `brand/` are trademarks and are outside this license, see `brand/NOTICE.md`.
