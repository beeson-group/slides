# slides

Our all-in-one tool for building HTML slides, built on [reveal.js](https://revealjs.com/).

## A word from the authors

HTML slides are greatly more expressive than any of the alternatives.

But editing raw HTML sucks.

So we built our own in-house editor, which combines the best ideas from PowerPoint, Keynote, and Beamer, all in one place.  
Minus all the bloat.

The slides (and editor) consist of a single [index.html](/index.html) file, which you open with a double click, from any machine (mobile too), without any requirements other than having a browser. They are themed to the [Beeson Group](https://beeson.princeton.edu/)'s colors. 

PRE-RELEASE: The template is currently still in beta. View the most up to date version of the template at [beeson-group.github.io/slides](https://beeson-group.github.io/slides/)

## Using this template

1. From GitHub, click the green 'Use this template' button on the top right angle of this repo's landing page, then 'Create a new repository'. I recommend toggling 'Include all branches' off and naming your repository something like `talk-{name-of-your-talk}`. The name of the repository becomes part of the URL of the slides on GitHub Pages (where your repo's slides are automatically deployed), e.g. `https://{owner}.github.io/talk-{name-of-your-talk}/`, where OWNER is your GitHub username.
2. (Optional) Modify `README.md` of the new repository with information about your talk, overwriting the text you are reading right now.
3. To create and edit your slides, open `index.html` (at the root of this repository) in your favorite browser. Then, press the `e` key on your keyboard. This will enter editor mode.
(This appends the text `?edit` your browser tab's URL bar, e.g. `https://{owner}.github.io/talk-{name-of-your-talk}?edit`. You can reach the editor by typing this out manually too).
4. When you are happy, click on the save button, which overwrites your repository's local `index.html`. We also support exports to the PDF and PPTX file formats (File > Export To > PDF… while in editor mode).

## Editing with agents

This tool was built with agents.

To create custom backdrops, animations, or other effects you want in your slides, ask your favorite agent. This repo contains an [AGENTS.md](/AGENTS.md) for this purpose. Collaboration with agents is encouraged to unleash the full expressive power of HTML. We have also been adding useful skills (found at [/.agents/skills/](/.agents/skills/)) which your agent will automatically find and load if it thinks it appropriate. If you don't have access to a coding agent, however, do not worry: you will be able to do everything you know how to do in PowerPoint/Keynote from our editor mode, including creating new slides, modifying, moving, and resizing text boxes or titles, setting up steps to determine the order of appearance of your slide elements in the presentation, and a lot more. You will also be able to accomplish what other slide editor apps do NOT enable you to do: edit LaTeX boxes directly from the slide they appear on (which compile with one click), edit and animate code in code boxes the same way, set up custom QR codes with ease, and, again, a lot more.

## Presenting

To present your slides, click on the Present button at the top of your editor. This will enter presentation mode. While in presentation mode, press `d` (or click on the top right toggle) to flip between dark and light themes, `s` to enter speaker view (with your notes), `p` to toggle on/off a pointer, `f` to enter (or leave) full screen mode (which hides the tabs and the address bar), and `o` for an overview of your slides. The theme defaults to dark. If you want your slides to to default to light theme, add `?theme=light` to the address.

Title, section, and closing slides are never numbered, and the slides after the closing slide default to being the appendix, numbered A1, A2, and so on.

Move the mouse near the bottom edge of the window to magnify the progress line into a scrubber. You can use the scrubber to jump to any numbered slide, forwards or backwards, so you never have to click through your entire presentation to go back to an earlier slide after a question. You can time a rehearsal of your presentation, setting the total time you expect your presentation to last: the scrubber will then automatically show the target start time for each numbered slide. To access rehersal mode or timestamp settings, open Play > Rehearse Timings while in editor mode.

You can go back to editor mode any time by pressing `e` while in presentation mode.

## License

The code itself and the `beeson` theme are [MIT](/LICENSE.md). The Princeton and group logo in `brand/` are trademarks and are NOT COVERED by this license. See [brand/NOTICE.md](/brand/NOTICE.md) for more information.
