const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function removeBg() {
  const file = path.join(__dirname, '../public/logo-clean.png');
  const tempFile = path.join(__dirname, '../public/logo-temp.png');

  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = new Uint8ClampedArray(data);

  // Global black removal (no flood-fill) to catch counters inside A, O, P, R, etc.
  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i+1];
    const b = pixels[i+2];

    // If it's pure/near-pure black, make it transparent
    if (r < 20 && g < 20 && b < 20) {
      pixels[i + 3] = 0; // Set alpha to 0
    } else {
      // For remaining visible pixels (anti-aliased edges and text)
      // Boost dark colors slightly to prevent fading
      const maxChannel = Math.max(r, g, b);
      if (maxChannel < 80 && b > r && b > g) {
        const scale = Math.min(3.5, 80 / Math.max(maxChannel, 1));
        pixels[i]     = Math.min(255, Math.round(r * scale));
        pixels[i + 1] = Math.min(255, Math.round(g * scale));
        pixels[i + 2] = Math.min(255, Math.round(b * scale));
      }
      
      // Ensure full opacity for colored pixels
      pixels[i + 3] = 255;
    }
  }

  await sharp(Buffer.from(pixels.buffer), {
    raw: { width, height, channels }
  })
  .png()
  .toFile(tempFile);

  fs.renameSync(tempFile, file);

  console.log('✅ Done! Removed ALL black backgrounds, including inside A and O.');
}

removeBg().catch(console.error);
