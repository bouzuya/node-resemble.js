import { Pixel } from './pixel';
import { Rectangle } from './rectangle';
import { Tolerance } from './tolerance';

export interface CompareImagesOptions {
  errorPixelTransformer: (p1: Pixel, p2: Pixel) => Pixel;
  ignoreAntialiasing: boolean;
  ignoreColors: boolean;
  ignoreRectangles: Rectangle[] | null;
  largeImageThreshold: number;
  tolerance: Tolerance;
  transparency: number;
}
