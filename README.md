# slides

This repository is an HTML slide template for the talks of the Beeson group, built on reveal.js 6 with the theme `beeson`. A deck is one `index.html`, and you open it with a double click, without a server or a toolchain. The same file is exported to a PDF with one page per step, exported to PowerPoint with one click per step, and published as a GitHub Pages site. The theme is black by default, and you switch to a warm paper light mode with the key `d`. Behind the slides are orbits of the circular restricted three-body problem, computed with a small engine ported from Claudio Vestini's website.

The demo deck, `index.html`, is also the documentation of every layout class. Open it, and press `s` for the speaker view.

## Start a talk

1. Press "Use this template" on GitHub, or copy the folders `theme/` and `brand/` next to a new `index.html`.
2. Write the slides in `index.html` as `section` elements, one per slide, with the layout classes listed in the demo and in `AGENTS.md`. Link the theme, the vendored fonts, and MathJax in the head of the file, and call `Beeson.start({})` with the options of reveal.js in the foot.
3. Give each element its step once the slide is complete: `class="fragment"` with a `data-fragment-index`. During the talk, a new element is faded in, and the earlier ones are dimmed to 45 percent. All of them are restored to full opacity once the slide is complete.
4. Export the PDF with `npm run pdf` after `npm ci`, or open `index.html?print-pdf` in a browser on a computer and print to PDF. The PDF is printed with one page per step.

The mode is kept per browser in local storage. To fix it for a venue, add the URL parameter `?theme=light`. To draw every backdrop complete at once for a screenshot, add `?still`.

## Edit the text in the browser

You can change the words, the formulas, the speaker notes, the steps, and the places of the figures of a deck on the slides themselves, without opening `index.html` in a text editor. The editor is loaded only when the address of the deck carries the parameter `?edit`, and a deck without it does not load any of it. The page is laid out like the normal view of PowerPoint: a toolbar at the top with the name of the file, its state, and the buttons Undo, Redo, Open, Save, Save as, Autosave, and Present, the list of the slides at the left, the slide in the middle, a pane for the notes under it, a pane for the steps at the right, and a status bar at the bottom with the slide number and the buttons Slides, Steps, and Notes.

1. Open `index.html` in a browser, with a double click or from a web server, and press E, which opens the same slide in the editor, or add `?edit` to the end of the address, e.g. `file:///Users/you/talk/index.html?edit`. When the address ends in a slide such as `#/3`, put `?edit` before the `#`.
2. After a double click, a card asks you to choose the file of the deck, since a file on your disk is not readable by a page until you choose it. Choose the same `index.html`, whose folder is named on the card. From a web server, the file is read by the editor itself, and the card is not shown.
3. Click any text and type. Enter starts a new line in the same block, a paste is inserted as plain text, and the arrow keys move within the text. Press Cmd+B or Cmd+I on a Mac, and Ctrl+B or Ctrl+I elsewhere, to make the selected words bold or italic, which are written as `<strong>` and `<em>`, and press the same keys again to take the format off. Press Esc to leave the text. The block is then selected, as a text box in PowerPoint, the arrow keys nudge it, and a second Esc deselects it, after which the arrow keys and the buttons in the status bar move between the slides again. The keys of reveal.js for the overview, the black screen, fullscreen, and the speaker view are off in the editor. Every step of a slide is shown at once, and the backdrops are drawn still while you edit. A text that runs past the edge of the slide is outlined in orange, and the state in the toolbar counts such texts.
4. Press Cmd+Z on a Mac and Ctrl+Z elsewhere to undo the last change, whether it is typing, a formula, a step, or a move, and Cmd+Shift+Z or Ctrl+Y to redo it. The Undo and Redo buttons in the toolbar do the same. An undo shows the slide of the change and puts the caret where the text changed, and once you have undone every change, the deck is marked as saved again.
5. Move between the slides with the arrow keys, the buttons in the status bar, or a click in the list at the left, which names each slide with its title and its layout. Rest the pointer on a row to see a small copy of its slide beside the list, with every step shown. A backdrop is drawn in the copy once its slide has been shown. Press G and type the number of a slide to jump to it. The Slides button hides the list, and the choice is kept between visits.
6. Click a formula, or reach it with Tab and press Enter, to open its TeX in a field under it, with its rendering under the TeX as you type. Apply, or Cmd+Enter on a Mac and Ctrl+Enter elsewhere, typesets it again, and Esc leaves it as it was. A TeX with an error is refused with the message of MathJax, an empty TeX is refused as well, and the slide is not touched.
7. Press Notes to show the speaker notes of the slide in the pane under it, and type into them. On a slide without notes, you can type into the empty pane, and the notes are saved once they have text. Drag the strip above the pane, or focus it with Tab and press the up and down arrows, to change its height, which is kept between visits.
8. Press Steps to open the pane at the right, which lists the elements of the slide in reading order with the step at which each appears, as the animation pane of PowerPoint and the build order of Keynote. A formula is named in the list by its TeX. Choose the step of an element in its select, or choose Step 1, new, before the others to show it ahead of the other steps, which are each moved one step later. Press One by one to show the elements one after the other and All at once to show them with the slide. Elements with the same step appear together, and the number of the step is shown at the upper left of each stepped element on the slide. A heading and the footnote can be given a step too, and One by one leaves them with the slide. A step is written into the file as a reveal.js fragment, i.e. `class="fragment"` with a `data-fragment-index`.
9. Drag a figure to move it, and drag a paragraph, a list, a formula, or a table by the handle ⠿ at its upper left, since a click into the text edits it. While you drag, the element snaps to the edges and the centers of the other elements of the slide, of the slide itself, and of its own place, and an orange guide shows the line it is aligned with. Hold Alt to drag freely, and hold Shift to keep the drag on the axis along which you moved farther. The arrow keys nudge the selected element by one slide pixel, or by ten with Shift. Nudges less than a second apart are undone together with one Cmd+Z. While you move the element, its offset is shown in slide pixels at the lower right of its frame. A double click on the handle, or Enter on it, puts the element back. A figure is also reached with Tab, which selects it. The offset is written into the tag of the element as the style `translate`, in slide pixels, and nothing else in the layout of the slide is changed.
10. Press Save, or Cmd+S on a Mac and Ctrl+S elsewhere. In Chrome and Edge, each edit is written into its place in `index.html`, and every other byte of the file is kept, hence a diff of the file shows only your changes. From a web server, the first save asks where to write the file. Open with unsaved changes asks whether to save them first, to open a file without them, or to go on editing. Save as, or Cmd+Shift+S and Ctrl+Shift+S, writes the deck into another file, and the next saves go into it. Firefox, Safari, and the browsers built on them do not have the file pickers of Chrome, hence a save there puts a copy of `index.html` with your edits into your downloads, and you replace the original with it.
11. Press Autosave to save after each change, as the AutoSave switch of PowerPoint. The file is written 1.5 s after the last change, once it has been chosen, and the switch is kept between visits. In every browser, the unsaved edits are also kept in the storage of the browser, and when the tab is closed or the browser crashes before a save, a card offers them the next time the deck is opened: Restore and save writes them into the file and shows the page again, Download a copy puts the file with them into your downloads, and Discard forgets them.
12. Press Present to open the saved deck in a new tab, without the editor. With unsaved changes, a card asks whether to save them first, to present the saved file without them, or to go on editing.

The editor does not add, delete, or reorder slides, and it does not change the layout class of a slide or add a figure. For these, edit `index.html` in a text editor. A text on the page that cannot be found in the file, e.g. after a change to the file in another program while the editor is open, is skipped, and the state in the toolbar says how many texts are skipped. Press Which? next to the state to see the list of these texts, with their slides and the reasons.

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
| `transfer` | A low-energy transfer through an L2 Lyapunov orbit, with its manifolds drawn first and a head on the spacecraft alone |
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

## Surfaces

A `surface` is the graph of a function $z = f(x, y)$ over a rectangle, drawn in 3D with three.js under a camera that turns slowly and can be turned with a drag. Set the function with `data-function`, and its parameters with further data attributes. Each function is defined in `src/surfaces.ts` with its stages, i.e. what is drawn at each step of the slide. Give a fragment of the same slide the attribute `data-surface-stage`, and the surface is moved to this stage when the fragment is shown, and back when it is hidden. A change of stage is animated: the heights are morphed, the marks are raised into place, and a cutting plane is slid to its height. Label a mark with a `lab` span whose `data-at` is the name of the mark. In a deck with a surface, load `theme/vendor/three/three.js` before `theme/beeson.js`.

| Function | Attributes | Stages |
|---|---|---|
| `effective-potential` | `data-mu`, the mass ratio $\mu$ of the circular restricted three-body problem, 0.05 by default, and `data-C` on the fragment of the cut, the Jacobi constant $C$, that of L1 by default | `wells`, `bowl`, `sum`, `extrema` with L1 to L5 marked, and `cut` with the plane at $-C/2$ and the zero-velocity curve |

The camera is set with `data-azimuth` and `data-elevation` in degrees, `data-turn` in seconds per turn (0 for a still camera), and `data-zoom`, and the heights are scaled with `data-zscale`. With `?still`, a stage is drawn at once and the camera is not turned. In a PDF and in PowerPoint, each step is printed with a still of its stage.

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

## Stepped math

A display is revealed in four steps: the lead-in sentence, the display, the sentence in which it is explained, and a step in which a symbol of the display is colored. Mark the symbol in the TeX with `\class{name}{...}`, and give a later fragment the attribute `data-highlight="name"`. Once this fragment is shown, the symbols of the class are drawn in orange, or in violet with `data-tone="violet"`. Any element of the slide with the class `name` is colored as well, e.g. a `span` around the words that name the symbol. Use orange for motion and violet for structure, as in the rest of the theme, and separate several classes with spaces.

An earlier fragment is dimmed to 45 percent once a later one is shown. Give the display the attribute `data-keep` to hold it at full opacity through the next step, or `data-keep="4"` to hold it through the step of index 4. A display is also held at full opacity while a class in it is colored at the current step. The demo slide "Motion in the rotating frame" is an example of every step.

## Plots

A plot is an animated 2D figure, drawn as SVG from a block of JSON in the deck. Put a `div` with the class `plot` in a `zone`, or with the classes `plot plate` on a `figure` slide, and give it the id of the block in `data-plot`. Write the block next to it as `<script type="application/json" id="...">`. The block is inline, since fetching a file is blocked for a deck opened with a double click. Run `node demo/multipliers.mjs index.html` to write the plot of the demo deck, the Floquet multipliers of the Lyapunov families of L1 and L2, which is also the example to start from.

The plot is played in a loop while its slide is shown, and it is paused when the slide is left. Under the plot, a button to play and pause, a scrubber with a tick at each event, and the value of the parameter are shown, and the plot is paused when you drag the scrubber. In the PDF and in PowerPoint, the plot is printed at its last frame. Set another frame with `data-plot-frame`, where a negative frame is counted from the end, and set `data-plot-paused` to show the still in the slides as well. To start the plot at a step, give a fragment of its slide the attribute `data-plot-play`. The plot is then held at its still frame until the fragment is shown and played from its first frame afterward, and it is printed at its last frame from this step on. Under reduced motion, the plot is not played.

To reveal a plot in steps, give a fragment of its slide the attribute `data-plot-show` with the ids of panels, marks, or elements, separated by spaces. Each of these is hidden until its fragment is shown. With `data-plot-tab` on a fragment, the plot is switched to the named tab, hence each tab is given a page of its own in the PDF. An empty `span` is enough for a fragment without text. To show one block on several slides, give each slide an element of its own, with the ids of its panels in `data-plot-panels` and the names of the tabs it offers in `data-plot-tabs`. A tab named in a `data-plot-show` is offered once its fragment is shown, hence give the panels, marks, elements, and tabs distinct names.

These keys are read from the block.

| Key | Value |
|---|---|
| `panels` | A list of panels, each with an `id`, the axes `x` and `y`, and an optional `title`, `regions`, `curves`, and `labels`. An axis is `{ "range": [a, b], "ticks": [...], "title": "..." }`, and a tick is a number or `{ "at": v, "text": "..." }` with a label in the markup. Set `"scale": "asinh"` on an axis to draw a value v at asinh(v/u), where u is the `unit` of the axis, 1 by default. Set `"equal": true` for one scale on both axes, and `"axes": false` to leave the axes out. The `size` of a panel is its share of the plot, 1 by default, and its `margin` is `[top, right, bottom, left]` in pixels. |
| `marks` | A list of the animated marks, each with an `id`, a `panel`, and a `kind`. The data of a mark are given in each tab. |
| `tabs` | A list of named data sets, each with a `name`, a `label` for its button, the `values` of the parameter at the frames, the `data` of the marks by their ids, an optional `active` list, and optional `panels`. In `panels`, the `x`, `y`, `title`, `regions`, `curves`, and `labels` given for a panel id replace those of the panel while the tab is shown. |
| `parameter` | `{ "label": "$A$", "digits": 3 }`, the name of the parameter and the digits of its value. |
| `duration`, `hold` | The length of a loop, 8 s by default, and the time for which the last frame is held, 1 s by default. |
| `layout` | `row` or `column`, the direction of the panels. By default, the panels are in a row in a wide box and in a column in a tall one. |

The data of a mark are given with one entry per value of the tab, or with one entry for a mark that does not move. Between two frames, the positions are interpolated, and a text is taken from the nearest frame.

| Kind | Entry | Drawing |
|---|---|---|
| `points` | A flat list `[x1, y1, x2, y2, ...]` | A dot at each point, filled, or a ring with `"hollow": true` |
| `trace` | A point `[x, y]` | The whole path in a faint line, and the path up to the current frame in full with a dot at its end |
| `label` | `{ "at": [x, y], "text": "..." }`, with one position and one text, or a list of each | The text at the position |
| `events` | A list of `{ "frame": n, "at": [x, y], "text": "..." }`, not one per frame | A ring and its text from the frame on, and a tick on the scrubber in the tone of the mark |

A region is a polygon of `points`, filled at `opacity`. A curve is a polyline of `points` or a `circle` `[cx, cy, r]`, with a `width` and a `dash`. A label is a `text` at `at`, with an `anchor` (`start`, `middle`, or `end`) and an offset `dx`, `dy` in pixels. A mark is drawn with a `size`, a `width`, an `anchor`, `dx`, and `dy` as well. Give each element and mark a `tone`, i.e. a color of the theme without its dashes (`accent`, `violet`, `text`, `subtle`, `muted`, or `data-1` to `data-8`), and the plot is drawn right in both modes. A `class` on an element or a mark is a target of `data-highlight`, as in stepped math, and the element keeps its color when a tab is chosen. In `active`, list the ids of the elements emphasized at each frame. The other ids named in the active list of any tab are dimmed at the same frame.

Text in the JSON is set in a small markup rather than with MathJax, so that a plot is drawn the same in the slides, the PDF, and PowerPoint. Math is written between `$` signs, with italic letters, `_` and `^`, braces, `\mathrm{}`, `\text{}`, Greek letters, and a few symbols such as `\to`, and a hyphen is set as a minus sign there. A fault in the block is shown in place of the plot with its path, e.g. `tabs[0].data.m: 3 frames are given, and the tab has 2 values`, and `npm run check` fails on it.

## Agent skills

The skill `refine-slides` is in `.claude/skills/`, and you do not have to install anything. Open Claude Code or Codex in a clone of this repository, and ask in plain words, e.g. "the slides are too wordy, tighten them up" or "go through the deck and fix whatever looks off". With this skill, an agent looks at every slide at its last step, and moves what it cuts into the speaker notes or into backup slides. In Claude Code the skill is read from this folder, and in Codex or any other agent it is reached through the pointer in `AGENTS.md`.

If you copied `theme/` and `brand/` by hand, copy `.claude/`, `AGENTS.md`, `scripts/`, and `package.json` as well. You can then run `npm run check`, `npm run pdf`, and `npm run pptx` without `npm ci`.

## Maintain the theme

The theme is maintained with npm and Node 22 or later, on macOS, Linux, or Windows. The commands are these.

```sh
npm ci                 # the dependencies
npm run vendor         # reveal.js, the notes plugin, the fonts, MathJax, and three.js into theme/vendor/ (tycho is copied by hand)
npm run build          # src/*.ts into theme/beeson.js and src/editor/*.ts into theme/editor.js with esbuild
npm run typecheck      # tsc --noEmit
npm test               # the orbit engine, the surfaces, the backdrops from files, the build, the vendor script, the browser lookup, the mode flip, the crop of the backdrops, the print view, the PowerPoint file, the plots, the stepped math, and the editor under node --test
npm run check          # every slide of index.html in both modes, screenshots, console errors, a poster on every video, and the editor on the deck
npm run pdf            # index.html to slides.pdf, with a check of the page count
npm run pptx           # index.html to slides.pptx, with one click per step
```

For `npm test`, `npm run check`, `npm run pdf`, and `npm run pptx`, Chrome is looked up at its default location on macOS and Windows, and on the `PATH` on Linux. Edge is used on Windows when Chrome is missing. To use another browser build, set `CHROME_PATH` to its executable.

To run the check in another engine, use `npm run check -- --browser firefox` or `npm run check -- --browser safari`. Firefox is driven with `geckodriver`, which is looked up in `GECKOWEBDRIVER` and on the `PATH`, and `FIREFOX_PATH` selects another Firefox build. Safari is driven with `safaridriver`, which you enable once with `sudo safaridriver --enable`. Quit Safari before a run, since a session cannot be started in a Safari that is already open. A page from `file://` is refused under automation, hence the deck is served from a local port in Safari, and a double click is not covered by this check. The problems in the page are reported in all three browsers, but the console is read only in Chrome, and the phone layout, a pixel ratio of 1.25, and a save of the editor are checked only in Chrome. On Linux, run Firefox under `xvfb-run`, since WebGL in software is available there only in a window.

The compiled `theme/beeson.js` and `theme/editor.js` are committed, hence none of this is required for a talk. The same commands are run on Ubuntu, macOS, and Windows on every push with the workflow `.github/workflows/check.yml`. The check is also run in Firefox on Ubuntu and in Safari on macOS. The repository root is published on GitHub Pages with `pages.yml`.

## License

The code and the theme are under the MIT license. The Princeton marks and the group logo in `brand/` are trademarks and are outside this license, see `brand/NOTICE.md`.
