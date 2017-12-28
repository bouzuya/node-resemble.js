import png = require('pngjs');
import { Image } from './type/image';

const newImageBasedOn = (image1: Image): Image => {
  return new png.PNG({
    width: image1.width,
    height: image1.height,
    deflateChunkSize: image1.deflateChunkSize,
    deflateLevel: image1.deflateLevel,
    deflateStrategy: image1.deflateStrategy,
  });
};

export { newImageBasedOn };
