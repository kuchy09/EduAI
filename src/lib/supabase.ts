import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeStorage, safeSessionStorage } from './safeStorage';

export const SERVER_VERIFIED_SESSION_KEY = 'edu_sb_verified_session';
const OAUTH_REDIRECT_PENDING_KEY = 'edu_oauth_redirect_pending_v1';
const OAUTH_REDIRECT_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes max for full-tab OAuth callback

let interactiveAuthorizedUserId: string | null = null;
let persistedDeviceSession: any = null;

function isValidCredentialSessionObj(sessionObj: any): boolean {
  return Boolean(
    sessionObj &&
      sessionObj.user?.id &&
      typeof sessionObj.access_token === 'string' &&
      sessionObj.access_token.length > 0 &&
      sessionObj.access_token !== 'demo_token' &&
      sessionObj.access_token !== 'local_token'
  );
}

// Hydrate any verified device session saved from an earlier login on this browser/device
(function hydrateSavedDeviceSession() {
  try {
    const saved = safeStorage.getJSON<any>(SERVER_VERIFIED_SESSION_KEY, null);
    if (isValidCredentialSessionObj(saved)) {
      interactiveAuthorizedUserId = saved.user.id;
      persistedDeviceSession = saved;
    } else if (saved) {
      safeStorage.removeItem(SERVER_VERIFIED_SESSION_KEY);
    }
  } catch (_) {}
})();

export function markOAuthRedirectPending(): void {
  try {
    safeSessionStorage.setItem(
      OAUTH_REDIRECT_PENDING_KEY,
      JSON.stringify({ ts: Date.now() })
    );
  } catch (_) {}
}

export function hasValidOAuthRedirectPending(): boolean {
  try {
    const raw = safeSessionStorage.getItem(OAUTH_REDIRECT_PENDING_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || typeof parsed.ts !== 'number') return false;
    return Date.now() - parsed.ts <= OAUTH_REDIRECT_MAX_AGE_MS;
  } catch (_) {
    return false;
  }
}

export function consumeOAuthRedirectPending(): boolean {
  const valid = hasValidOAuthRedirectPending();
  try {
    safeSessionStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY);
  } catch (_) {}
  return valid;
}

export function authorizeInteractiveSession(userId: string, sessionObj?: any): void {
  if (!userId) return;
  if (
    sessionObj &&
    (sessionObj.access_token === 'demo_token' || sessionObj.access_token === 'local_token')
  ) {
    return;
  }
  interactiveAuthorizedUserId = userId;
  if (sessionObj && isValidCredentialSessionObj(sessionObj)) {
    persistedDeviceSession = sessionObj;
    try {
      safeStorage.setJSON(SERVER_VERIFIED_SESSION_KEY, sessionObj);
    } catch (_) {}
  }
}

export function isInteractiveSessionAuthorized(userId?: string | null): boolean {
  if (!interactiveAuthorizedUserId) {
    const saved = getPersistedDeviceSession();
    if (saved?.user?.id) {
      interactiveAuthorizedUserId = saved.user.id;
    }
  }
  if (!interactiveAuthorizedUserId) return false;
  if (userId && interactiveAuthorizedUserId !== userId) return false;
  return true;
}

export function getPersistedDeviceSession(): any {
  if (isValidCredentialSessionObj(persistedDeviceSession)) {
    return persistedDeviceSession;
  }
  try {
    const saved = safeStorage.getJSON<any>(SERVER_VERIFIED_SESSION_KEY, null);
    if (isValidCredentialSessionObj(saved)) {
      persistedDeviceSession = saved;
      interactiveAuthorizedUserId = saved.user.id;
      return saved;
    }
  } catch (_) {}
  return null;
}

export function getActiveEphemeralSession(): any {
  return getPersistedDeviceSession();
}

export function revokeInteractiveSession(): void {
  interactiveAuthorizedUserId = null;
  persistedDeviceSession = null;
  try {
    safeStorage.removeItem(SERVER_VERIFIED_SESSION_KEY);
    safeSessionStorage.removeItem(SERVER_VERIFIED_SESSION_KEY);
    safeSessionStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY);
  } catch (_) {}
  clearStaleSupabaseTokens();
}

// Persistent device auth storage backed by localStorage (with safe in-memory fallback)
const persistentAuthStorage = {
  getItem(key: string): string | null {
    if (key.includes('code-verifier')) {
      return safeSessionStorage.getItem(key) ?? safeStorage.getItem(key);
    }
    return safeStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (key.includes('code-verifier')) {
      safeSessionStorage.setItem(key, value);
    }
    safeStorage.setItem(key, String(value));
  },
  removeItem(key: string): void {
    if (key.includes('code-verifier')) {
      safeSessionStorage.removeItem(key);
    }
    safeStorage.removeItem(key);
  },
};

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

export function clearStaleSupabaseTokens(preserveOAuthVerifier = false) {
  interactiveAuthorizedUserId = null;
  persistedDeviceSession = null;
  if (typeof window === 'undefined') return;
  try {
    const ls = (function() { try { return window.localStorage; } catch (_) { return null; } })();
    if (ls) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (!key) continue;
        if (preserveOAuthVerifier && key.includes('code-verifier')) {
          continue;
        }
        if (
          key.startsWith('sb-') || 
          key.startsWith('sb_') ||
          key.includes('supabase.auth.token') || 
          key.includes('sb_edu_ai_token') ||
          key.includes('-auth-token') ||
          key === SERVER_VERIFIED_SESSION_KEY ||
          key === 'edu_ai_guest_mode' ||
          key === 'edu_demo_user'
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
        if (!key) continue;
        if (preserveOAuthVerifier && (key.includes('code-verifier') || key === OAUTH_REDIRECT_PENDING_KEY)) {
          continue;
        }
        if (
          key.startsWith('sb-') || 
          key.startsWith('sb_') ||
          key.includes('supabase.auth.token') || 
          key.includes('sb_edu_ai_token') ||
          key.includes('-auth-token') ||
          key === SERVER_VERIFIED_SESSION_KEY ||
          key === 'edu_ai_guest_mode' ||
          key === 'edu_demo_user'
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
  // Purge legacy guest/demo bypass flags and reject any fake/demo tokens while preserving legitimate device logins
  if (typeof window === 'undefined') return;
  try {
    safeStorage.removeItem('edu_ai_guest_mode');
    safeSessionStorage.removeItem('edu_ai_guest_mode');
    safeStorage.removeItem('edu_demo_user');
    safeSessionStorage.removeItem('edu_demo_user');

    const saved = safeStorage.getJSON<any>(SERVER_VERIFIED_SESSION_KEY, null);
    if (saved && !isValidCredentialSessionObj(saved)) {
      safeStorage.removeItem(SERVER_VERIFIED_SESSION_KEY);
    }

    const ls = (function() { try { return window.localStorage; } catch (_) { return null; } })();
    if (ls) {
      for (let i = ls.length - 1; i >= 0; i--) {
        const key = ls.key(i);
        if (!key) continue;
        if (key.startsWith('sb-') || key.includes('supabase.auth.token') || key.includes('-auth-token')) {
          const rawVal = ls.getItem(key) || '';
          if (rawVal.includes('"demo_token"') || rawVal.includes('"local_token"')) {
            ls.removeItem(key);
          }
        }
      }
    }
  } catch (_) {}
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
      storage: persistentAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
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

