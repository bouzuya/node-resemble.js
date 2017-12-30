import { newPixel } from '../image';
import { ErrorPixelTransformer } from '../type/error-pixel-transformer';
import { Pixel } from '../type/pixel';

const newTransformer = ({ r, g, b }: Pixel): ErrorPixelTransformer => {
  return (_p1: Pixel, p2: Pixel): Pixel => {
    return newPixel(
      ((p2.r * (r / 255)) + r) / 2,
      ((p2.g * (g / 255)) + g) / 2,
      ((p2.b * (b / 255)) + b) / 2,
      p2.a
    );
  };
};

export { newTransformer };
