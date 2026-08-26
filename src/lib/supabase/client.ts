import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase browser client for client-side authentication and database queries.
 * Supports both Next.js public environment variables (NEXT_PUBLIC_*) and Vite environment variables (VITE_*).
 */
export function createClient() {
  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    '';

  const supabaseAnonKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    '';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
