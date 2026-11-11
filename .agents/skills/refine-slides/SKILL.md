---
name: refine-slides
description: Use when someone wants existing slides tightened, shortened, cleaned up, polished, fixed, or reviewed.
---

# Refine existing slides

Find the problems by looking at the deck, then fix them with the layout classes. Passing `npm run check` is not enough, since only page errors are reported.

## Look at the complete slides

Run `npm run pdf`, and read the last page of each slide in `slides.pdf`. If you cannot read a PDF with your tools, turn the pages into images first, e.g. with `pdftoppm` or PyMuPDF. In the screenshots of `npm run check`, each slide is shown before its first step, and text past the edge of a slide is cut off without an error. Open the light PNGs of `npm run check` as well, since a figure may be visible in one mode only.

List what you find, slide by slide, before you change anything. Look for these problems.

- Text that is cut off, or too close to a figure, the footnote, or the running head.
- A figure that is invisible or boxed in white in one mode. Fix it with `for-dark` and `for-light`, `paper`, or `invert`.
- A figure without a caption.
- Equations shown in red, which is a MathJax error and is not reported in the console.
- A repeated heading, or a topic in place of a finding. Write a finding only if it is shown on the slide, and otherwise a more specific topic.
- More than about 50 words on a slide, or two ideas on a slide. Count the words rather than estimate them.
- Hand-written `style` attributes. Replace them with `narrow`, `wide`, `figure`, or `split`.

## Tighten without losing anything

When the talk is too long, count one slide per minute, find the slides that are not needed for the main point, and move them behind the closing slide as backup slides. Move what you cut from a slide into its `aside.notes`, so that the speaker keeps it. Do not change a number, a claim, or an equation.

## Write in the voice of the group

Make a person the subject of every active verb in the text that you write, headings included. A thing may be the subject only of "is", "becomes", or a passive, and a passive with a thing after "by" is the same fault. Write "We continue the family through the fold", not "The method tracks the fold", and "We stop the run early with the certificate", not "The run is ended early by the certificate". Write "the period of the orbit", not "the orbit's period". The common forms "Figure 3 shows" and "the bound holds" are fine.

Reread every sentence that you wrote with a thing as its subject, and do not repair one by swapping its active verb for another. Do not use semicolons, em dashes, or bold labels in front of a list item.

## Report

Run `npm run check` and `npm run pdf` at the end. Say in your last message what you changed per slide, what you moved to the notes or to the backup slides, and what a person still has to decide.
