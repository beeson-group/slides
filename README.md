# slides

This repository is an HTML slide template for the talks of the Beeson group, built on reveal.js 6 with the theme `beeson`. A deck is one `index.html`, and you open it with a double click, without a server or a toolchain. The same file is exported to a PDF with one page per step and published as a GitHub Pages site. The theme is black by default, and you switch to a warm paper light mode with the key `d`. Behind the slides are orbits of the circular restricted three-body problem, computed with a small engine ported from Claudio Vestini's website.

The demo deck, `index.html`, is also the documentation of every layout class. Open it, and press `s` for the speaker view.

## Start a talk

1. Press "Use this template" on GitHub, or copy the folders `theme/` and `brand/` next to a new `index.html`.
2. Write the slides in `index.html` as `section` elements, one per slide, with the layout classes listed in the demo and in `AGENTS.md`. Link the theme, the vendored fonts, and MathJax in the head of the file, and call `Beeson.start({})` with the options of reveal.js in the foot.
3. Give each element its step once the slide is complete: `class="fragment"` with a `data-fragment-index`. During the talk, a new element is faded in, and the earlier ones are dimmed to 45 percent. All of them are restored to full opacity once the slide is complete.
4. Export the PDF with `npm run pdf` after `npm ci`, or open `index.html?print-pdf` in a browser on a computer and print to PDF. The PDF is printed with one page per step.

The mode is kept per browser in local storage. To fix it for a venue, add the URL parameter `?theme=light`. To draw every backdrop complete at once for a screenshot, add `?still`.

## Browsers

You can show a deck in the current Chrome, Edge, Firefox, and Safari, and in the browsers built on their engines, on a computer, a phone, or a tablet. This holds for both modes, the steps, the speaker view, and the viewer of tycho, whether you open the file with a double click or from a web server. All browsers on iOS are built on the engine of Safari. These are the limits.

- In Safari on a Mac, the paper size of the deck is ignored, and the PDF is printed on the paper chosen in the print dialog. Choose a paper of 16:9, or export with `npm run pdf`. The backdrops are also printed fainter than in the other browsers.
- On an iPhone, fullscreen is not available, since the fullscreen API is missing there.
- On a phone or a tablet, the speaker view is opened with the key `s`, hence you need a keyboard. A deck is opened from a web server, such as the site of the repository, since a double click on a file does not apply there. Printing is not tested.
- In every browser, the viewer of tycho is printed as an empty panel.
- In every browser, `\require{bbm}`, `\require{bboldx}`, and `\require{dsfont}` show the error "Extension failed to load", since the fonts of these three extensions of MathJax are not vendored.

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
npm test               # the orbit engine, the build, the vendor script, and the browser lookup under node --test
npm run check          # every slide of index.html in both modes, screenshots and console errors
npm run pdf            # index.html to slides.pdf, with a check of the page count
```

For `npm run check` and `npm run pdf`, Chrome is looked up at its default location on macOS and Windows, and on the `PATH` on Linux. Edge is used on Windows when Chrome is missing. To use another browser build, set `CHROME_PATH` to its executable.

To run the check in another engine, use `npm run check -- --browser firefox` or `npm run check -- --browser safari`. Firefox is driven with `geckodriver`, which is looked up in `GECKOWEBDRIVER` and on the `PATH`, and `FIREFOX_PATH` selects another Firefox build. Safari is driven with `safaridriver`, which you enable once with `safaridriver --enable`. The problems in the page are reported in all three browsers, but the console is read only in Chrome, and the phone layout and a pixel ratio of 1.25 are checked only in Chrome. On Linux, run Firefox under `xvfb-run`, since WebGL in software is available there only in a window.

The compiled `theme/beeson.js` is committed, hence none of this is required for a talk. The same commands are run on Ubuntu, macOS, and Windows on every push with the workflow `.github/workflows/check.yml`, the check is also run in Firefox on Ubuntu, and the repository root is published on GitHub Pages with `pages.yml`.

## License

The code and the theme are under the MIT license. The Princeton marks and the group logo in `brand/` are trademarks and are outside this license, see `brand/NOTICE.md`.
