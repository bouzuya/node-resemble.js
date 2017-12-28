import { U8 } from './type/u8';

const getLightness = (r: U8, g: U8, b: U8): number => {
  return 0.3 * r + 0.59 * g + 0.11 * b;
};

export { getLightness };
