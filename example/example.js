const { compareImages, loadImage } = require('../.tmp/src'); // @bouzuya/resemble
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
    data.getDiffImage().pack().pipe(fs.createWriteStream('diff.png'));
  });

// jpeg comparison
Promise
  .all([loadImage('People.jpg'), loadImage('People2.jpg')])
  .then(([image1, image2]) => {
    const data = compareImages(image1, image2, options);
    console.log(data);
    data.getDiffImage().pack().pipe(fs.createWriteStream('diffjpg.png'));
  });

// jpeg comparison
Promise
  .all([loadImage('People.jpg'), loadImage('People2.jpg')])
  .then(([image1, image2]) => {
    const data = compareImages(image1, image2, options);
    console.log(data);
    fs.writeFileSync('diffjpg.jpg', data.getDiffImageAsJPEG());
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
    data.getDiffImage().pack().pipe(fs.createWriteStream('diffr.png'));
  });
