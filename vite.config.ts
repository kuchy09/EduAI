import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function isRealUrl(val?: string): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.startsWith('http') &&
    !trimmed.includes('placeholder') &&
    !trimmed.includes('your-project') &&
    !trimmed.includes('your_') &&
    !trimmed.startsWith('MY_')
  );
}

function isRealKey(val?: string): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 15 &&
    !trimmed.includes('placeholder') &&
    !trimmed.includes('your-key') &&
    !trimmed.includes('your_') &&
    !trimmed.startsWith('MY_')
  );
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const resolvedSupabaseUrl =
    [
      env.VITE_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_URL,
      process.env.VITE_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_URL,
    ].find(isRealUrl) || '';

  const resolvedSupabaseAnonKey =
    [
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      env.VITE_SUPABASE_ANON_KEY,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      env.SUPABASE_PUBLISHABLE_KEY,
      env.SUPABASE_ANON_KEY,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      process.env.VITE_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.SUPABASE_ANON_KEY,
    ].find(isRealKey) || '';

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      ...(resolvedSupabaseUrl
        ? {'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(resolvedSupabaseUrl)}
        : {}),
      ...(resolvedSupabaseAnonKey
        ? {
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(resolvedSupabaseAnonKey),
            'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(resolvedSupabaseAnonKey),
          }
        : {}),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Edu AI — Study Atelier',
          short_name: 'Edu AI',
          description: 'Scholarly textbook reader, science labs, and Sage AI tutor built for Android and web.',
          theme_color: '#0F5C6E',
          background_color: '#F7F5F0',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          categories: ['education', 'books', 'productivity'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Open Library',
              short_name: 'Library',
              url: '/?view=library',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Ask Sage AI',
              short_name: 'Sage AI',
              url: '/?view=ai-tutor',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/ws\//, /^\/\.well-known\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 12,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 16,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom', 'pdfjs-dist'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    server: {
      hmr: false,
    },
  };
});

