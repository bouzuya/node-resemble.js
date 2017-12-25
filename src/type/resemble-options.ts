import { Color } from './color';
import { Rectangle } from './rectangle';

export interface ResembleOptions {
  errorColor?: Partial<Color>;
  errorType?: 'flat' | 'movement';
  largeImageThreshold?: number;
  transparency?: number;
  ignoreAntialiasing?: boolean;
  ignoreColors?: boolean;
  ignoreNothing?: boolean;
  ignoreRectangles?: Rectangle[];
}
