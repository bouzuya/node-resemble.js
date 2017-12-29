import { RGB } from './rgb';
import { U8 } from './u8';

export interface Pixel extends RGB {
  a: U8;
}
