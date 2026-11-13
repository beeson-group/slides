// Exports a deck to PowerPoint, so that a click is a step of the deck.
//
//   node scripts/export-pptx.mjs [deck] [output]
//
// The default deck is index.html, and the default output is slides.pptx. Each step is an image of
// the print view of the deck, the same view as in scripts/export-pdf.mjs, hence the text is not
// editable and the backdrops are static. Each step is a PowerPoint slide of its own, except on a
// slide with a video. A video is placed over its image as a PowerPoint video, and it would be
// restarted on a new PowerPoint slide, hence the steps that show it are stacked on one PowerPoint
// slide under the video, and each later step is shown on a click. The notes of a slide are copied
// to each of its PowerPoint slides, and each item of a list in the notes is a paragraph of its own
// after a dash.
// Keynote opens this file too. The script exits nonzero on a JavaScript error in the page, and on a
// video without an MP4 source, since MP4 is the one format that plays in every version of PowerPoint.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deckUrl, launch, printView } from './chrome.mjs';
import { pptx } from './pptx.mjs';

const [deck = 'index.html', output = 'slides.pptx'] = process.argv.slice(2);

// a step is a .pdf-page. A video that is hidden, e.g. by the style of its fragment or under a later
// video of its place, or in a step still to come, is left out. A video of the fragment style play
// is thus in the image of the steps before its own, with its poster. Its box is the box of the
// picture, which is smaller than the element under object-fit: contain, and a video of PowerPoint is
// stretched to its box
const listSteps = `[...document.querySelectorAll('.pdf-page')].map((step) => {
  const page = step.getBoundingClientRect();
  const notes = [...step.querySelectorAll('aside.notes')]
    .flatMap((aside) => {
      const copy = aside.cloneNode(true);
      for (const li of copy.querySelectorAll('li')) {
        li.prepend('\\n\\n– ');
        li.append('\\n\\n');
      }
      return copy.textContent.split(/\\n\\s*\\n/);
    })
    .map((text) => text.replace(/\\s+/g, ' ').trim())
    .filter(Boolean);
  const videos = [...step.querySelectorAll('video')]
    .filter((video) => video.getClientRects().length && getComputedStyle(video).visibility !== 'hidden'
      && !video.closest('.fragment:not(.visible)'))
    .map((video) => {
      const box = video.getBoundingClientRect();
      const [left, top] = getComputedStyle(video).objectPosition.split(' ').map((p) => parseFloat(p) / 100);
      const scale = Math.min(box.width / video.videoWidth, box.height / video.videoHeight);
      const width = video.videoWidth * scale, height = video.videoHeight * scale;
      return {
        sources: [video.src, ...[...video.querySelectorAll('source')].map((source) => source.src)].filter(Boolean),
        x: box.x - page.x + (box.width - width) * left,
        y: box.y - page.y + (box.height - height) * top,
        width,
        height,
        duration: video.duration * 1000,
        loop: video.loop,
        muted: video.defaultMuted,
      };
    });
  return {
    top: window.scrollY + page.y,
    // the first step of a slide does not show a fragment
    continues: !!step.querySelector('.fragment.visible'),
    name: step.querySelector('h1, h2')?.textContent ?? '',
    notes,
    videos,
  };
})`;

// joins each step to the slide before it if both are of one slide of the deck and show the same videos
function stackSteps(steps) {
  const slides = [];
  for (const { top, continues, ...step } of steps) {
    const last = slides.at(-1);
    const same = step.videos.length && JSON.stringify(step.videos) === JSON.stringify(last?.videos);
    if (continues && same) last.tops.push(top);
    else slides.push({ ...step, tops: [top] });
  }
  return slides;
}

function localFile(video) {
  const source = video.sources.find((url) => new URL(url).pathname.toLowerCase().endsWith('.mp4'));
  if (!source) throw new Error(`a video does not have an MP4 source, which PowerPoint needs: ${video.sources.join(', ') || 'no source'}`);
  if (!Number.isFinite(video.duration)) throw new Error(`a video did not load: ${source}`);
  return fileURLToPath(source);
}

const browser = await launch();
let failed = false;
try {
  // twice the design size, since an image of text is blurred on a display above 1080 lines
  const page = await browser.newPage({ scale: 2 });
  await printView(page, deckUrl(deck, 'print-pdf&still'));
  const steps = await page.evaluate(listSteps);
  const slides = stackSteps(steps);
  for (const slide of slides) {
    slide.images = [];
    for (const top of slide.tops) {
      await page.evaluate(`window.scrollTo(0, ${top})`);
      await page.waitFor(`new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))`);
      slide.images.push(await page.screenshot());
    }
    for (const video of slide.videos) {
      video.path = localFile(video);
      const { x, y, width, height } = video;
      video.poster = await page.screenshot({ x, y: slide.tops.at(-1) + y, width, height, scale: 1 });
    }
  }
  writeFileSync(output, pptx(slides));
  const videos = slides.reduce((total, slide) => total + slide.videos.length, 0);
  console.log(`${output}: ${slides.length} slides for ${steps.length} steps of ${deck}, placed videos: ${videos}`);
  for (const error of page.errors) console.error(`page error: ${error}`);
  if (page.errors.length) failed = true;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
