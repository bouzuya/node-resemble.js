import { Pixel } from '../type/pixel';

const distance = (c1: Pixel, c2: Pixel): number => {
  return (
    Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
  ) / 3;
};

export { distance };
