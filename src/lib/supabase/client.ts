import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase browser client for client-side authentication and database queries.
 * Supports Supabase's updated API keys interface:
 * - Publishable Key: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY
 * - Legacy Anon Key fallback: NEXT_PUBLIC_SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY
 */
export function createClient() {
  const supabaseUrl =
    (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL)) ||
    (typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_SUPABASE_URL || (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL)) ||
    '';

  const supabasePublishableKey =
    (typeof process !== 'undefined' && (
      process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env?.SUPABASE_PUBLISHABLE_KEY ||
      process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env?.VITE_SUPABASE_ANON_KEY ||
      process.env?.SUPABASE_ANON_KEY
    )) ||
    (typeof import.meta !== 'undefined' && (
      (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )) ||
    '';

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
