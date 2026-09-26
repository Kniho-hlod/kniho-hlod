/**
 * Draws the app's icons into `public/`: the favicon, the PWA manifest icons and the iOS home screen
 * icon. They all show the bookworm from `src/assets/bookworm.svg` — alone in the favicon, on the
 * app's paper in the others. Chromium from Playwright rasterises the SVG, so no image library is
 * needed.
 *
 *     pnpm --filter @kniho-hlod/web icons
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** The app's paper; keep in step with `BACKGROUND_COLOR` in `vite.config.ts`. */
const TILE_COLOR = '#fff7ec';
const MARK_FILE = fileURLToPath(new URL('../src/assets/bookworm.svg', import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

/**
 * `cornerRadius` and `markScale` are fractions of the icon's size. Maskable and Apple icons are
 * full squares that the platform crops; a maskable mark must fit the central safe circle (80 %).
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, cornerRadius: 0.22, markScale: 0.8 },
  { file: 'icon-512.png', size: 512, cornerRadius: 0.22, markScale: 0.8 },
  { file: 'icon-maskable-512.png', size: 512, cornerRadius: 0, markScale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, cornerRadius: 0, markScale: 0.72 },
];
const FAVICON = { file: 'favicon.svg', size: 64, markScale: 1 };

async function readMark() {
  const source = await readFile(MARK_FILE, 'utf8');
  const [, viewBox, body] = source.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/) ?? [];
  if (!body) throw new Error(`${MARK_FILE} has no <svg> with a viewBox`);
  return { viewBox, body: body.trim() };
}

function drawMark({ viewBox, body }, { size, markScale }) {
  const markSize = size * markScale;
  const offset = (size - markSize) / 2;
  return `<svg x="${offset}" y="${offset}" width="${markSize}" height="${markSize}" viewBox="${viewBox}">${body}</svg>`;
}

function drawIcon(mark, icon) {
  const { size, cornerRadius } = icon;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${size * cornerRadius}" fill="${TILE_COLOR}"/>`,
    drawMark(mark, icon),
    '</svg>',
  ].join('');
}

function drawFavicon(mark) {
  const { size } = FAVICON;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    drawMark(mark, FAVICON),
    '</svg>',
  ].join('');
}

async function main() {
  const mark = await readMark();
  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(`${PUBLIC_DIR}${FAVICON.file}`, `${drawFavicon(mark)}\n`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const icon of ICONS) {
      await page.setViewportSize({ width: icon.size, height: icon.size });
      await page.setContent(
        `<body style="margin:0;background:transparent">${drawIcon(mark, icon)}</body>`
      );
      await page.screenshot({ path: `${PUBLIC_DIR}${icon.file}`, omitBackground: true });
    }
  } finally {
    await browser.close();
  }
  console.info(`Icons written to ${PUBLIC_DIR}`);
}

await main();
