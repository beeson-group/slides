// the stills of the print view. A viewer draws only while it is in the viewport, and the drawing
// buffer of its WebGL canvas is cleared after each frame, hence a viewer is printed with an empty
// panel. Each viewer is thus replaced by an image of its canvas

type Viewer = HTMLElement & {
  canvas: HTMLCanvasElement | null;
  renderer: object | null;
  pause(): void;
  draw(): void;
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Replaces each tycho viewer by an image, except a viewer that shows an error. */
export async function stillViewers(): Promise<void> {
  for (const viewer of document.querySelectorAll<Viewer>('tycho-viewer')) {
    const failed = () => viewer.shadowRoot?.querySelector('.status.error');
    while (!viewer.renderer && !failed()) await sleep(50);
    if (!viewer.canvas || !viewer.renderer) continue;
    viewer.pause();
    // in one task, since the drawing buffer is kept only until the next frame
    viewer.draw();
    const image = new Image();
    image.src = viewer.canvas.toDataURL('image/png');
    image.alt = 'A still of a tycho scene';
    const still = document.createElement('div');
    still.className = viewer.className;
    still.append(image);
    viewer.replaceWith(still);
  }
}
