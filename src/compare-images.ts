import jpeg = require('jpeg-js');
import png = require('pngjs');
import { Byte } from './type/byte';
import { Color } from './type/color';
import { File } from './type/file';
import { Image } from './type/image';
import {
  Pixel,
  PixelWithBrightnessAndHueInfo,
  PixelWithBrightnessInfo
} from './type/pixel';
import { Rectangle } from './type/rectangle';
import { ResembleOptions } from './type/resemble-options';
import { CompareResult } from './type/compare-result';
import { getBrightness } from './get-brightness';
import { loadImageData } from './load-image-data';

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

  var tolerance = { // between 0 and 255
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

  function loop(height: number, width: number, callback: (y: number, x: number) => void): void {
    var y, x;
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        callback(y, x);
      }
    }
  }

  function isColorSimilar(a: Pixel['a'] | PixelWithBrightnessInfo['brightness'], b: Pixel['a'] | PixelWithBrightnessInfo['brightness'], color: 'red' | 'green' | 'blue' | 'alpha' | 'minBrightness'): boolean {

    var absDiff = Math.abs(a - b);

    if (typeof a === 'undefined') {
      return false;
    }
    if (typeof b === 'undefined') {
      return false;
    }

    if (a === b) {
      return true;
    } else if (absDiff < tolerance[color]) {
      return true;
    } else {
      return false;
    }
  }

  function isPixelBrightnessSimilar(p1: PixelWithBrightnessInfo, p2: PixelWithBrightnessInfo): boolean {
    var alpha = isColorSimilar(p1.a, p2.a, 'alpha');
    var brightness = isColorSimilar(p1.brightness, p2.brightness, 'minBrightness');
    return brightness && alpha;
  }

  function isRGBSame(p1: Pixel, p2: Pixel) {
    var red = p1.r === p2.r;
    var green = p1.g === p2.g;
    var blue = p1.b === p2.b;
    return red && green && blue;
  }

  function isRGBSimilar(p1: Pixel, p2: Pixel): boolean {
    var red = isColorSimilar(p1.r, p2.r, 'red');
    var green = isColorSimilar(p1.g, p2.g, 'green');
    var blue = isColorSimilar(p1.b, p2.b, 'blue');
    var alpha = isColorSimilar(p1.a, p2.a, 'alpha');

    return red && green && blue && alpha;
  }

  function isContrasting(p1: PixelWithBrightnessInfo, p2: PixelWithBrightnessInfo): boolean {
    return Math.abs(p1.brightness - p2.brightness) > tolerance.maxBrightness;
  }

  function getHue(r: Byte, g: Byte, b: Byte): number {
    r = r / 255;
    g = g / 255;
    b = b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h: number;
    var d;

    if (max == min) {
      h = 0; // achromatic
    } else {
      d = max - min;
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: throw new Error('assert max is r or g or b');
      }
      h /= 6;
    }

    return h;
  }

  function isAntialiased(sourcePix: PixelWithBrightnessInfo, imageData: Buffer, cacheSet: 1 | 2, y: number, x: number, width: number): boolean {
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
          targetPix = getPixelInfo(imageData, offset, cacheSet);

          if (targetPix === null) {
            continue;
          }

          addBrightnessInfo(targetPix);
          addHueInfo(targetPix as PixelWithBrightnessInfo);

          if (isContrasting(sourcePix as PixelWithBrightnessAndHueInfo, targetPix as PixelWithBrightnessAndHueInfo)) {
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

  function errorPixel(px: Buffer, offset: number, p1: Pixel, p2: Pixel): void {
    var p = errorPixelTransformer(p1, p2);
    px[offset] = p.r;
    px[offset + 1] = p.g;
    px[offset + 2] = p.b;
    px[offset + 3] = p.a;
  }

  // ? copyPixel(px: Buffer, offset: number, p1: Pixel, p2: Pixel): void
  function copyPixel(px: Buffer, offset: number, p1: Pixel): void {
    px[offset] = p1.r; //r
    px[offset + 1] = p1.g; //g
    px[offset + 2] = p1.b; //b
    px[offset + 3] = p1.a * pixelTransparency; //a
  }

  function copyGrayScalePixel(px: Buffer, offset: number, p: Pixel): void {
    px[offset] = p.brightness; //r
    px[offset + 1] = p.brightness; //g
    px[offset + 2] = p.brightness; //b
    px[offset + 3] = p.a * pixelTransparency; //a
  }

  function getPixelInfo(imageData: Buffer, offset: number, _cacheSet: 1 | 2): Pixel | null {
    var r;
    var g;
    var b;
    var d;
    var a;

    r = imageData[offset];

    if (typeof r !== 'undefined') {
      g = imageData[offset + 1];
      b = imageData[offset + 2];
      a = imageData[offset + 3];
      d = {
        r: r,
        g: g,
        b: b,
        a: a
      };

      return d;
    } else {
      return null;
    }
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

          copyPixel(targetPix, offset, { // ? { r: 0, b: 0, g: 0, a: 0 }
            red: 0,
            blue: 0,
            green: 0,
            alpha: 0
          });

          return;
        }
      }

      var pixel1 = getPixelInfo(imageData1, offset, 1);
      var pixel2 = getPixelInfo(imageData2, offset, 2);

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
            copyGrayScalePixel(targetPix, offset, pixel2); // ? pixel2.brightness is not defined
            //copyPixel(targetPix, offset, pixel1, pixel2);
            return;
          }
        }
      }

      if (ignoreColors) {

        addBrightnessInfo(pixel1);
        addBrightnessInfo(pixel2);

        if (isPixelBrightnessSimilar(pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo)) {
          copyGrayScalePixel(targetPix, offset, pixel2 as PixelWithBrightnessInfo);
        } else {
          errorPixel(targetPix, offset, pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo);
          mismatchCount++;
        }
        return;
      }

      if (isRGBSimilar(pixel1, pixel2)) {
        copyPixel(targetPix, offset, pixel1, pixel2);

      } else if (ignoreAntialiasing && (
        addBrightnessInfo(pixel1), // jit pixel info augmentation looks a little weird, sorry.
        addBrightnessInfo(pixel2),
        isAntialiased(pixel1 as PixelWithBrightnessInfo, imageData1, 1, y, x, width) ||
        isAntialiased(pixel2 as PixelWithBrightnessInfo, imageData2, 2, y, x, width)
      )) {

        if (isPixelBrightnessSimilar(pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo)) {
          copyGrayScalePixel(targetPix, offset, pixel2 as PixelWithBrightnessInfo);
        } else {
          errorPixel(targetPix, offset, pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo);
          mismatchCount++;
        }
      } else {
        errorPixel(targetPix, offset, pixel1 as PixelWithBrightnessInfo, pixel2 as PixelWithBrightnessInfo);
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
