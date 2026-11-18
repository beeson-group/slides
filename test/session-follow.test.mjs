// following a person, the dots of the people on each slide, and the lines of Share, in Chrome on
// the edit command started on a temporary talk folder: a click on an avatar that follows, the
// selection of the person followed brought into view, each way that following stops, the texts of
// the pill, the count of the followers, a person with two pages, the dots of a row and a tile with
// +N and the chips of a shared tone, the changed dot, the lines of the Share dialog, a page that
// closes, which sends no state after its bye, the pill on a phone of 390 px, and a deck of 200
// slides with three people typing, which is not parsed per operation

import assert from 'node:assert/strict';
import { cpSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { launch } from '../scripts/chrome.mjs';
import { caretAtEnd, frame, front } from './helpers/apply.mjs';
import { C, clean, converge, ONLINE, open, sessionUrl, show, talk, TALK } from './helpers/client.mjs';
import { click, press as key, typeKeys } from './helpers/editor.mjs';
import { startEdit, stopEdit, talkFolder, until } from './helpers/session.mjs';
import { dialogButton, HIT, item, menu, press, tap } from './helpers/share.mjs';

const F = 'window.BeesonSession.follow()';
const P = 'window.BeesonSession.presence()';
// the avatar of the person named name
const avatar = (name) => `.beeson-session-people button[title=${JSON.stringify(name)}]`;
// the element of selector on the slide whose heading starts with heading
const on = (heading, selector) => `[...document.querySelectorAll('.reveal .slides > section')].find((s) => s.querySelector('h2')?.textContent.startsWith(${JSON.stringify(heading)}))?.querySelector(${JSON.stringify(selector)})`;
const HEADING = `Reveal.getCurrentSlide()?.querySelector('h2')?.textContent`;

// the text, the button, and the border of the pill, or null while it is hidden
const PILL = `(() => {
  const box = document.querySelector('.beeson-session-follow');
  if (!box || box.hidden) return null;
  const b = box.querySelector('button');
  return { text: box.querySelector('.text').textContent, button: b.hidden ? null : b.textContent, on: box.classList.contains('on') };
})()`;

async function untilPill(page, want, what = JSON.stringify(want)) {
  await front(page);
  return until(async () => {
    const got = await page.evaluate(PILL);
    return JSON.stringify(got) === JSON.stringify(want) ? got ?? true : null;
  }, `the pill ${what}`);
}

// the elements of expressions selected on page
async function select(page, ...expressions) {
  await front(page);
  const ok = await page.evaluate(`(() => {
    const els = [${expressions.join(', ')}];
    if (els.some((e) => !e)) return false;
    ${C}.app.selection.set('elements', els);
    return true;
  })()`);
  assert.ok(ok, `${expressions.join(', ')} are on the page`);
}

async function session(t, names, options = {}) {
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const server = await talk(t);
  const url = sessionUrl(server.edit);
  const pages = [];
  for (const name of names) pages.push(await open(browser, url, { name, ...options }));
  await converge(server, pages);
  const ids = await Promise.all(pages.map((p) => p.evaluate(`${C}.person`)));
  return { browser, server, url, pages, ids };
}

// a second page of the person who holds name, which answers Yes to the question of the join
async function samePerson(browser, url, name) {
  const page = await open(browser, url, { name, wait: false });
  await page.waitFor(`!!${dialogButton('beeson-edit-dialog', 'Yes, continue')}`);
  await press(page, dialogButton('beeson-edit-dialog', 'Yes, continue'));
  await page.waitFor(ONLINE);
  return page;
}

// the person followed by page once it is target
const following = async (page, target) => {
  await front(page);
  await page.waitFor(`${F}.target === ${JSON.stringify(target)}`);
};

test('a click on an avatar follows the person to the slide, and brings the selection into view at the own zoom', { timeout: 120_000 }, async (t) => {
  const { pages: [ana, ben], ids: [anaId] } = await session(t, ['Ana', 'Ben']);
  await press(ben, avatar('Ana'));
  await following(ben, anaId);
  assert.deepEqual(await ben.evaluate(PILL), { text: 'Following Ana', button: 'Stop', on: true });
  // the name is isolated from the text around it, for a name in a right-to-left script
  assert.equal(await ben.evaluate(`document.querySelector('.beeson-session-follow .text bdi')?.textContent`), 'Ana');
  assert.equal(await ben.evaluate(`document.querySelector(${JSON.stringify(avatar('Ana'))}).getAttribute('aria-pressed')`), 'true');
  assert.ok(await ben.evaluate(`[...document.querySelectorAll('.beeson-session-live')].some((l) => l.textContent === 'Following Ana')`));
  // the border lies over the canvas, in the tone of Ana, and only the pill takes a pointer
  const border = await ben.evaluate(`(() => {
    const box = document.querySelector('.beeson-session-follow');
    const r = box.getBoundingClientRect(), v = ${C}.app.stage.viewport, s = getComputedStyle(box);
    return { edges: [r.left - v.left, r.top - v.top, r.right - v.right, r.bottom - v.bottom].map(Math.round), shadow: s.boxShadow, events: s.pointerEvents, pill: getComputedStyle(box.querySelector('.pill')).pointerEvents };
  })()`);
  assert.deepEqual(border.edges, [0, 0, 0, 0]);
  assert.match(border.shadow, /0px 0px 0px 3px inset/);
  assert.equal(border.events, 'none');
  assert.equal(border.pill, 'auto');

  await t.test('the slide of Ana is shown without an entry of the history or a change of the deck', async () => {
    await ben.evaluate(`window.__last = ${C}.app.history.last; window.__dirty = ${C}.app.dirty`);
    await show(ana, 'Two');
    await front(ben);
    await ben.waitFor(`${HEADING} === 'Two'`);
    assert.equal(await ben.evaluate(`${C}.app.history.last === window.__last && ${C}.app.dirty === window.__dirty`), true);
    assert.equal(await ben.evaluate(`${F}.target`), anaId);
    // the label of the avatar of Ana reads the slide of Ana
    await ben.waitFor(`document.querySelector(${JSON.stringify(avatar('Ana'))}).getAttribute('aria-label') === 'Ana, on slide 2'`);
  });

  await t.test('a zoom and a scroll do not stop it, and the selection of Ana is scrolled into view', async () => {
    const IN_VIEW = `(() => {
      // an item wider than the canvas at this zoom is brought in by its left edge
      const v = ${C}.app.stage.viewport, r = ${on('Two', 'li:last-child')}.getBoundingClientRect();
      return r.left >= v.left && r.left < v.right && r.top >= v.top && r.bottom <= v.bottom;
    })()`;
    await front(ben);
    await ben.evaluate(`${C}.app.stage.setZoom(4)`);
    await frame(ben);
    await ben.evaluate(`(() => { const el = ${C}.app.stage.el; el.scrollTo(el.scrollWidth, el.scrollHeight); })()`);
    await frame(ben);
    assert.equal(await ben.evaluate(IN_VIEW), false, 'Beta is out of view before Ana selects it');
    assert.equal(await ben.evaluate(`${F}.target`), anaId);
    await select(ana, on('Two', 'li:last-child'));
    await front(ben);
    await ben.waitFor(IN_VIEW);
    assert.equal(await ben.evaluate(`${C}.app.stage.zoom`), 4);
    assert.equal(await ben.evaluate(`${F}.target`), anaId);
    await ben.evaluate(`${C}.app.stage.setZoom(null)`);
    await frame(ben);
    assert.equal(await ben.evaluate(`${F}.target`), anaId);
  });

  await t.test('the own avatar counts the followers', async () => {
    await front(ana);
    await ana.waitFor(`document.querySelector('.beeson-session-people .me .beeson-session-followers')?.dataset.count === '1'`);
    assert.equal(await ana.evaluate(`document.querySelector('.beeson-session-people .me .beeson-session-followers').title`), 'Ben is following you');
    assert.equal(await ana.evaluate(`document.querySelector('.beeson-session-people .me').getAttribute('aria-label')`), 'Ana, you, Ben is following you');
    // the count is drawn by CSS, and the text of the avatar keeps the initials alone
    assert.doesNotMatch(await ana.evaluate(`document.querySelector('.beeson-session-people .me').textContent`), /\d/);
  });

  await t.test('Enter and Space on the focused avatar stop and follow again, and the menu goes to the slide', async () => {
    await front(ben);
    await ben.evaluate(`document.querySelector(${JSON.stringify(avatar('Ana'))}).focus()`);
    await key(ben, 'Enter');
    await following(ben, null);
    await key(ben, 'Space');
    await following(ben, anaId);
    await click(ben, avatar('Ana'), { button: 'right' });
    await ben.waitFor(`!!document.querySelector('.beeson-edit-menu')`);
    assert.deepEqual(await menu(ben), ['Ana', 'Stop Following', 'Go to Slide 2']);
    await key(ben, 'Escape');
    await show(ben, 'One');
    await following(ben, null);
    await click(ben, avatar('Ana'), { button: 'right' });
    await ben.waitFor(`!!${item('Go to Slide 2')}`);
    assert.deepEqual(await menu(ben), ['Ana', 'Follow', 'Go to Slide 2']);
    await press(ben, item('Go to Slide 2'));
    await ben.waitFor(`${HEADING} === 'Two'`);
    assert.equal(await ben.evaluate(`${F}.target`), null);
    // the count goes with the last follower
    await front(ana);
    await ana.waitFor(`!document.querySelector('.beeson-session-followers') && document.querySelector('.beeson-session-people .me').getAttribute('aria-label') === 'Ana, you'`);
  });
  clean(ana);
  clean(ben);
});

test('following stops at the avatar, Stop, Escape, a selection, a slide, an edit, and a show, and the pill tells why', { timeout: 180_000 }, async (t) => {
  const { browser, url, server, pages: [ana, ben], ids: [anaId] } = await session(t, ['Ana', 'Ben']);
  await ben.evaluate(`${F}.notice = 60000`);
  const follow = async () => {
    await front(ben);
    await ben.evaluate(`${F}.start(${JSON.stringify(anaId)})`);
    await following(ben, anaId);
  };
  const stopped = async (how) => {
    await following(ben, null);
    assert.deepEqual(await ben.evaluate(PILL), { text: 'Stopped following Ana', button: 'Follow again', on: false }, how);
    assert.ok(await ben.evaluate(`[...document.querySelectorAll('.beeson-session-live')].some((l) => l.textContent === 'Stopped following Ana')`), how);
  };

  await follow();
  await press(ben, avatar('Ana'));
  await stopped('a click on the avatar');
  await press(ben, '.beeson-session-follow button');
  await following(ben, anaId);
  assert.deepEqual(await ben.evaluate(PILL), { text: 'Following Ana', button: 'Stop', on: true });
  await press(ben, '.beeson-session-follow button');
  await stopped('Stop');

  await follow();
  await ben.evaluate(`document.querySelector('.beeson-session-follow button').focus()`);
  await key(ben, 'Escape');
  await stopped('Escape in the pill');

  await follow();
  await select(ben, on('One', 'p'));
  await stopped('a selection');

  await follow();
  await show(ben, 'Two');
  await stopped('a slide shown by Ben');

  await follow();
  await ben.waitFor(`${HEADING} === 'One'`);
  await ben.evaluate(`${C}.app.commands.run('slide.hide')`);
  await stopped('an edit');
  await ben.evaluate(`${C}.app.commands.run('slide.hide')`);
  await converge(server, [ana, ben]);

  await t.test('a show of Ben stops it, and Ben is presenting for the others', async () => {
    await follow();
    await ben.evaluate(`void ${C}.app.commands.run('file.present')`);
    await ben.waitFor(`!!document.querySelector('body > .beeson-edit-show')`);
    await stopped('a show');
    // the page of Ben stays in front. a page that is not in front is taken out of full screen, and
    // its show ends when the blur of its window comes more than 100 ms after this change
    await ana.waitFor(`${C}.resolved().some((r) => r.name === 'Ben' && r.mode === 'present')`);
    await ben.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
    await ben.waitFor(`!document.querySelector('.beeson-edit-show')`);
    await front(ana);
    await ana.waitFor(`${C}.resolved().some((r) => r.name === 'Ben' && r.mode === 'edit')`);
  });

  await t.test('while Ana presents or views the history, the pill tells, and the page stays on its slide', async () => {
    await show(ana, 'One');
    await follow();
    await ben.waitFor(`${HEADING} === 'One'`);
    await front(ana);
    await ana.evaluate(`void ${C}.app.commands.run('file.present')`);
    await ana.waitFor(`!!document.querySelector('body > .beeson-edit-show')`);
    await untilPill(ben, { text: 'Ana is presenting', button: 'Stop', on: true });
    await front(ana);
    await ana.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
    await ana.waitFor(`!document.querySelector('.beeson-edit-show')`);
    await untilPill(ben, { text: 'Following Ana', button: 'Stop', on: true });
    await front(ana);
    await ana.evaluate(`${P}.set({ mode: 'history' })`);
    await untilPill(ben, { text: 'Ana is viewing the version history', button: 'Stop', on: true });
    await show(ana, 'Two');
    await front(ana);
    await ana.waitFor(`${C}.connection === 'online'`);
    await front(ben);
    await ben.waitFor(`${C}.resolved().some((r) => r.name === 'Ana' && r.slide?.querySelector('h2')?.textContent === 'Two')`);
    assert.equal(await ben.evaluate(HEADING), 'One');
    await front(ana);
    await ana.evaluate(`${P}.set({ mode: 'edit' })`);
    await front(ben);
    await ben.waitFor(`${HEADING} === 'Two'`);
    await untilPill(ben, { text: 'Following Ana', button: 'Stop', on: true });
  });

  await t.test('a person who leaves ends it, and a notice goes after its time', async () => {
    const cleo = await open(browser, url, { name: 'Cleo' });
    const cleoId = await cleo.evaluate(`${C}.person`);
    await front(ben);
    await ben.waitFor(`${C}.people.some((p) => p.person === ${JSON.stringify(cleoId)})`);
    await ben.evaluate(`${F}.start(${JSON.stringify(cleoId)})`);
    await following(ben, cleoId);
    await untilPill(ben, { text: 'Following Cleo', button: 'Stop', on: true });
    await cleo.close();
    await untilPill(ben, { text: 'Cleo left the session', button: null, on: false });
    assert.equal(await ben.evaluate(`${F}.target`), null);
    await ben.evaluate(`${F}.notice = 300`);
    await follow();
    await press(ben, '.beeson-session-follow button');
    await following(ben, null);
    await untilPill(ben, null, 'hidden after the notice');
  });
  clean(ana);
  clean(ben);
});

test('a person with two pages is followed on the page that changed last, and two people who follow each other stay', { timeout: 120_000 }, async (t) => {
  const { browser, url, server, pages: [ana, ben], ids: [anaId, benId] } = await session(t, ['Ana', 'Ben']);
  const ana2 = await samePerson(browser, url, 'Ana');
  await converge(server, [ana, ben, ana2]);
  await front(ben);
  await ben.evaluate(`${F}.start(${JSON.stringify(anaId)})`);
  await following(ben, anaId);
  await show(ana2, 'Two');
  await front(ben);
  await ben.waitFor(`${HEADING} === 'Two'`);
  // the first page of Ana, still on One, selects there and changes last, then the second does
  await select(ana, on('One', 'p'));
  await front(ben);
  await ben.waitFor(`${HEADING} === 'One'`);
  await select(ana2, on('Two', 'p'));
  await front(ben);
  await ben.waitFor(`${HEADING} === 'Two'`);
  assert.equal(await ben.evaluate(`${F}.target`), anaId);

  await t.test('nobody follows the own person, whose avatar keeps its menu', async () => {
    await ben.evaluate(`${F}.start(${JSON.stringify(benId)})`);
    assert.equal(await ben.evaluate(`${F}.target`), anaId);
    await ben.evaluate(`${F}.stop()`);
    await press(ben, '.beeson-session-people .me');
    await ben.waitFor(`!!${item('Change Name…')}`);
    assert.equal(await ben.evaluate(`${F}.target`), null);
    await key(ben, 'Escape');
  });

  await t.test('two people who follow each other both stay where they are', async () => {
    await ana2.close();
    await front(ben);
    await ben.waitFor(`${C}.resolved().filter((r) => r.person === ${JSON.stringify(anaId)}).length === 1`);
    await show(ana, 'One');
    await show(ben, 'Two');
    await front(ana);
    await ana.evaluate(`${F}.start(${JSON.stringify(benId)})`);
    await ana.waitFor(`${HEADING} === 'Two'`);
    // Ben has heard that Ana follows Ben from Two before Ben follows Ana
    await front(ben);
    await ben.waitFor(`${C}.resolved().some((r) => r.person === ${JSON.stringify(anaId)} && r.following === ${JSON.stringify(benId)} && r.slide?.querySelector('h2')?.textContent === 'Two')`);
    await ben.evaluate(`${F}.start(${JSON.stringify(anaId)})`);
    // each page has heard that the other follows it
    await front(ana);
    await ana.waitFor(`${C}.resolved().some((r) => r.following === ${JSON.stringify(anaId)})`);
    await front(ben);
    await ben.waitFor(`${C}.resolved().some((r) => r.following === ${JSON.stringify(benId)})`);
    await converge(server, [ana, ben]);
    for (const [page, name, target] of [[ana, 'Ben', benId], [ben, 'Ana', anaId]]) {
      assert.equal(await page.evaluate(`${F}.target`), target);
      assert.equal(await page.evaluate(HEADING), 'Two');
      await untilPill(page, { text: `Following ${name}`, button: 'Stop', on: true });
    }
  });
  clean(ana);
  clean(ben);
});

test('the dots of the people on each slide in the navigator and the Slide Sorter, +N, the chips of a shared tone, and the changed dot', { timeout: 180_000 }, async (t) => {
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const server = await talk(t);
  const url = sessionUrl(server.edit);
  const ann = await open(browser, url, { name: 'Ann Smith' });
  const ben = await open(browser, url, { name: 'Ben Carter' });
  // one Chrome holds six connections to a host, and each page holds one with its poll
  const other = await launch({ offline: false });
  t.after(() => other.close());
  const cleo = await open(other, url, { name: 'Cleo Diaz' });
  const dan = await open(other, url, { name: 'Dan Evans' });
  const eve = await open(other, url, { name: 'Eve Fox' });
  // the dots of the row or the tile of the slide of heading
  const dots = (where, heading) => ann.evaluate(`(() => {
    const slide = [...document.querySelectorAll('.reveal .slides > section')].find((s) => s.querySelector('h2')?.textContent === ${JSON.stringify(heading)});
    const owner = ${JSON.stringify(where)} === 'row' ? ${C}.app.nav.rowOf(slide) : ${C}.shell.slides.tiles().get(slide);
    const box = owner?.querySelector('.beeson-session-dots');
    if (box && owner.getAttribute('aria-describedby') !== box.id) return 'not described';
    return [...(box?.querySelectorAll('i') ?? [])].map((i) => {
      if (i.title !== i.getAttribute('aria-label') || i.getAttribute('role') !== 'img') return 'unnamed';
      return (i.classList.contains('more') ? '+' : i.classList.contains('chip') ? 'chip ' : '') + i.textContent + '|' + i.getAttribute('aria-label');
    });
  })()`);
  const untilDots = async (where, heading, want) => {
    await front(ann);
    return until(async () => JSON.stringify(await dots(where, heading)) === JSON.stringify(want), `${where} ${heading}: ${JSON.stringify(want)}, not ${JSON.stringify(await dots(where, heading))}`);
  };
  await show(ann, 'One');
  for (const page of [ben, cleo, dan, eve]) await show(page, 'Two');
  // the tones go round in the order of joining, hence Eve Fox has the tone of Ann Smith
  await untilDots('row', 'Two', ['|Ben Carter', '|Cleo Diaz', '|Dan Evans', '++1|Eve Fox']);
  assert.deepEqual(await dots('row', 'One'), []);
  await show(eve, 'One');
  await untilDots('row', 'One', ['chip EF|Eve Fox']);
  await untilDots('row', 'Two', ['|Ben Carter', '|Cleo Diaz', '|Dan Evans']);
  const size = await ann.evaluate(`(() => { const r = ${C}.app.nav.rowOf(Reveal.getSlides()[1]).querySelector('.beeson-session-dots i').getBoundingClientRect(); return [r.width, r.height]; })()`);
  assert.deepEqual(size, [10, 10]);

  await t.test('a tile of the Slide Sorter holds circles of 16 px with initials, and +N', async () => {
    await front(ann);
    await ann.evaluate(`${C}.app.commands.run('view.lightTable')`);
    await untilDots('tile', 'Two', ['BC|Ben Carter', 'CD|Cleo Diaz', 'DE|Dan Evans']);
    await untilDots('tile', 'One', ['EF|Eve Fox']);
    await show(eve, 'Two');
    await untilDots('tile', 'Two', ['BC|Ben Carter', 'CD|Cleo Diaz', 'DE|Dan Evans', '++1|Eve Fox']);
    await untilDots('tile', 'One', []);
    const circle = await ann.evaluate(`(() => { const r = document.querySelector('.beeson-edit-sorter .beeson-session-dots i').getBoundingClientRect(); return [r.width, r.height]; })()`);
    assert.deepEqual(circle, [16, 16]);
    await ann.evaluate(`${C}.app.commands.run('view.lightTable')`);
    await ann.waitFor(`!${C}.app.nav.table?.shown`);
  });

  await t.test('a slide that Ben changed gets the changed dot with the name of Ben, until Ann has shown it', async () => {
    const ROW = `${C}.app.nav.rowOf(Reveal.getSlides()[1])`;
    await front(ben);
    await caretAtEnd(ben, on('Two', 'p'));
    await typeKeys(ben, ' more');
    await converge(server, [ann, ben]);
    await front(ann);
    await ann.waitFor(`${ROW}.classList.contains('changed') && ${ROW}.querySelector('.no').title === 'Changed by Ben since you last saw it.'`);
    assert.equal(await ann.evaluate(`document.getElementById(${ROW}.getAttribute('aria-describedby')).textContent.includes('Changed by Ben since you last saw it.')`), true);
    await show(ann, 'Two');
    await show(ann, 'One');
    await front(ann);
    await ann.waitFor(`!${ROW}.classList.contains('changed') && ${ROW}.querySelector('.no').title === ''`);
  });
  for (const page of [ann, ben, cleo, dan, eve]) clean(page);
});

test('the line of each person in the Share dialog', { timeout: 120_000 }, async (t) => {
  const { pages: [ann, ben], ids: [annId, benId] } = await session(t, ['Ann Smith', 'Ben Carter']);
  await press(ann, '.beeson-session-share');
  const DIALOG = 'dialog.beeson-session-share-dialog[open]';
  await ann.waitFor(`document.querySelectorAll('${DIALOG} li').length === 2`);
  // every line of Ben shown, recorded, since Typing on slide 2 lasts two seconds
  await ann.evaluate(`(() => {
    window.__lines = [];
    const read = () => {
      const li = document.querySelector('${DIALOG} li[data-person=${JSON.stringify(benId)}]');
      const text = li?.querySelector('.activity').textContent;
      if (text !== undefined && window.__lines.at(-1) !== text) window.__lines.push(text);
    };
    new MutationObserver(read).observe(document.querySelector('${DIALOG}'), { childList: true, subtree: true, characterData: true });
    read();
  })()`);
  const line = (person) => `document.querySelector('${DIALOG} li[data-person=${JSON.stringify(person)}] .activity')?.textContent`;
  const untilLine = async (person, text) => {
    await front(ann);
    await ann.waitFor(`${line(person)} === ${JSON.stringify(text)}`);
  };
  await untilLine(annId, 'On slide 1');
  await untilLine(benId, 'On slide 1');
  await show(ben, 'Two');
  await untilLine(benId, 'On slide 2');
  await front(ben);
  await caretAtEnd(ben, on('Two', 'p'));
  await typeKeys(ben, 'x');
  await front(ann);
  await ann.waitFor(`window.__lines.includes('Typing on slide 2')`);
  await untilLine(benId, 'On slide 2');
  for (const [mode, text] of [['history', 'Viewing the version history'], ['present', 'Presenting'], ['edit', 'On slide 2']]) {
    await ben.evaluate(`${P}.set({ mode: ${JSON.stringify(mode)} })`);
    await untilLine(benId, text);
  }
  // a page is away while it is hidden
  await ben.evaluate(`window.__visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'))`);
  await untilLine(benId, 'Away');
  await ben.evaluate(`window.__visibility = undefined; document.dispatchEvent(new Event('visibilitychange'))`);
  await untilLine(benId, 'On slide 2');
  // following goes before the rest
  await front(ben);
  await ben.evaluate(`${F}.start(${JSON.stringify(annId)})`);
  await untilLine(benId, 'Following you');
  await ben.evaluate(`${P}.set({ mode: 'history' })`);
  await front(ben);
  await ben.waitFor(`${C}.connection === 'online'`);
  await untilLine(benId, 'Following you');
  await ben.evaluate(`${F}.stop(); ${P}.set({ mode: 'edit' })`);
  await untilLine(benId, 'On slide 1');
  await ann.evaluate(`${F}.start(${JSON.stringify(benId)})`);
  await untilLine(annId, 'Following Ben');
  assert.equal(await ann.evaluate(`document.querySelector('${DIALOG} li[data-person=${JSON.stringify(annId)}] .activity bdi')?.textContent`), 'Ben');
  await untilLine(benId, 'On slide 1');
  assert.equal(await ann.evaluate(`document.querySelector('${DIALOG} li[data-person=${JSON.stringify(benId)}] .activity bdi')`), null);
  clean(ann);
  clean(ben);
});

test('a page that closes sends no state after its bye', { timeout: 60_000 }, async (t) => {
  const { pages: [ann, ben] } = await session(t, ['Ann Smith', 'Ben Carter']);
  // Ben reads the visibility of Chrome, which hides a page as it closes, and tells Ann each request
  // that it sends and each change of its visibility, in order
  await ann.evaluate(`window.__sent = []; new BroadcastChannel('sent').onmessage = (m) => window.__sent.push(m.data)`);
  await ben.evaluate(`(() => {
    window.__visibility = 'real';
    const channel = new BroadcastChannel('sent');
    const fetched = window.fetch;
    window.fetch = function (input, init) {
      channel.postMessage((typeof input === 'string' ? input : input.url).replace(/^.*[/][.]session[/]/, '').replace(/[?].*$/, ''));
      return fetched.call(this, input, init);
    };
    document.addEventListener('visibilitychange', () => channel.postMessage(document.visibilityState));
  })()`);
  await front(ben);
  clean(ben);
  await ben.close();
  await ann.waitFor(`window.__sent.includes('bye') && window.__sent.includes('hidden')`);
  const sent = await ann.evaluate('window.__sent');
  assert.deepEqual(sent.slice(sent.indexOf('bye')).filter((s) => s === 'presence'), [], `Ben sent ${sent.join(', ')}`);
  clean(ann);
});

test('on a phone of 390 px the pill and its buttons are in view with a hit area of 32 px', { timeout: 120_000 }, async (t) => {
  const browser = await launch({ offline: false });
  t.after(() => browser.close());
  const server = await talk(t);
  const url = sessionUrl(server.edit);
  const phone = await open(browser, url, { name: 'Pia Park', width: 390, height: 844, mobile: true });
  const ben = await open(browser, url, { name: 'Ben Carter' });
  const benId = await ben.evaluate(`${C}.person`);
  await front(phone);
  await phone.waitFor(`!!document.querySelector(${JSON.stringify(avatar('Ben Carter'))})`);
  await phone.evaluate(`${F}.notice = 60000`);
  await tap(phone, avatar('Ben Carter'));
  await following(phone, benId);
  const fits = async (label) => {
    await untilPill(phone, label);
    const got = await phone.evaluate(`(() => {
      const pill = document.querySelector('.beeson-session-follow .pill').getBoundingClientRect();
      return { pill: pill.left >= 0 && pill.right <= innerWidth && pill.top >= 0 && pill.bottom <= innerHeight, button: ${HIT}(document.querySelector('.beeson-session-follow button')), page: document.documentElement.scrollWidth <= innerWidth };
    })()`);
    assert.ok(got.pill && got.page, `the pill ${label.text} is in view`);
    assert.ok(got.button.inside && got.button.hit, `${label.button} is in view and takes a tap`);
    assert.ok(got.button.width >= 32 && got.button.height >= 32, `${label.button} has a hit area of ${got.button.width} by ${got.button.height} px`);
  };
  await fits({ text: 'Following Ben', button: 'Stop', on: true });
  await tap(phone, '.beeson-session-follow button');
  await following(phone, null);
  await fits({ text: 'Stopped following Ben', button: 'Follow again', on: false });
  await tap(phone, '.beeson-session-follow button');
  await following(phone, benId);
  clean(phone);
  clean(ben);
});

// a deck of n slides of about bytes / n characters each, with the bulk in the speaker notes
function bigDeck(n, bytes) {
  const words = 'the orbit of the moon is followed by a ship that sees the far side '.repeat(Math.ceil(bytes / n / 68));
  const slides = Array.from({ length: n }, (_, i) => `<section>\n  <h2>Slide ${i + 1}:</h2>\n  <p>Text of slide ${i + 1}</p>\n  <aside class="notes">${words.slice(0, Math.floor(bytes / n))}</aside>\n</section>\n`);
  return TALK.replace(/<section>[\s\S]*<\/section>\n/, slides.join('\n'));
}

test('a deck of 200 slides with three people typing finds the slides of each operation without a parse of the deck', { timeout: 300_000 }, async (t) => {
  const browser = await launch({ offline: false, timeout: 120_000 });
  t.after(() => browser.close());
  const folder = talkFolder(t, bigDeck(200, 2_000_000));
  for (const dir of ['theme', 'brand']) cpSync(resolve(dir), join(folder.talk, dir), { recursive: true });
  const edit = await startEdit(folder.talk, { env: { XDG_CONFIG_HOME: folder.config, APPDATA: folder.config } });
  t.after(async () => {
    await stopEdit(edit);
    rmSync(folder.root, { recursive: true, force: true });
  });
  const url = sessionUrl(edit);
  const ana = await open(browser, url, { name: 'Ana' });
  const ben = await open(browser, url, { name: 'Ben' });
  const cleo = await open(browser, url, { name: 'Cleo' });
  assert.ok((await ana.evaluate(`${C}.port.text().length`)) > 2_000_000);
  // the calls of Ana into the editor that parse the deck, and the time of each read of the slides
  // of an operation
  await front(ana);
  await ana.evaluate(`(() => {
    const c = ${C};
    window.__calls = { slidesAt: 0, changedSlides: 0, slidesIn: 0, time: 0, ops: 0 };
    for (const k of ['slidesAt', 'changedSlides']) {
      const f = c.shell[k];
      c.shell[k] = (...a) => (window.__calls[k]++, f(...a));
    }
    const hooks = c.shell.slides, f = hooks.slidesIn;
    hooks.slidesIn = (ranges) => {
      const t = performance.now();
      try {
        return f(ranges);
      } finally {
        window.__calls.slidesIn++;
        window.__calls.time += performance.now() - t;
      }
    };
    c.on('ops', (ops) => (window.__calls.ops += ops.filter((op) => op.author !== c.person).length));
  })()`);
  const typists = [[ana, 'Slide 10:'], [ben, 'Slide 100:'], [cleo, 'Slide 190:']];
  for (const [page, heading] of typists) await show(page, heading);
  // the caret is set again at each turn, since a page brought behind another loses it
  for (let round = 0; round < 6; round++) {
    for (const [page, heading] of typists) {
      await front(page);
      await caretAtEnd(page, on(heading, 'p'));
      await typeKeys(page, 'ab');
    }
  }
  // each page is brought to the front until the three agree, since a page behind does not apply
  let last = [];
  await until(async () => {
    const texts = [];
    for (const [page] of typists) {
      await front(page);
      texts.push(await page.evaluate(`${ONLINE} && ${C}.acked() ? ${C}.port.text() : null`));
    }
    last = texts.map((x) => (x === null ? 'not acknowledged' : `${x.length} characters, ${x.split('ab').length - 1} ab`));
    return texts[0] && texts.every((x) => x === texts[0]) && texts[0].split('ab').length > 18;
  }, 'the three pages to agree', 120_000).catch((e) => {
    throw new Error(`${e.message}: ${last.join('; ')}`);
  });
  // the keys of a page may be sent as fewer operations than keys, and the texts agree once Ana has
  // applied every operation
  await front(ana);
  const calls = await ana.evaluate('window.__calls');
  assert.ok(calls.ops > 0, 'the operations of Ben and Cleo reached Ana');
  assert.equal(calls.slidesAt, 0, 'the deck is not parsed for the slides of an operation');
  assert.equal(calls.changedSlides, 0, 'the deck is not compared for the slides of an operation');
  assert.ok(calls.slidesIn > 0, 'the slides of the operations were read');
  // the slides of Ben and Cleo are marked with their names
  for (const [n, name] of [[100, 'Ben'], [190, 'Cleo']]) {
    await ana.waitFor(`(() => { const row = ${C}.app.nav.rowOf(Reveal.getSlides()[${n - 1}]); return row.classList.contains('changed') && row.querySelector('.no').title === 'Changed by ${name} since you last saw it.'; })()`);
  }
  // a read of the slides of an operation is bound by a tenth of one parse of the same deck, taken
  // in the same page, and measured again before the test fails. each of the three texts differs
  // from the one before it by a line break at its end, since slidesAt keeps the parse of its last
  // text
  const parse = () => ana.evaluate(`(() => {
    const c = ${C}, text = c.port.text(), texts = [1, 2, 3].map((i) => text + '\\n'.repeat(i)), t = performance.now();
    for (const x of texts) c.shell.slidesAt(x, [{ start: 0, end: 1, text: '' }]);
    return (performance.now() - t) / 3;
  })()`);
  const read = () => ana.evaluate(`(() => {
    const hooks = ${C}.shell.slides, source = window.BeesonEditor.session.text(), at = source.indexOf('Text of slide 150'), t = performance.now();
    for (let i = 0; i < 30; i++) hooks.slidesIn([{ start: at, end: at + 2, text: '' }]);
    return (performance.now() - t) / 30;
  })()`);
  let [mean, bound] = [calls.time / calls.slidesIn, (await parse()) / 10];
  if (mean >= bound) [mean, bound] = [await read(), (await parse()) / 10];
  t.diagnostic(`${calls.slidesIn} reads of the slides of ${calls.ops} operations, ${mean.toFixed(3)} ms each, and a tenth of a parse ${bound.toFixed(3)} ms`);
  assert.ok(mean < bound, `a read of the slides of an operation took ${mean.toFixed(3)} ms, and a tenth of a parse ${bound.toFixed(3)} ms`);
  for (const [page] of typists) clean(page);
});
