import png = require('pngjs');

export interface CompareResult {
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
