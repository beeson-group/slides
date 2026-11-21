# Glossary

The words used in slides in a narrower sense than in everyday English, and the words coined for slides, are defined here, each with one meaning across the theme, the editor, `REFERENCE.md`, and the demo deck. An entry is added the moment a term is settled, and the classes, the attributes, and the labels of the editor are named after it. The old name of a renamed class or attribute is listed under "Avoid", so that you can convert an old talk by hand.

## Animated plot

A 2D figure on a slide that is played as an animation, drawn from the JSON data written next to it, with one or more plot panels.

Avoid "chart" and "graph". The class of an animated plot is `plot`.

## Attach

To join an end of a line to an element in the editor, so that the end is moved together with the element.

Avoid "glue".

## Backdrop

The drawing of orbits behind the words of a slide, or in its figure box, chosen by name from the built-in drawings or drawn from a file of trajectories.

Avoid "background", and avoid "scene", which means only a TyCHO scene. The attribute `data-scene` of an old talk is `data-backdrop`.

## Badge

The count of the open threads of an element or a slide in a session, drawn at its upper right corner on the canvas, and filled violet while one of them is unread.

Avoid "pin" and "marker", and avoid "bubble", which is the message shown at a refused edit of a held element.

## Bibliography

The file `references.bib` next to the deck, from which the references of its citations are written into `tex.js`.

Avoid "library" and "references file".

## Chip

A small rounded tile with a short text, e.g. the initials of a person on a collapsed name flag, or the tint behind inline code.

## Citation

The empty `cite` after the cited words of a slide, with the key of a paper of the bibliography in `data-key`, drawn as the number of the paper on its slide.

Avoid "footnote", which is the `foot` line of a slide, and "reference", which is the short entry of the cited paper.

## Comment

A text that a person of a session writes on an element or a slide, kept in `.session/comments.json` and never in `index.html`.

Avoid "note", which is a speaker note, and "annotation". Write "HTML comment" for a comment `<!-- -->` in the source of a deck.

## Convention

A rule of slides that is followed by default and may be argued with, as opposed to a hard invariant.

## Data file

A file of the talk folder that a TikZ figure reads, e.g. a CSV file of a pgfplots `table`. From Data… writes a CSV file into `figures/` as the data file of a new figure, and the edit command compiles a figure again after a change of one of its data files.

## data-own-keys

The attribute of a field of the editor in which the keys of commands that the field takes for itself are named, separated by spaces. In the field of a comment, it is `Mod+Enter`, i.e. Cmd+Enter on a Mac and Ctrl+Enter elsewhere, which then sends the comment and does not start Present. A key named there is taken with the other of these two modifiers as well, e.g. Ctrl+Enter on a Mac.

## Delay

The seconds between the click of a step and the moment an element is shown, as the Delay of an animation in PowerPoint. It is written as the key `delay` of an element of an animated plot, and as `--delay` on a late step.

## Dialog

A window of the editor that is shown over the deck to ask a question or to give a message, until it is answered or closed.

Avoid "card". The heading over the scrubber of the progress line is not a card either, and its class is `scrub-heading`.

## Edit command

The program that a host runs during a session, `theme/edit.mjs`, started with `npm run edit` or with a launcher. With it, the talk folder is served to the browsers of the session, the one text of the deck that everyone edits is kept, `index.html` and `tex.js` are written, and the TikZ figures are compiled.

Avoid "server" and "daemon".

## Figure box

The box at the right of a content slide or of a split slide in which a figure is placed.

Avoid "zone", the class of a figure box in an old talk, which is `figure-box`.

## Fly

A step that moves and scales its element from the box of other elements of its slide into its own box, as the Fly In of PowerPoint flies an element in from an edge. It is written as `data-fly-from` on a fragment, with `data-fly-to` and `data-fly-duration`.

Avoid "Magic Move", which matches the elements of two slides.

## Focus

The step from which every step shown on its slide is held at full opacity, written as `data-focus` on a fragment, e.g. on an empty `span` after the steps of a comparison. It is not the keyboard focus of the editor.

## Follow

To keep your view of the editor on the slide and the selection of another person of a session, from a click on the avatar of this person until you stop.

Avoid "spotlight" and "watch".

## For You

The filter of the Comments pane under which the open threads that you wrote, replied to, or are mentioned in are listed.

## Full view

The page of a deck at the scale at which it is opened, i.e. not zoomed by the browser.

## Guest

A person who has joined a session through its link, in any browser.

Avoid "collaborator" and "peer".

## Hard invariant

A rule of slides that is never traded away for another goal, and that an agent does not break without asking first. The hard invariants are listed at the top of `AGENTS.md`.

## Heading

The title line at the top of a slide, i.e. its `h2`, or the `h1` of a title slide.

Avoid "head" for the heading of a figure slide, since a head is the moving dot at the tip of a trajectory while it is traced, or the title of a theorem as in amsthm.

## Hold

To have your caret in a text element of a session, having typed or put the caret into it within the last 30 s. The others can type in an element that you hold and format its text, and they cannot move, restyle, split, join, or delete it until the hold ends.

Avoid "lock", which is the command Lock of the Arrange menu.

## Host

The person who started a session. The edit command runs on the machine of the host, and `index.html` is written in the talk folder of the host.

Avoid "owner".

## Iris

To grow a region of an animated plot as a disk from a point until the region is filled, as its step is shown, as an iris opens in film. The seconds of the growth are written in the key `iris` of the region, and the point in its key `from`.

The key `spread` of an old talk is `iris`.

## Jump

A move of the show to a slide that is neither the next one nor the previous one, e.g. with the scrubber, in the overview, with the Home or the End key, or with a link. After a jump back, the slide is shown with every step, and after a jump ahead, at its first step.

## Kind

The sort of a theorem, e.g. lemma, definition, or proof, written in `data-kind`, which gives its title, its style, and its counter.

Avoid "type" and "environment".

## Label

A short text placed at a point of a backdrop or of a surface, such as the name of L1 or of the Moon.

Avoid "lab", the class of a label in an old talk, which is `label`.

## Last viewed slide

The slide and the step that were left at the last jump. On the band of the scrubber, an angle that points back is drawn before its number or its name, and a click on it shows the slide at the step left.

Avoid "mark", which is a drawn element of an animated plot.

## Late step

An element shown a number of seconds after the click of its step, as an animation of PowerPoint with a delay. It is written as a fragment of the class `late`, with the seconds in the custom property `--delay` of its style.

Avoid "delayed step", which is a step that starts After Previous, written with `data-autoslide` on the step before. The custom property `--late` of an old talk is `--delay`.

## Launcher

A file in a talk folder with which the edit command is started by a double click: `Edit.command` on macOS, `Edit.cmd` on Windows, and `Edit.sh` on Linux.

## Layer

The place of an element in the stacking order of its slide, i.e. which elements it is drawn in front of and which behind.

Avoid "layer" for the steps of a slide that the editor shows at once, which do not have a noun.

## Mark

A drawn element of an animated plot, such as a curve or a trace.

Avoid "mark" outside a plot. Write "bullet" for the sign of a list item, "logo" or "trademark" for a file in `brand/`, "surface point" for a point of a surface, and "Markdown syntax" for the signs that format a text.

## Mention

A name of a person picked from the list after an @ in a comment, with which the thread is listed under For You for this person. A name typed by hand is not a mention.

Avoid "tag" and "ping".

## Name flag

The small box with the name of a person at the upper left corner of the frame of an element that this person selected in a session.

Avoid "cursor", "tag", and "badge".

## Outline list

The list of the sections of a talk on a section slide, written empty with `data-auto` and given the heading of each section slide as an item when the deck is shown. The item of the section of its slide is drawn in `--text`, and the others are muted.

Avoid "agenda" and "table of contents".

## Overview

The view of reveal.js in which the slides of a show are shown small in one row. It is opened with the key O, or on a touch screen with a pinch closed at the full view, since a pinch on a zoomed page is the zoom of the browser. The row is moved with the arrow keys, a swipe, or a sideways wheel, and a slide is shown with a tap, a click, or a pinch open on it.

Avoid "Slide Sorter", which is the grid of the editor.

## Part

A named scope or curve of a TikZ figure that a slide shows as a step.

Avoid "part" for an element of a slide or for a mark of an animated plot. A part is written with the key `part` in the source and with `data-part` on its span in the deck. Avoid "Figure Part" for its row in the Steps pane, which reads Part and its name.

## PDF figure

A page of a PDF on a slide, shown as the image of its render for each mode, or as one render in the colors of the PDF. Its PDF is named in `data-pdf` and its page in `data-page`.

Avoid "PDF image" and "embedded PDF".

## Pinch closed

Two fingers moved together on a touch screen.

Avoid "pinch in" and "zoom out".

## Pinch open

Two fingers moved apart on a touch screen.

Avoid "pinch out" and "zoom in".

## Plate

The figure box over the whole of a figure slide, behind its heading and its caption.

Avoid "plate" for a layout of a slide, such as the title, closing, or figure layout.

## Play once

To play a tab of an animated plot from its first frame to its last and to hold it at its last frame, at a step with `data-plot-once`. A plot started by a step with `data-plot-play` is played in a loop instead.

Avoid "run", which is the running head of a section, written with `data-run`. The attribute `data-plot-run` of an old talk is `data-plot-once`.

## Plot panel

One set of axes of an animated plot, as a panel is in TyCHO.

Avoid "panel" for the text column of a split slide.

## Preamble

The LaTeX definitions of a talk in `preamble.tex` next to the deck, i.e. its macros, environments, packages, and kinds of theorem.

Avoid "macros file", "header", and "style file". The `theme/macros.js` of an old talk is moved into `preamble.tex` by `npm run tex`.

## Presence

What a person in a session sees of the others: who is there, the slide each one is on, and what each one has selected or is typing.

Avoid "awareness" and "cursors".

## Reach

The height at the bottom edge of the window within which a pointer opens the band of the scrubber. It is higher for a finger than for a mouse.

Avoid "strip", which is the surface of a strip bundle.

## Reference

The short entry of a cited paper in the footnote line of its slide, e.g. Koon et al., Chaos 10 (2000).

Avoid "footnote" and "citation".

## Relay

The program through which a guest reaches the edit command of a host, which can be reached only from the computer of the host. A deck is never kept on it.

Avoid "server" and "hub".

## Render

The PNG of the page of a PDF figure, written by the editor or by `npm run tex`, in the colors of a mode or in those of the PDF.

Avoid "rasterization" and "preview".

## Rest

The time for which a pointer stays in the reach before the band of the scrubber is opened. A pointer on its way to a control low on a slide crosses the reach without a rest.

Avoid "delay", which is the delay of a step, and avoid "dwell".

## Scrubber

A line of progress with ticks, on which a place is chosen with the pointer. The scrubber of a show is its progress line, magnified into a band while it is open. A tick is the place of a numbered slide on the band. The name of a section is the text of its running head, and the name of the closing slide is its heading, both written over the ticks. The scrubber of an animated plot is the line under the plot, with a tick at each event.

## Session

One run of the edit command on a talk folder, from its start to its stop, together with the people who have joined it.

Avoid "room", and avoid "document" for the deck of a session.

## Set aside

The version of the deck of a person that is kept apart from the deck when this person chooses Keep theirs after a conflict, so that it is not lost. It is listed under Set aside in Version History.

## Sheet

A panel of the editor in which a source is edited with a live preview, i.e. the Preamble sheet and the Bibliography sheet, the sheet of a formula, and the Edit Source sheet of a TikZ figure.

Avoid "window", "dialog", and "pane". A dialog of a session that is fitted to the visible part of the page is not a sheet either, and its class is `beeson-session-fit`, not `beeson-session-sheet`.

## Slide Sorter

The view of the editor in which every slide is shown as a thumbnail in a grid, grouped by section, to select and reorder the slides and the sections, as in PowerPoint and Keynote.

Avoid "Chapters Table".

## Source

The text from which an output is compiled: `figures/name.tex` for a TikZ figure, and `preamble.tex` and `references.bib` for `tex.js`. The source of a TikZ figure is changed in its Edit Source sheet, or with the fields of the TikZ Figure pane when From Data… wrote it.

Avoid "Edit TeX…" for Edit Source….

## Stack

A `div` with the class `r-stack` of reveal.js, whose children are drawn in one place and shown one at a time, each from its step until the step of the next child, as the `overprint` of Beamer. In the editor, each child is shown alone under its own tab at the slide, as if it were a separate slide.

Avoid "pane", "layer", "panel", and "tab" for a child of a stack. Avoid "stack" for the vertical slides of reveal.js.

## Step

The click of the talk at which an element appears, is dimmed, or is hidden, written as a reveal.js fragment.

Avoid "fragment" outside the markup, and avoid "click" and "build". Avoid "card" for a step in the Steps pane of the editor.

## Strip

The surface swept along the orbit of a strip bundle by a segment through each point of the orbit, along a unit direction given at the point, e.g. an eigendirection of the monodromy matrix. A rib is one of these segments, drawn as a line at a point named in the key `ribs` of the strip.

## Strip bundle

A closed orbit drawn in 3D with the strips along it, from the JSON script named in `data-bundle` on a `surface`, with a compass toward far points. The strips shown at a step are named in `data-surface-state`, as the state of a surface.

## Surface point

A named point on a surface, which is shown, dimmed, or filled in a tone at a step.

Avoid "surface mark". The attribute `data-surface-marks` of an old talk is `data-surface-points`.

## Surface state

What a surface shows at a step, set on a fragment of its slide.

Avoid "stage". The attribute `data-surface-stage` of an old talk is `data-surface-state`. The states `flat`, `wells`, `bowl`, and `sum` of the function `effective-potential` in an old talk are `zero`, `gravitational`, `centrifugal`, and `effective`.

## Synchronous editor

The editor while several people edit one deck at the same time, each in a browser, with every change shown to the others as it is made.

Avoid "co-authoring", "multiplayer", and "live share". "Collaboration" is kept for work on a talk through git.

## Tab

One named data set of an animated plot, chosen with its button under the plot.

## Tagged version

A version given a tag with Tag this version in Version History. A tagged version is kept when the history is shortened.

Avoid "named version".

## Talk folder

The folder of a talk, in which `index.html` is kept next to `theme/`, `brand/`, and the other files that the deck loads, e.g. `media/`, `figures/`, and `tex.js`. In a session, it is downloaded as a zip with File > Export To > Talk Folder….

## Text box

A paragraph that is added to a slide with Insert > Text Box and placed freely, as in PowerPoint and Keynote. A text box is one kind of text element.

## Text column

The column of words at the left of a content slide or of a split slide. On a split slide it is a dark box of its own.

Avoid "panel", the class of the text column of a split slide in an old talk, which is `text-column`. The custom properties `--panel` and `--panel-text` of an old talk are `--text-column` and `--text-column-text`.

## Text element

An element whose text is edited in place in the editor, such as a heading, a paragraph, a list item, a cell of a table, a caption, the footnote, a display of math, a label, or the speaker notes.

Avoid "block". The class `block` of the words of a title or closing slide in an old talk is `title-text`.

## Theorem

A paragraph of the class `theorem`, headed by the title of its kind, its number, and its name, as a theorem, a lemma, or a proof in amsthm. The head of a theorem is this title, number, and name, which is not the head of a trajectory.

Avoid "statement", "block", "card", "box", and "environment".

## Thread

A comment together with its replies, on one element or slide, which is resolved and reopened as one.

Avoid "conversation" and "discussion".

## TikZ figure

A figure written in TikZ or pgfplots as a source `figures/name.tex`, compiled by `npm run tex` or the edit command into the output `figures/name.js` with an SVG for each mode, and drawn into a `div.tikz` with the same name in `data-figure`. It is compiled at the size of its box, i.e. the `width` and the `height` in px of its `style`. A new one is inserted with Insert > TikZ Figure > From Data…, From File…, or Blank.

Avoid "TikZ" alone for the element, also as its kind in the editor, and avoid "plot", which means an animated plot. Avoid "Plot…" and "Data Plot…" for From Data…, "TeX File…" for From File…, and "Drawing" and "Empty" for Blank.

## Toast

A short message of a session shown above the status bar for 6 s, e.g. Ana restored the version of 2:41 PM, sometimes with a button.

Avoid "notification" and "snackbar".

## Tone

A color of the theme chosen by name, such as accent, violet, blue, or red, with a value for each mode.

## Trajectory

One polyline of a file of trajectories, traced over its times or its true anomalies.

Avoid "strand" and "record". The attribute `data-strands` of an old talk is `data-trajectories`.

## Version

A state of the deck kept by the edit command during a session, with its time and the people who changed the deck since the version before, and listed in Version History.

Avoid "revision", "snapshot", and "checkpoint".

## Wipe

To trace a curve of an animated plot from its first point to its last as its step is shown, as the Wipe of PowerPoint does. The seconds of the tracing are written in the key `wipe` of the curve.

Avoid "draw", which is said of every element on a slide. The key `draw` of an old talk is `wipe`.
