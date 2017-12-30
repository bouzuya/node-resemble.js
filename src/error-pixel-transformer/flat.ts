import { newPixel } from '../image';
import { ErrorPixelTransformer } from '../type/error-pixel-transformer';
import { Pixel } from '../type/pixel';

const newTransformer = ({ r, g, b, a }: Pixel): ErrorPixelTransformer => {
  return (_p1: Pixel, _p2: Pixel): Pixel => {
    return newPixel(r, g, b, a);
  };
};

export { newTransformer };
