import { U8 } from './u8';

export interface Tolerance {
  red: U8;
  green: U8;
  blue: U8;
  alpha: U8;
  minBrightness: U8;
  maxBrightness: U8;
}
