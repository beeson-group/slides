# slides

An HTML slide template for the talks of the Beeson group, built on reveal.js 6 with a theme named `beeson`. A deck is one `index.html`, opened from a double click without a server or a toolchain. The same file is exported to a PDF with one page per step and published as a GitHub Pages site. The theme is black by default, with a warm paper light mode behind the key `d`, and the orbits of the circular restricted three-body problem are drawn behind the slides by a small engine ported from Claudio Vestini's website.

The demo deck, `index.html`, is also the documentation of every layout class. Open it, and press `s` for the speaker view.

## Start a talk

1. Press "Use this template" on GitHub, or copy the folders `theme/` and `brand/` next to a new `index.html`.
2. Write the slides in `index.html` as `section` elements, one per slide, with the layout classes listed in the demo and in `AGENTS.md`. In the head of the file, the theme, the vendored fonts, and MathJax are linked, and in the foot `Beeson.start({})` is called with the options of reveal.js.
3. Give each element its step once the slide is complete: `class="fragment"` with a `data-fragment-index`. A new element fades in, the earlier ones dim to 45 percent, and all return to full once the slide is complete.
4. Export the PDF with `npm run pdf` after `npm ci`, or open `index.html?print-pdf` in Chrome and print to PDF. The export prints one page per step.

The mode is kept per browser in local storage. The URL parameter `?theme=light` fixes it for a venue, and `?still` draws every backdrop complete at once, for a screenshot.

## Figures

Figures made with matplotlib take the styles in `styles/`, `beeson-dark.mplstyle` and `beeson-light.mplstyle`, which set the palette, the typeface, and a transparent background. Export one file per mode and mark the images `for-dark` and `for-light`, so that the mode switch shows the right one. Give a white raster figure the class `paper`, and it is framed. Give a black-on-white line plot the class `invert`, and it is inverted in dark mode.

Math is typeset by MathJax 4 in SVG with the STIX Two Math font, both vendored. Macros shared by a deck are defined in `theme/macros.js`.

A tycho scene is embedded as an inline `tycho-viewer` element, which pytycho's `build_embed` writes with the scene and its data as two inline blocks. The runtime is vendored once in `theme/vendor/tycho/`, copied by hand from a build of pytycho, since tycho is not on npm. The viewer takes the mode of the deck from the theme, plays only while its slide is shown, and keeps its keys from the deck. Pass `kiosk=True` for a viewer without controls. The viewer of the demo deck is written by `demo/tycho-scene.py`, which is also the example to start from.

## Maintain the theme

The theme is maintained with npm. The commands are these.

```sh
npm ci                 # the dependencies
npm run vendor         # reveal.js, the notes plugin, the fonts, and MathJax into theme/vendor/ (tycho is copied by hand)
npm run build          # src/*.ts into theme/beeson.js with esbuild
npm run typecheck      # tsc --noEmit
npm test               # the orbit engine under node --test
npm run check          # every slide of index.html in both modes, screenshots and console errors
npm run pdf            # index.html to slides.pdf, with a check of the page count
```

The compiled `theme/beeson.js` is committed, hence a talk needs none of this. The workflow in `.github/workflows/check.yml` runs the same commands on every push, and `pages.yml` publishes the repository root on GitHub Pages.

## License

The code and the theme are under the MIT license. The Princeton marks and the group logo in `brand/` are trademarks and are not covered by it, see `brand/NOTICE.md`.
