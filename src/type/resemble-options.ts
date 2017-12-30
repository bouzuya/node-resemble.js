import { Rectangle } from './rectangle';
import { U8 } from './u8';
import { ErrorPixelTransformerType } from './error-pixel-transformer-type';

export interface ResembleOptions {
  errorColor?: Partial<{
    red: U8;
    green: U8;
    blue: U8;
    alpha: U8;
  }>;
  errorType?: ErrorPixelTransformerType;
  largeImageThreshold?: number;
  transparency?: number;
  ignoreAntialiasing?: boolean;
  ignoreColors?: boolean;
  ignoreNothing?: boolean;
  ignoreRectangles?: Rectangle[];
}
