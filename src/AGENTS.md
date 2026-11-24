# AGENTS.md of the template source

The rules below are for changes to the template in beeson-group/slides: the theme, the editor, the exports, the tests, and the documentation. They add to the root `AGENTS.md`, whose sections from "Changes to the template" on are for the same changes. None of them applies when you write a talk.

## Documentation

- Write each fact in one place, and link to it from the others.
- Do not write comments or docstrings in any file of the repository. Write what a reader needs to know, e.g. the reason for a workaround, into a name, a test, `REFERENCE.md`, or this file. `test/comments.test.mjs` fails on every comment, apart from the license banner at the top of each bundle.
- `README.md` is hand-written for human readers by the maintainers, in their voice. If you have to edit it, keep this voice, and do not restyle it to the rules of this file.

## Terms

- Before you coin a word, use the word that PowerPoint, Keynote, reveal.js, CSS, or everyday English already has.
- Give narrowed and coined words an entry in `GLOSSARY.md` as soon as they are settled. Name classes, attributes, and the labels of the editor after the glossary.
- Keep one meaning per word across the theme, the editor, `REFERENCE.md`, and the demo deck.

## Commits and PRs

- Conventional commit titles, plain language: `fix(editor): undo no longer drops a typed word`.

## Reviewing a PR

- In this repository, PR-Agent is run only at the pushes to PRs from branches of this repository, and commands in comments are ignored.
- Do not suggest changes in `theme/vendor/`, which is vendored with its licenses. Do not suggest changes in the bundles of `theme/`, from `npm run build`, either. They are compiled and committed on purpose.
- Read the section of `REFERENCE.md` on an element before you question it. Most of what looks unusual there is the design of the theme.

## Bundles and vendored files

- Each bundle of `theme/` is compiled by `build.mjs` from an entry point under `src/`. `theme/editor-tex.js` is loaded when a sheet or the bibliography list is first opened, `theme/editor-pdf.js` with `theme/vendor/pdfjs/pdf.js` at the first PDF and by `npm run tex`, `theme/editor-session.js` when a page starts or joins a session, and `theme/session-history.js` a few seconds after a page joins a session or when Version History is first opened, so that it opens offline as well. Run `npm run build` after every change under `src/`. Commit the bundles with the change.
- Keep the editor out of `theme/beeson.js`. Nothing of the editor is loaded in decks opened without `edit`.
- Decks are opened as files, and from a file a module script, a worker, and a fetch of a file next to the deck do not work. Hence each library and each generated file loaded by a deck, e.g. `tex.js`, `figures/name.js`, and the trajectories of a backdrop, is a classic script.
- Keep `theme/editor.js` under the budget in `test/build.test.mjs`. The editor is loaded from this file at each `edit`.
- The budget of `theme/editor.js` is set to catch a library bundled by mistake. Do not shorten code to fit it.
- Keep `theme/session.js`, `theme/session-history.js`, and `theme/edit.mjs` under their budgets in `test/build.test.mjs`. `theme/session.js` is loaded at each `edit` with `session`.
- Let `theme/session.js` reach the editor only through `src/session/client/handover.ts`. From `src/editor/`, import only `merge.ts`, `tokens.ts`, and types. Any other module would be a second copy with separate state, and `build.mjs` fails on it.
- Let `theme/session-history.js` take the modules of `theme/session.js` that keep state, e.g. `toast.ts`, `follow.ts`, and `presence.ts`, only from `src/session/client/history.ts`. It may share with `theme/session.js` only `src/editor/tokens.ts`, `protocol.ts`, `slides.ts`, `dom.ts`, and `labels.ts`, and `build.mjs` fails on any other module.
- Let the engine of the port reach the editor only through `src/editor/session/host.ts`. Import a module of the editor into `session.ts`, `apply.ts`, or `tree.ts` only with `import type`. `theme/editor-session.js` may not share any module with `theme/editor.js`, and `build.mjs` fails on one.
- Add what the session client needs from the editor as a small hook in `src/editor/session/`. Keep the code that draws, the texts, and the styles in `src/session/client/`.
- Keep the edit command and the relay free of dependencies. They are run on Node 20 and later, on Windows, macOS, and Linux.
- Do not hold up the edit command with a long step. Every page of a session waits on its one process.
- The files in `theme/vendor/` are copied from `node_modules` by `scripts/vendor.mjs`. The TyCHO runtime and the Latin Modern Roman faces are the exceptions, and they are copied by hand. Add libraries that decks load to `scripts/vendor.mjs`, together with their licenses.
- pdf.js is vendored from its legacy build. Its default build calls methods that are missing in the Safari version before the current one.
- In a Dependabot PR of the npm packages, only `package.json` and `package-lock.json` are changed. Before its merge, run `npm run vendor` and `npm run build` on its branch, and commit `theme/vendor/` and the bundles.
- The orbit engine in `src/orbits.ts` is a port of the MIT-licensed `orbits.ts` of claudiovestini.com, not of DyLAN code.
- The engine of the Poincaré sections and of the tori, in `src/dots.ts`, `src/poincare.ts`, and `src/tori.ts`, was written for a talk of the group, not ported from DyLAN code.
- `src/normal-form.ts` is a port of the kind `normal-form` of `demos/families/families.js` of the normal-forms talk of the group, whose other two kinds are ported in `src/poincare.ts` and `src/tori.ts`. Its generating function was chosen for the look, and it was not ported from DyLAN code. The files of `theme/backdrops/` hold data computed by DyLAN, which is allowed.
- The moving point of a strip bundle in `src/bundle.ts` was written for the bifurcation-tracking talk of the group and ported from the normal-forms talk, not from DyLAN code.
- Load the file of a built-in backdrop of `theme/backdrops/` only in a deck that draws it. `theme/beeson.js` is loaded by every deck, hence keep the data of a backdrop out of it.
- `realpathSync` of Node keeps the short names of Windows, e.g. `RUNNER~1`. `realpathSync.native` and `realpath` of `fs/promises` resolve them.
- On Windows, another program may hold `index.html` open for a moment. A rename over it is therefore tried again.
- `node:zlib` has `crc32` only since Node 20.15. The CRC-32 of a zip entry is read from the trailer of gzip.

## Features

- Do not take design decisions that tie a feature to Chrome or to any one browser.
- Do not make users reach for a terminal. Whatever a talk needs from a command is written by the editor as well, e.g. `tex.js` from `npm run tex`.
- Record the videos of the PowerPoint export as H.264 in MP4, the one video format that every version of PowerPoint can play.
- Open a file chooser, a folder picker, or a save picker in the handler of the click or the key press, since a picker requested later is refused.
- The PowerPoint file is written by `scripts/pptx.mjs` without pptxgenjs, since the timing that starts a video by itself is not written by pptxgenjs. Elements out of the order of the schema are refused by PowerPoint.
- Build menus and selects of DOM elements, since the popup of a native select is missing from a screenshot taken over the DevTools protocol.
- The formulas of a plot are typeset one at a time by MathJax, with a yield to the page every 8 ms, so that a label with a new text at each frame does not hold up the page. Their typesetting is chained onto `MathJax.startup.promise`, which `scripts/chrome.mjs` waits for before it captures a deck.

## Theme

- Take every color from the custom properties of `theme/beeson.css`. Use orange for motion and progress, and violet for structure.
- The output color conversion of three.js is turned off for surfaces, since the sRGB colors of the theme are written as they are by the shaders.
- Keep the plot palette, `--data-1` to `--data-8` of `theme/beeson.css`, as the Okabe–Ito palette, whose colors can be told apart with color vision deficiency. In the dark mode, its black is replaced by the color of the text. Keep the same colors in the same order in the styles of `styles/`.
- Keep `axes.formatter.use_mathtext` in the Matplotlib styles. The tick labels are then set as math, since cmr10, the fallback typeface of Matplotlib, does not have a minus sign.
- Set type in Latin Modern Roman at 22, 28, 36, 48, 64, or 96 px on the design size of 1920 by 1080. Set math in the TeX font of MathJax.
- Keep body text at 48 px, i.e. the 24 points of the AIAA guideline for a slide 7.5 in high. Keep captions and tables at 36 px, and code boxes at 22 px.
- When you rename a class or an attribute for the glossary, make the theme read only the new name. Add the old name to `test/names.test.mjs`, and under "Avoid" in its entry of `GLOSSARY.md`.
- During a trace, the strokes of thin trajectories are kept on an offscreen canvas in the order in which they are traced. Only their new pieces are stroked at each frame. A thin trajectory has an opacity up to 0.5, a width up to 1, and no glow, and only the first run of thin trajectories in the file is kept. The trajectories before this run are stroked whole at each frame under the canvas, and the trajectories after it are stroked whole at each frame over it. Hence put the opaque trajectories of a built-in backdrop first, as in `tubes` and `wideRibbon`. The still is drawn in the order of the file, so a few overlaps of two colors change at the last frame.
- Describe new or changed classes, attributes, and editor commands in `REFERENCE.md`, in the section of their element.
- When an editor command or an export is not available in a browser, tell the user so in a message in this browser.

## Demo deck

- The demo deck in `index.html` is the start of every new talk. It is also the page published on GitHub Pages from `main`.
- The tests of `npm test` are run on `test-deck.html`, a frozen copy of the demo deck. Hence you can change the demo deck without changing the tests.
- The two figures, `demo/broucke-sample.js`, and the TyCHO viewer of the demo deck are written by the scripts of `demo/`. Run them from the root of the repository, with the pytycho of the version of `theme/vendor/tycho/`. For `demo/broucke.py`, a checkout of TyCHO at the tag of this version is also needed next to the repository, since the Broucke example of TyCHO is read.

  ```sh
  uv run --with matplotlib,numpy,scipy python demo/figures.py .
  uv run --project ../tycho/code python demo/broucke.py
  uv run --with pytycho==0.3.1,scipy python demo/tycho-scene.py index.html
  ```
- The files of `theme/backdrops/` are written by `demo/poincare.py` and `demo/tori.py` from files of sections and of orbits computed by DyLAN. These inputs and the scripts that call DyLAN are not in the repository, since nothing here may be derived from DyLAN code. An input is an `npz` file of NumPy with the keys read in `section` of `demo/poincare.py` and in `tori` of `demo/tori.py`, and `demo/poincare.py` takes one file per system.

  ```sh
  uv run --with numpy python demo/poincare.py earth-moon-l2 sections-earth-moon-l2.npz
  uv run --with numpy python demo/poincare.py sun-earth-l1 sections-sun-earth-l1.npz
  uv run --with numpy python demo/poincare.py bicircular-l1-horizontal sections-bicircular-l1-horizontal.npz
  uv run --with numpy python demo/poincare.py bicircular-l1-vertical sections-bicircular-l1-vertical.npz
  uv run --with numpy python demo/tori.py tori.npz
  ```
- `theme/backdrops/saddle.js` is written by `demo/saddle.py` from the closed-form flow of the quadratic part of the normal form, with NumPy alone. The script was written for the normal-forms talk of the group and does not call DyLAN.

  ```sh
  uv run --with numpy python demo/saddle.py
  ```
- The clips of the demo deck are exported with tycho, as described in its CONTRIBUTING.md.

## Verifying

On a laptop, the whole suite of `npm test` takes over an hour, with every core busy. In each round of the workflow `check`, the suite is split over several runners. On a laptop, run only the test files of your change.

- Run test files with `npm test -- test/<name>.test.mjs`, which takes several files at once. Outside CI, they are run at the lowest priority of the system.
- Find the test files of a change by searching `test/` for the commands, classes, and functions that you changed.
- Do not run the whole suite, with `npm test -- --all` or a glob of test files, unless the person you work for asks. Push, and watch the round instead.
- Before you call a failure unrelated to your change, run its test file alone on `main`.
- Before you hand work over, run `npm run build`, `npm run typecheck`, the test files of your change, and `npm run check`. Hand work over only when all of them pass.
- Run `node --test test/perf.test.mjs` yourself after you change how backdrops are drawn. This test is skipped on CI.
- Keep `test/helpers/blocking-stdout.mjs` in the options of `npm test`. With `--test-force-exit`, a test file ends with `process.exit()`, and the reports still queued to a pipe would be dropped.
- In the workflow `check`, `npm test` is run only in beeson-group/slides. In a talk, only the checks of the deck are run.
- A PR is checked on Ubuntu only: the tests, the deck in Chrome and in Firefox, and the figures. Windows, macOS, and Safari are checked on `main` after each merge.
- `npm test` is not run on macOS, since WebGL is drawn there by SwiftShader, too slowly for the timings of the tests.
- Before the merge of a change that is specific to Windows, macOS, or Safari, start a round on every system with `gh workflow run check --ref <branch>`. Watch this round as well.
- Fix a failed round on `main` before other changes are merged.

## Workflows

- Do not add a trigger on comments to the workflow `pr-agent`, since such a trigger is a high finding of zizmor. A PR from a fork is not reviewed, since the events of a fork are given a read-only token and are not given the secrets.

## Writing a test

A round is one run of the workflow `check` on a commit. A flaky test is a test that fails in a round without a fault in the code under test. On GitHub runners, with two to four cores, WebGL and video are drawn in software. Hence pages are many times slower there than on a laptop.

- Write a new test into the test file of its feature. Add a test file only for a feature that does not have one, and name the file after the feature, not after an issue or a review round.
- A test file with a failed test is run once more in the same job. A test that then passes is flaky. It is named in a warning of the round, and the round does not fail.
- Read the warnings of a round before the merge. Fix a flaky test of the code that you changed. For any other flaky test, open a `Bug` issue, or extend its open issue.
- Reproduce the failure of a flaky test first by forcing its condition. Do not run a failed job again in place of a fix.
- Do not read results after a fixed wait. Wait for the state of the page with `page.waitFor`. Read the result once this state is reached.
- Record the states of previews and animations with a clock in the page, and assert the record. A state may be over before it is read in the test.
- Wait for the end of animations, transitions, and mode flips by their state. Give them 60 s on slides with a surface, a video, or a TyCHO viewer.
- Open pages with `motion: true` in tests of animations. Reduced motion is set on the Windows and macOS runners.
- Type the keys of one history entry with `typeKeys` or `type` of `test/helpers/editor.mjs`. Two keys more than a second apart are two entries.
- Bound a time by the same time on a smaller case, not by a number of milliseconds. Measure a time over its bound again before the test fails.
- Send a key, or read a time, within a delay of the page on the virtual time of Chrome, which is not advanced during a stall of the machine. Advance virtual time by one budget at a time.
- Give each test a limit longer than the sum of the waits inside it. Keep each read of a page under a minute on a runner, or give the browser a longer limit with `launch({ timeout })`.
- When the target may be moved between the read of its place and the click, click again until the state is reached.
- After a click that loads the page again, wait for the new page with `page.waitFor`. Catch the error "Inspected target navigated or closed" of the click. It is the answer of Chrome to a read in flight at the reload.
- Count the requests of a page for the file under test by its name. Another file of the deck may be answered between two reads.
- Find slides of `test-deck.html` by their content, not by their number, and assert that they are found.
- Pass `drafts: true` to a page only in tests of the unsaved edits. These edits are offered on a dialog to the next page of the same test.
- Do not export `GIT_DIR`, `GIT_WORK_TREE`, or `GIT_INDEX_FILE` in a test. Git then works on the repository that they name.
- `node:test` runs the after hooks in the order they were added, and skips the rest after one fails. A hook is not bounded by the timeout of its test.

## Browsers and reveal.js

- Animation frames are not given to hidden or background tabs. Bring a page to the front, e.g. with `front` of `test/helpers/apply.mjs`, before you wait for its frames.
- The system clipboard is shared between tests. Stub `navigator.clipboard`, or send copy and paste events with a `DataTransfer` of the page.
- Over the DevTools protocol, a trusted key runs an editing command, or clicks a button at Enter, only when it is sent with the command or with its text, e.g. `commands: ['selectAll']` or `text: '\r'`. In headless Chrome, a paste event is not fired at Mod+V.
- In headless Chrome, a file chooser is canceled unless `Page.setInterceptFileChooserDialog` is turned on before the trusted click that opens it. The cancel would race the files set by the test.
- Under load, an anti-aliased edge may be rastered a few levels apart. Compare the computed styles and boxes of two pages, not their pixels.
- On the Windows runners, Chrome draws WebGL in WARP, since SwiftShader takes about 170 ms for a frame of a surface there, against about 30 ms in WARP. The page is still composited in software, so that the screenshots of the print view equal the frames composed on a 2D canvas.
- On macOS, Chrome is started without MacAppCodeSignClone. With it, Chrome copies its app into a temp folder of macOS at each start, and the copy is left there when Chrome is ended by a signal. Chrome removes what it has written outside its profile only at an exit of its own, hence `close()` waits up to 5 s for Chrome to exit after `Browser.close` before it ends Chrome.
- On Windows, Chrome is started without TcpPortRandomizationWin. On Windows 11 and Server 2025, it causes spurious `net::ERR_NO_BUFFER_SPACE` at rapid fetches over 127.0.0.1, also inside iframes, where the reload of `goto()` does not recover them.
- Text is laid out differently on each system. The sans-serif face of Linux is wider, and a caption there may be placed 1 px lower. On Windows, the space after a word is part of the selection of a double-click.
- A touch sent with `Input.dispatchTouchEvent` on a grip may be given by Chrome to the text element beside it. Make the pointer events of a touch on a grip in the page.
- IndexedDB does not answer a read while the virtual time of Chrome is paused.
- Under the policy `advance` of virtual time without a budget, the 1 s interval of reveal.js is run back to back, and virtual time is advanced by days each second.
- Under virtual time, a reading of `performance.now()` may be off by 0.1 ms, and a reading of `Date.now()` by 1 ms, also at the end of a budget. Wait for the end of a budget with `page.next('Emulation.virtualTimeBudgetExpired')`, not for a reading of the clock. Animation frames are not drawn while virtual time is paused.
- reveal.js blurs the focus when a page is shown again. In a test of a session, do not bring another page to the front, and send the edits of the other person over HTTP instead.
- reveal.js answers `isReady()` one timer before `.reveal` is given the class `ready`, and an Esc in between opens its overview. Wait for `.reveal.ready` before you send a key.
- A crash of a page may cancel the keepalive requests of the other pages of its renderer. In a test of a crash, send these requests by hand.
- On Linux, in a Chrome launched with `wholeFrames`, a page closed right after its first screenshot may leave the later screenshots of the browser unanswered. Hence the page of the probe of `launch()` is left open until the browser is closed.
- Chrome ends a closing page whose `pagehide` has not run within about half a second, and its bye is not sent. On a loaded runner, a closed page may thus leave only at the sweep, once the poll held for it is answered. A test that closes a page and waits for its person to leave starts its edit command with a short `SLIDES_POLL_HOLD_MS` and `SLIDES_GONE_MS`.
- A page opened with `open()` of `test/helpers/client.mjs` reads as visible behind another page, as the page of a person on another machine does. Set `window.__visibility` to `'hidden'` or `'real'` to change this.
- ⌘L and ⌥⌘L are taken by Safari before the page, and Shift+F3 and Ctrl+F3 by Chrome and Edge. A command bound to such a key has a second key as well, which is listed first in the menus of the browser that takes the first key.
- On Windows and Linux, the keys of Chrome and Firefox are sent to the page first, apart from the reserved keys, e.g. those that open or close tabs and windows. Hence Ctrl+Shift+J and Ctrl+Shift+M can be bound to commands of the editor, since their keydown is canceled with `preventDefault`. In Chrome they open the console and the profile menu, and in Firefox the console and the responsive design mode.
- Outside a Mac, ] and [ need AltGr on German and Italian keyboards. Hence a menu lists first the key typed without AltGr. On a Mac, Option with an arrow and the Control keys of macOS, e.g. Control-D, are left to the text.
- The clipboard is read and written only through its events, which are allowed in every browser. Text read from it may come from any page. The folders in the path of a session page are its key, hence they are hashed before they are written.
- A page opened from `file:` cannot download a file, and `crypto.subtle` is missing outside a secure context.
- In Chrome, a space typed at the end of a text becomes a no-break space, and a character typed at the end of an inline element is put into this element. A plain space that is not drawn, e.g. at the end of a text, is deleted at the next key typed next to it. Hence spaces written into a text by an edit of another person, or by a change of the file, are put on the page as Chrome puts typed spaces. A space after the caret at the start of a text is dropped, and `selectionchange` is held back while keys come quickly.
- reveal.js marks only the fragments of the slide that it starts on. Its highlight plugin replaces the elements of a code box, hence code is colored in the editor with the CSS Custom Highlight API.
- WebDriver cannot read the console of Safari, and pages from file URLs are refused in Safari. Phones and pixel ratios are emulated only in Chrome. On a Mac, enable safaridriver once with `sudo safaridriver --enable`. After a show leaves full screen, the window of Safari can be put back behind the window of another app, and its page is then hidden. Hence the next page of `scripts/check-editor.mjs` is opened in a new window, which is put in front.
- Firefox on Android reports a fine pointer on a screen with a stylus. Hence a rule for touch screens also matches `hover: none`.
- In a PDF from Chrome, the page tree, the objects of the pages, and the dictionaries of the images are not compressed. Hence the scripts and the tests read them as text.
- The origin of a deck opened from a file is opaque. Hence the files of its folder cannot be fetched, and the rules of its style sheets and the frames of its videos cannot be read.
- Under a type filter, `index.html` may be grayed out in the file dialog of macOS. Open files without a filter.
- After a click canceled with `preventDefault`, the former state of a checkbox is put back after the listeners of the click. Read the checkbox in the next task.
- reveal.js takes the first `.reveal` of the page, and the sections under `.reveal .slides` as the slides. Put a copy of a slide in a shadow root or after the slide.
- A pinch of the trackpad arrives as gesture events in Safari, and as a wheel event with Ctrl in the other browsers.
- In Safari on a phone, the memory of all canvases together is small. Set the size of a canvas to 0 once it is read.
- The cancel of a dialog at Esc may be ignored when the dialog was not used since a former cancel. Close a dialog at Esc in a keydown listener of the dialog.
- A screen reader may skip a live region added together with its text, and does not read it again when its text is set to the same text. A node that is moved or written again loses the focus and is read again.
- Outside the top modal dialog the page is inert. A live region of a page with an open dialog therefore sits in the same dialog.
- A removed button does not send `focusout` in every browser, and a pointer that stays still does not send `pointerenter`.
- A phone keyboard sends a delete as an input event, without a keydown of its key. A key of an input method that composes text comes with `isComposing` or `keyCode` 229, and belongs to the composition.
- `maxLength` counts UTF-16 code units, an emoji as two, and a cut inside a composition breaks the input method.
- iOS Safari fires no `contextmenu` at a long press, hence the page times the hold. An iPad names itself a Mac, and a Windows tablet opens a deck from the disk.
- A phone may suspend or close a hidden page without `pagehide`. The unread keys of a session are sent at `visibilitychange`.
- Firefox keeps a page with a `beforeunload` listener out of its back-forward cache. The listener is thus added only while an edit is unsent.
- Safari aborts a write into IndexedDB that starts once the page is hidden or closed, but keeps a write into `localStorage`, whose quota is a few MB. It keeps the Web Locks of a page in its back-forward cache, hence the lock is released at `pagehide`.
- `crypto.randomUUID`, `crypto.subtle`, and `navigator.clipboard` work only in a secure context.
- A browser opens at most 6 connections to one host, for all the pages of the origin together.
- A second page loaded into one iframe adds an entry to the history of the tab.
- `::highlight` does not read custom properties in every browser. A highlight therefore takes the literal color of its tone.
- An attribute set to its own value still invalidates the style.
- The drawing buffer of a WebGL canvas is cleared once its frame is shown. Copy it into a 2D canvas in the same task as its render.
- Over the DevTools protocol, a load may fail with `net::ERR_ABORTED` before the crash of the network service of Chrome is written to stderr. Hence the crash line is awaited for `CRASH_LINE_WAIT` of `scripts/chrome.mjs` after such a failure.
