# AGENTS.md of the template source

The rules below are for work on the template itself, i.e. the theme, the editor, the exports, and the tests, and they add to the root `AGENTS.md`.

## Bundles and vendored files

- The theme is compiled from `src/main.ts` into `theme/beeson.js`, and the editor from `src/editor/main.ts` into `theme/editor.js`. Run `npm run build` after every change under `src/`, and commit both bundles with the change.
- Keep the editor out of `theme/beeson.js`, since nothing of the editor is loaded in a deck opened without `edit`.
- Keep `theme/editor.js` under the budget in `test/build.test.mjs`, since the editor is loaded from the file at each `edit`.
- The files in `theme/vendor/` are copied from `node_modules` by `scripts/vendor.mjs`, apart from the TyCHO runtime and the Latin Modern Roman faces, which are copied by hand. Add a library that a deck loads to `scripts/vendor.mjs`, together with its license.
- The orbit engine in `src/orbits.ts` is a port of the MIT-licensed `orbits.ts` of claudiovestini.com, and not of DyLAN code.

## Theme

- Take every color from the custom properties of `theme/beeson.css`, and use orange for motion and progress and violet for structure.
- Set type in Latin Modern Roman at 22, 28, 36, 48, 64, or 96 px on the design size of 1920 by 1080, and set math in the TeX font of MathJax.
- Keep body text at 48 px, i.e. the 24 points of the AIAA guideline for a slide 7.5 in high, captions and tables at 36 px, and a code box at 22 px.
- When you rename a class or an attribute for the glossary, make the theme read only the new name, and add the old name to `test/names.test.mjs` and under "Avoid" in its entry of `GLOSSARY.md`.
- Describe a new or changed class, attribute, or command of the editor in `REFERENCE.md`, in the section of its element.
- When an editor command or an export is not available in a browser, tell the user so in a message in this browser.

## Demo deck

- The demo deck in `index.html` is the start of every new talk, and it is the page published on GitHub Pages from `main`.
- The tests of `npm test` are run on `test-deck.html`, a frozen copy of the demo deck, hence you can change the demo deck without a change to the tests.

## Before you hand work over

- Run `npm run build`, `npm run typecheck`, the test files of what you changed, and `npm run check`, and hand work over only when all of them pass.
- Run one test file with `node --test test/<name>.test.mjs`. The whole suite is over an hour long on one machine, and it is split over seven runners in the workflow `check`.
- Run `node --test test/perf.test.mjs` yourself after a change to the drawing of a backdrop, since this test is skipped on CI.
- In the workflow `check`, `npm test` is run only in beeson-group/slides, and in a talk only the checks of the deck are run.

## Writing a test

A round is one run of the workflow `check` on a commit, and a flaky test is a test that fails in a round without a fault in the code under test. On a runner of GitHub, with two to four cores, WebGL and video are drawn in software, hence a page is many times slower there than on a laptop.

- Fix a flaky test before the merge. Reproduce its failure first by forcing its condition, and do not run the failed job again in place of a fix.
- Do not read a result after a fixed wait. Wait for the state of the page with `page.waitFor`, and read the result once this state is reached.
- Record the states of a preview or an animation with a clock in the page, and assert the record, since a state may be over before it is read in the test.
- Wait for the end of an animation, a transition, or a flip of the mode by its state, and give it 60 s on a slide with a surface, a video, or a TyCHO viewer.
- Open a page with `motion: true` in a test of an animation, since reduced motion is set on the Windows and macOS runners.
- Type the keys of one entry of the history with `typeKeys` or `type` of `test/helpers/editor.mjs`, since two keys more than a second apart are two entries.
- Bound a time by the same time on a smaller case, not by a number of milliseconds, and measure a time over its bound again before the test fails.
- Give a test a limit longer than the sum of the waits inside it. Keep one read of a page under a minute on a runner, or give the browser a longer limit with `launch({ timeout })`.
- Click again until the state is reached when the target may be moved between the read of its place and the click.
- After a click that loads the page again, wait for the new page with `page.waitFor`. Catch the error "Inspected target navigated or closed" of the click, which is the answer of Chrome to a read in flight at the reload.
- Count the requests of a page for the file under test by its name, since another file of the deck may be answered between two reads.
- Find a slide of `test-deck.html` by its content and not by its number, and assert that it is found.
- Pass `drafts: true` to a page only in a test of the unsaved edits, which are offered on a dialog to the next page of the same test.
