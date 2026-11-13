// Exports a deck to PowerPoint, so that a click is a step of the deck.
//
//   node scripts/export-pptx.mjs [--still] [deck] [output]
//
// The default deck is index.html, and the default output is slides.pptx. Each step is an image of
// the print view of the deck, the same view as in scripts/export-pdf.mjs, hence the text is not
// editable. A backdrop that the deck traces or loops is recorded into an MP4 in scripts/record.mjs,
// from the first step of its slide at which it is traced. The PowerPoint slide of this step holds
// the last frame of the recording as its image, the recording over it, which starts with the slide,
// and a picture of the words of each step over the recording. Each later step that shows the same
// videos is shown on a click on this PowerPoint slide. Each tycho scene is recorded into an MP4 in
// scripts/scenes.mjs, and it is placed in the box of its viewer as a video. A video is placed over
// its image as a PowerPoint video, and it would be restarted on a new PowerPoint slide, hence the
// steps that show it are stacked on one PowerPoint slide under the video, and each later step is
// shown on a click. A recording would be restarted as well, hence a step that changes the videos of
// a recorded slide starts a PowerPoint slide whose images show the backdrops complete. Any other
// step is a PowerPoint slide of its own. With --still, the backdrops are drawn complete, a scene is
// left in the images as the still of its first frame, and an H.264 encoder is not needed. The notes
// of a slide are copied to each of its PowerPoint slides, and each item of a list in the notes is a
// paragraph of its own after a dash.
// Keynote opens this file too. The script exits nonzero on a JavaScript error in the page, on a
// video without an MP4 source, since MP4 is the one format that plays in every version of
// PowerPoint, and on a backdrop or a scene that is not recorded, e.g. in a browser without an H.264
// encoder.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deckUrl, launch, printView } from './chrome.mjs';
import { pptx } from './pptx.mjs';
import { recorder } from './record.mjs';
import { recordScenes, showFirstFrames } from './scenes.mjs';

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg.startsWith('--') && arg !== '--still');
if (unknown.length) {
  console.error(`unknown option ${unknown.join(', ')}. Usage: node scripts/export-pptx.mjs [--still] [deck] [output]`);
  process.exit(1);
}
const still = args.includes('--still');
const [deck = 'index.html', output = 'slides.pptx'] = args.filter((arg) => arg !== '--still');

// a step is a .pdf-page. A video that is hidden, e.g. by the style of its fragment or under a later
// video of its place, or in a step still to come, is left out. A video of the fragment style play
// is thus in the image of the steps before its own, with its poster. Its box is the box of the
// picture, which is smaller than the element under object-fit: contain, and a video of PowerPoint is
// stretched to its box. A scene is listed as a video with the number of its viewer, in the box of
// the still of its viewer, and without --still it is left out of the images in the same way
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
  const videos = [...step.querySelectorAll(${JSON.stringify(still ? 'video' : 'video, .viewer-still')})]
    .filter((video) => video.getClientRects().length && getComputedStyle(video).visibility !== 'hidden'
      && !video.closest('.fragment:not(.visible)'))
    .map((video) => {
      const box = video.getBoundingClientRect();
      if (video.localName !== 'video') {
        return { scene: Number(video.dataset.still), x: box.x - page.x, y: box.y - page.y, width: box.width, height: box.height };
      }
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

// joins each step to the slide before it if both are of one slide of the deck and show the same
// videos, and keeps the scroll offset and the index of each step. live holds the indices of the
// traced backdrops of each step, or it is null with --still. a slide is recorded from the first step
// of its slide of the deck with a traced backdrop, and the steps after it are joined to it while
// they show the same videos, none included. a recording would restart on a later PowerPoint slide,
// hence the slide after a change of the videos is not recorded
function stackSteps(steps, live) {
  const slides = [];
  let recorded = null, started = false;
  for (const [index, { top, continues, ...step }] of steps.entries()) {
    if (!continues) started = false;
    const last = slides.at(-1);
    const same = continues && JSON.stringify(step.videos) === JSON.stringify(last?.videos);
    if (same && (step.videos.length || last === recorded)) {
      last.offsets.push(top);
      last.steps.push(index);
      continue;
    }
    const slide = { ...step, offsets: [top], steps: [index], recorded: !started && !!live?.[index].length };
    started ||= slide.recorded;
    recorded = slide.recorded ? slide : null;
    slides.push(slide);
  }
  return slides;
}

function localFile(video) {
  const source = video.sources.find((url) => new URL(url).pathname.toLowerCase().endsWith('.mp4'));
  if (!source) throw new Error(`a video does not have an MP4 source, which PowerPoint needs: ${video.sources.join(', ') || 'no source'}`);
  if (!Number.isFinite(video.duration)) throw new Error(`a video did not load: ${source}`);
  return fileURLToPath(source);
}

// the box and the name of the slide of each scene, at its first step, by the number of its viewer
function sceneBoxes(slides) {
  const boxes = new Map();
  for (const slide of slides) {
    for (const { scene, width, height } of slide.videos) {
      if (scene !== undefined && !boxes.has(scene)) boxes.set(scene, { width, height, name: slide.name });
    }
  }
  return boxes;
}

// whether a backdrop of the print view is traced or looped at a step, as in live() of
// scripts/record.mjs, which is made only once the encoder is checked
const traced = `[...document.querySelectorAll('.pdf-page .backdrop')].some((el) => {
  const orbits = Beeson.backdrops.find((o) => o.el === el);
  return !!orbits && Beeson.animated(orbits);
})`;

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

// with wholeFrames, since the pictures are taken in the page where the recordings are made
const browser = await launch({ wholeFrames: true });
let failed = false;
try {
  // twice the design size, since an image of text is blurred on a display above 1080 lines
  const page = await browser.newPage({ scale: 2 });
  // by default, a .pdf-page of reveal.js is a pixel shorter than its slide, and a picture of 1080 px
  // would then end on the first row of the next page
  await printView(page, deckUrl(deck, 'print-pdf&still&pdfPageHeightOffset=0'));
  const steps = await page.evaluate(listSteps);
  // the recorder fails in a browser without an H.264 encoder, which a deck without a traced
  // backdrop does not need
  const rec = !still && (await page.evaluate(traced)) ? await recorder(browser) : null;
  const slides = stackSteps(steps, rec && (await rec.live(page)));
  let start = Date.now();
  const scenes = await recordScenes(browser, deck, sceneBoxes(slides));
  if (scenes.size) console.log(`recorded scenes: ${scenes.size} in ${seconds(Date.now() - start)}`);
  await showFirstFrames(page, scenes);
  // a page behind another one, e.g. behind the page of the scenes, is not given animation frames
  await page.send('Page.bringToFront');
  let backdrops = 0, recording = 0;
  const scrollTo = async (top) => {
    await page.evaluate(`window.scrollTo(0, ${top})`);
    await page.waitFor(`new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))`);
  };
  for (const slide of slides) {
    if (slide.recorded) {
      start = Date.now();
      const { recording: { data, poster, duration, loop }, still: image, tops } = await rec.record(page, slide.steps);
      Object.assign(slide, { images: [image], recording: { data, poster, duration, loop }, tops });
      backdrops++;
      recording += Date.now() - start;
      await scrollTo(slide.offsets.at(-1));
    } else {
      slide.images = [];
      for (const top of slide.offsets) {
        await scrollTo(top);
        slide.images.push(await page.screenshot());
      }
    }
    for (const video of slide.videos) {
      // the same Buffer of a scene on several PowerPoint slides is embedded once in pptx
      if (video.scene !== undefined) {
        Object.assign(video, scenes.get(video.scene), { muted: true });
        continue;
      }
      video.path = localFile(video);
      const { x, y, width, height } = video;
      video.poster = await page.screenshot({ x, y: slide.offsets.at(-1) + y, width, height, scale: 1 });
    }
  }
  if (backdrops) console.log(`recorded backdrops: ${backdrops} in ${seconds(recording)}`);
  writeFileSync(output, pptx(slides));
  const videos = slides.reduce((total, slide) => total + slide.videos.filter((video) => video.scene === undefined).length, 0);
  console.log(`${output}: ${slides.length} slides for ${steps.length} steps of ${deck}, placed videos: ${videos}`);
  for (const error of page.errors) console.error(`page error: ${error}`);
  if (page.errors.length) failed = true;
} catch (error) {
  // the reason first, e.g. that the browser does not encode H.264, in place of the source line
  // that Node prints over an uncaught error
  console.error(error);
  failed = true;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
