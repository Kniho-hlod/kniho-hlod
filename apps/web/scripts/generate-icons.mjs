/**
 * Draws the app's icons into `public/`: the favicon, the PWA manifest icons and the iOS home screen
 * icon. They show the header's `library-big` glyph from Lucide in white on the theme colour.
 * Chromium from Playwright rasterises the SVG, so no image library is needed.
 *
 *     pnpm --filter @kniho-hlod/web icons
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** Keep in step with `THEME_COLOR` in `vite.config.ts`. */
const THEME_COLOR = '#4f46e5';
const GLYPH_COLOR = '#ffffff';
const GLYPH_NAME = 'library-big';
const LUCIDE_VIEWBOX_SIZE = 24;
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

/**
 * `cornerRadius` and `glyphScale` are fractions of the icon's size. Maskable and Apple icons are
 * full squares that the platform crops; a maskable glyph must fit the central safe circle (80 %).
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, cornerRadius: 0.22, glyphScale: 0.62 },
  { file: 'icon-512.png', size: 512, cornerRadius: 0.22, glyphScale: 0.62 },
  { file: 'icon-maskable-512.png', size: 512, cornerRadius: 0, glyphScale: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, cornerRadius: 0, glyphScale: 0.6 },
];
const FAVICON = { file: 'favicon.svg', size: 64, cornerRadius: 0.22, glyphScale: 0.7 };

async function readGlyph() {
  const require = createRequire(import.meta.url);
  const iconSet = JSON.parse(await readFile(require.resolve('@iconify-json/lucide/icons.json')));
  return iconSet.icons[GLYPH_NAME].body;
}

function drawIcon(glyph, { size, cornerRadius, glyphScale }) {
  const glyphSize = size * glyphScale;
  const offset = (size - glyphSize) / 2;
  const scale = glyphSize / LUCIDE_VIEWBOX_SIZE;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${size * cornerRadius}" fill="${THEME_COLOR}"/>`,
    `<g color="${GLYPH_COLOR}" transform="translate(${offset} ${offset}) scale(${scale})">${glyph}</g>`,
    '</svg>',
  ].join('');
}

async function main() {
  const glyph = await readGlyph();
  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(`${PUBLIC_DIR}${FAVICON.file}`, `${drawIcon(glyph, FAVICON)}\n`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const icon of ICONS) {
      await page.setViewportSize({ width: icon.size, height: icon.size });
      await page.setContent(
        `<body style="margin:0;background:transparent">${drawIcon(glyph, icon)}</body>`
      );
      await page.screenshot({ path: `${PUBLIC_DIR}${icon.file}`, omitBackground: true });
    }
  } finally {
    await browser.close();
  }
  console.info(`Icons written to ${PUBLIC_DIR}`);
}

await main();
