import * as assert from 'assert';
import { Test, run, test } from 'beater';
import png = require('pngjs');
import { compareImages, loadImage } from '../src';
import { Image } from '../src/type/image';

var EXAMPLE_LARGE_IMAGE = 'example/LargeImage.png';
var EXAMPLE_SMALL_IMAGE = 'example/SmallImage.png';
var EXAMPLE_PEOPLE_IMAGES = [
  'example/People.png',
  'example/People2.png'
];
var OPTIMISATION_SKIP_STEP = 6;

function expectPixelsToBeSkipped(image: png.PNG, step: number) {
  assert(getPixelForLocation(image, 1, step - 1).alpha !== 0);
  assert(getPixelForLocation(image, 1, step).alpha === 0);
  assert(getPixelForLocation(image, 1, step + 1).alpha !== 0);

  assert(getPixelForLocation(image, step - 1, 1).alpha !== 0);
  assert(getPixelForLocation(image, step, 1).alpha === 0);
  assert(getPixelForLocation(image, step + 1, 1).alpha !== 0);

  assert(getPixelForLocation(image, step, step).alpha === 0);
}

function expectPixelsNotToBeSkipped(image: png.PNG, step: number) {
  assert(getPixelForLocation(image, 1, step).alpha !== 0);
  assert(getPixelForLocation(image, step, 1).alpha !== 0);
  assert(getPixelForLocation(image, step, step).alpha !== 0);
}

function getLargeImageComparison() {
  return Promise.all([
    loadImage(EXAMPLE_LARGE_IMAGE),
    loadImage(EXAMPLE_LARGE_IMAGE)
  ]);
}

function getPixelForLocation(image: Image, x: number, y: number) {
  var index = (image.width * y + x) << 2;
  return {
    red: image.data[index],
    green: image.data[index + 1],
    blue: image.data[index + 2],
    alpha: image.data[index + 3]
  };
}

function getSmallImageComparison() {
  return Promise.all([
    loadImage(EXAMPLE_SMALL_IMAGE),
    loadImage(EXAMPLE_SMALL_IMAGE)
  ]);
}

const category = 'node-resemble.js';

const categoryLargeImageThreashold = [category, 'largeImageThreshold'];

const testsLargeImageThreashold: Test[] = [
  test(categoryLargeImageThreashold.concat([
    'when unset',
    'when ignoreAntialiasing is enabled',
    'skips pixels when a dimension is larger than the default threshold (1200)'
  ]).join('/'), () => {
    return getLargeImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        ignoreAntialiasing: true
      });
      expectPixelsToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when unset',
    'when ignoreAntialiasing is enabled',
    'does not skip pixels when both dimensions are smaller than the default threshold (1200)'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        ignoreAntialiasing: true
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when unset',
    'when ignoreAntialiasing is disabled',
    'does not skip pixels when a dimension is larger than the default threshold (1200)'
  ]).join('/'), () => {
    return getLargeImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2);
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when unset',
    'when ignoreAntialiasing is disabled',
    'does not skip pixels when both dimensions are smaller than the default threshold (1200)'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2);
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),

  // when explicitly set
  test(categoryLargeImageThreashold.concat([
    'when explicitly set',
    'when ignoreAntialiasing is enabled',
    'skips pixels on images with a dimension larger than the given threshold'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        ignoreAntialiasing: true,
        largeImageThreshold: 999
      });
      expectPixelsToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when explicitly set',
    'when ignoreAntialiasing is enabled',
    'does not skip pixels on images with a dimension equal to the given threshold'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        ignoreAntialiasing: true,
        largeImageThreshold: 1000
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when explicitly set',
    'when ignoreAntialiasing is enabled',
    'does not skip pixels on images with both dimensions smaller than the given threshold'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        ignoreAntialiasing: true,
        largeImageThreshold: 1001
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when explicitly set',
    'when ignoreAntialiasing is disabled',
    'does not skip pixels on images with a dimension larger than the given threshold'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        largeImageThreshold: 999
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when explicitly set',
    'when ignoreAntialiasing is disabled',
    'does not skip pixels on images with a dimension equal to the given threshold'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        largeImageThreshold: 1000
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when explicitly set',
    'when ignoreAntialiasing is disabled',
    'does not skip pixels on images with both dimensions smaller than the given threshold'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        largeImageThreshold: 1001
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),

  test(categoryLargeImageThreashold.concat([
    'when set to a falsy value',
    'when ignoreAntialiasing is enabled',
    'does not skip pixels on images with a dimension larger than the default threshold (1200)'
  ]).join('/'), () => {
    return getLargeImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        ignoreAntialiasing: true,
        largeImageThreshold: 0
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when set to a falsy value',
    'when ignoreAntialiasing is enabled',
    'does not skip pixels on images with a dimension smaller than the default threshold (1200)'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        ignoreAntialiasing: true,
        largeImageThreshold: 0
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),

  test(categoryLargeImageThreashold.concat([
    'when set to a falsy value',
    'when ignoreAntialiasing is disabled',
    'does not skip pixels on images with a dimension larger than the default threshold (1200)'
  ]).join('/'), () => {
    return getLargeImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        largeImageThreshold: 0
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  }),
  test(categoryLargeImageThreashold.concat([
    'when set to a falsy value',
    'when ignoreAntialiasing is disabled',
    'does not skip pixels on images with a dimension smaller than the default threshold (1200)'
  ]).join('/'), () => {
    return getSmallImageComparison().then(([image1, image2]) => {
      const data = compareImages(image1, image2, {
        largeImageThreshold: 0
      });
      expectPixelsNotToBeSkipped(data.getDiffImage(), OPTIMISATION_SKIP_STEP);
    });
  })
];

const testsRawMisMatchPercentage: Test[] = [
  test([
    category,
    'rawMisMatchPercentage',
    'rawMisMatchPercentage contains raw result'
  ].join('/'), () => {
    return Promise.all([
      loadImage(EXAMPLE_PEOPLE_IMAGES[0]),
      loadImage(EXAMPLE_PEOPLE_IMAGES[1])
    ]).then(([image1, image2]) => {
      const data = compareImages(image1, image2);
      assert(data.rawMisMatchPercentage === 8.6612);
    })
  })
];

const tests: Test[] = ([] as Test[])
  .concat(testsLargeImageThreashold)
  .concat(testsRawMisMatchPercentage);

run(tests).catch(() => process.exit(1));
