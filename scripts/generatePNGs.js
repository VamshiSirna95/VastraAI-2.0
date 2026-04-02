// scripts/generatePNGs.js
// Converts the SVG templates to required PNG sizes using sharp
// Run: node scripts/generatePNGs.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

async function main() {
  const iconSVG = fs.readFileSync(path.join(assetsDir, 'icon.svg'));
  const splashSVG = fs.readFileSync(path.join(assetsDir, 'splash.svg'));

  // icon.png — 1024x1024
  await sharp(iconSVG)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('✓ icon.png (1024x1024)');

  // adaptive-icon.png — 1024x1024 (same as icon, no rounded corners for adaptive)
  await sharp(iconSVG)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png (1024x1024)');

  // splash.png — 1284x2778
  await sharp(splashSVG)
    .resize(1284, 2778)
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  console.log('✓ splash.png (1284x2778)');

  console.log('\nAll PNG assets generated in /assets/');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
