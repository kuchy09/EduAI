import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeStorage } from './safeStorage';

export const SERVER_VERIFIED_SESSION_KEY = 'edu_sb_verified_session';

export function isRealSupabaseUrl(val?: string | null): val is string {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return Boolean(
    trimmed &&
      trimmed.startsWith('http') &&
      !trimmed.includes('placeholder') &&
      !trimmed.includes('your-project') &&
      !trimmed.includes('your_') &&
      !trimmed.startsWith('MY_')
  );
}

export function isRealSupabaseKey(val?: string | null): val is string {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return Boolean(
    trimmed &&
      trimmed.length > 15 &&
      !trimmed.includes('placeholder') &&
      !trimmed.includes('your-key') &&
      !trimmed.includes('your_') &&
      !trimmed.startsWith('MY_')
  );
}

// Resolve first non-placeholder Supabase Project URL (supports Vite & Next.js conventions)
let currentSupabaseUrl =
  [
    typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined,
    typeof import.meta !== 'undefined' ? (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL : undefined,
    typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined,
    typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined,
    typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined,
  ].find(isRealSupabaseUrl) || '';

// Resolve first non-placeholder Supabase Public Key (never short-circuits on placeholder strings)
let currentSupabaseApiKey =
  [
    typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined,
    typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined,
    typeof import.meta !== 'undefined' ? (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : undefined,
    typeof import.meta !== 'undefined' ? (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY : undefined,
  ].find(isRealSupabaseKey) || '';

let serverAuthReadyFlag = false;

export function clearStaleSupabaseTokens() {
  if (typeof window === 'undefined') return;
  try {
    const ls = (function() { try { return window.localStorage; } catch (_) { return null; } })();
    if (ls) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (
          key && (
            key.startsWith('sb-') || 
            key.startsWith('sb_') ||
            key.includes('supabase.auth.token') || 
            key.includes('sb_edu_ai_token') ||
            key.includes('-auth-token') ||
            key === SERVER_VERIFIED_SESSION_KEY
          )
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => {
        try {
          ls.removeItem(key);
        } catch (_) {}
      });
    }
  } catch (e) {
    console.warn('Failed to clear stale tokens from localStorage:', e);
  }

  try {
    const ss = (function() { try { return window.sessionStorage; } catch (_) { return null; } })();
    if (ss) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < ss.length; i++) {
        const key = ss.key(i);
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
          ss.removeItem(key);
        } catch (_) {}
      });
    }
  } catch (e) {
    console.warn('Failed to clear stale tokens from sessionStorage:', e);
  }
}

export function sanitizeStoredSupabaseSession() {
  if (typeof window === 'undefined') return;
  try {
    const ls = (function() { try { return window.localStorage; } catch (_) { return null; } })();
    if (!ls) return;
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (
        key && (
          key.startsWith('sb-') || 
          key.startsWith('sb_') ||
          key.includes('supabase.auth.token') || 
          key.includes('sb_edu_ai_token') ||
          key.includes('-auth-token')
        )
      ) {
        const item = ls.getItem(key);
        if (!item) continue;
        try {
          const parsed = JSON.parse(item);
          if (!parsed || typeof parsed !== 'object') {
            ls.removeItem(key);
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
            ls.removeItem(key);
            continue;
          }
        } catch {
          // Corrupt JSON
          ls.removeItem(key);
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

  // 4. If OAuth popup landed on Site URL '/' instead of '/auth/callback', relay callback payload to window.opener immediately
  try {
    if (window.opener && !window.opener.closed && window.location.pathname !== '/auth/callback') {
      const searchParams = new URLSearchParams(window.location.search);
      const rawHash = window.location.hash ? window.location.hash.substring(1) : '';
      const hashParams = new URLSearchParams(rawHash);
      const hasOAuthParams = Boolean(
        hashParams.get('access_token') ||
          searchParams.get('code') ||
          hashParams.get('error') ||
          searchParams.get('error')
      );
      if (hasOAuthParams) {
        const payload = {
          type: 'EDU_SUPABASE_OAUTH_CALLBACK',
          code: searchParams.get('code') || hashParams.get('code') || null,
          access_token: hashParams.get('access_token') || searchParams.get('access_token') || null,
          refresh_token: hashParams.get('refresh_token') || searchParams.get('refresh_token') || null,
          error: searchParams.get('error') || hashParams.get('error') || null,
          error_description: searchParams.get('error_description') || hashParams.get('error_description') || null,
        };
        try {
          window.opener.postMessage(payload, window.location.origin);
        } catch {
          window.opener.postMessage(payload, '*');
        }
        setTimeout(() => {
          try {
            window.close();
          } catch {}
        }, 120);
      }
    }
  } catch (_) {}
}

// Proactively sanitize stored sessions before constructing the Supabase client
sanitizeStoredSupabaseSession();

function buildBrowserSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url.trim(), key.trim(), {
    auth: {
      storage: safeStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

// Initialize Supabase Client with updated interface and robust session caching
export let supabase: SupabaseClient | null =
  isRealSupabaseUrl(currentSupabaseUrl) && isRealSupabaseKey(currentSupabaseApiKey)
    ? buildBrowserSupabaseClient(currentSupabaseUrl, currentSupabaseApiKey)
    : null;

export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

export function getResolvedSupabaseUrl(): string {
  return currentSupabaseUrl;
}

export function isServerAuthAvailable(): boolean {
  return Boolean(supabase) || serverAuthReadyFlag || Boolean(currentSupabaseUrl);
}

let runtimeConfigPromise: Promise<{
  client: SupabaseClient | null;
  supabaseUrl: string;
  serverAuthReady: boolean;
}> | null = null;

export async function ensureSupabaseRuntimeConfig(): Promise<{
  client: SupabaseClient | null;
  supabaseUrl: string;
  serverAuthReady: boolean;
}> {
  if (supabase) {
    return {
      client: supabase,
      supabaseUrl: currentSupabaseUrl,
      serverAuthReady: true,
    };
  }

  if (!runtimeConfigPromise) {
    runtimeConfigPromise = (async () => {
      try {
        const res = await fetch('/api/public-config', {
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const data = await res.json();
          if (isRealSupabaseUrl(data?.supabaseUrl)) {
            currentSupabaseUrl = data.supabaseUrl.trim();
          }
          if (isRealSupabaseKey(data?.supabaseAnonKey)) {
            currentSupabaseApiKey = data.supabaseAnonKey.trim();
          }
          if (typeof data?.serverAuthReady === 'boolean') {
            serverAuthReadyFlag = data.serverAuthReady;
          }
          if (!supabase && isRealSupabaseUrl(currentSupabaseUrl) && isRealSupabaseKey(currentSupabaseApiKey)) {
            supabase = buildBrowserSupabaseClient(currentSupabaseUrl, currentSupabaseApiKey);
          }
        }
      } catch (_) {
        // Offline or local-only mode
      }
      return {
        client: supabase,
        supabaseUrl: currentSupabaseUrl,
        serverAuthReady: Boolean(supabase) || serverAuthReadyFlag,
      };
    })();
  }

  const resolved = await runtimeConfigPromise;
  // Allow future re-checks if still not initialized
  if (!resolved.client && !resolved.serverAuthReady) {
    runtimeConfigPromise = null;
  }
  return resolved;
}

