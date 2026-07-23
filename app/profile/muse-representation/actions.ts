'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  museRepresentationOptions,
  type MuseRepresentationTheme,
} from '@/lib/muse-representation';

function isValidTheme(value: string): value is MuseRepresentationTheme {
  return museRepresentationOptions.some((option) => option.value === value);
}

export async function saveMuseRepresentationTheme(formData: FormData) {
  const submittedTheme = String(formData.get('theme') ?? '');

  if (!isValidTheme(submittedTheme)) {
    redirect('/profile/muse-representation?error=invalid_theme');
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect('/profile/muse-representation?error=connection');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/sign-in?next=/profile/muse-representation');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      muse_representation_theme: submittedTheme,
    })
    .eq('id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to save Muse representation theme:', error);
    redirect('/profile/muse-representation?error=save_failed');
  }

  if (!data) {
    console.error('No profile row was found for user:', user.id);
    redirect('/profile/muse-representation?error=profile_missing');
  }

  revalidatePath('/');
  revalidatePath('/nine-muses');
  revalidatePath('/profile/muse-representation');
  revalidatePath('/studio');

  redirect('/profile/muse-representation?saved=1');
}
