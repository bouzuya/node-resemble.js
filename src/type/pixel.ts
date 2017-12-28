import { U8 } from './u8';

export interface Pixel {
  r: U8;
  g: U8;
  b: U8;
  a: U8;
}

interface Lightness {
  l: number;
}

interface Hue {
  h: number;
}

export type PixelWithL = Pixel & Lightness;

export type PixelWithHL = Pixel & Lightness & Hue;
