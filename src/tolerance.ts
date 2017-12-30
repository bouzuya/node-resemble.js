import { IgnoreType } from './type/ignore-type';
import { Tolerance } from './type/tolerance';

const alpha: Tolerance = {
  r: 16,
  g: 16,
  b: 16,
  a: 255,
  minL: 16,
  maxL: 240
};

const antialiasing: Tolerance = {
  r: 32,
  g: 32,
  b: 32,
  a: 32,
  minL: 64,
  maxL: 96
};

const colors: Tolerance = {
  r: 16,
  g: 16,
  b: 16,
  a: 16,
  minL: 16,
  maxL: 240
};

const less: Tolerance = {
  r: 16,
  g: 16,
  b: 16,
  a: 255,
  minL: 16,
  maxL: 240
};

const nothing: Tolerance = {
  r: 0,
  g: 0,
  b: 0,
  a: 0,
  minL: 0,
  maxL: 255
};

const default_: Tolerance = {
  r: 16,
  g: 16,
  b: 16,
  a: 16,
  minL: 16,
  maxL: 240
};

const newTolerance = (ignoreType: IgnoreType): Tolerance => {
  return ignoreType === 'alpha'
    ? alpha
    : ignoreType === 'antialiasing'
      ? antialiasing
      : ignoreType === 'colors'
        ? colors
        : ignoreType === 'less'
          ? less
          : ignoreType === 'nothing'
            ? nothing
            : default_;
};

export { newTolerance };
