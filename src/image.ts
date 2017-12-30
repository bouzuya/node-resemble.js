import * as fs from 'fs';
import jpeg = require('jpeg-js');
import * as path from 'path';
import png = require('pngjs');
import { FileNameOrData } from './type/file-name-or-data';
import { Image } from './type/image';
import { Pixel } from './type/pixel';
import { U8 } from './type/u8';

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

const getPixel = (image: Image, offset: number): Pixel | null => {
  const d = image.data;
  const r = d[offset];
  if (typeof r === 'undefined') return null;
  return {
    r: r,
    g: d[offset + 1],
    b: d[offset + 2],
    a: d[offset + 3]
  };
};

const loadImage = (file: FileNameOrData): Promise<Image> => {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(file)) {
      const buffer = file;
      new png.PNG().parse(buffer, (error, image) => {
        if (error) {
          reject(error);
        } else {
          resolve(image);
        }
      });
    } else {
      const ext = path.extname(file);
      if (ext === '.png') {
        fs.createReadStream(file)
          .pipe(new png.PNG())
          .on('parsed', function (this: png.PNG) {
            resolve(this);
          });
      } else if (ext === '.jpg' || ext === '.jpeg') {
        fs.readFile(file, (error, data) => {
          if (error) {
            reject(error);
          } else {
            resolve(jpeg.decode(data, true) as jpeg.RawImageData<Buffer>);
          }
        });
      } else {
        reject(new Error(`unknown extension: ${ext}`))
      }
    };
  });
};

const newImageBasedOn = (image: Image): Image => {
  return new png.PNG({
    width: image.width,
    height: image.height,
    deflateChunkSize: image.deflateChunkSize,
    deflateLevel: image.deflateLevel,
    deflateStrategy: image.deflateStrategy,
  });
};

const newPixel = (r: U8, g: U8, b: U8, a: U8): Pixel => {
  return { r, g, b, a };
};

const setPixel = (image: Image, offset: number, p: Pixel): void => {
  // ? range check
  const d = image.data;
  d[offset] = p.r;
  d[offset + 1] = p.g;
  d[offset + 2] = p.b;
  d[offset + 3] = p.a;
};

export {
  convertToJPG,
  convertToPNG,
  getPixel,
  loadImage,
  newImageBasedOn,
  newPixel,
  setPixel
};
