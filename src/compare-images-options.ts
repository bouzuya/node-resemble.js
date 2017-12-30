import { newTransformer } from './error-pixel-transformer';
import { newTolerance } from './tolerance';
import { U8 } from './type/u8';
import { CompareImagesOptions } from './type/compare-images-options';
import { CompareImagesOptionsImpl } from './type/compare-images-options-impl';
import { IgnoreType } from './type/ignore-type';
import { Pixel } from './type/pixel';
import { Rectangle } from './type/rectangle';
import { Tolerance } from './type/tolerance';

const parseCompareImagesOptions = (
  options?: CompareImagesOptions
): CompareImagesOptionsImpl => {
  const opts = options || {};
  const getColorValue = (
    color: CompareImagesOptions['errorColor'],
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
  const errorPixelTransformer = newTransformer(
    errorPixelColor,
    typeof opts.errorType !== 'undefined' ? opts.errorType : 'flat'
  );
  const transparency = typeof opts.transparency !== 'undefined'
    ? opts.transparency
    : 1;
  const largeImageThreshold = typeof opts.largeImageThreshold !== 'undefined'
    ? opts.largeImageThreshold
    : 1200;
  const ignoreType: IgnoreType =
    typeof opts.ignoreAlpha !== 'undefined' && opts.ignoreAlpha
      ? 'alpha'
      : typeof opts.ignoreAntialiasing !== 'undefined' && opts.ignoreAntialiasing
        ? 'antialiasing'
        : typeof opts.ignoreColors !== 'undefined' && opts.ignoreColors
          ? 'colors'
          : typeof opts.ignoreLess !== 'undefined' && opts.ignoreLess
            ? 'less'
            : typeof opts.ignoreNothing !== 'undefined' && opts.ignoreNothing
              ? 'nothing'
              : 'default';
  const tolerance: Tolerance = newTolerance(ignoreType);
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

export { parseCompareImagesOptions };
