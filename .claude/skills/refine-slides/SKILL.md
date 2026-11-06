---
name: refine-slides
description: Use when someone wants existing slides tightened, shortened, cleaned up, polished, fixed, or reviewed.
---

# Refine existing slides

Find the problems by looking at the deck, then fix them with the layout classes. Passing `npm run check` is not enough, since only page errors are reported.

## Look at the complete slides

Run `npm run pdf`, and read the last page of each slide in `slides.pdf`. If you cannot read a PDF with your tools, turn the pages into images first, e.g. with `pdftoppm` or PyMuPDF. The screenshots of `npm run check` show each slide before its first step, hence they are not enough, and text past the edge of a slide is cut off without an error. Open the light PNGs of `npm run check` as well, since a figure may be visible in one mode only.

List what you find, slide by slide, before you change anything. Look for these problems.

- Text that is cut off, or too close to a figure, the footnote, or the running head.
- A figure that is invisible or boxed in white in one mode. Fix it with `for-dark` and `for-light`, `paper`, or `invert`.
- A figure without a caption.
- Equations shown in red, which is a MathJax error and is not reported in the console.
- A heading that is repeated on another slide, or a topic as the heading of a slide with a finding. Write a finding only if it is shown on the slide, and otherwise a more specific topic.
- More than about 50 words on a slide, or two ideas on a slide. Count the words rather than estimate them.
- Hand-written `style` attributes. Replace them with `narrow`, `wide`, `figure`, or `split`.

## Tighten without losing anything

When the talk is too long, count one slide per minute, find the slides that are not needed for the main point, and move them behind the closing slide as backup slides. Move what you cut from a slide into its `aside.notes`, so that the speaker keeps it. Do not change a number, a claim, or an equation.

## Write in the voice of the group

Write slide text with a person as the subject, or with "is", "becomes", or a passive. Write "We continue the family through the fold", not "The method tracks the fold". Do not use semicolons, em dashes, or bold labels in front of a list item.

## Report

Run `npm run check` and `npm run pdf` at the end. Say in your last message what you changed per slide, what you moved to the notes or to the backup slides, and what a person still has to decide.
