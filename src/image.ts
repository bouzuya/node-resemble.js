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
  const p: png.PNG = new png.PNG({
    width: image.width,
    height: image.height,
  });
  p.data = new Buffer(image.data);
  return p;
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

const newImage = (dimension: { width: number; height: number; }): Image => {
  const { width, height } = dimension;
  return {
    data: new Buffer(4 * height * width),
    height,
    width
  };
};

const newPixel = (r: U8, g: U8, b: U8, a: U8): Pixel => {
  return { r, g, b, a };
};

const saveImageAsJPG = (
  fileName: string,
  image: Image,
  options?: { quality?: number; }
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const data = convertToJPG(image, (options || {}).quality);
    fs.writeFile(fileName, data, (error) => error ? resolve() : reject(error));
  });
};

const saveImageAsPNG = (
  fileName: string,
  image: Image,
  _options?: {}
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const data = convertToPNG(image);
    const ws = fs.createWriteStream(fileName);
    ws.once('finish', () => resolve()).once('error', (error) => reject(error));
    data.pack().pipe(ws);
  });
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
  newImage,
  newPixel,
  saveImageAsJPG,
  saveImageAsPNG,
  setPixel
};
