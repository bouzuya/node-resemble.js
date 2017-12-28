import { Rectangle } from './rectangle';
import { U8 } from './u8';

export interface ResembleOptions {
  errorColor?: Partial<{
    red: U8;
    green: U8;
    blue: U8;
    alpha: U8;
  }>;
  errorType?: 'flat' | 'movement';
  largeImageThreshold?: number;
  transparency?: number;
  ignoreAntialiasing?: boolean;
  ignoreColors?: boolean;
  ignoreNothing?: boolean;
  ignoreRectangles?: Rectangle[];
}
