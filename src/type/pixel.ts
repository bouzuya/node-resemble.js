import { Byte } from './byte';

export interface Pixel {
  r: Byte;
  g: Byte;
  b: Byte;
  a: Byte;
}

interface BrightnessInfo {
  brightness: number;
}

interface HueInfo {
  h: number;
}

export type PixelWithBrightnessInfo = Pixel & BrightnessInfo;

export type PixelWithBrightnessAndHueInfo = Pixel & BrightnessInfo & HueInfo;
