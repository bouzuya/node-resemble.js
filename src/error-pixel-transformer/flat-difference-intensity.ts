import { newPixel } from '../image';
import { ErrorPixelTransformer } from '../type/error-pixel-transformer';
import { Pixel } from '../type/pixel';
import { distance } from './_';

const newTransformer = ({ r, g, b }: Pixel): ErrorPixelTransformer => {
  return (p1: Pixel, p2: Pixel): Pixel => {
    return newPixel(r, g, b, distance(p1, p2));
  };
};

export { newTransformer };
