import { U8 } from './type/u8';
import { RGBA } from './type/rgba';
import { CompareImagesOptions } from './type/compare-images-options';
import { CompareResult } from './type/compare-result';
import { FileNameOrData } from './type/file-name-or-data';
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
import {
  convertToJPG,
  convertToPNG,
  loadImage,
  newImageBasedOn
} from './image';

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
  b1: U8,
  b2: U8,
  color: keyof Tolerance,
  tolerance: Tolerance
): boolean => {
  return b1 === b2 || Math.abs(b1 - b2) < tolerance[color];
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

const isRGBASimilar = (p1: Pixel, p2: Pixel, tolerance: Tolerance): boolean => {
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

const getHue = (r: U8, g: U8, b: U8): number => {
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

const getPixel = (imageData: Buffer, offset: number): Pixel | null => {
  const r = imageData[offset];
  if (typeof r === 'undefined') return null;
  return {
    r: r,
    g: imageData[offset + 1],
    b: imageData[offset + 2],
    a: imageData[offset + 3]
  };
};

const setPixel = (imageData: Buffer, offset: number, p: Pixel): void => {
  setRGBA(imageData, offset, p.r, p.g, p.b, p.a);
};

const setRGBA = (
  imageData: Buffer,
  offset: number,
  r: U8,
  g: U8,
  b: U8,
  a: U8
): void => {
  imageData[offset] = r;
  imageData[offset + 1] = g;
  imageData[offset + 2] = b;
  imageData[offset + 3] = a;
};

const copyErrorPixel = (
  imageData: Buffer,
  offset: number,
  p1: Pixel,
  p2: Pixel,
  errorPixelTransformer: (p1: Pixel, p2: Pixel) => Pixel
): void => {
  setPixel(imageData, offset, errorPixelTransformer(p1, p2));
};

const copyPixel = (
  imageData: Buffer,
  offset: number,
  p1: Pixel,
  pixelTransparency: number
): void => {
  setRGBA(imageData, offset, p1.r, p1.g, p1.b, p1.a * pixelTransparency);
};

const copyGrayScalePixel = (
  imageData: Buffer,
  offset: number,
  p: PixelWithBrightnessInfo,
  pixelTransparency: number
): void => {
  setRGBA(imageData, offset, p.brightness, p.brightness, p.brightness, p.a * pixelTransparency);
};

const toPixelWithBrightness = (p: Pixel): PixelWithBrightnessInfo => {
  return {
    r: p.r,
    g: p.g,
    b: p.b,
    a: p.a,
    brightness: getBrightness(p.r, p.g, p.b) // 'corrected' lightness
  };
};

const toPixelWithBrightnessAndHue = (p: PixelWithBrightnessInfo): PixelWithBrightnessAndHueInfo => {
  return {
    r: p.r,
    g: p.g,
    b: p.b,
    a: p.a,
    brightness: p.brightness,
    h: getHue(p.r, p.g, p.b),
  };
};

const isAntialiased = (
  centerPixel: PixelWithBrightnessInfo,
  imageData: Buffer,
  y: number,
  x: number,
  width: number,
  tolerance: Tolerance
): boolean => {
  let distance = 1;
  let hasHighContrastSibling = 0;
  let hasSiblingWithDifferentHue = 0;
  let hasEquivilantSibling = 0;
  const centerPixelWithBrightnessAndHue = toPixelWithBrightnessAndHue(centerPixel);
  for (let i = distance * -1; i <= distance; i++) {
    for (let j = distance * -1; j <= distance; j++) {
      if (i === 0 && j === 0) continue; // ignore source pixel
      const offset = ((y + j) * width + (x + i)) * 4;
      const aroundPixel = getPixel(imageData, offset);
      if (aroundPixel === null) continue;
      const targetPixWithBrightness = toPixelWithBrightness(aroundPixel);
      const targetPixWithBrightnessAndHue = toPixelWithBrightnessAndHue(targetPixWithBrightness);
      if (isContrasting(centerPixelWithBrightnessAndHue, targetPixWithBrightnessAndHue, tolerance)) {
        hasHighContrastSibling++;
      }
      if (isRGBSame(centerPixelWithBrightnessAndHue, targetPixWithBrightnessAndHue)) {
        hasEquivilantSibling++;
      }
      if (Math.abs(targetPixWithBrightnessAndHue.h - centerPixelWithBrightnessAndHue.h) > 0.3) {
        hasSiblingWithDifferentHue++;
      }
      if (hasSiblingWithDifferentHue > 1 || hasHighContrastSibling > 1) {
        return true;
      }
    }
  }
  return hasEquivilantSibling < 2;
};

const analyseImages = (
  image1: Image,
  image2: Image,
  options: CompareImagesOptions
): CompareResult => {
  const width = Math.max(image1.width, image2.width);
  const height = Math.max(image1.height, image2.height);
  const {
    errorPixelTransformer,
    ignoreAntialiasing,
    ignoreColors,
    ignoreRectangles,
    largeImageThreshold,
    tolerance,
    transparency: pixelTransparency
  } = options;
  const imageData1 = image1.data;
  const imageData2 = image2.data;
  //TODO
  const diffImage = newImageBasedOn(image1);
  const diffImageData = diffImage.data;
  let mismatchCount = 0;
  const time = Date.now();
  let skip: number | undefined;
  let currentRectangle = null;
  if (!!largeImageThreshold && ignoreAntialiasing && (width > largeImageThreshold || height > largeImageThreshold)) {
    skip = 6;
  }

  loop(height, width, function (y, x) {
    const offset = (y * width + x) * 4;
    if (skip) { // only skip if the image isn't small
      if (y % skip === 0 || x % skip === 0) {
        copyPixel(diffImageData, offset, {
          r: 0,
          b: 0,
          g: 0,
          a: 0
        }, pixelTransparency);
        return;
      }
    }

    const pixel1 = getPixel(imageData1, offset);
    const pixel2 = getPixel(imageData2, offset);
    if (pixel1 === null || pixel2 === null) return;
    if (ignoreRectangles) {
      for (let rectagnlesIdx = 0; rectagnlesIdx < ignoreRectangles.length; rectagnlesIdx++) {
        currentRectangle = ignoreRectangles[rectagnlesIdx];
        //console.log(currentRectangle, y, x);
        if (
          (y >= currentRectangle[1]) &&
          (y < currentRectangle[1] + currentRectangle[3]) &&
          (x >= currentRectangle[0]) &&
          (x < currentRectangle[0] + currentRectangle[2])
        ) {
          const pixel2_ = pixel2 as PixelWithBrightnessInfo; // FIXME: addBrightnessInfo(pixel2) has not been called yet
          copyGrayScalePixel(diffImageData, offset, pixel2_, pixelTransparency); // ? pixel2.brightness is not defined
          //copyPixel(targetPix, offset, pixel1, pixelTransparency);
          return;
        }
      }
    }

    if (ignoreColors) {
      const pixel1WithBrightness = toPixelWithBrightness(pixel1);
      const pixel2WithBrightness = toPixelWithBrightness(pixel2);
      if (isPixelBrightnessSimilar(pixel1WithBrightness, pixel2WithBrightness, tolerance)) {
        copyGrayScalePixel(diffImageData, offset, pixel2WithBrightness, pixelTransparency);
      } else {
        copyErrorPixel(diffImageData, offset, pixel1WithBrightness, pixel2WithBrightness, errorPixelTransformer);
        mismatchCount++;
      }
    } else if (isRGBASimilar(pixel1, pixel2, tolerance)) {
      copyPixel(diffImageData, offset, pixel1, pixelTransparency);
    } else if (ignoreAntialiasing) {
      const pixel1WithBrightness = toPixelWithBrightness(pixel1); // jit pixel info augmentation looks a little weird, sorry.
      const pixel2WithBrightness = toPixelWithBrightness(pixel2);
      if (
        isAntialiased(pixel1WithBrightness, imageData1, y, x, width, tolerance) ||
        isAntialiased(pixel2WithBrightness, imageData2, y, x, width, tolerance)
      ) {
        if (isPixelBrightnessSimilar(pixel1WithBrightness, pixel2WithBrightness, tolerance)) {
          copyGrayScalePixel(diffImageData, offset, pixel2WithBrightness, pixelTransparency);
        } else {
          copyErrorPixel(diffImageData, offset, pixel1WithBrightness, pixel2WithBrightness, errorPixelTransformer);
          mismatchCount++;
        }
      } else {
        copyErrorPixel(diffImageData, offset, pixel1WithBrightness, pixel2WithBrightness, errorPixelTransformer);
        mismatchCount++;
      }
    } else {
      copyErrorPixel(diffImageData, offset, pixel1, pixel2, errorPixelTransformer);
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
    getDiffImage: function (_text) {
      return convertToPNG(diffImage);
    },
    getDiffImageAsJPEG: function (quality) {
      return convertToJPG(diffImage, quality);
    }
  };
};

const parseOptions = (options?: ResembleOptions): CompareImagesOptions => {
  const opts = options || {};
  const getColorValue = (
    color: Partial<RGBA> | undefined,
    key: keyof RGBA,
    defaultValue: U8
  ): U8 => {
    if (typeof color === 'undefined') return defaultValue;
    const value = color[key];
    if (typeof value === 'undefined') return defaultValue;
    return value;
  };
  const errorPixelColor: RGBA = {
    red: getColorValue(opts.errorColor, 'red', 255),
    green: getColorValue(opts.errorColor, 'green', 0),
    blue: getColorValue(opts.errorColor, 'blue', 255),
    alpha: getColorValue(opts.errorColor, 'alpha', 255)
  };
  const errorPixelTransform = {
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
  const errorPixelTransformer =
    typeof opts.errorType !== 'undefined' && typeof errorPixelTransform[opts.errorType] !== 'undefined'
      ? errorPixelTransform[opts.errorType]
      : errorPixelTransform.flat;
  const transparency = typeof opts.transparency !== 'undefined'
    ? opts.transparency
    : 1;
  const largeImageThreshold = typeof opts.largeImageThreshold !== 'undefined'
    ? opts.largeImageThreshold
    : 1200;
  const ignoreType: 'antialiasing' | 'colors' | 'nothing' | 'default' =
    typeof opts.ignoreAntialiasing !== 'undefined' && opts.ignoreAntialiasing
      ? 'antialiasing'
      : typeof opts.ignoreColors !== 'undefined' && opts.ignoreColors
        ? 'colors'
        : typeof opts.ignoreNothing !== 'undefined' && opts.ignoreNothing
          ? 'nothing'
          : 'default';
  const tolerance: Tolerance = ignoreType === 'antialiasing'
    ? {
      red: 32,
      green: 32,
      blue: 32,
      alpha: 32,
      minBrightness: 64,
      maxBrightness: 96
    }
    : ignoreType === 'colors'
      ? {
        red: 16, // unused -> default
        green: 16, // unused -> default
        blue: 16, // unused -> default
        alpha: 16,
        minBrightness: 16,
        maxBrightness: 240
      }
      : ignoreType === 'nothing'
        ? {
          red: 0,
          green: 0,
          blue: 0,
          alpha: 0,
          minBrightness: 0,
          maxBrightness: 255
        }
        : {
          red: 16,
          green: 16,
          blue: 16,
          alpha: 16,
          minBrightness: 16,
          maxBrightness: 240
        };
  const ignoreAntialiasing = ignoreType === 'antialiasing';
  const ignoreColors = ignoreType === 'colors';
  const ignoreRectangles: Rectangle[] | null =
    typeof opts.ignoreRectangles !== 'undefined'
      ? opts.ignoreRectangles
      : null;
  return {
    largeImageThreshold,
    ignoreAntialiasing,
    ignoreColors,
    ignoreRectangles,
    transparency,
    tolerance,
    errorPixelTransformer
  };
};

const compareImages = (file1: FileNameOrData, file2: FileNameOrData, options?: ResembleOptions): Promise<CompareResult> => {
  return Promise
    .all([loadImage(file1), loadImage(file2)])
    .then(([image1, image2]: [Image, Image]) => {
      //lksv: normalization removed
      return analyseImages(image1, image2, parseOptions(options));
    });
};

export { compareImages };
