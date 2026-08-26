import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Creates a Supabase server client for Server Components, Server Actions, and Route Handlers.
 */
export function createClient(cookieStore?: any) {
  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
    '';

  const supabaseAnonKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
    '';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
