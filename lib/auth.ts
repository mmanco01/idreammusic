import { cache } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/types';

export type AuthProfile = {
  id: string;
  display_name: string | null;
  role: AppRole;
};

export const getServerAuthContext = cache(async () => {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return { supabase: null, user: null, profile: null as AuthProfile | null };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null as AuthProfile | null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    profile: (profile as AuthProfile | null) ?? null
  };
});
