import { RGBA } from './rgba';
import { Rectangle } from './rectangle';

export interface ResembleOptions {
  errorColor?: Partial<RGBA>;
  errorType?: 'flat' | 'movement';
  largeImageThreshold?: number;
  transparency?: number;
  ignoreAntialiasing?: boolean;
  ignoreColors?: boolean;
  ignoreNothing?: boolean;
  ignoreRectangles?: Rectangle[];
}
