import { FileNameOrData } from './type/file-name-or-data';
import { ParsedImage } from './type/parsed-image';
import { getLightness } from './get-lightness';
import { loadImage } from './image';

const parseImage = (file: FileNameOrData): Promise<ParsedImage> => {
  return loadImage(file).then(({ data, width, height }) => {
    let pixelCount = 0;
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let lightnessTotal = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let offset = (y * width + x) * 4;
        let red = data[offset];
        let green = data[offset + 1];
        let blue = data[offset + 2];
        let lightness = getLightness(red, green, blue);
        pixelCount += 1;
        redTotal += red / 255 * 100;
        greenTotal += green / 255 * 100;
        blueTotal += blue / 255 * 100;
        lightnessTotal += lightness / 255 * 100;
      }
    }

    return Promise.resolve({
      red: Math.floor(redTotal / pixelCount),
      green: Math.floor(greenTotal / pixelCount),
      blue: Math.floor(blueTotal / pixelCount),
      brightness: Math.floor(lightnessTotal / pixelCount)
    });
  });
};

export { parseImage };
