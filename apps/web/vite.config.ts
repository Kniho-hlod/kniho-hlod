import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import ui from '@nuxt/ui/vite';
import { VitePWA } from 'vite-plugin-pwa';

const THEME_COLOR = '#0f766e';

export default defineConfig({
  plugins: [
    vue(),
    ui(),
    VitePWA({
      registerType: 'prompt',
      // The API is never cached: reads must reflect what the server has.
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      manifest: {
        name: 'Kniho-hlod',
        short_name: 'Kniho-hlod',
        description: 'Vaše knihovna a přehled o tom, komu jste co půjčili.',
        lang: 'cs',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: THEME_COLOR,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
