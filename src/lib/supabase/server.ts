import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Creates a Supabase server client for Server Components, Server Actions, Route Handlers, and Admin Tasks.
 * Supports Supabase's updated API keys interface:
 * - Publishable Key: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - Secret / Service Key: SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY (optional for elevated access)
 */
export function createClient(cookieStore?: any, options?: { admin?: boolean }) {
  const supabaseUrl =
    (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL)) ||
    '';

  const secretKey =
    typeof process !== 'undefined'
      ? process.env?.SUPABASE_SECRET_KEY || process.env?.SUPABASE_SERVICE_ROLE_KEY
      : '';

  const publishableKey =
    (typeof process !== 'undefined' && (
      process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env?.SUPABASE_PUBLISHABLE_KEY ||
      process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env?.SUPABASE_ANON_KEY ||
      process.env?.VITE_SUPABASE_ANON_KEY
    )) ||
    '';

  const apiKey = (options?.admin && secretKey) ? secretKey : (publishableKey || secretKey);

  return createServerClient(supabaseUrl, apiKey, {
    cookies: {
      getAll() {
        if (!cookieStore) return [];
        if (typeof cookieStore.getAll === 'function') {
          return cookieStore.getAll();
        }
        return [];
      },
      setAll(cookiesToSet) {
        try {
          if (cookieStore && typeof cookieStore.set === 'function') {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
              cookieStore.set(name, value, options)
            );
          }
        } catch {
          // Can occur if called from a Server Component where response cookies cannot be set directly.
        }
      },
    },
  });
}
