import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isRealUrl = Boolean(
  supabaseUrl && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('placeholder') && 
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('your_')
);

const isRealKey = Boolean(
  supabaseAnonKey && 
  !supabaseAnonKey.includes('placeholder') && 
  !supabaseAnonKey.includes('your-key') &&
  !supabaseAnonKey.includes('your_')
);

export function clearStaleSupabaseTokens() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token') || key.includes('sb_edu_ai_token'))) {
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

// Only create the client if valid credentials exist, preventing network crashes if unconfigured
export const supabase = (isRealUrl && isRealKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    }) 
  : null;


