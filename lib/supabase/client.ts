import { createBrowserClient } from '@supabase/ssr';
import { env, hasSupabaseEnv } from '@/lib/supabase/env';

export function createClient() {
  if (!hasSupabaseEnv()) {
    throw new Error('Supabase environment variables are not configured.');
  }

  return createBrowserClient(env.url!, env.anonKey!);
}
