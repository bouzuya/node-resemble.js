import { U8 } from './u8';

export interface Tolerance {
  red: U8;
  green: U8;
  blue: U8;
  alpha: U8;
  minL: U8;
  maxL: U8;
}
