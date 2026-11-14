# AGENTS.md

This repository is either slides, the template of the Beeson group for talks as HTML slides on reveal.js, or a talk that someone made from the template with the button "Use this template" of GitHub. The deck is `index.html`, i.e. the demo deck in the template and the talk in a talk. It is drawn by the theme in `theme/`, and it is edited in the browser with the editor, which is opened with the URL parameter `edit`.

## Hard invariants

A hard invariant is never traded away for another goal, and when a change would break one, you stop and ask the person you work for. A convention may be argued with.

1. A talk works without a toolchain, since the compiled `theme/beeson.js` and `theme/editor.js` are committed.
2. A deck does not fetch anything at show time, since everything it loads is vendored under `theme/vendor/` with its license.
3. A save of the editor keeps every byte of `index.html` outside the edited text elements.
4. Nothing in this repository is derived from DyLAN code.
5. Every feature is supported in all browsers, i.e. a deck can be viewed and presented, and every control can be used, in current Chrome, Firefox, and Safari on a desktop and on a phone. An extra such as an export or an editor command may be missing in one browser, and the user is then told so in a message.
6. Phones are supported.
7. Performance on a slow machine is always an objective.

## Writing a talk

- Write the talk over the demo deck in `index.html`, and keep `theme/` and `brand/` next to it, since `index.html` is the deck that `npm run check`, `npm run pdf`, and `npm run pptx` read by default.
- Read the section of `REFERENCE.md` on an element before you write one, since every class and attribute of the theme is described there.
- Use one `h2` per slide and an `h1` on a title slide, and keep a line of a text column under 66 characters.
- Design the complete slide first, and assign its steps afterward.
- Take every color from a tone of the theme, and do not add a title bar, a rule under a heading, an all-caps label, or an eyebrow, since none of them is part of the theme.
- Set a width in px in a `style` only on a heading, a paragraph, a list, a `math` div, a caption, or a cell in the top row of a table. A picture, a QR code, a TyCHO viewer, a shape, and a backdrop may take a width as well.
- Set a height in px in a `style` only on a shape, a backdrop, a row of a table, or an image or a video that has a width.
- Give a figure a version for each mode with `for-dark` and `for-light`, or the class `white-figure` or `invert`, since a figure may otherwise be visible in one mode only.
- Write a math macro used on more than one slide into `theme/macros.js`.
- Put the speaker notes of a slide in an `aside.notes`.
- Do not write `data-moves-on`, which is set by the theme when the deck is started.
- Someone may have the deck open in the editor while you change `index.html`. The editor then loads your change, and at the next save it merges the unsaved edits of this person into it.
- When you copy a newer `theme/` into a talk, convert every class and attribute listed under "Avoid" in `GLOSSARY.md` to its new name, since the theme reads only the new names.
- Read a PowerPoint file from its XML, and do not script PowerPoint, Keynote, or any other desktop app.

## Commands

```sh
npm ci && npm run vendor && npm run build   # the dependencies, theme/vendor/, theme/beeson.js, and theme/editor.js
npm run check                               # screenshots of every slide in both modes into check/, and the problems of the page
npm run check -- --browser firefox          # the same in Firefox, or in Safari with --browser safari
npm run pdf                                 # slides.pdf, one page per step
npm run pptx                                # slides.pptx, one click per step, with recordings of the scenes and the traced backdrops
npm run pptx -- --still                     # the same file without recordings, for a browser without an H.264 encoder
```

In a talk, `npm run check`, `npm run pdf`, and `npm run pptx` need only Node.js and Chrome, and not `npm ci`.

## Before you hand work over

- Run `npm run check` and `npm run pdf`, and hand work over only when `npm run check` passes.
- Look at the last page of each changed slide in `slides.pdf`, since text that runs off a slide is not reported by `npm run check`.
- Do not assume that a failure was there before your change.

## Issues and branches

- Before you start a change, search the open issues, the open pull requests, and the remote branches for the same work, and report what you find to the person you work for.
- Start a change from a GitHub issue. An issue is not needed for a change of under about 20 lines, a change of the documentation alone, or a dependency bump.
- Extend an existing issue when the change belongs to it, rather than opening a new one. Open a separate issue for a bug that can be reproduced on `main`.
- Open an issue with `gh issue create --type`, since the issue forms of the group cannot be filled in from the terminal. The type is `Bug` for a crash, a regression, or unintended behavior, `Feature` for behavior that the repository does not have yet, and `Task` for an investigation, a refactor, or a performance improvement without new behavior.
- Write a `Bug` under the headings What happened, What you expected, Steps or a minimal script to reproduce, and Version and browser. Write any other issue under the headings The problem, What you would like, and Alternatives.
- Name a branch `<surname>/<N>-<two-or-three-words>` in lowercase, where the surname is the one of the person you work for and `N` is the number of the issue. Create it with `gh issue develop <N> --name <branch> --checkout`, and leave `<N>-` out when the change does not have an issue.

## Commits and pull requests

- Start a bug fix from a regression test that fails for the reported reason, and commit this test first, alone, before the fix.
- Give each commit one purpose. Write its subject as a lowercase phrase that opens with an imperative verb, without an article at the start or a prefix such as `fix:`, and write the subject of a regression test as `add regression test:` followed by the behavior.
- Do not add an attribution line, such as `Co-Authored-By`, to a commit message.
- Open every issue description, pull request description, and comment that you write with the line `:robot: Generated by <harness>:<model>, not yet reviewed by the author :robot:`, where `<harness>` is the name of your harness and `<model>` is the id of your model. Delete this line only when the person you work for tells you that they have read the text.
- Open a pull request as a draft with `gh pr create --draft`, and fill in the template of the group. Write `Closes #N` on the line below the attribution line, and do not repeat the text of the issue in the description.
- Mark a pull request as ready for review only when every check is green and the person you work for agrees. When you think that a check itself is broken, say so in the description rather than changing the check.
- The reasons for these rules are explained for people in the [group contributing guide](https://github.com/beeson-group/.github/blob/main/CONTRIBUTING.md).
- Merge a pull request only when you are told to by the person you work for.

## Documentation

- A documentation change is not needed for most code changes, since a reader can read the code.
- Write each fact in one place, and link to it from the others.
- `README.md` is written for a human reader in the first-person voice of Claudio Vestini. When you edit it, keep this voice, and do not restyle it to the rules of this file.

## Terms

- The words with a narrower meaning than usual are defined in `GLOSSARY.md`.
- Before you coin a word, use the word that PowerPoint, Keynote, reveal.js, CSS, or everyday English already has.
- Give a word with a narrower meaning than usual, or a coined word, an entry in `GLOSSARY.md` the moment it is settled, and name classes, attributes, and the labels of the editor after the glossary.
- Keep one meaning per word across the theme, the editor, `REFERENCE.md`, and the demo deck.

## Work on the template

Before you change `src/`, `theme/beeson.css`, `scripts/`, `test/`, or `.github/`, read `src/AGENTS.md` as well, where the rules for the source of the theme, the editor, the exports, and the tests are written.

## Skills

The skills of the repository are kept in `.agents/skills/`, and `.claude/skills` is a link to the same folder for Claude Code. When someone asks you to tighten, shorten, clean up, polish, fix, or review existing slides, follow `.agents/skills/refine-slides/SKILL.md`.

## Sibling repository

TyCHO (`https://github.com/beeson-group/tycho.git`) is the Python package and browser runtime of the group for astrodynamics visualizations, and its viewer can be put on a slide. Read its `AGENTS.md` before you change it.
