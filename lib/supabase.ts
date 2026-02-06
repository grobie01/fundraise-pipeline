import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr';

// Client-side Supabase client (uses cookies via @supabase/ssr)
// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;

function getEnvVars() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  };
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const { url, anonKey } = getEnvVars();
    if (url && anonKey) {
      _supabase = createBrowserClient(url, anonKey);
    }
  }
  if (!_supabase) {
    throw new Error('Supabase client not initialized. Check environment variables.');
  }
  return _supabase;
}

// Legacy export for compatibility
export const supabase = {
  get channel() {
    return getSupabase().channel.bind(getSupabase());
  },
  get removeChannel() {
    return getSupabase().removeChannel.bind(getSupabase());
  },
  get from() {
    return getSupabase().from.bind(getSupabase());
  },
  get auth() {
    return getSupabase().auth;
  },
} as unknown as SupabaseClient;

// Server-side Supabase client with cookie-based auth (for SSR)
export async function createServerClient() {
  // Dynamic import to avoid client-side issues
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  const { url, anonKey } = getEnvVars();
  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createSSRClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Admin client with service role key (bypasses RLS)
export function createAdminClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const { url } = getEnvVars();
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}
