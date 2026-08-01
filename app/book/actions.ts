'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLength);
}

function isPlausibleEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function subscribeToBookUpdates(formData: FormData) {
  const name = cleanText(formData.get('name'), 120);
  const email = cleanText(formData.get('email'), 320).toLowerCase();
  const website = cleanText(formData.get('website'), 200);

  // Quietly accept bot submissions without storing them.
  if (website) {
    redirect('/book?signup=success#release-updates');
  }

  if (!isPlausibleEmail(email)) {
    redirect('/book?signup=invalid#release-updates');
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect('/book?signup=unavailable#release-updates');
  }

  const { error } = await supabase.from('book_release_subscribers').insert({
    name: name || null,
    email,
    source: 'book-page',
  });

  // A repeat signup is still a successful outcome for the visitor.
  if (error && error.code !== '23505') {
    console.error('Book release signup failed:', error);
    redirect('/book?signup=error#release-updates');
  }

  redirect('/book?signup=success#release-updates');
}
