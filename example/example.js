const {
  compareImages,
  loadImage,
  saveImageAsJPG,
  saveImageAsPNG
} = require('../.tmp/src'); // @bouzuya/resemble
const fs = require('fs');

const options = {
  errorColor: {
    red: 155,
    green: 100,
    blue: 155
  },
  errorType: 'movement',
  transparency: 0.6
};

Promise
  .all([loadImage('People.png'), loadImage('People2.png')])
  .then(([image1, image2]) => {
    const data = compareImages(image1, image2, options);
    console.log(data);
    saveImageAsPNG('diff.png', data.getDiffImage());
  });

// jpeg comparison
Promise
  .all([loadImage('People.jpg'), loadImage('People2.jpg')])
  .then(([image1, image2]) => {
    const data = compareImages(image1, image2, options);
    console.log(data);
    saveImageAsPNG('diffjpg.png', data.getDiffImage());
  });

// jpeg comparison
Promise
  .all([loadImage('People.jpg'), loadImage('People2.jpg')])
  .then(([image1, image2]) => {
    const data = compareImages(image1, image2, options);
    console.log(data);
    saveImageAsJPG('diffjpg.jpg', data.getDiffImage());
  });

const fileData1 = fs.readFileSync('People.png');
const fileData2 = fs.readFileSync('People2.png');
Promise
  .all([loadImage(fileData1), loadImage(fileData2)])
  .then(([image1, image2]) => {
    const data = compareImages(image1, image2, Object.assign({}, options, {
      ignoreRectangles: [[325, 170, 100, 40]]
    }));
    console.log('with ignore rectangle:', data);
    saveImageAsPNG('diffr.png', data.getDiffImage());
  });
