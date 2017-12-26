import { Byte } from './byte';

export interface Tolerance {
  red: Byte;
  green: Byte;
  blue: Byte;
  alpha: Byte;
  minBrightness: Byte;
  maxBrightness: Byte;
}
