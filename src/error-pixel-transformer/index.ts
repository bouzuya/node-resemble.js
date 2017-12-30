import { ErrorPixelTransformer } from '../type/error-pixel-transformer';
import { ErrorPixelTransformerType } from '../type/error-pixel-transformer-type';
import { Pixel } from '../type/pixel';
import { newTransformer as diffOnly } from './diff-only';
import { newTransformer as flat } from './flat';
import { newTransformer as flatDifferenceIntensity } from './flat-difference-intensity';
import { newTransformer as movement } from './movement';
import { newTransformer as movementDifferenceIntensity } from './movement-difference-intensity';

const newTransformer = (
  base: Pixel,
  type: ErrorPixelTransformerType
): ErrorPixelTransformer => {
  switch (type) {
    case 'diffOnly':
      return diffOnly(base);
    case 'flat':
      return flat(base);
    case 'flatDifferenceIntensity':
      return flatDifferenceIntensity(base);
    case 'movement':
      return movement(base);
    case 'movementDifferenceIntensity':
      return movementDifferenceIntensity(base);
    default:
      throw new Error('unknown ErrorPixelTransformerType');
  }
};

export { newTransformer };
