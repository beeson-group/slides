// inline code is drawn as a chip in both modes, tinted with the text color and with rounded corners,
// and the code of a code box is drawn without the chip

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deckSettled, deckUrl, launch } from '../scripts/chrome.mjs';

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

const STYLE = (selector) => `(() => {
  const s = getComputedStyle(document.querySelector(${JSON.stringify(selector)}));
  return { background: s.backgroundColor, radius: s.borderTopLeftRadius, color: s.color, text: getComputedStyle(document.body).color };
})()`;

for (const mode of ['dark', 'light']) {
  test(`inline code is a chip, and the code of a code box is not, in ${mode} mode`, async (t) => {
    const page = await browser.newPage();
    t.after(() => page.close().catch(() => {}));
    await page.goto(deckUrl('test-deck.html', `still&theme=${mode}`));
    await page.waitFor(deckSettled);
    const chip = await page.evaluate(STYLE('.reveal .slides p code'));
    assert.notEqual(chip.background, 'rgba(0, 0, 0, 0)', 'inline code is not tinted');
    assert.notEqual(chip.radius, '0px', 'inline code does not have rounded corners');
    const box = await page.evaluate(STYLE('.reveal .slides pre code'));
    assert.equal(box.radius, '0px', 'the code of a code box has rounded corners');
    assert.notEqual(box.background, chip.background, 'the code of a code box is drawn as a chip');
    assert.deepEqual(page.errors, []);
  });
}
