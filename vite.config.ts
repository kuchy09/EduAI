import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

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
    plugins: [react(), tailwindcss()],
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

