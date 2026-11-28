import './lib/supabase'; // Ensure auth error interceptors and session sanitizers are primed
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { safeStorage } from './lib/safeStorage';

if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() && window.location.hostname === 'localhost') {
  const configuredBase =
    safeStorage.getItem('edu_ai_api_base_url') ||
    (import.meta as any).env?.VITE_API_BASE_URL ||
    'https://ais-pre-vvfmzub4fuhwyulg6tacri-72101744053.europe-west3.run.app';
  const cleanBase = String(configuredBase).replace(/\/+$/, '');
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return origFetch(`${cleanBase}${input}`, init);
    }
    if (input instanceof Request) {
      try {
        const u = new URL(input.url);
        if (u.origin === window.location.origin && u.pathname.startsWith('/api/')) {
          return origFetch(new Request(`${cleanBase}${u.pathname}${u.search}`, input), init);
        }
      } catch {}
    }
    return origFetch(input, init);
  };
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('[Edu AI] PWA service worker notice:', error);
      },
    });
  } catch (_) {}
}

// Safe theme initialization
try {
  const savedTheme = safeStorage.getItem('theme') || 'light';
  const isDark = savedTheme === 'dark' || (savedTheme === 'system' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  }
} catch (_) {}

// Safe font size initialization
try {
  const savedFontSize = safeStorage.getItem('fontSize') || 'Medium';
  document.documentElement.setAttribute('data-font-size', savedFontSize.toLowerCase());
} catch (_) {}

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (err: any) {
    console.error('Fatal initialization error in createRoot:', err);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b0f19; color: white; padding: 24px; font-family: ui-sans-serif, system-ui, sans-serif; text-align: center;">
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">Edu AI Recovery</h2>
        <p style="color: #94a3b8; font-size: 14px; max-width: 360px; margin-bottom: 20px; line-height: 1.5;">A display issue occurred during startup. Click below to refresh your library.</p>
        <button onclick="try{window.location.reload();}catch(e){}" style="padding: 10px 22px; background: #7c3aed; color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 14px;">
          Reset & Open Edu AI
        </button>
      </div>
    `;
  }
}
