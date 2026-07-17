import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// NOTE: No COOP/COEP cross-origin isolation here. The SQLite persistence layer
// uses the OPFS SAHPool VFS (see lib/db/sqlite.ts), which runs on the main
// thread and does NOT need SharedArrayBuffer / cross-origin isolation. Setting
// `Cross-Origin-Embedder-Policy: require-corp` would block the cross-origin map
// tiles and web fonts (breaking the offline-first map) for no benefit.

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      strategies: 'generateSW',
      manifest: {
        name: 'Kuxtal',
        short_name: 'Kuxtal',
        description: 'Offline-first land and plant management',
        theme_color: '#3B2F1E',
        background_color: '#FFF9F0',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'es',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm,json}'],
        importScripts: ['push-handler.js'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.host.endsWith('tile.openstreetmap.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: ({ url }) => url.host.endsWith('tiles.openfreemap.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'es2022',
    sourcemap: true
  }
});
