// image and video files dragged from the Finder or the Explorer onto the slide. a file dropped onto
// an image or a video, or onto a figure box or a plate that shows one, replaces its file, as a drop onto
// an image in Keynote. a file dropped onto an empty figure box or plate fills it, and one dropped anywhere
// else on the slide is put into a new figure box, as a drop onto the slide of PowerPoint. an empty figure box or
// plate is drawn with the placeholder of placeholder.ts. the target is outlined while the files are
// dragged over it. the browser does not open a file dropped onto the chrome of the editor in place
// of the deck

import type { App } from '../app.ts';
import { onCanvas } from '../canvas/hit.ts';
import { injectStyle, make } from '../ui/dom.ts';
import { insertFiles, isEmptySlot, isSlot, kindOfElement, mediaIn, pairMode, replaceFile } from './actions.ts';
import { install as installPlaceholder } from './placeholder.ts';
import { kindOf } from './store.ts';

const CSS = `
.beeson-drop { position: fixed; z-index: 30; pointer-events: none; box-sizing: border-box; border: 2px solid var(--ed-select, #7048e8); background: color-mix(in srgb, var(--ed-select, #7048e8) 12%, transparent); border-radius: 4px; }
.beeson-drop[hidden] { display: none; }
.beeson-drop span { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 4px 10px; border-radius: 6px; background: var(--ed-select, #7048e8); color: #fff; font: 600 13px/18px system-ui, sans-serif; white-space: nowrap; }
`;

// what a drop at a point does: the file of media replaced, the empty slot filled, or the file
// added to the slide
export type Target = { replace: HTMLImageElement | HTMLVideoElement } | { fill: Element } | { add: Element };

export function targetAt(app: App, x: number, y: number): Target | null {
  const slide = app.current();
  if (!slide || !app.pairing?.root || app.region() === 'dialog') return null;
  const under = document.elementsFromPoint(x, y);
  for (const el of under) {
    if (!slide.contains(el) || el === slide || el.closest('aside.notes')) continue;
    // a locked picture is not replaced and a locked figure box is not filled, nor is a picture under
    // them. the file is added to the slide, as a file dropped onto a locked image of Keynote
    if (el.closest('[data-locked]')) break;
    const m = el.closest('img, video');
    const replace = m && slide.contains(m) ? mediaIn(app, m) : null;
    if (replace) return { replace };
    const slot = el.closest('figure, .figure-box, .plate');
    if (slot && slide.contains(slot) && isSlot(app, slot)) {
      if (isEmptySlot(app, slot)) return { fill: slot };
      const shown = mediaIn(app, slot);
      if (shown) return { replace: shown };
    }
  }
  return onCanvas(under[0] ?? null, app, { x, y }) ? { add: slide } : null;
}

// the kind of the dragged files, which a browser tells from their types before the drop
function draggedKind(dt: DataTransfer): 'image' | 'video' | null {
  const types = [...dt.items].filter((i) => i.kind === 'file').map((i) => kindOf({ type: i.type, name: '' }));
  return types.length && types.every((t) => t === types[0]) ? types[0] : null;
}

const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

// whether every dragged file has a type that is not of an image or a video. a file without a type
// is known only by its name at the drop
const noMedia = (dt: DataTransfer) => {
  const files = [...dt.items].filter((i) => i.kind === 'file');
  return files.length > 0 && files.every((i) => i.type && !kindOf({ type: i.type, name: '' }));
};

export function install(app: App): void {
  injectStyle('media-drop', CSS);
  installPlaceholder(app);
  const box = make('div', 'beeson-drop');
  const tag = make('span');
  box.append(tag);
  box.hidden = true;
  document.body.append(box);

  // the buttons and the hint of the placeholder of a figure box to fill are hidden under the tag
  const marked = () => document.querySelectorAll('.beeson-placeholder.dropping');
  const hide = () => {
    box.hidden = true;
    for (const p of marked()) p.classList.remove('dropping');
  };
  const show = (t: Target, kind: 'image' | 'video' | null) => {
    const pair = 'replace' in t ? pairMode(app, t.replace) : null;
    const el = 'replace' in t ? (pair && t.replace.parentElement) || t.replace : 'fill' in t ? t.fill : t.add;
    const holder = 'fill' in t ? t.fill.querySelector(':scope > .beeson-placeholder') : null;
    for (const p of marked()) if (p !== holder) p.classList.remove('dropping');
    holder?.classList.add('dropping');
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const noun = kind === 'video' ? 'Video' : kind === 'image' ? 'Image' : 'Media';
    const what = 'replace' in t && kindOfElement(t.replace) === 'video' ? 'Video' : 'Image';
    tag.textContent = pair ? `Add ${what} for ${pair === 'dark' ? 'Dark' : 'Light'} Mode` : 'replace' in t ? `Replace ${what}` : 'fill' in t ? `Add ${noun} Here` : `Add ${noun}`;
    box.hidden = false;
  };

  // a file is not opened by the browser in place of the deck, wherever it is dropped
  window.addEventListener(
    'dragover',
    (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const t = noMedia(e.dataTransfer!) ? null : targetAt(app, e.clientX, e.clientY);
      e.dataTransfer!.dropEffect = t ? 'copy' : 'none';
      if (t) show(t, draggedKind(e.dataTransfer!));
      else hide();
    },
    true,
  );
  window.addEventListener('dragleave', (e) => {
    if (hasFiles(e) && !e.relatedTarget) hide();
  });
  window.addEventListener(
    'drop',
    (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      hide();
      const files = [...(e.dataTransfer?.files ?? [])];
      const t = targetAt(app, e.clientX, e.clientY);
      if (!t || !files.length) return;
      const run = 'replace' in t && files.length === 1 ? replaceFile(app, t.replace, files[0]) : insertFiles(app, files, 'fill' in t ? t.fill : null);
      void Promise.resolve(run).catch((err) => app.fail(err));
    },
    true,
  );
}
