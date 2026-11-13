// the stills of the print view. A viewer draws only while it is in the viewport, and the drawing
// buffer of its WebGL canvas is cleared after each frame, hence a viewer is printed with an empty
// panel. Each viewer is thus replaced by an image of its canvas, placed where the canvas is. In the
// print view, a slide is cloned by reveal.js for each of its steps, and only the 16 newest WebGL
// contexts of a page are kept by Chrome, hence the clones of a viewer are replaced before their
// scenes load, each by the still of the viewer written in the file

type Viewer = HTMLElement & {
  canvas: HTMLCanvasElement | null;
  renderer: object | null;
  pause(): void;
  draw(): void;
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

// the viewers written in the file, as opposed to their clones
const written = new WeakSet<Element>();

/** Numbers the viewers of the deck before they are cloned for the print view, so that a clone is told from its viewer. */
export function markViewers(): void {
  document.querySelectorAll('tycho-viewer').forEach((viewer, i) => {
    viewer.setAttribute('data-still', String(i));
    written.add(viewer);
  });
}

/** Puts an empty box with the class, the style, the position, and the number of a viewer in its place, with the class viewer-still. */
function box(viewer: Viewer): HTMLDivElement {
  const still = document.createElement('div');
  still.className = viewer.className;
  // a still is not dimmed at a later step, as a viewer, see theme/beeson.css
  still.classList.add('viewer-still');
  still.style.cssText = viewer.style.cssText;
  // the number of the viewer names the recording of its scene in scripts/export-pptx.mjs
  if (viewer.dataset.still !== undefined) still.dataset.still = viewer.dataset.still;
  // the still is placed in the box, which is thus positioned as the viewer, e.g. relative as the
  // runtime sets it for a viewer that is not a figure box, in a plate of the class row
  still.style.position = getComputedStyle(viewer).position;
  viewer.replaceWith(still);
  return still;
}

/** The image of the canvas of a viewer, in the box of the canvas, or null for a viewer that shows an error. */
async function still(viewer: Viewer): Promise<HTMLImageElement | null> {
  const failed = () => viewer.shadowRoot?.querySelector('.status.error');
  while (!viewer.renderer && !failed()) await sleep(50);
  if (!viewer.canvas || !viewer.renderer) return null;
  viewer.pause();
  // in one task, since the drawing buffer is kept only until the next frame
  viewer.draw();
  const image = new Image();
  image.src = viewer.canvas.toDataURL('image/png');
  image.alt = 'A still of a tycho scene';
  // the rects are scaled with the slide, and the width of the host is not
  const host = viewer.getBoundingClientRect();
  const canvas = viewer.canvas.getBoundingClientRect();
  const scale = host.width / (viewer.offsetWidth || 1);
  const px = (n: number) => `${Math.round(n / scale)}px`;
  image.style.cssText = `position: absolute; left: ${px(canvas.left - host.left)}; top: ${px(canvas.top - host.top)}; width: ${px(canvas.width)}; height: ${px(canvas.height)}; object-fit: fill`;
  return image;
}

/** Replaces each tycho viewer by an image, except a viewer that shows an error, and each clone of a viewer by the same image. */
export async function stillViewers(): Promise<void> {
  const viewers: Viewer[] = [];
  const clones = new Map<string, HTMLDivElement[]>();
  // the clones are replaced in the task of the pdf-ready event, before the load of any of their
  // scenes resumes, hence none of them takes a WebGL context
  for (const viewer of document.querySelectorAll<Viewer>('tycho-viewer')) {
    const id = viewer.dataset.still;
    if (id === undefined || written.has(viewer)) viewers.push(viewer);
    else clones.set(id, [...(clones.get(id) ?? []), box(viewer)]);
  }
  for (const viewer of viewers) {
    const image = await still(viewer);
    if (image === null) continue;
    box(viewer).append(image);
    for (const clone of clones.get(viewer.dataset.still ?? '') ?? []) clone.append(image.cloneNode());
  }
}
