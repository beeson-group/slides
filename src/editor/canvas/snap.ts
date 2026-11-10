// the snap engine of a drag, without the DOM: the edges and centers of a dragged box are snapped
// to those of the other elements, of the slide, and of the boxes of the layouts, within 8 screen
// px. every box is in slide pixels of the 1920 by 1080 design size

import type { App } from '../app.ts';

export type Box = { left: number; top: number; width: number; height: number };
export type Guide = { axis: 'x' | 'y'; at: number };
// the shift that snaps a box, in slide pixels, and the guides that it snaps to
export type Snap = { dx: number; dy: number; guides: Guide[] };

// the edges of the layouts of theme/beeson.css: the margins, the right edges of the narrow,
// content, and wide columns, the left edge of a zone, the running head, the top of the text, the
// bottom of a zone, and the bottom of the footnote
export const LAYOUT_GUIDES: { x: number[]; y: number[] } = { x: [120, 880, 1120, 1200, 1800], y: [44, 120, 920, 1030] };

export function install(_app: App): void {
  // nothing yet
}
