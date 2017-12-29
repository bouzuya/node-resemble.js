import { getHue, getLightness } from './color';
import { U8 } from './type/u8';
import { CompareImagesOptions } from './type/compare-images-options';
import { CompareResult } from './type/compare-result';
import { FileNameOrData } from './type/file-name-or-data';
import { Image } from './type/image';
import { Pixel } from './type/pixel';
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

const isAntialiased = (
  centerPixel: Pixel,
  centerL: number,
  imageData: Buffer,
  y: number,
  x: number,
  width: number,
  tolerance: Tolerance
): boolean => {
  let hasHighContrastSibling = 0;
  let hasSiblingWithDifferentHue = 0;
  let hasEquivilantSibling = 0;
  const distance = 1;
  const centerH = getHue(centerPixel);
  for (let i = distance * -1; i <= distance; i++) {
    for (let j = distance * -1; j <= distance; j++) {
      if (i === 0 && j === 0) continue; // ignore source pixel
      const offset = ((y + j) * width + (x + i)) * 4;
      const aroundPixel = getPixel(imageData, offset);
      if (aroundPixel === null) continue;
      const aroundL = getLightness(aroundPixel);
      const aroundH = getHue(aroundPixel);
      // isContrasting
      if (Math.abs(centerL - aroundL) > tolerance.maxL) {
        hasHighContrastSibling++;
      }
      if (
        centerPixel.r === aroundPixel.r &&
        centerPixel.g === aroundPixel.g &&
        centerPixel.b === aroundPixel.b
      ) {
        hasEquivilantSibling++;
      }
      if (Math.abs(aroundH - centerH) > 0.3) {
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
  const newGrayScalePixel = (l: number, a: U8): Pixel => newPixel(l, l, l, a);
  const width = Math.max(image1.width, image2.width);
  const height = Math.max(image1.height, image2.height);
  const {
    errorPixelTransformer: newErrorPixel,
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
        setPixel(diffImageData, offset, newPixel(0, 0, 0, 0));
        return;
      }
    }

    const pixel1 = getPixel(imageData1, offset);
    const pixel2 = getPixel(imageData2, offset);
    if (pixel1 === null || pixel2 === null) return;

    if (
      ignoreRectangles !== null &&
      ignoreRectangles.some(([rx, ry, rw, rh]) => {
        return (y >= ry) && (y < ry + rh) && (x >= rx) && (x < rx + rw);
      })
    ) {
      const pixel2L = getLightness(pixel2);
      setPixel(
        diffImageData,
        offset,
        newGrayScalePixel(pixel2L, pixel2.a * pixelTransparency)
        // newPixel(pixel1.r, pixel1.g, pixel1.b, pixel1.a * pixelTransparency)
      );
      return;
    }

    if (ignoreColors) {
      const pixel1L = getLightness(pixel1);
      const pixel2L = getLightness(pixel2);
      if (
        isColorSimilar(pixel1.a, pixel2.a, 'a', tolerance) &&
        isColorSimilar(pixel1L, pixel2L, 'minL', tolerance)
      ) {
        setPixel(
          diffImageData,
          offset,
          newGrayScalePixel(pixel2L, pixel2.a * pixelTransparency)
        );
      } else {
        setPixel(diffImageData, offset, newErrorPixel(pixel1, pixel2));
        mismatchCount++;
      }
    } else if (
      isColorSimilar(pixel1.r, pixel2.r, 'r', tolerance) &&
      isColorSimilar(pixel1.g, pixel2.g, 'g', tolerance) &&
      isColorSimilar(pixel1.b, pixel2.b, 'b', tolerance) &&
      isColorSimilar(pixel1.a, pixel2.a, 'a', tolerance)
    ) {
      setPixel(
        diffImageData,
        offset,
        newPixel(pixel1.r, pixel1.g, pixel1.b, pixel1.a * pixelTransparency)
      );
    } else if (ignoreAntialiasing) {
      const pixel1L = getLightness(pixel1); // jit pixel info augmentation looks a little weird, sorry.
      const pixel2L = getLightness(pixel2);
      if (
        isAntialiased(pixel1, pixel1L, imageData1, y, x, width, tolerance) ||
        isAntialiased(pixel2, pixel2L, imageData2, y, x, width, tolerance)
      ) {
        if (
          isColorSimilar(pixel1.a, pixel2.a, 'a', tolerance) &&
          isColorSimilar(pixel1L, pixel2L, 'minL', tolerance)
        ) {
          setPixel(
            diffImageData,
            offset,
            newGrayScalePixel(pixel2L, pixel2.a * pixelTransparency)
          );
        } else {
          setPixel(diffImageData, offset, newErrorPixel(pixel1, pixel2));
          mismatchCount++;
        }
      } else {
        setPixel(diffImageData, offset, newErrorPixel(pixel1, pixel2));
        mismatchCount++;
      }
    } else {
      setPixel(diffImageData, offset, newErrorPixel(pixel1, pixel2));
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
