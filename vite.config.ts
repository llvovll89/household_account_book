import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
  server: {
    proxy: {
      // 개발환경 CORS 우회: /yf-api/* → https://query1.finance.yahoo.com/*
      '/yf-api': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yf-api/, ''),
      },
      '/yf-api2': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yf-api2/, ''),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: [
          '**/assets/vendor-xlsx-*.js',
          '**/assets/vendor-pdf-*.js',
          '**/assets/ImportModal-*.js',
          '**/assets/TransactionModal-*.js',
          '**/assets/StockTradeModal-*.js',
          '**/assets/SyncConflictModal-*.js',
          '**/assets/SyncRecoveryGuideModal-*.js',
          '**/assets/MergeLocalDataModal-*.js',
          '**/assets/AutoApplyRecurringModal-*.js',
          '**/assets/HelpModal-*.js',
          '**/assets/CategoryModal-*.js',
          '**/assets/PaymentMethodsModal-*.js',
          '**/assets/StockDetailModal-*.js',
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
})
