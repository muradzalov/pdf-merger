import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * pdf.js loads these files from node_modules/pdfjs-dist on demand, by file name, from the folder
 * URLs set in src/editor/pdfjs.ts. Nothing imports them, so Vite wouldn't put them in the build;
 * this copies them into dist/pdfjs/. (`npm run dev` serves them straight from node_modules.)
 */
const PDFJS_ASSETS = [
  // Image decoders for JPEG 2000, JBIG2 and CCITT fax, which scanned PDFs often use.
  'wasm/openjpeg.wasm',
  'wasm/jbig2.wasm',
  // Symbol and ZapfDingbats (e.g. form checkbox ticks) for PDFs that don't embed them.
  'standard_fonts/FoxitSymbol.pfb',
  'standard_fonts/FoxitDingbats.pfb',
  // Stand-ins for Helvetica, the usual non-embedded font in forms, on devices without Helvetica
  // or Arial (e.g. Android). Other standard fonts are drawn with the device's own fonts.
  'standard_fonts/LiberationSans-Regular.ttf',
  'standard_fonts/LiberationSans-Bold.ttf',
  'standard_fonts/LiberationSans-Italic.ttf',
  'standard_fonts/LiberationSans-BoldItalic.ttf',
]

function copyPdfjsAssets(): Plugin {
  let root = ''
  return {
    name: 'copy-pdfjs-assets',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    async generateBundle() {
      for (const file of PDFJS_ASSETS) {
        this.emitFile({
          type: 'asset',
          fileName: `pdfjs/${file}`,
          source: await this.fs.readFile(`${root}/node_modules/pdfjs-dist/${file}`),
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site from /pdf-merger/. `npm run dev` keeps serving from /.
  base: command === 'serve' && !isPreview ? '/' : '/pdf-merger/',
  plugins: [
    react(),
    copyPdfjsAssets(),
    // Caches the app in the browser so the hosted site works offline after the first visit
    // and can be installed. Only active in builds, never in `npm run dev`.
    VitePWA({
      // A new deploy waits until the user clicks Reload on the prompt (src/components/UpdatePrompt.tsx)
      // or closes every tab of the app, so a page never loses its files mid-session.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        // "PDF" in the full name keeps the installed app findable by searching for "pdf".
        name: 'Pagewright – PDF merge, fill & sign',
        short_name: 'Pagewright',
        description: 'Merge PDFs, scans and screenshots into one PDF, or fill in and sign a PDF, entirely in your browser.',
        theme_color: '#1677ff',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // mjs: the pdf.js worker. wasm, pfb, ttf: the pdf.js files above.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,wasm,pfb,ttf}'],
        // The largest files are the app bundle and the pdf.js worker, ~1.3 MB each. Workbox's
        // default 2 MiB cap fails the build if a file outgrows it.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
}))
