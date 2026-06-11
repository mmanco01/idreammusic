import { cache } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MuseRepresentationTheme } from '@/lib/muse-representation';

export const getMyMuseRepresentationTheme = cache(
  async (): Promise<MuseRepresentationTheme> => {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return 'default';

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return 'default';

    const { data, error } = await supabase
      .from('profiles')
      .select('muse_representation_theme')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load muse representation theme:', error);
      return 'default';
    }

    return (data?.muse_representation_theme as MuseRepresentationTheme) ?? 'default';
  }
);