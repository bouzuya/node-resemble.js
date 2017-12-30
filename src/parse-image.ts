import { getLightness } from './color';
import { Image } from './type/image';
import { ParsedImage } from './type/parsed-image';
import { getPixel } from './image';

const parseImage = (image: Image): ParsedImage => {
  const { width, height } = image;
  let pixelCount = 0;
  let rTotal = 0;
  let gTotal = 0;
  let bTotal = 0;
  let lTotal = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let offset = (y * width + x) * 4;
      const p = getPixel(image, offset);
      if (p === null) throw new Error();
      const { r, g, b } = p;
      let l = getLightness({ r, g, b });
      pixelCount += 1;
      rTotal += r / 255 * 100;
      gTotal += g / 255 * 100;
      bTotal += b / 255 * 100;
      lTotal += l / 255 * 100;
    }
  }

  return {
    red: Math.floor(rTotal / pixelCount),
    green: Math.floor(gTotal / pixelCount),
    blue: Math.floor(bTotal / pixelCount),
    brightness: Math.floor(lTotal / pixelCount)
  };
};

export { parseImage };
