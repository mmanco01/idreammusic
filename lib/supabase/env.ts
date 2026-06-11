export const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

export function hasSupabaseEnv() {
  return Boolean(env.url && env.anonKey);
}
