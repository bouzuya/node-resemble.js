import * as fs from 'fs';
import jpeg = require('jpeg-js');
import png = require('pngjs');

const { PNG } = png;

interface ResembleOptions {
  errorColor?: Partial<Color>;
  errorType?: 'flat' | 'movement';
  largeImageThreshold?: number;
  transparency?: number;
}

interface Pixel {
  r: Byte;
  g: Byte;
  b: Byte;
  a: Byte;
}

interface BrightnessInfo {
  brightness: number;
}

interface HueInfo {
  h: number;
}

type PixelWithBrightnessInfo = Pixel & BrightnessInfo;
type PixelWithBrightnessAndHueInfo = Pixel & BrightnessInfo & HueInfo;

interface ErrorPixelTransformer {
  (p1: Pixel, p2: Pixel): Pixel;
}

interface Image {
  data: Buffer;
  height: number;
  width: number;
  deflateChunkSize?: number; // ?
  deflateLevel?: number; // ?
  deflateStrategy?: number; // ?
}

interface Color {
  red: Byte;
  green: Byte;
  blue: Byte;
  alpha: Byte;
}

type FileData = string | Buffer;
type Byte = number;
interface CompleteData {
  red: number;
  green: number;
  blue: number;
  brightness: number;
  rawMisMatchPercentage: number;
  misMatchPercentage: string;
  analysisTime: number;
  getDiffImage: (_text: any) => png.PNG;// imgd
  getDiffImageAsJPEG: (quality?: number) => Buffer;
  isSameDimensions: boolean;
  dimensionDifference: {
    width: number;
    height: number;
  };
};
type CompleteCallback = (data: CompleteData) => void;
type Rectangle = [number, number, number, number]; // (x, y, width, height)

interface CompareApi {
  ignoreAntialiasing: () => CompareApi;
  ignoreColors: () => CompareApi;
  ignoreNothing: () => CompareApi;
  ignoreRectangles: (rectangles: Rectangle[]) => CompareApi;
  onComplete: (callback: CompleteCallback) => CompareApi;
  repaint: () => CompareApi;
}

interface Resemble {
  (fileData: FileData): {
    compareTo: (secondFileData: FileData) => CompareApi;
    onComplete: (callback: CompleteCallback) => void;
  };
  outputSettings: (options: ResembleOptions) => Resemble;
}

var _this: { resemble: Resemble; } = {} as any;

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

var errorPixelTransformer: ErrorPixelTransformer = errorPixelTransform.flat;
var largeImageThreshold = 1200;

_this['resemble'] = function (fileData: FileData): {
  compareTo: (secondFileData: FileData) => CompareApi;
  onComplete: (callback: CompleteCallback) => void;
} {

  var data: Partial<CompleteData> = {};
  var images: Image[] = [];
  var updateCallbackArray: CompleteCallback[] = [];

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

  function triggerDataUpdate() {
    var len = updateCallbackArray.length;
    var i;
    for (i = 0; i < len; i++) {
      if (typeof updateCallbackArray[i] === 'function') {
        updateCallbackArray[i](data);
      }
    }
  }

  function loop(height: number, width: number, callback: (y: number, x: number) => void): void {
    var y, x;
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        callback(y, x);
      }
    }
  }

  function parseImage(sourceImageData: Buffer, width: number, height: number): void {

    var pixleCount = 0;
    var redTotal = 0;
    var greenTotal = 0;
    var blueTotal = 0;
    var brightnessTotal = 0;

    loop(height, width, function (y, x) {
      var offset = (y * width + x) * 4;
      var red = sourceImageData[offset];
      var green = sourceImageData[offset + 1];
      var blue = sourceImageData[offset + 2];
      var brightness = getBrightness(red, green, blue);

      pixleCount++;

      redTotal += red / 255 * 100;
      greenTotal += green / 255 * 100;
      blueTotal += blue / 255 * 100;
      brightnessTotal += brightness / 255 * 100;
    });

    data.red = Math.floor(redTotal / pixleCount);
    data.green = Math.floor(greenTotal / pixleCount);
    data.blue = Math.floor(blueTotal / pixleCount);
    data.brightness = Math.floor(brightnessTotal / pixleCount);

    triggerDataUpdate();
  }

  function loadImageData(fileData: string | Buffer, callback: (data: Image, width: number, height: number) => void) {

    if (Buffer.isBuffer(fileData)) {
      var png = new PNG();
      png.parse(fileData, function (_err, data) {
        callback(data, data.width, data.height);
      });
    } else {
      var ext = fileData.substring(fileData.lastIndexOf(".") + 1);
      if (ext == "png") {
        var png = new PNG();
        fs.createReadStream(fileData)
          .pipe(png)
          .on('parsed', function (this: png.PNG) {
            callback(this, this.width, this.height);
          });
      }
      if (ext == "jpg" || ext == "jpeg") {
        var jpegData = fs.readFileSync(fileData);
        var fileData_ = jpeg.decode(jpegData, true) as jpeg.RawImageData<Buffer>;
        callback(fileData_, fileData_.width, fileData_.height);
      }
    };
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

  function getBrightness(r: Byte, g: Byte, b: Byte): number {
    return 0.3 * r + 0.59 * g + 0.11 * b;
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

  function getHue(r: Byte, g: Byte, b: Byte): number { // Pixel['h']

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

  function isAntialiased(sourcePix: PixelWithBrightnessInfo, data: Buffer, cacheSet: 1 | 2, y: number, x: number, width: number): boolean {
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
          targetPix = getPixelInfo(data, offset, cacheSet);

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
    var data = errorPixelTransformer(p1, p2);
    px[offset] = data.r;
    px[offset + 1] = data.g;
    px[offset + 2] = data.b;
    px[offset + 3] = data.a;
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

  function getPixelInfo(data: Buffer, offset: number, _cacheSet: 1 | 2): Pixel | null {
    var r;
    var g;
    var b;
    var d;
    var a;

    r = data[offset];

    if (typeof r !== 'undefined') {
      g = data[offset + 1];
      b = data[offset + 2];
      a = data[offset + 3];
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

  function analyseImages(img1: Image, img2: Image, width: number, height: number): void {

    var data1 = img1.data;
    var data2 = img2.data;

    //TODO
    var imgd = new PNG({
      width: img1.width,
      height: img1.height,
      deflateChunkSize: img1.deflateChunkSize,
      deflateLevel: img1.deflateLevel,
      deflateStrategy: img1.deflateStrategy,
    });
    var targetPix = imgd.data;

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

      var pixel1 = getPixelInfo(data1, offset, 1);
      var pixel2 = getPixelInfo(data2, offset, 2);

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
        isAntialiased(pixel1 as PixelWithBrightnessInfo, data1, 1, y, x, width) ||
        isAntialiased(pixel2 as PixelWithBrightnessInfo, data2, 2, y, x, width)
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

    data.rawMisMatchPercentage = (mismatchCount / (height * width) * 100);
    data.misMatchPercentage = data.rawMisMatchPercentage.toFixed(2);
    data.analysisTime = Date.now() - time;

    data.getDiffImage = function (_text) {
      return imgd;
    };

    data.getDiffImageAsJPEG = function (quality) {
      return jpeg.encode({
        data: targetPix,
        width: img1.width,
        height: img1.height
      }, quality !== undefined ? quality : 50).data;
    };
  }

  function compare(one: FileData, two: FileData): void {

    function onceWeHaveBoth(img: Image) {
      var width;
      var height;

      images.push(img);
      if (images.length === 2) {
        width = images[0].width > images[1].width ? images[0].width : images[1].width;
        height = images[0].height > images[1].height ? images[0].height : images[1].height;

        if ((images[0].width === images[1].width) && (images[0].height === images[1].height)) {
          data.isSameDimensions = true;
        } else {
          data.isSameDimensions = false;
        }

        data.dimensionDifference = { width: images[0].width - images[1].width, height: images[0].height - images[1].height };

        //lksv: normalization removed
        analyseImages(images[0], images[1], width, height);

        triggerDataUpdate();
      }
    }

    images = [];
    loadImageData(one, onceWeHaveBoth);
    loadImageData(two, onceWeHaveBoth);
  }

  function getCompareApi(param: Function | FileData): CompareApi {

    var secondFileData: FileData,
      hasMethod = typeof param === 'function';

    if (!hasMethod) {
      // assume it's file data
      secondFileData = param as FileData;
    }

    var self: CompareApi = {
      ignoreNothing: function () {

        tolerance.red = 16;
        tolerance.green = 16;
        tolerance.blue = 16;
        tolerance.alpha = 16;
        tolerance.minBrightness = 16;
        tolerance.maxBrightness = 240;

        ignoreAntialiasing = false;
        ignoreColors = false;

        if (hasMethod) { (param as Function)(); }
        return self;
      },
      ignoreAntialiasing: function () {

        tolerance.red = 32;
        tolerance.green = 32;
        tolerance.blue = 32;
        tolerance.alpha = 32;
        tolerance.minBrightness = 64;
        tolerance.maxBrightness = 96;

        ignoreAntialiasing = true;
        ignoreColors = false;

        if (hasMethod) { (param as Function)(); }
        return self;
      },
      ignoreColors: function () {

        tolerance.alpha = 16;
        tolerance.minBrightness = 16;
        tolerance.maxBrightness = 240;

        ignoreAntialiasing = false;
        ignoreColors = true;

        if (hasMethod) { (param as Function)(); }
        return self;
      },
      //array of rectangles, each rectangle is defined as (x, y, width. height)
      //e.g. [[325, 170, 100, 40]]
      ignoreRectangles: function (rectangles) {
        ignoreRectangles = rectangles;
        return self;
      },
      repaint: function () {
        if (hasMethod) { (param as Function)(); }
        return self;
      },
      onComplete: function (callback) {

        updateCallbackArray.push(callback);

        var wrapper = function () {
          compare(fileData, secondFileData);
        };

        wrapper();

        return getCompareApi(wrapper);
      }
    };

    return self;
  }

  return {
    onComplete: function (callback) {
      updateCallbackArray.push(callback);
      loadImageData(fileData, function (imageData, width, height) {
        parseImage(imageData.data, width, height);
      });
    },
    compareTo: function (secondFileData) {
      return getCompareApi(secondFileData);
    }
  };

};

_this['resemble'].outputSettings = function (options: ResembleOptions): Resemble {
  var key: keyof Color;
  var undefined;

  if (options.errorColor) {
    for (key in options.errorColor) {
      errorPixelColor[key] = options.errorColor[key] === undefined ? errorPixelColor[key] : options.errorColor[key];
    }
  }

  if (options.errorType && errorPixelTransform[options.errorType]) {
    errorPixelTransformer = errorPixelTransform[options.errorType];
  }

  pixelTransparency = options.transparency || pixelTransparency;

  if (options.largeImageThreshold !== undefined) {
    largeImageThreshold = options.largeImageThreshold;
  }

  return this;
};

module.exports = _this['resemble']
