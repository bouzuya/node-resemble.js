import { U8 } from './u8';

export interface Pixel {
  r: U8;
  g: U8;
  b: U8;
  a: U8;
}

interface BrightnessInfo {
  brightness: number;
}

interface HueInfo {
  h: number;
}

export type PixelWithBrightnessInfo = Pixel & BrightnessInfo;

export type PixelWithBrightnessAndHueInfo = Pixel & BrightnessInfo & HueInfo;
