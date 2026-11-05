import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site from /pdf-merger/. `npm run dev` keeps serving from /.
  base: command === 'serve' && !isPreview ? '/' : '/pdf-merger/',
  plugins: [
    react(),
    // Caches the app in the browser so the hosted site works offline after the first visit
    // and can be installed. Only active in builds, never in `npm run dev`.
    VitePWA({
      registerType: 'autoUpdate', // a new deploy is picked up on the next visit; never reloads mid-session
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'PDF Merger',
        short_name: 'PDF Merger',
        description: 'Combine PDFs and JPG scans into one PDF, entirely in your browser.',
        theme_color: '#1677ff',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // The app bundle is ~1.3 MB. Workbox's default 2 MiB cap fails the build if a file outgrows it.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
}))
