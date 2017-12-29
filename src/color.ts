import { RGB } from './type/rgb';

const getHue = ({ r, g, b }: RGB): number => {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  if (max == min) return 0; // achromatic
  const d = max - min;
  switch (max) {
    case r1: return ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6;
    case g1: return ((b1 - r1) / d + 2) / 6;
    case b1: return ((r1 - g1) / d + 4) / 6;
    default: throw new Error('assert max is r or g or b');
  }
};

const getLightness = ({ r, g, b }: RGB): number => {
  return 0.3 * r + 0.59 * g + 0.11 * b;
};

export { getHue, getLightness };
