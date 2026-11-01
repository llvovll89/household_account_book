import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { seoPlugin } from './build/seo'
import { pwaShortcuts } from './src/lib/pwaShortcuts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('xlsx')) return 'vendor-xlsx'
          if (id.includes('pdfjs-dist')) return 'vendor-pdf'
          if (id.includes('papaparse')) return 'vendor-csv'
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    seoPlugin({ ...loadEnv(mode, process.cwd(), ''), ...process.env }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '잔고플랜',
        short_name: '잔고플랜',
        description: '심플한 개인 잔고플랜 앱',
        theme_color: '#0D0F14',
        background_color: '#0D0F14',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        shortcuts: pwaShortcuts,
        lang: 'ko',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/(?:about|guide)(?:\/|$)/, /^\/(?:robots\.txt|sitemap\.xml|404\.html)$/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: [
          '**/assets/vendor-xlsx-*.js',
          '**/assets/vendor-pdf-*.js',
          '**/assets/ImportModal-*.js',
          '**/assets/SyncConflictModal-*.js',
          '**/assets/SyncRecoveryGuideModal-*.js',
          '**/assets/MergeLocalDataModal-*.js',
          '**/assets/AutoApplyRecurringModal-*.js',
          '**/assets/HelpModal-*.js',
          '**/assets/CategoryModal-*.js',
          '**/assets/PaymentMethodsModal-*.js',
          '**/assets/ResetAllDataModal-*.js',
        ],
        clientsClaim: true,
        skipWaiting: true,
        // 폰트 등 외부 리소스는 네트워크 우선, 나머지는 캐시 우선
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1년
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
}))
