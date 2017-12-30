import { newPixel } from '../image';
import { ErrorPixelTransformer } from '../type/error-pixel-transformer';
import { Pixel } from '../type/pixel';
import { distance } from './_';

const newTransformer = ({ r, g, b }: Pixel): ErrorPixelTransformer => {
  return (p1: Pixel, p2: Pixel): Pixel => {
    const ratio = distance(p1, p2) / 255 * 0.8;
    return newPixel(
      ((1 - ratio) * (p2.r * (r / 255)) + ratio * r),
      ((1 - ratio) * (p2.g * (g / 255)) + ratio * g),
      ((1 - ratio) * (p2.b * (b / 255)) + ratio * b),
      p2.a
    );
  };
};

export { newTransformer };
