import { Image } from './image';

export interface CompareImagesResult {
  rawMisMatchPercentage: number;
  misMatchPercentage: string;
  analysisTime: number;
  getDiffImage: () => Image;
  isSameDimensions: boolean;
  dimensionDifference: {
    width: number;
    height: number;
  };
}
