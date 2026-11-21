# AGENTS.md

This repository is either slides or a talk made from it. slides is the Beeson group's template for talks as HTML slides on reveal.js. Talks are made from it with the GitHub button "Use this template". The deck is `index.html`: the demo deck in the template, and the talk in a talk. It is drawn by the theme in `theme/`. It is edited in the browser with the editor, which is opened with the URL parameter `edit`.

<!-- shared:begin -->
## Hard invariants

Hard invariants are never traded away for other goals. When a change would break one, stop and ask the person you work for. Conventions may be argued with.

1. Phones are supported.
2. Great performance on slow machines is always an objective.
3. The best part is no part. Complexity is never favored when a simpler solution exists.
<!-- shared:end -->
4. Talks work without a toolchain. The bundles of `theme/`, from `npm run build`, are committed.
5. Decks do not fetch anything at show time. Everything they load is vendored under `theme/vendor/` with its license.
6. Editor saves keep every byte of `index.html` outside the edited text elements.
7. Nothing in this repository is derived from DyLAN code.
8. Every feature is supported in all browsers. Decks can be viewed and presented, and every control can be used, in current Chrome, Firefox, and Safari, on desktops and phones. Extras such as an export or an editor command may be missing in one browser. The user is then told so in a message.

## Writing a talk

- Write the talk over the demo deck in `index.html`. Keep `theme/` and `brand/` next to it. `index.html` is the deck that `npm run check`, `npm run pdf`, and `npm run pptx` read by default.
- Read the section of `REFERENCE.md` on an element before you write one. Every class and attribute of the theme is described there.
- Use one `h2` per slide, and an `h1` on title slides. Keep lines of text columns under 66 characters.
- Design the complete slide first. Assign its steps afterward.
- Write content that replaces other content in the same place, e.g. the next form of an equation, as a stack, described under Stacks in `REFERENCE.md`. Give it one child `div` per version, and make each child but the first a fragment with a `data-fragment-index`, in increasing steps. Do not write `current-visible`, `fade-out`, or `fade-in-then-out` on elements replaced in place.
- Take every color from a tone of the theme. Do not add title bars, rules under headings, all-caps labels, or eyebrows. None of them is part of the theme.
- Set widths in px in a `style` only on headings, paragraphs, lists, `math` divs, captions, and cells in the top row of tables. Pictures, QR codes, TyCHO viewers, shapes, and backdrops may take widths as well.
- Set heights in px in a `style` only on shapes, backdrops, table rows, and images, videos, or TyCHO viewers that have a width.
- Give figures a version for each mode with `for-dark` and `for-light`, or the class `white-figure` or `invert`. Otherwise a figure may be visible in one mode only.
- Put a PDF on a slide as a PDF figure, described under Figures in `REFERENCE.md`, rather than converting it by hand. Run `npm run tex` after you add or change one, and commit its renders.
- Write each TikZ figure as a lone `tikzpicture` in `figures/name.tex`, with the colors of `styles/beeson-tikz.sty`. `npm run tex` compiles it into `figures/name.js` with a TeX that has `latex` and `dvisvgm`. While the edit command runs, it compiles the figure by itself after each change. Commit this output.
- Write math macros used on more than one slide into `preamble.tex`. Write papers cited on slides into `references.bib`. Run `npm run tex` after you change either file.
- Put the speaker notes of a slide in an `aside.notes`.
- Do not write `data-moves-on`. It is set by the theme when the deck is started.
- Someone may have the deck open in the editor while you change `index.html`. The editor then loads your change. At the next save, the unsaved edits of this person are merged into it.
- When you copy a newer `theme/` into a talk, convert every class and attribute listed under "Avoid" in `GLOSSARY.md` to its new name. The theme reads only the new names. Copy `scripts/` and `src/` of the same version with it, as listed under Tooling in `REFERENCE.md`, then run `npm run tex`. When the version of TyCHO changes, write each TyCHO scene again, as described under Figures in `REFERENCE.md`.

## Commands

```sh
npm ci && npm run vendor && npm run build   # the dependencies, theme/vendor/, and the bundles of theme/
npm run tex                                 # tex.js, from preamble.tex and references.bib next to index.html, and the TikZ and PDF figures
npm run edit                                # the editor in a session, in which several people edit the deck at once
npm run check                               # screenshots of every slide in both modes into check/, and the problems of the page
npm run check -- --browser firefox          # the same in Firefox, or in Safari with --browser safari
npm run pdf                                 # slides.pdf, one page per step
npm run pptx                                # slides.pptx, one click per step, with recordings of the scenes, surfaces, plots, and traced backdrops
npm run pptx -- --still                     # the same file without recordings, for a browser without an H.264 encoder
```

In a talk, `npm run pdf` and `npm run pptx` need only Node.js and Chrome, not `npm ci`. `npm run check` and `npm run tex` need Node.js 22.18 or later, as described under Tooling in `REFERENCE.md`. `npm run edit` needs only Node.js 20 or later.

Start Chrome only with the commands above or with `launch()` of `scripts/chrome.mjs`, and end it with the `close()` of the returned browser. Do not run the binary of Chrome yourself, and do not end a Chrome with `kill` or `pkill`. On macOS, a Chrome without the flags of `launch()` copies its app into a temp folder at each start, and this copy is left behind when Chrome is ended by a signal.

## Before you hand work over

- Run `npm run check` and `npm run pdf`. Hand work over only when `npm run check` passes.
- Look at the last page of each changed slide in `slides.pdf`. Text that runs off a slide is not reported by `npm run check`.
- NEVER assume the failure was there before your change.

<!-- shared:begin -->
## Issues and branches

- Before you start a change, search the open issues, the open PRs, and the remote branches for the same work, and report what you find to the person you work for.
- Start changes from GitHub issues. Issues are not needed for changes under about 20 lines, documentation-only changes, or dependency bumps.
- Extend an existing issue when the change belongs to it, rather than opening a new one. Open separate issues for bugs that reproduce on `main`.
- The issue type is `Bug` for a crash, a regression, or unintended behavior, `Feature` for behavior that the repository does not have yet, and `Task` for a refactor or performance improvement without new behavior.
- Write a `Bug` under the headings Expected behavior, Actual behavior, Reproduction on `main`, and Version and browser.
- UI changes need before/after images side by side. Take these yourself and attach them to the issue. Motion or timing needs short before/after videos.
- Upload PR evidence to GitHub. Never commit PR-only screenshots or assets such as `.github/pr-assets/`.
- Write feature issues under the headings Idea, Hard requirements, and Soft requirements.
- Name your branch `<surname>/<N>-<two-or-three-words>` in lowercase, where the surname is the one of the person you work for and `N` is the number of the issue. Leave `<N>-` out when the change does not have an issue.
<!-- shared:end -->

## Commits and PRs

- Conventional commit titles, plain language: `fix(editor): undo no longer drops a typed word`.
<!-- shared:begin -->
- Open GitHub descriptions and comments with the line `:robot: Generated by <harness>:<model>, not yet reviewed by the author :robot:`, where `<harness>` is the name of your harness and `<model>` is the id of your model.
- Write `Closes #N` on the line below the attribution line, and NEVER repeat the text of the issue in the description.
- Mark a PR as ready for review only when every check is green and the person you work for agrees.
- If you think CI itself is broken, say so in the description but DO NOT change CI unless explicitly instructed to do so.
- Watch CI until everything is green. DO NOT hand over until you have fixed all CI problems, and addressed `pr-agent` code reviews.
- Merge a PR only when you are told to by the person you work for.
<!-- shared:end -->

<!-- shared:begin -->
## Reviewing a PR

PR-Agent reviews PRs in the workflow `pr-agent`. A person needs effective write access to start a review. Authorized commands review any PR, one opened by a bot included.

- Treat the hard invariants above as the review criteria, and name the invariant that a finding breaks. A change that breaks one is a finding to fix before the PR is merged, not a suggestion.
<!-- shared:end -->
- In this repository, PR-Agent is run only at the pushes to PRs from branches of this repository, and commands in comments are ignored.
- Do not suggest changes in `theme/vendor/`, which is vendored with its licenses. Do not suggest changes in the bundles of `theme/`, from `npm run build`, either. They are compiled and committed on purpose.
- Read the section of `REFERENCE.md` on an element before you question it. Most of what looks unusual there is the design of the theme.

## Documentation

- Write each fact in one place, and link to it from the others.
- Do not write comments or docstrings in any file of the repository. Write what a reader needs to know into a name, a test, `REFERENCE.md`, or `src/AGENTS.md`. `test/comments.test.mjs` fails on every comment, apart from the license banner at the top of each bundle.
- `README.md` is hand-written for human readers by the maintainers, in their voice. If you have to edit it, keep this voice, and do not restyle it to the rules of this file.

## Terms

- Words with a narrower meaning than usual are defined in `GLOSSARY.md`.
- Before you coin a word, use the word that PowerPoint, Keynote, reveal.js, CSS, or everyday English already has.
- Give narrowed and coined words an entry in `GLOSSARY.md` as soon as they are settled. Name classes, attributes, and the labels of the editor after the glossary.
- Keep one meaning per word across the theme, the editor, `REFERENCE.md`, and the demo deck.

## Work on the template

Before you change `src/`, `theme/beeson.css`, `scripts/`, `test/`, or `.github/`, read `src/AGENTS.md` as well. The rules for the source of the theme, the editor, the exports, and the tests are written there.

## Skills

Repository skills are kept in `.agents/skills/`. For Claude Code, `.claude/skills` is a link to the same folder. When someone asks you to tighten, shorten, clean up, polish, fix, or review existing slides, follow `.agents/skills/refine-slides/SKILL.md`.

## Sibling repository

TyCHO (`https://github.com/beeson-group/tycho.git`) is the group's Python package and browser runtime for astrodynamics visualizations. Its viewer can be put on a slide. Read its `AGENTS.md` before you change it.
