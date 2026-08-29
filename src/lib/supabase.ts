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
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key && (
          key.startsWith('sb-') || 
          key.startsWith('sb_') ||
          key.includes('supabase.auth.token') || 
          key.includes('sb_edu_ai_token')
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
  } catch (e) {
    console.warn('Failed to clear stale tokens:', e);
  }
}

// Global interceptor for unhandled auth errors (e.g. invalid refresh tokens or unreachable auth server)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    if (
      msg.includes('Invalid Refresh Token') ||
      msg.includes('refresh_token_not_found') ||
      msg.includes('Refresh Token Not Found') ||
      (msg.includes('Failed to fetch') && (reason?.stack?.includes('supabase') || reason?.stack?.includes('gotrue') || msg.includes('auth')))
    ) {
      event.preventDefault();
      clearStaleSupabaseTokens();
      console.warn('Supabase auth session auto-cleared due to invalid/expired refresh token or network fault:', msg);
    }
  });
}

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
