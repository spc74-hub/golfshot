import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');

// Read the SVG file
const svgBuffer = readFileSync(join(publicDir, 'icon.svg'));

// Icon sizes to generate
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
];

// Splash screen sizes (width x height)
const splashSizes = [
  { name: 'apple-splash-640-1136.png', width: 640, height: 1136 },
  { name: 'apple-splash-750-1334.png', width: 750, height: 1334 },
  { name: 'apple-splash-828-1792.png', width: 828, height: 1792 },
  { name: 'apple-splash-1125-2436.png', width: 1125, height: 2436 },
  { name: 'apple-splash-1170-2532.png', width: 1170, height: 2532 },
  { name: 'apple-splash-1179-2556.png', width: 1179, height: 2556 },
  { name: 'apple-splash-1242-2208.png', width: 1242, height: 2208 },
  { name: 'apple-splash-1242-2688.png', width: 1242, height: 2688 },
  { name: 'apple-splash-1290-2796.png', width: 1290, height: 2796 },
  { name: 'apple-splash-1536-2048.png', width: 1536, height: 2048 },
  { name: 'apple-splash-1668-2388.png', width: 1668, height: 2388 },
  { name: 'apple-splash-2048-2732.png', width: 2048, height: 2732 },
];

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, name));
    console.log(`  Created ${name}`);
  }

  console.log('Generating splash screens...');

  for (const { name, width, height } of splashSizes) {
    // Calculate icon size (40% of the smaller dimension)
    const iconSize = Math.round(Math.min(width, height) * 0.4);

    // Create a splash screen with the icon centered on a green gradient background
    const splashSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#22c55e"/>
            <stop offset="100%" style="stop-color:#16a34a"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bg)"/>
      </svg>
    `;

    // Resize the icon
    const iconBuffer = await sharp(svgBuffer)
      .resize(iconSize, iconSize)
      .png()
      .toBuffer();

    // Create splash with centered icon
    await sharp(Buffer.from(splashSvg))
      .composite([{
        input: iconBuffer,
        top: Math.round((height - iconSize) / 2),
        left: Math.round((width - iconSize) / 2),
      }])
      .png()
      .toFile(join(publicDir, name));

    console.log(`  Created ${name}`);
  }

  console.log('Done!');
}

generateIcons().catch(console.error);
