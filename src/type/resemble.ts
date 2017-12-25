import { CompareApi } from './compare-api';
import { CompleteCallback } from './complete-callback';

export interface Resemble {
  (file: File): {
    compareTo: (secondFile: File) => CompareApi;
    onComplete: (callback: CompleteCallback) => void;
  };
}
