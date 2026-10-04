// Renders public/favicon.svg into the PNG icons the PWA manifest needs.
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/favicon.svg'));
const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });

for (const size of [192, 512]) {
  await sharp(svg, { density: 600 }).resize(size, size).png().toFile(join(out, `icon-${size}.png`));
}
// Maskable: full-bleed green with the mark inside the 80% safe zone.
const inner = await sharp(svg, { density: 600 }).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#15803D' } })
  .composite([{ input: inner, top: 76, left: 76 }])
  .png()
  .toFile(join(out, 'icon-maskable-512.png'));
console.log('icons written to public/icons');
