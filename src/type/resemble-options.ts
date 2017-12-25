import { Color } from './color';

export interface ResembleOptions {
  errorColor?: Partial<Color>;
  errorType?: 'flat' | 'movement';
  largeImageThreshold?: number;
  transparency?: number;
}
