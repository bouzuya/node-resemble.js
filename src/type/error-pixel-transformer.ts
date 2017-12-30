import { Pixel } from './pixel';

export interface ErrorPixelTransformer {
  (p1: Pixel, p2: Pixel): Pixel;
}
