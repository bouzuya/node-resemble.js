import { RGB } from './rgb';
import { U8 } from './u8';

export interface Pixel extends RGB {
  a: U8;
}

interface Lightness {
  l: number;
}

export type PixelWithL = Pixel & Lightness;
