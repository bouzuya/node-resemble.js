import { getHue, getLightness } from './color';
import { parseCompareImagesOptions } from './compare-images-options';
import { U8 } from './type/u8';
import { CompareImagesOptions } from './type/compare-images-options';
import { CompareImagesOptionsImpl } from './type/compare-images-options-impl';
import { CompareImagesResult } from './type/compare-images-result';
import { Image } from './type/image';
import { Pixel } from './type/pixel';
import { Rectangle } from './type/rectangle';
import { Tolerance } from './type/tolerance';
import {
  convertToJPG,
  convertToPNG,
  getPixel,
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

const isValueSameOrSimilar = (
  b1: U8,
  b2: U8,
  color: keyof Tolerance,
  tolerance: Tolerance
): boolean => {
  return b1 === b2 || Math.abs(b1 - b2) < tolerance[color];
};

const isColorSimilar = (p1: Pixel, p2: Pixel, tolerance: Tolerance) => {
  return isValueSameOrSimilar(p1.r, p2.r, 'r', tolerance) &&
    isValueSameOrSimilar(p1.g, p2.g, 'g', tolerance) &&
    isValueSameOrSimilar(p1.b, p2.b, 'b', tolerance) &&
    isValueSameOrSimilar(p1.a, p2.a, 'a', tolerance);
};

const isGrayScaleSimilar = (p1: Pixel, p2: Pixel, tolerance: Tolerance) => {
  return isValueSameOrSimilar(p1.a, p2.a, 'a', tolerance) &&
    isValueSameOrSimilar(getLightness(p1), getLightness(p2), 'minL', tolerance);
};

const isSimilar = (p1: Pixel, p2: Pixel, options: CompareImagesOptionsImpl) => {
  const { ignoreColors, tolerance } = options;
  if (ignoreColors) {
    return isGrayScaleSimilar(p1, p2, tolerance);
  } else {
    return isColorSimilar(p1, p2, tolerance);
  }
};

const isInIgnoreRectangle = (
  x: number,
  y: number,
  ignoreRectangles: Rectangle[] | null
): boolean => {
  return ignoreRectangles !== null &&
    ignoreRectangles.some(([rx, ry, rw, rh]) => {
      return (y >= ry) && (y < ry + rh) && (x >= rx) && (x < rx + rw);
    });
};

const isAntialiased = (
  centerPixel: Pixel,
  image: Image,
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
  const centerL = getLightness(centerPixel);
  for (let i = distance * -1; i <= distance; i++) {
    for (let j = distance * -1; j <= distance; j++) {
      if (i === 0 && j === 0) continue; // ignore source pixel
      const offset = ((y + j) * width + (x + i)) * 4;
      const aroundPixel = getPixel(image, offset);
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

const compareImages = (
  image1: Image,
  image2: Image,
  options?: CompareImagesOptions
): CompareImagesResult => {
  const opts = parseCompareImagesOptions(options);
  const newGrayScalePixel = (l: number, a: U8): Pixel => newPixel(l, l, l, a);
  const startTime = Date.now();
  const width = Math.max(image1.width, image2.width);
  const height = Math.max(image1.height, image2.height);
  const {
    errorPixelTransformer: newErrorPixel,
    ignoreAntialiasing,
    largeImageThreshold,
    tolerance,
    transparency
  } = opts;
  const diffImage = newImageBasedOn(image1); // TODO
  const skip: number | null =
    !!largeImageThreshold &&
      ignoreAntialiasing &&
      (width > largeImageThreshold || height > largeImageThreshold)
      ? 6
      : null;

  let misMatchPixelCount = 0;
  loop(height, width, function (y, x) {
    const offset = (y * width + x) * 4;
    if (skip !== null) { // only skip if the image isn't small
      if (y % skip === 0 || x % skip === 0) {
        // ? skip
        setPixel(diffImage, offset, newPixel(0, 0, 0, 0));
        return;
      }
    }

    const pixel1 = getPixel(image1, offset);
    const pixel2 = getPixel(image2, offset);
    if (pixel1 === null || pixel2 === null) return;

    if (isInIgnoreRectangle(x, y, opts.ignoreRectangles)) {
      setPixel(
        diffImage,
        offset,
        newGrayScalePixel(getLightness(pixel2), pixel2.a * transparency)
        // newPixel(pixel1.r, pixel1.g, pixel1.b, pixel1.a * pixelTransparency)
        // ? diffOnly
      );
      return;
    }

    if (isSimilar(pixel1, pixel2, opts)) {
      setPixel(
        diffImage,
        offset,
        opts.ignoreColors
          ? newGrayScalePixel(getLightness(pixel2), pixel2.a * transparency)
          : newPixel(pixel1.r, pixel1.g, pixel1.b, pixel1.a * transparency)
      );
      // ? diffOnly
    } else if (
      !opts.ignoreColors && // ?
      ignoreAntialiasing &&
      (
        isAntialiased(pixel1, image1, y, x, width, tolerance) ||
        isAntialiased(pixel2, image2, y, x, width, tolerance)
      ) &&
      isGrayScaleSimilar(pixel1, pixel2, tolerance)
    ) {
      setPixel(
        diffImage,
        offset,
        newGrayScalePixel(getLightness(pixel2), pixel2.a * transparency)
      );
      // ? diffOnly
    } else {
      setPixel(diffImage, offset, newErrorPixel(pixel1, pixel2));
      misMatchPixelCount++;
    }
  });

  const allPixelCount = height * width;
  const rawMisMatchPercentage = (misMatchPixelCount / allPixelCount * 100);
  const endTime = Date.now();
  return {
    isSameDimensions:
      image1.width === image2.width && image1.height === image2.height,
    dimensionDifference: {
      width: image1.width - image2.width,
      height: image1.height - image2.height
    },
    rawMisMatchPercentage,
    misMatchPercentage: rawMisMatchPercentage.toFixed(2),
    analysisTime: endTime - startTime,
    getDiffImage: function (_text) {
      return convertToPNG(diffImage);
    },
    getDiffImageAsJPEG: function (quality) {
      return convertToJPG(diffImage, quality);
    }
  };
};

export { compareImages };
