'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MuseRepresentationTheme } from '@/lib/muse-representation';

export async function saveMuseRepresentationTheme(formData: FormData) {
  const theme = String(formData.get('theme') || '') as MuseRepresentationTheme;

  if (!theme) {
    redirect('/profile/muse-representation');
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect('/profile/muse-representation');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in?next=/profile/muse-representation');
  }

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
    redirect('/profile/muse-representation');
  }

  revalidatePath('/');
  revalidatePath('/nine-muses');
  revalidatePath('/profile/muse-representation');

  redirect('/profile/muse-representation');
}