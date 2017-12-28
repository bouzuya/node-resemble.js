import * as fs from 'fs';
import jpeg = require('jpeg-js');
import * as path from 'path';
import png = require('pngjs');
import { FileNameOrData } from './type/file-name-or-data';
import { Image } from './type/image';

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

export { loadImage };
