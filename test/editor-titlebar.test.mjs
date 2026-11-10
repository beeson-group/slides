// the title of the file in the menu bar of the editor, on both platforms. as in PowerPoint and
// Keynote, the title is cut with an ellipsis, or hidden, when there is not room for it between the
// menus and the buttons at the right, and it never overlaps a menu title

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { editorPage } from './helpers/editor.mjs';

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser?.close();
});

// the boxes of the last menu title, of the text of the title of the file, and of the leftmost
// shown button at the right, and whether the title is cut or hidden
const layout = (page) => page.evaluate(`(() => {
  const row = document.querySelector('.beeson-edit-titlebar');
  const titles = [...row.querySelectorAll('.beeson-edit-menubar [role=menuitem]')];
  const doc = row.querySelector('.doc');
  const shown = [...doc.children].filter((el) => el.getClientRects().length && el.getBoundingClientRect().width > 0);
  const docBox = doc.getBoundingClientRect();
  const left = shown.length ? Math.max(docBox.left, Math.min(...shown.map((el) => el.getBoundingClientRect().left))) : null;
  const right = shown.length ? Math.min(docBox.right, Math.max(...shown.map((el) => el.getBoundingClientRect().right))) : null;
  const buttons = [...row.querySelectorAll('.right button')].filter((b) => !b.hidden).map((b) => b.getBoundingClientRect().left);
  const file = row.querySelector('.file');
  return {
    menus: titles.at(-1).getBoundingClientRect().right,
    text: left === null || right <= left ? null : { left, right },
    buttons: Math.min(...buttons),
    cut: !file.getClientRects().length || file.scrollWidth > file.clientWidth || docBox.width < doc.scrollWidth,
    row: row.scrollWidth <= row.clientWidth,
  };
})()`);

for (const platform of ['mac', 'other']) {
  for (const width of [1000, 1280, 1600]) {
    test(`the title of the file is between the menus and the buttons at ${width} px on ${platform}`, async () => {
      const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}`, page: { width, height: 800 } });
      try {
        const box = await layout(page);
        assert.ok(box.text, 'the title of the file is shown');
        assert.ok(box.text.left >= box.menus, `the title starts at ${box.text.left} px, over the last menu, which ends at ${box.menus} px`);
        assert.ok(box.text.right <= box.buttons, `the title ends at ${box.text.right} px, over the buttons, which start at ${box.buttons} px`);
        assert.equal(box.row, true, 'the menu bar overflows the window');
        assert.deepEqual(page.errors, []);
      } finally {
        await page.close();
      }
    });
  }

  test(`the title of the file is cut when there is not room for it on ${platform}`, async () => {
    const page = await editorPage(browser, { query: `edit&still&edit-platform=${platform}`, page: { width: 600, height: 800 } });
    try {
      const box = await layout(page);
      assert.equal(box.cut, true, 'the title of the file is shown whole');
      if (box.text) {
        assert.ok(box.text.left >= box.menus, `the title starts at ${box.text.left} px, over the last menu, which ends at ${box.menus} px`);
        assert.ok(box.text.right <= box.buttons, `the title ends at ${box.text.right} px, over the buttons, which start at ${box.buttons} px`);
      }
      assert.deepEqual(page.errors, []);
    } finally {
      await page.close();
    }
  });
}
