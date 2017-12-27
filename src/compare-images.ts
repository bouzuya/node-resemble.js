import jpeg = require('jpeg-js');
import png = require('pngjs');
import { Byte } from './type/byte';
import { Color } from './type/color';
import { CompareResult } from './type/compare-result';
import { File } from './type/file';
import { Image } from './type/image';
import {
  Pixel,
  PixelWithBrightnessAndHueInfo,
  PixelWithBrightnessInfo
} from './type/pixel';
import { Rectangle } from './type/rectangle';
import { ResembleOptions } from './type/resemble-options';
import { Tolerance } from './type/tolerance';
import { getBrightness } from './get-brightness';
import { loadImageData } from './load-image-data';

const loop = (
  height: number,
  width: number,
  callback: (y: number, x: number) => void
): void => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      callback(y, x);
    }
  }
};

const isColorSimilar = (
  b1: Byte,
  b2: Byte,
  color: keyof Tolerance,
  tolerance: Tolerance
): boolean => {
  if (typeof b1 === 'undefined') return false;
  if (typeof b2 === 'undefined') return false;
  if (b1 === b2) return true;
  if (Math.abs(b1 - b2) < tolerance[color]) return true;
  return false;
};

const isPixelBrightnessSimilar = (
  p1: PixelWithBrightnessInfo,
  p2: PixelWithBrightnessInfo,
  tolerance: Tolerance
): boolean => {
  const alpha = isColorSimilar(p1.a, p2.a, 'alpha', tolerance);
  const brightness = isColorSimilar(
    p1.brightness, p2.brightness, 'minBrightness', tolerance
  );
  return brightness && alpha;
};

const isRGBSame = (p1: Pixel, p2: Pixel): boolean => {
  const red = p1.r === p2.r;
  const green = p1.g === p2.g;
  const blue = p1.b === p2.b;
  return red && green && blue;
};

const isRGBSimilar = (p1: Pixel, p2: Pixel, tolerance: Tolerance): boolean => {
  const red = isColorSimilar(p1.r, p2.r, 'red', tolerance);
  const green = isColorSimilar(p1.g, p2.g, 'green', tolerance);
  const blue = isColorSimilar(p1.b, p2.b, 'blue', tolerance);
  const alpha = isColorSimilar(p1.a, p2.a, 'alpha', tolerance);
  return red && green && blue && alpha;
};

const isContrasting = (
  p1: PixelWithBrightnessInfo,
  p2: PixelWithBrightnessInfo,
  tolerance: Tolerance
): boolean => {
  return Math.abs(p1.brightness - p2.brightness) > tolerance.maxBrightness;
};

const getHue = (r: Byte, g: Byte, b: Byte): number => {
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

const getPixel = (px: Buffer, offset: number): Pixel | null => {
  const r = px[offset];
  if (typeof r === 'undefined') return null;
  return {
    r: r,
    g: px[offset + 1],
    b: px[offset + 2],
    a: px[offset + 3]
  };
};

const setPixel = (
  buffer: Buffer,
  offset: number,
  r: Byte,
  g: Byte,
  b: Byte,
  a: Byte
): void => {
  buffer[offset] = r;
  buffer[offset + 1] = g;
  buffer[offset + 2] = b;
  buffer[offset + 3] = a;
};

const copyErrorPixel = (
  px: Buffer,
  offset: number,
  p1: Pixel,
  p2: Pixel,
  errorPixelTransformer: (p1: Pixel, p2: Pixel) => Pixel
): void => {
  const p = errorPixelTransformer(p1, p2);
  setPixel(px, offset, p.r, p.g, p.b, p.a);
};

const copyPixel = (
  px: Buffer,
  offset: number,
  p1: Pixel,
  pixelTransparency: number
): void => {
  setPixel(px, offset, p1.r, p1.g, p1.b, p1.a * pixelTransparency);
};

const copyGrayScalePixel = (
  px: Buffer,
  offset: number,
  p: PixelWithBrightnessInfo,
  pixelTransparency: number
): void => {
  setPixel(px, offset, p.brightness, p.brightness, p.brightness, p.a * pixelTransparency);
};

const compareImages = (file1: File, file2: File, options?: ResembleOptions): Promise<CompareResult> => {
  var pixelTransparency = 1;

  var errorPixelColor: Color = { // Color for Error Pixels. Between 0 and 255.
    red: 255,
    green: 0,
    blue: 255,
    alpha: 255
  };

  var errorPixelTransform = {
    flat: function (_p1: Pixel, _p2: Pixel): Pixel {
      return {
        r: errorPixelColor.red,
        g: errorPixelColor.green,
        b: errorPixelColor.blue,
        a: errorPixelColor.alpha
      }
    },
    movement: function (_p1: Pixel, p2: Pixel): Pixel {
      return {
        r: ((p2.r * (errorPixelColor.red / 255)) + errorPixelColor.red) / 2,
        g: ((p2.g * (errorPixelColor.green / 255)) + errorPixelColor.green) / 2,
        b: ((p2.b * (errorPixelColor.blue / 255)) + errorPixelColor.blue) / 2,
        a: p2.a
      }
    }
  };

  var errorPixelTransformer: (p1: Pixel, p2: Pixel) => Pixel = errorPixelTransform.flat;
  var largeImageThreshold = 1200;

  // options start
  var key: keyof Color;
  var opts = options || {};
  if (opts.errorColor) {
    for (key in opts.errorColor) {
      let color = opts.errorColor[key];
      errorPixelColor[key] = typeof color === 'undefined'
        ? errorPixelColor[key]
        : color;
    }
  }
  if (opts.errorType && errorPixelTransform[opts.errorType]) {
    errorPixelTransformer = errorPixelTransform[opts.errorType];
  }
  pixelTransparency = opts.transparency || pixelTransparency;
  if (typeof opts.largeImageThreshold !== 'undefined') {
    largeImageThreshold = opts.largeImageThreshold;
  }
  // options end

  var tolerance: Tolerance = { // between 0 and 255
    red: 16,
    green: 16,
    blue: 16,
    alpha: 16,
    minBrightness: 16,
    maxBrightness: 240
  };

  var ignoreAntialiasing = false;
  var ignoreColors = false;
  var ignoreRectangles: Rectangle[] | null = null;

  function isAntialiased(sourcePix: PixelWithBrightnessInfo, imageData: Buffer, y: number, x: number, width: number): boolean {
    var offset;
    var targetPix;
    var distance = 1;
    var i;
    var j;
    var hasHighContrastSibling = 0;
    var hasSiblingWithDifferentHue = 0;
    var hasEquivilantSibling = 0;

    addHueInfo(sourcePix);

    for (i = distance * -1; i <= distance; i++) {
      for (j = distance * -1; j <= distance; j++) {

        if (i === 0 && j === 0) {
          // ignore source pixel
        } else {

          offset = ((y + j) * width + (x + i)) * 4;
          targetPix = getPixel(imageData, offset);

          if (targetPix === null) {
            continue;
          }

          addBrightnessInfo(targetPix);
          addHueInfo(targetPix as PixelWithBrightnessInfo);

          if (isContrasting(sourcePix as PixelWithBrightnessAndHueInfo, targetPix as PixelWithBrightnessAndHueInfo, tolerance)) {
            hasHighContrastSibling++;
          }

          if (isRGBSame(sourcePix as PixelWithBrightnessAndHueInfo, targetPix as PixelWithBrightnessAndHueInfo)) {
            hasEquivilantSibling++;
          }

          if (Math.abs((targetPix as PixelWithBrightnessAndHueInfo).h - (sourcePix as PixelWithBrightnessAndHueInfo).h) > 0.3) {
            hasSiblingWithDifferentHue++;
          }

          if (hasSiblingWithDifferentHue > 1 || hasHighContrastSibling > 1) {
            return true;
          }
        }
      }
    }

    if (hasEquivilantSibling < 2) {
      return true;
    }

    return false;
  }

  // convert Pixel to PixelWithBrightnessInfo
  function addBrightnessInfo(p: Pixel): void {
    (p as PixelWithBrightnessInfo).brightness = getBrightness(p.r, p.g, p.b); // 'corrected' lightness
  }

  // convert PixelWithBrightnessInfo to PixelWithBrightnessAndHueInfo
  function addHueInfo(p: PixelWithBrightnessInfo): void {
    (p as PixelWithBrightnessAndHueInfo).h = getHue(p.r, p.g, p.b);
  }

  function analyseImages(image1: Image, image2: Image, width: number, height: number): CompareResult {

    var imageData1 = image1.data;
    var imageData2 = image2.data;

    //TODO
    var image = new png.PNG({
      width: image1.width,
      height: image1.height,
      deflateChunkSize: image1.deflateChunkSize,
      deflateLevel: image1.deflateLevel,
      deflateStrategy: image1.deflateStrategy,
    });
    var targetPix = image.data;

    var mismatchCount = 0;

    var time = Date.now();

    var skip: number | undefined;

    var currentRectangle = null;
    var rectagnlesIdx = 0;

    if (!!largeImageThreshold && ignoreAntialiasing && (width > largeImageThreshold || height > largeImageThreshold)) {
      skip = 6;
    }

    loop(height, width, function (y, x) {
      var offset = (y * width + x) * 4;

      if (skip) { // only skip if the image isn't small
        if (y % skip === 0 || x % skip === 0) {

          copyPixel(targetPix, offset, {
            r: 0,
            b: 0,
            g: 0,
            a: 0
          }, pixelTransparency);

          return;
        }
      }

      var pixel1 = getPixel(imageData1, offset);
      var pixel2 = getPixel(imageData2, offset);

      if (pixel1 === null || pixel2 === null) {
        return;
      }

      if (ignoreRectangles) {
        for (rectagnlesIdx = 0; rectagnlesIdx < ignoreRectangles.length; rectagnlesIdx++) {
          currentRectangle = ignoreRectangles[rectagnlesIdx];
          //console.log(currentRectangle, y, x);
          if (
            (y >= currentRectangle[1]) &&
            (y < currentRectangle[1] + currentRectangle[3]) &&
            (x >= currentRectangle[0]) &&
            (x < currentRectangle[0] + currentRectangle[2])
          ) {
            const pixel2_ = pixel2 as PixelWithBrightnessInfo; // FIXME: addBrightnessInfo(pixel2) has not been called yet
            copyGrayScalePixel(targetPix, offset, pixel2_, pixelTransparency); // ? pixel2.brightness is not defined
            //copyPixel(targetPix, offset, pixel1, pixelTransparency);
            return;
          }
        }
      }

      if (ignoreColors) {

        addBrightnessInfo(pixel1);
        addBrightnessInfo(pixel2);

        if (isPixelBrightnessSimilar(pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo, tolerance)) {
          copyGrayScalePixel(targetPix, offset, pixel2 as PixelWithBrightnessInfo, pixelTransparency);
        } else {
          copyErrorPixel(targetPix, offset, pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo, errorPixelTransformer);
          mismatchCount++;
        }
        return;
      }

      if (isRGBSimilar(pixel1, pixel2, tolerance)) {
        copyPixel(targetPix, offset, pixel1, pixelTransparency);

      } else if (ignoreAntialiasing && (
        addBrightnessInfo(pixel1), // jit pixel info augmentation looks a little weird, sorry.
        addBrightnessInfo(pixel2),
        isAntialiased(pixel1 as PixelWithBrightnessInfo, imageData1, y, x, width) ||
        isAntialiased(pixel2 as PixelWithBrightnessInfo, imageData2, y, x, width)
      )) {

        if (isPixelBrightnessSimilar(pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo, tolerance)) {
          copyGrayScalePixel(targetPix, offset, pixel2 as PixelWithBrightnessInfo, pixelTransparency);
        } else {
          copyErrorPixel(targetPix, offset, pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo, errorPixelTransformer);
          mismatchCount++;
        }
      } else {
        copyErrorPixel(targetPix, offset, pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo, errorPixelTransformer);
        mismatchCount++;
      }

    });

    const rawMisMatchPercentage = (mismatchCount / (height * width) * 100);
    return {
      isSameDimensions:
        image1.width === image2.width && image1.height === image2.height,
      dimensionDifference: {
        width: image1.width - image2.width,
        height: image1.height - image2.height
      },
      rawMisMatchPercentage,
      misMatchPercentage: rawMisMatchPercentage.toFixed(2),
      analysisTime: Date.now() - time,
      getDiffImage: function (_text) { return image; },
      getDiffImageAsJPEG: function (quality) {
        return jpeg.encode({
          data: targetPix,
          width: image1.width,
          height: image1.height
        }, typeof quality !== 'undefined' ? quality : 50).data;
      }
    };
  }

  if (typeof opts.ignoreAntialiasing !== 'undefined' && opts.ignoreAntialiasing) {
    tolerance.red = 32;
    tolerance.green = 32;
    tolerance.blue = 32;
    tolerance.alpha = 32;
    tolerance.minBrightness = 64;
    tolerance.maxBrightness = 96;

    ignoreAntialiasing = true;
    ignoreColors = false;
  }
  if (typeof opts.ignoreColors !== 'undefined' && opts.ignoreColors) {
    tolerance.alpha = 16;
    tolerance.minBrightness = 16;
    tolerance.maxBrightness = 240;

    ignoreAntialiasing = false;
    ignoreColors = true;
  }
  if (typeof opts.ignoreNothing !== 'undefined' && opts.ignoreNothing) {
    tolerance.red = 16;
    tolerance.green = 16;
    tolerance.blue = 16;
    tolerance.alpha = 16;
    tolerance.minBrightness = 16;
    tolerance.maxBrightness = 240;

    ignoreAntialiasing = false;
    ignoreColors = false;
  }
  if (typeof opts.ignoreRectangles !== 'undefined') {
    ignoreRectangles = opts.ignoreRectangles;
  }

  return Promise
    .all([loadImageData(file1), loadImageData(file2)])
    .then(([image1, image2]: [Image, Image]) => {
      var width = image1.width > image2.width ? image1.width : image2.width;
      var height = image1.height > image2.height ? image1.height : image2.height;
      //lksv: normalization removed
      return analyseImages(image1, image2, width, height);
    });
};

export { compareImages };
