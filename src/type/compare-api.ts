import { Rectangle } from './rectangle';
import { CompleteCallback } from './complete-callback';

export interface CompareApi {
  ignoreAntialiasing: () => CompareApi;
  ignoreColors: () => CompareApi;
  ignoreNothing: () => CompareApi;
  ignoreRectangles: (rectangles: Rectangle[]) => CompareApi;
  onComplete: (callback: CompleteCallback) => CompareApi;
  repaint: () => CompareApi;
}
