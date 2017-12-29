import { getHue, getLightness } from './color';
import { U8 } from './type/u8';
import { CompareImagesOptions } from './type/compare-images-options';
import { CompareResult } from './type/compare-result';
import { FileNameOrData } from './type/file-name-or-data';
import { Image } from './type/image';
import {
  Pixel,
  PixelWithHL,
  PixelWithL
} from './type/pixel';
import { Rectangle } from './type/rectangle';
import { ResembleOptions } from './type/resemble-options';
import { Tolerance } from './type/tolerance';
import {
  convertToJPG,
  convertToPNG,
  getPixel,
  loadImage,
  newImageBasedOn,
  newPixel,
  setPixel
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

const isPixelLightnessSimilar = (
  p1: PixelWithL,
  p2: PixelWithL,
  tolerance: Tolerance
): boolean => {
  const a = isColorSimilar(p1.a, p2.a, 'a', tolerance);
  const l = isColorSimilar(p1.l, p2.l, 'minL', tolerance);
  return l && a;
};

const isRGBSame = (p1: Pixel, p2: Pixel): boolean => {
  const r = p1.r === p2.r;
  const g = p1.g === p2.g;
  const b = p1.b === p2.b;
  return r && g && b;
};

const isRGBASimilar = (p1: Pixel, p2: Pixel, tolerance: Tolerance): boolean => {
  const r = isColorSimilar(p1.r, p2.r, 'r', tolerance);
  const g = isColorSimilar(p1.g, p2.g, 'g', tolerance);
  const b = isColorSimilar(p1.b, p2.b, 'b', tolerance);
  const a = isColorSimilar(p1.a, p2.a, 'a', tolerance);
  return r && g && b && a;
};

const isContrasting = (
  p1: PixelWithL,
  p2: PixelWithL,
  tolerance: Tolerance
): boolean => {
  return Math.abs(p1.l - p2.l) > tolerance.maxL;
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
  setPixel(imageData, offset, newPixel(p1.r, p1.g, p1.b, p1.a * pixelTransparency));
};

const copyGrayScalePixel = (
  imageData: Buffer,
  offset: number,
  p: PixelWithL,
  pixelTransparency: number
): void => {
  setPixel(imageData, offset, newPixel(p.l, p.l, p.l, p.a * pixelTransparency));
};

const toPixelWithL = (p: Pixel): PixelWithL => {
  return {
    r: p.r,
    g: p.g,
    b: p.b,
    a: p.a,
    l: getLightness(p) // 'corrected' lightness
  };
};

const toPixelWithHL = (p: PixelWithL): PixelWithHL => {
  return {
    r: p.r,
    g: p.g,
    b: p.b,
    a: p.a,
    l: p.l,
    h: getHue(p),
  };
};

const isAntialiased = (
  centerPixel: PixelWithL,
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
  const centerPixelWithHL = toPixelWithHL(centerPixel);
  for (let i = distance * -1; i <= distance; i++) {
    for (let j = distance * -1; j <= distance; j++) {
      if (i === 0 && j === 0) continue; // ignore source pixel
      const offset = ((y + j) * width + (x + i)) * 4;
      const aroundPixel = getPixel(imageData, offset);
      if (aroundPixel === null) continue;
      const targetPixWithL = toPixelWithL(aroundPixel);
      const targetPixWithHL = toPixelWithHL(targetPixWithL);
      if (isContrasting(centerPixelWithHL, targetPixWithHL, tolerance)) {
        hasHighContrastSibling++;
      }
      if (isRGBSame(centerPixelWithHL, targetPixWithHL)) {
        hasEquivilantSibling++;
      }
      if (Math.abs(targetPixWithHL.h - centerPixelWithHL.h) > 0.3) {
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
        let [rx, ry, rwidth, rheight] = ignoreRectangles[rectagnlesIdx];
        if ((y >= ry) && (y < ry + rheight) && (x >= rx) && (x < rx + rwidth)) {
          const pixel2_ = pixel2 as PixelWithL; // FIXME: toPixelWithL(pixel2) has not been called yet
          copyGrayScalePixel(diffImageData, offset, pixel2_, pixelTransparency); // ? pixel2.l is not defined
          //copyPixel(targetPix, offset, pixel1, pixelTransparency);
          return;
        }
      }
    }

    if (ignoreColors) {
      const pixel1WithL = toPixelWithL(pixel1);
      const pixel2WithL = toPixelWithL(pixel2);
      if (isPixelLightnessSimilar(pixel1WithL, pixel2WithL, tolerance)) {
        copyGrayScalePixel(diffImageData, offset, pixel2WithL, pixelTransparency);
      } else {
        copyErrorPixel(diffImageData, offset, pixel1WithL, pixel2WithL, errorPixelTransformer);
        mismatchCount++;
      }
    } else if (isRGBASimilar(pixel1, pixel2, tolerance)) {
      copyPixel(diffImageData, offset, pixel1, pixelTransparency);
    } else if (ignoreAntialiasing) {
      const pixel1WithL = toPixelWithL(pixel1); // jit pixel info augmentation looks a little weird, sorry.
      const pixel2WithL = toPixelWithL(pixel2);
      if (
        isAntialiased(pixel1WithL, imageData1, y, x, width, tolerance) ||
        isAntialiased(pixel2WithL, imageData2, y, x, width, tolerance)
      ) {
        if (isPixelLightnessSimilar(pixel1WithL, pixel2WithL, tolerance)) {
          copyGrayScalePixel(diffImageData, offset, pixel2WithL, pixelTransparency);
        } else {
          copyErrorPixel(diffImageData, offset, pixel1WithL, pixel2WithL, errorPixelTransformer);
          mismatchCount++;
        }
      } else {
        copyErrorPixel(diffImageData, offset, pixel1WithL, pixel2WithL, errorPixelTransformer);
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
    color: ResembleOptions['errorColor'],
    key: 'red' | 'green' | 'blue' | 'alpha',
    defaultValue: U8
  ): U8 => {
    if (typeof color === 'undefined') return defaultValue;
    const value = color[key];
    if (typeof value === 'undefined') return defaultValue;
    return value;
  };
  const errorPixelColor: Pixel = {
    r: getColorValue(opts.errorColor, 'red', 255),
    g: getColorValue(opts.errorColor, 'green', 0),
    b: getColorValue(opts.errorColor, 'blue', 255),
    a: getColorValue(opts.errorColor, 'alpha', 255)
  };
  const errorPixelTransform = {
    flat: function (_p1: Pixel, _p2: Pixel): Pixel {
      return {
        r: errorPixelColor.r,
        g: errorPixelColor.g,
        b: errorPixelColor.b,
        a: errorPixelColor.a
      }
    },
    movement: function (_p1: Pixel, p2: Pixel): Pixel {
      return {
        r: ((p2.r * (errorPixelColor.r / 255)) + errorPixelColor.r) / 2,
        g: ((p2.g * (errorPixelColor.g / 255)) + errorPixelColor.g) / 2,
        b: ((p2.b * (errorPixelColor.b / 255)) + errorPixelColor.b) / 2,
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
      r: 32,
      g: 32,
      b: 32,
      a: 32,
      minL: 64,
      maxL: 96
    }
    : ignoreType === 'colors'
      ? {
        r: 16, // unused -> default
        g: 16, // unused -> default
        b: 16, // unused -> default
        a: 16,
        minL: 16,
        maxL: 240
      }
      : ignoreType === 'nothing'
        ? {
          r: 0,
          g: 0,
          b: 0,
          a: 0,
          minL: 0,
          maxL: 255
        }
        : {
          r: 16,
          g: 16,
          b: 16,
          a: 16,
          minL: 16,
          maxL: 240
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
