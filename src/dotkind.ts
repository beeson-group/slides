import type { ColormapName } from './trajectories.ts';

export type Extent = { x0: number; x1: number; y0: number; y1: number };

export type Colors = {
  light: boolean;
  text: string;
  ground: string;
  mark: string;
  tone(name: string): string;
  map(name: ColormapName, at: number, trim?: [number, number]): string;
};

export type Frame<S> = {
  g: CanvasRenderingContext2D;
  state: S;
  colors: Colors;
  scale: number;
  x0: number;
  y0: number;
};

export type Kind<D, S> = {
  margin: number;
  endless: boolean;
  file(el: HTMLElement): string | null;
  prepare(data: D, el: HTMLElement): S;
  extent(state: S): Extent;
  span(state: S, duration: number): number;
  draw(frame: Frame<S>, seconds: number, duration: number): void;
};

export const TAU = 2 * Math.PI;
export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const smooth = (v: number): number => {
  const u = clamp(v);
  return u * u * (3 - 2 * u);
};
