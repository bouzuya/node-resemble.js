import { Byte } from './type/byte';

const getBrightness = (r: Byte, g: Byte, b: Byte): number => {
  return 0.3 * r + 0.59 * g + 0.11 * b;
};

export { getBrightness };
