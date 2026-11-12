import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // регистрируем сами, когда модель уже показана (src/main.tsx)
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Атлас систем',
        short_name: 'Атлас',
        description: 'Демо главного экрана: 3D-модель и риск по 13 системам организма.',
        lang: 'ru',
        dir: 'ltr',
        display: 'standalone',
        background_color: '#E7EEF2',
        theme_color: '#FFFFFF',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,glb,woff2,ico,webp}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
