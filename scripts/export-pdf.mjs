// Prints a deck to PDF, one page for each step, i.e. each fragment state of each slide.
//
//   node scripts/export-pdf.mjs [deck] [output]
//
// The deck defaults to index.html and the output to slides.pdf. The deck is opened offline at
// ?print-pdf&still, where `still` makes the theme draw its backdrops complete. reveal.js then sets
// the @page size from the slide size, e.g. 1920 by 1080 px with a margin of 0, which Chrome honors
// with preferCSSPageSize. The script exits nonzero when the page throws or logs a JavaScript
// error, or when the page count of the PDF is not equal to the number of .pdf-page elements
// created by reveal.js. A slide taller than one page is the usual cause of the latter.
import { readFileSync, writeFileSync } from 'node:fs';
import { deckSettled, deckUrl, launch } from './chrome.mjs';

const [deck = 'index.html', output = 'slides.pdf'] = process.argv.slice(2);

// the largest /Count of a PDF is found in the root of its page tree, and it is the number of pages.
// the page tree is written uncompressed by Chrome. if it is not found, the /Type /Page objects are
// counted
function countPdfPages(pdf) {
  const text = pdf.toString('latin1');
  const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)]
    .map((m) => Number(m[1] ?? m[2]));
  if (counts.length) return Math.max(...counts);
  return text.match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0;
}

const browser = await launch();
let failed = false;
try {
  const page = await browser.newPage();
  await page.goto(deckUrl(deck, 'print-pdf&still'));
  // reveal.js removes loading-scroll-mode from the viewport after its pdf-ready event
  await page.waitFor(`!!document.querySelector('.pdf-page')
    && !document.querySelector('.reveal-viewport.loading-scroll-mode')`);
  await page.waitFor(deckSettled);
  const steps = await page.evaluate(`document.querySelectorAll('.pdf-page').length`);
  const pdf = await page.pdf();
  writeFileSync(output, pdf);
  const pages = countPdfPages(readFileSync(output));
  console.log(`${output}: ${pages} pages for ${steps} steps of ${deck}`);
  if (pages !== steps) {
    console.error(`page count ${pages} differs from step count ${steps}, look for a slide taller than 1080 px`);
    failed = true;
  }
  for (const error of page.errors) console.error(`page error: ${error}`);
  if (page.errors.length) failed = true;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
