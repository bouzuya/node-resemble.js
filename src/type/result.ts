import png = require('pngjs');

export interface Result {
  red: number;
  green: number;
  blue: number;
  brightness: number;
  rawMisMatchPercentage: number;
  misMatchPercentage: string;
  analysisTime: number;
  getDiffImage: (_text: any) => png.PNG;
  getDiffImageAsJPEG: (quality?: number) => Buffer;
  isSameDimensions: boolean;
  dimensionDifference: {
    width: number;
    height: number;
  };
}
