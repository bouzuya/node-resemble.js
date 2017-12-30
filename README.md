# @bouzuya/resemble

Analyse and compare images with Javascript. This project does not need canvas or any other binary dependencies.
It is a modification of [Resemble.js](https://github.com/Huddle/Resemble.js)

## Installation

`npm install @bouzuya/resemble`

## Example

Retrieve basic analysis on image.

```javascript
import { loadImage, parseImage } from '@bouzuya/resemble';

const filePath = /* ... */;
loadImage(filePath)
  .then((image) => {
    const data = parseImage(image);
    console.log(data);
    /*
    {
      red: 255,
      green: 255,
      blue: 255,
      brightness: 255
    }
    */
  });
```

Use resemble to compare two images.

```javascript
import { loadImage, comareImages } from '@bouzuya/resemble';

const filePath1 = /* ... */;
const filePath2 = /* ... */;
Promise.all([loadImage(filePath1), loadImage(filePath2)])
  .then(([image1, image2]) => {
    const data = comareImages(image1, image2, { ignoreColors: true });
    console.log(data);
    /*
    {
      misMatchPercentage : 100, // %
      isSameDimensions: true, // or false
      dimensionDifference: { width: 0, height: -1 }, // defined if dimensions are not the same
      getImageDataUrl: function(){}
    }
    */
  });
```

## LICENSE

MIT

- Resemble.js - James Cryer / Huddle 2014
  https://github.com/Huddle/Resemble.js
- node-resemble.js - Lukas Svoboda
  http://github.com/lksv/node-resemble-js
- @bouzuya/resemble - bouzuya <m@bouzuya.net> (http://bouzuya.net)
  http://github.com/bouzuya/node-resemble-js
