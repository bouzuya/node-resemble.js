import { getHue, getLightness } from './color';
import { parseCompareImagesOptions } from './compare-images-options';
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

const isSimilar = (p1: Pixel, p2: Pixel, options: CompareImagesOptions) => {
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
  const centerL = getLightness(centerPixel);
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
  const startTime = Date.now();
  const width = Math.max(image1.width, image2.width);
  const height = Math.max(image1.height, image2.height);
  const {
    errorPixelTransformer: newErrorPixel,
    ignoreAntialiasing,
    largeImageThreshold,
    tolerance,
    transparency
  } = options;
  const imageData1 = image1.data;
  const imageData2 = image2.data;
  const diffImage = newImageBasedOn(image1); // TODO
  const diffImageData = diffImage.data;
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
        setPixel(diffImageData, offset, newPixel(0, 0, 0, 0));
        return;
      }
    }

    const pixel1 = getPixel(imageData1, offset);
    const pixel2 = getPixel(imageData2, offset);
    if (pixel1 === null || pixel2 === null) return;

    if (isInIgnoreRectangle(x, y, options.ignoreRectangles)) {
      setPixel(
        diffImageData,
        offset,
        newGrayScalePixel(getLightness(pixel2), pixel2.a * transparency)
        // newPixel(pixel1.r, pixel1.g, pixel1.b, pixel1.a * pixelTransparency)
        // ? diffOnly
      );
      return;
    }

    if (isSimilar(pixel1, pixel2, options)) {
      setPixel(
        diffImageData,
        offset,
        options.ignoreColors
          ? newGrayScalePixel(getLightness(pixel2), pixel2.a * transparency)
          : newPixel(pixel1.r, pixel1.g, pixel1.b, pixel1.a * transparency)
      );
      // ? diffOnly
    } else if (
      !options.ignoreColors && // ?
      ignoreAntialiasing &&
      (
        isAntialiased(pixel1, imageData1, y, x, width, tolerance) ||
        isAntialiased(pixel2, imageData2, y, x, width, tolerance)
      ) &&
      isGrayScaleSimilar(pixel1, pixel2, tolerance)
    ) {
      setPixel(
        diffImageData,
        offset,
        newGrayScalePixel(getLightness(pixel2), pixel2.a * transparency)
      );
      // ? diffOnly
    } else {
      setPixel(diffImageData, offset, newErrorPixel(pixel1, pixel2));
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

const compareImages = (
  file1: FileNameOrData,
  file2: FileNameOrData,
  options?: ResembleOptions
): Promise<CompareResult> => {
  return Promise
    .all([loadImage(file1), loadImage(file2)])
    .then(([image1, image2]: [Image, Image]) => {
      //lksv: normalization removed
      return analyseImages(image1, image2, parseCompareImagesOptions(options));
    });
};

export { compareImages };
