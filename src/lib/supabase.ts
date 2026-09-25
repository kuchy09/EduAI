import { createClient } from '@supabase/supabase-js';

// Resolve Supabase Project URL (supports Vite & Next.js conventions)
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL)) ||
  '';

// Resolve Supabase API Key (supports updated Publishable Key interface as well as legacy Anon Key)
const supabaseApiKey = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && (
    process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env?.SUPABASE_PUBLISHABLE_KEY ||
    process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env?.VITE_SUPABASE_ANON_KEY ||
    process.env?.SUPABASE_ANON_KEY
  )) ||
  '';

const isRealUrl = Boolean(
  supabaseUrl && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('placeholder') && 
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('your_')
);

const isRealKey = Boolean(
  supabaseApiKey && 
  !supabaseApiKey.includes('placeholder') && 
  !supabaseApiKey.includes('your-key') &&
  !supabaseApiKey.includes('your_')
);

export function clearStaleSupabaseTokens() {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key && (
            key.startsWith('sb-') || 
            key.startsWith('sb_') ||
            key.includes('supabase.auth.token') || 
            key.includes('sb_edu_ai_token') ||
            key.includes('-auth-token')
          )
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (_) {}
      });
    }
  } catch (e) {
    console.warn('Failed to clear stale tokens from localStorage:', e);
  }

  try {
    if (window.sessionStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (
          key && (
            key.startsWith('sb-') || 
            key.startsWith('sb_') ||
            key.includes('supabase.auth.token') || 
            key.includes('sb_edu_ai_token') ||
            key.includes('-auth-token')
          )
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => {
        try {
          sessionStorage.removeItem(key);
        } catch (_) {}
      });
    }
  } catch (e) {
    console.warn('Failed to clear stale tokens from sessionStorage:', e);
  }
}

export function sanitizeStoredSupabaseSession() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key && (
          key.startsWith('sb-') || 
          key.startsWith('sb_') ||
          key.includes('supabase.auth.token') || 
          key.includes('sb_edu_ai_token') ||
          key.includes('-auth-token')
        )
      ) {
        const item = localStorage.getItem(key);
        if (!item) continue;
        try {
          const parsed = JSON.parse(item);
          if (!parsed || typeof parsed !== 'object') {
            localStorage.removeItem(key);
            continue;
          }
          // If the stored item lacks a valid refresh_token or has placeholder strings
          if (
            !parsed.refresh_token || 
            typeof parsed.refresh_token !== 'string' || 
            parsed.refresh_token.length < 5 ||
            parsed.refresh_token.includes('placeholder') ||
            parsed.refresh_token.includes('your_')
          ) {
            localStorage.removeItem(key);
            continue;
          }
        } catch {
          // Corrupt JSON
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.warn('Session sanitization notice:', e);
  }
}

// Global interceptors for auth errors (e.g. invalid refresh tokens or unreachable auth server)
if (typeof window !== 'undefined') {
  // 1. Intercept console.error to gracefully suppress unhandled GoTrue refresh token error reports
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const errorString = args
      .map(arg => {
        if (!arg) return '';
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.name}: ${arg.message} ${arg.stack || ''}`;
        if (typeof arg === 'object') {
          return `${arg.name || ''} ${arg.message || ''} ${arg.error_description || ''} ${arg.error || ''} ${JSON.stringify(arg)}`;
        }
        return String(arg);
      })
      .join(' ');

    if (
      errorString.includes('Invalid Refresh Token') ||
      errorString.includes('Refresh Token Not Found') ||
      errorString.includes('refresh_token_not_found') ||
      errorString.includes('refresh_token_already_used') ||
      errorString.includes('Invalid refresh token') ||
      (errorString.includes('invalid_grant') && errorString.includes('refresh_token'))
    ) {
      clearStaleSupabaseTokens();
      console.warn('[Handled Supabase Session Refresh Notice]: Stale refresh token cleaned up safely.');
      return;
    }

    originalConsoleError.apply(console, args);
  };

  // 2. Intercept unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason?.error_description || reason || '');
    if (
      msg.includes('Invalid Refresh Token') ||
      msg.includes('refresh_token_not_found') ||
      msg.includes('Refresh Token Not Found') ||
      msg.includes('refresh_token_already_used') ||
      msg.includes('Failed to fetch')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!msg.includes('Failed to fetch')) {
        clearStaleSupabaseTokens();
      }
      console.warn('Handled background network or auth notice:', msg);
    }
  }, true);

  // 3. Intercept global window errors
  window.addEventListener('error', (event) => {
    const msg = String(event.message || event.error?.message || '');
    if (
      msg.includes('Invalid Refresh Token') ||
      msg.includes('refresh_token_not_found') ||
      msg.includes('Refresh Token Not Found') ||
      msg.includes('refresh_token_already_used')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearStaleSupabaseTokens();
      console.warn('Handled background auth error event:', msg);
    }
  }, true);
}

// Proactively sanitize stored sessions before constructing the Supabase client
sanitizeStoredSupabaseSession();

// Initialize Supabase Client with updated interface and robust session caching
export const supabase = (isRealUrl && isRealKey)
  ? createClient(supabaseUrl, supabaseApiKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    }) 
  : null;
