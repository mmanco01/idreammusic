'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MuseRepresentationTheme } from '@/lib/muse-representation';

export async function saveMuseRepresentationTheme(formData: FormData) {
  const theme = formData.get('theme') as MuseRepresentationTheme | null;
  if (!theme) return;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        muse_representation_theme: theme,
      },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('Failed to save muse representation theme:', error);
    return;
  }

  revalidatePath('/');
  revalidatePath('/nine-muses');
  revalidatePath('/muses/[slug]', 'page');
  revalidatePath('/profile/muse-representation');

  redirect('/profile/muse-representation');
}