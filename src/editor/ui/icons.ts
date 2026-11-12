// the icons of the toolbar and the menus, as inline SVG paths drawn in currentColor on a grid of
// 20 by 20 px, with a stroke of 1.5 px and round ends. a command names its icon in its toolbar
// place, and a name that is not in PATHS is drawn as a square. the icon shape:<kind> of a shape
// is drawn from the geometry of src/shapes.ts, so that it follows a change of its shape

import type { App } from '../app.ts';
import { shapePath } from '../../shapes.ts';

const SVG = 'http://www.w3.org/2000/svg';

// the path data of each icon. a path is stroked, and a path that starts with F in place of its
// first M is filled
const PATHS: Record<string, string[]> = {
  undo: ['M7.5 5 4 8.5 7.5 12', 'M4.5 8.5h7.25a4.25 4.25 0 0 1 0 8.5H9'],
  redo: ['M12.5 5 16 8.5 12.5 12', 'M15.5 8.5H8.25a4.25 4.25 0 0 0 0 8.5H11'],
  slide: ['M3 5.5h14v9H3z'],
  'add-slide': ['M5 4.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M10 7.25v5.5', 'M7.25 10h5.5'],
  text: ['M4.5 5.5V4h11v1.5', 'M10 4v12', 'M7.5 16h5'],
  formula: ['M14.5 4.5h-9l5 5.5-5 5.5h9'],
  table: ['M3 4.5h14v11H3z', 'M3 8.25h14', 'M3 11.75h14', 'M8 4.5v11', 'M12.5 8.25v7.25'],
  image: ['M3 4.5h14v11H3z', 'M3.5 14l4-4.25 3.25 3.25 2.25-2.25L16.5 14', 'F13 8.25a1.25 1.25 0 1 1 0-.01z'],
  video: ['M2.5 5.5h10.5v9H2.5z', 'M13 9l4.5-2.5v7L13 11'],
  qr: ['M3.5 3.5h5v5h-5z', 'M11.5 3.5h5v5h-5z', 'M3.5 11.5h5v5h-5z', 'M11.5 11.5h2v2h-2z', 'M14.5 14.5h2v2h-2z', 'F5.25 5.25h1.5v1.5h-1.5z', 'F13.25 5.25h1.5v1.5h-1.5z', 'F5.25 13.25h1.5v1.5h-1.5z'],
  play: ['F6.5 4.25v11.5L15.75 10z'],
  pause: ['F5.5 4.5h3v11h-3z', 'F11.5 4.5h3v11h-3z'],
  // Present, a screen on its stand as the Keynote logo: a board under a bar, a post, and a foot
  present: ['M2.5 3.75h15', 'M3.75 3.75v7.75a1 1 0 0 0 1 1h10.5a1 1 0 0 0 1-1V3.75', 'M10 12.5v3.75', 'M6.5 16.25h7'],
  save: ['M4 3.5h9.5L16.5 6.5V16.5H4z', 'M7 3.5V7.5h5.5V3.5', 'M7 16.5v-5h6.5v5'],
  open: ['M2.75 15.5V4.5h5l1.75 2h7.75v9z', 'M2.75 8.5h14.5'],
  format: ['M12 3.5l4.5 4.5-6.75 6.75-4.5-4.5z', 'M5.25 10.25 3.5 16.5l6.25-1.75'],
  steps: ['M10 3 17 10 10 17 3 10z', 'M10 6.5v7'],
  navigator: ['M3 4.5h14v11H3z', 'M8 4.5v11', 'M4.75 7h1.5', 'M4.75 9.5h1.5', 'M4.75 12h1.5'],
  inspector: ['M3 4.5h14v11H3z', 'M12 4.5v11', 'M13.75 7h1.5', 'M13.75 9.5h1.5', 'M13.75 12h1.5'],
  notes: ['M3 4.5h14v11H3z', 'M3 11h14', 'M5.5 13.25h6'],
  'chevron-down': ['M6 8l4 4 4-4'],
  'chevron-right': ['M8 6l4 4-4 4'],
  'chevron-left': ['M12 6l-4 4 4 4'],
  check: ['M5 10.5l3.25 3.25L15 6.5'],
  minus: ['M5 10h10'],
  plus: ['M5 10h10', 'M10 5v10'],
  contrast: ['M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z', 'F10 3.5a6.5 6.5 0 0 0 0 13z'],
  fit: ['M3.5 7.5v-4h4', 'M12.5 3.5h4v4', 'M16.5 12.5v4h-4', 'M7.5 16.5h-4v-4'],
  // the Edit Mask button of the mask bar of Keynote
  crop: ['M6 2.5V14h11.5', 'M2.5 6H14v11.5'],
  more: ['M5 6l4 4-4 4', 'M11 6l4 4-4 4'],
  warning: ['M10 3.5 17.5 16.5h-15z', 'M10 8.5v3.5', 'F10.75 14.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z'],
  square: ['M4.5 4.5h11v11h-11z'],
  // the Shape and Media buttons of the toolbar of Keynote, a square behind a circle and a paper clip
  shape: ['M12 7.78V3.5H3.5V12h4.28', 'M12.5 7.75a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5z'],
  media: ['M12.75 6.5 7.6 11.65a1.6 1.6 0 0 0 2.26 2.26l5.66-5.66a3.2 3.2 0 0 0-4.53-4.53L5.3 9.4a4.8 4.8 0 0 0 6.79 6.79l4.41-4.41'],
  // the lines of the Shape button: a line, an arrow, a curved arrow, and an elbow arrow
  'line-straight': ['M4 16 16 4'],
  'line-arrow': ['M4 16 15.5 4.5', 'M10 4.5h5.5V10'],
  'line-curve': ['M3.5 16C4.75 9 9 5.25 15.5 5', 'M12.75 2.5 15.5 5l-2.75 2.5'],
  'line-elbow': ['M3.5 16h6.5V5h5.5', 'M13 2.5l2.5 2.5L13 7.5'],
  orbit: ['M2.5 10a7.5 3.75 0 1 0 15 0a7.5 3.75 0 1 0-15 0', 'F8.5 10a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0'],
};

export const iconNames = (): string[] => Object.keys(PATHS);

// the box of each shape in its icon, in px of the grid, and the paths of the shapes drawn by CSS
const SHAPE_BOXES: Record<string, [number, number]> = {
  rounded: [16, 12], rectangle: [16, 12], ellipse: [16, 12], triangle: [16, 14], arrow: [16, 12],
  'arrow-both': [17, 11], brace: [7, 16], plus: [15, 15], equals: [15, 13],
};
function shapeD(kind: string, w: number, h: number): string {
  const i = 0.75, r = w - i, b = h - i, rx = 3;
  const arc = `a${rx} ${rx} 0 0 1`;
  if (kind === 'rounded') {
    return `M${i + rx} ${i}H${r - rx}${arc} ${rx} ${rx}V${b - rx}${arc}-${rx} ${rx}`
      + `H${i + rx}${arc}-${rx}-${rx}V${i + rx}${arc} ${rx}-${rx}z`;
  }
  const ex = w / 2 - i, ey = h / 2 - i;
  if (kind === 'ellipse') return `M${i} ${h / 2}a${ex} ${ey} 0 1 0 ${2 * ex} 0a${ex} ${ey} 0 1 0-${2 * ex} 0z`;
  return shapePath(kind, w, h, 1.5) || `M${i} ${i}H${r}V${b}H${i}z`;
}

// the icon of a command in the menu of a split button of the toolbar, e.g. of each entry of Shape,
// set by the module of the command
const ITEM_ICONS = new Map<string, string>();
export const setItemIcon = (command: string, name: string): void => void ITEM_ICONS.set(command, name);
export const itemIcon = (command: string): string | undefined => ITEM_ICONS.get(command);

// the svg of the icon name at size CSS px, hidden from assistive technology, since the button or
// item that holds it has a label
export function icon(name: string, size = 20): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('beeson-icon');
  const box = name.startsWith('shape:') ? SHAPE_BOXES[name.slice(6)] : undefined;
  // a shape is drawn in its box, which the origin of the view box centers on the grid
  if (box) svg.setAttribute('viewBox', `${(box[0] - 20) / 2} ${(box[1] - 20) / 2} 20 20`);
  for (const d of box ? [shapeD(name.slice(6), ...box)] : (PATHS[name] ?? PATHS.square)) {
    const path = document.createElementNS(SVG, 'path');
    const filled = d.startsWith('F');
    path.setAttribute('d', filled ? `M${d.slice(1)}` : d);
    if (filled) {
      path.setAttribute('fill', 'currentColor');
    } else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    }
    svg.append(path);
  }
  return svg;
}

export function install(_app: App): void {
  // the icons are drawn when a bar asks for them
}
