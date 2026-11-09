import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { seoPlugin } from './build/seo'
import { pwaShortcuts } from './src/lib/pwaShortcuts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('xlsx')) return 'vendor-xlsx'
          if (id.includes('pdfjs-dist')) return 'vendor-pdf'
          if (id.includes('papaparse')) return 'vendor-csv'
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (/node_modules\/(?:react|react-dom|react-is|scheduler)\//.test(id.replaceAll('\\', '/'))) return 'vendor-react'
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
          '**/assets/BackupModal-*.js',
          '**/assets/vendor-charts-*.js',
          '**/assets/MonthlyDashboard-*.js',
          '**/assets/CalendarDatePicker-*.js',
        ],
        clientsClaim: true,
        skipWaiting: true,
        // 폰트 등 외부 리소스는 네트워크 우선, 나머지는 캐시 우선
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/.*\.(?:js|css)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'deferred-assets', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-fonts',
              expiration: {
                // 가변 폰트 dynamic subset은 CSS 1개 + 글자 범위별 woff2 최대 92개로 나뉜다
                maxEntries: 100,
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
