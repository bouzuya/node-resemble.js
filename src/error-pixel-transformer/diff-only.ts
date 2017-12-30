import { newPixel } from '../image';
import { ErrorPixelTransformer } from '../type/error-pixel-transformer';
import { Pixel } from '../type/pixel';

const newTransformer = (_: Pixel): ErrorPixelTransformer => {
  return (_p1: Pixel, p2: Pixel): Pixel => {
    return newPixel(p2.r, p2.g, p2.b, p2.a);
  };
};

export { newTransformer };
