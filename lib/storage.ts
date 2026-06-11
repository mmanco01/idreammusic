import { env, hasSupabaseEnv } from '@/lib/supabase/env';

export function buildPublicAssetUrl(storagePath: string, bucket = 'song-assets') {
  if (!hasSupabaseEnv()) return null;

  const cleanPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${env.url}/storage/v1/object/public/${bucket}/${cleanPath}`;
}
