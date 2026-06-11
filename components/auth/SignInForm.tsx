"use client";

import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export function SignInForm() {
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get('next') || '/studio', [searchParams]);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSupabaseEnv()) {
      setStatus('error');
      setMessage('Supabase environment variables are missing in this build.');
      return;
    }

    try {
      setStatus('sending');
      setMessage('');

      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo
        }
      });

      if (error) throw error;

      setStatus('sent');
      setMessage(`Magic link sent to ${email}. Open it on this same browser to finish signing in.`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to send your sign-in link.');
    }
  }

  return (
    <div className="card formCard">
      <div className="eyebrow">Authentication</div>
      <h1 className="h2">Sign in to upload</h1>
      <p className="copy" style={{ maxWidth: 680 }}>
        Use a magic link. Once you open the email link, you will come back to iDreamMusic already signed in and ready
        to upload to the Muse pages.
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="full">
          <span className="fieldLabel">Email</span>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <div className="full button-row">
          <button className="button primary" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
          </button>
        </div>
      </form>

      {message ? (
        <div className={`statusMessage ${status === 'error' ? 'statusError' : 'statusSuccess'}`}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
