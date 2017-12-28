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

interface HueInfo {
  h: number;
}

export type PixelWithL = Pixel & Lightness;

export type PixelWithLAndHueInfo = Pixel & Lightness & HueInfo;
