import { LABEL_SOURCE } from '../../drawn-text.ts';
import type { MathInfo } from '../math.ts';

export const LABEL = '.backdrop > .label, .surface > .label';

type Hooks = { typesetLabel?(label: Element): Promise<void> };

export const isLabel = (el: Element | null | undefined): el is HTMLElement => !!el?.matches(LABEL);

export const typesetLabel = (label: Element): Promise<void> => (window as unknown as { Beeson?: Hooks }).Beeson?.typesetLabel?.(label) ?? Promise.resolve();

export function faceInfo(el: Element): MathInfo | null {
  const tex = el.localName === 'mjx-container' ? el.getAttribute(LABEL_SOURCE) : null;
  return tex === null ? null : { tex, open: '', close: '', display: false };
}
