import jpeg = require('jpeg-js');
import png = require('pngjs');
import { Image } from './type/image';

const convertToJPG = (image: Image, quality?: number): Buffer => {
  return jpeg.encode({
    data: image.data,
    width: image.width,
    height: image.height
  }, typeof quality !== 'undefined' ? quality : 50).data;
};

const convertToPNG = (image: Image): png.PNG => {
  return image as png.PNG; // downcast
};

export {
  convertToJPG,
  convertToPNG
};
