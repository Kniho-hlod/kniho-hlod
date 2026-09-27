/**
 * Draws the picture a link to Kniho-hlod shows when shared on Facebook, in a chat or anywhere
 * else that reads Open Graph (`og:image` in `index.html`): the splash screen's bookworm with the
 * app's logo and question on a card, in the app's display font. Chromium from Playwright renders
 * it, as it does the icons.
 *
 *     pnpm --filter @kniho-hlod/web share-image
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** Facebook's recommended size for a link preview (1.91 : 1). */
const WIDTH = 1200;
const HEIGHT = 630;
/** A painted scene: JPEG keeps it small, and the PWA does not precache JPEGs. */
const JPEG_QUALITY = 85;
const OUTPUT_FILE = fileURLToPath(new URL('../public/og-image.jpg', import.meta.url));

const SPLASH_FILE = fileURLToPath(new URL('../src/assets/splash.webp', import.meta.url));
const MARK_FILE = fileURLToPath(new URL('../src/assets/bookworm.svg', import.meta.url));
const DISPLAY_FONT_CSS = createRequire(import.meta.url).resolve(
  '@fontsource-variable/bricolage-grotesque/index.css'
);

/** The app's colours in its light theme: `main.css` and `BACKGROUND_COLOR` in `vite.config.ts`. */
const LINE_COLOR = 'oklch(22.5% 0.058 285)';
const CARD_COLOR = '#ffffff';
const TILE_COLOR = '#ffffff';

/** Words on the card, from `cs.json` (`app.name`, `app.heroTitle`): links are shared in Czech. */
const APP_NAME = 'Kniho-hlod';
const QUESTION = 'Víte, kdo má vaši knihu?';

async function dataUrl(file, mimeType) {
  return `data:${mimeType};base64,${(await readFile(file)).toString('base64')}`;
}

/** Fontsource's stylesheet with its font files inlined, since the page has no address to load from. */
async function inlineFontCss() {
  const css = await readFile(DISPLAY_FONT_CSS, 'utf8');
  const fontDir = dirname(DISPLAY_FONT_CSS);
  const fontFiles = [...new Set(css.match(/\.\/files\/[^)]+\.woff2/g))];
  let inlined = css;
  for (const fontFile of fontFiles) {
    inlined = inlined.replaceAll(fontFile, await dataUrl(`${fontDir}/${fontFile}`, 'font/woff2'));
  }
  return inlined;
}

async function drawPage() {
  const [fontCss, splash, mark] = await Promise.all([
    inlineFontCss(),
    dataUrl(SPLASH_FILE, 'image/webp'),
    dataUrl(MARK_FILE, 'image/svg+xml'),
  ]);
  return `<!doctype html>
<style>
  ${fontCss}
  body {
    margin: 0;
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    background: url(${splash}) center 42% / cover;
    font-family: 'Bricolage Grotesque Variable', sans-serif;
    color: ${LINE_COLOR};
  }
  .card {
    position: absolute;
    left: 48px;
    bottom: 64px;
    width: 330px;
    padding: 28px 32px 32px;
    border-radius: 18px;
    background: ${CARD_COLOR};
    box-shadow: 0 0 0 3px ${LINE_COLOR}, 8px 8px 0 3px ${LINE_COLOR};
  }
  .logo { display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 800; }
  .tile {
    display: grid;
    place-items: center;
    width: 60px;
    height: 60px;
    border-radius: 14px;
    background: ${TILE_COLOR};
    box-shadow: 0 0 0 3px ${LINE_COLOR}, 4px 4px 0 3px ${LINE_COLOR};
    transform: rotate(-6deg);
  }
  .tile img { width: 52px; height: 52px; }
  h1 { margin: 22px 0 0; font-size: 46px; font-weight: 700; line-height: 1.08; letter-spacing: -0.01em; }
</style>
<div class="card">
  <div class="logo"><span class="tile"><img src="${mark}" alt=""></span>${APP_NAME}</div>
  <h1>${QUESTION}</h1>
</div>`;
}

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    await page.setContent(await drawPage());
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: OUTPUT_FILE, type: 'jpeg', quality: JPEG_QUALITY });
  } finally {
    await browser.close();
  }
  console.info(`Share image written to ${OUTPUT_FILE}`);
}

await main();
