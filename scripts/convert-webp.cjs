const sharp = require('sharp');
const path = require('path');

const files = [
  {
    input: path.join(__dirname, '../public/stores/kunal-wine.png'),
    output: path.join(__dirname, '../public/stores/kunal-wine.webp'),
  },
  {
    input: path.join(__dirname, '../public/stores/vishal-wine.png'),
    output: path.join(__dirname, '../public/stores/vishal-wine.webp'),
  },
];

(async () => {
  for (const file of files) {
    await sharp(file.input)
      .webp({ quality: 85 })
      .toFile(file.output);
    console.log(`Converted: ${file.output}`);
  }
  console.log('Done!');
})();
