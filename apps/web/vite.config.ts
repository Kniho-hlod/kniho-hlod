import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import ui from '@nuxt/ui/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { uiTheme } from './ui.config';

/** Indigo 600, the primary colour; keep in step with `index.html` and `scripts/generate-icons.mjs`. */
const THEME_COLOR = '#4f46e5';
/** The paper behind the app (`--app-paper` in `src/assets/main.css`), shown while it starts. */
const BACKGROUND_COLOR = '#fff7ec';

export default defineConfig({
  plugins: [
    vue(),
    ui({
      ui: uiTheme,
      // Bundle every icon the sources name instead of fetching it from the Iconify API at
      // runtime: no third-party requests, no icons popping in late, and icons work offline.
      icon: {
        clientBundle: { scan: { globInclude: ['src/**/*.{vue,ts}'] } },
      },
    }),
    VitePWA({
      registerType: 'prompt',
      // The API is never cached: reads must reflect what the server has.
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      // The icons come from `pnpm icons` (scripts/generate-icons.mjs).
      manifest: {
        id: '/',
        name: 'Kniho-hlod',
        short_name: 'Kniho-hlod',
        description: 'Vaše knihovna a přehled o tom, komu jste co půjčili.',
        lang: 'cs',
        start_url: '/',
        display: 'standalone',
        background_color: BACKGROUND_COLOR,
        theme_color: THEME_COLOR,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
  },
});
