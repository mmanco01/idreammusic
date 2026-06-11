'use client';

import { useActionState, useEffect, useRef } from 'react';
import { submitListenerResponse, type SubmitListenerResponseState } from './actions';

const initialState: SubmitListenerResponseState = {
  ok: false,
  message: ''
};

type Props = {
  songId: string;
  songSlug: string;
  songTitle: string;
};

export default function ListenerResponseForm({ songId, songSlug, songTitle }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(submitListenerResponse, initialState);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Share what this song stirred in you</h2>
        <p className="mt-1 text-sm opacity-75">
          Your note for <span className="font-medium">{songTitle}</span> will be reviewed before it appears publicly.
        </p>
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
        <input type="hidden" name="songId" value={songId} />
        <input type="hidden" name="songSlug" value={songSlug} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-sm font-medium">Your name</span>
            <input
              name="authorName"
              type="text"
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none"
              placeholder="Jane Listener"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-sm font-medium">Email (optional)</span>
            <input
              name="authorEmail"
              type="email"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none"
              placeholder="jane@example.com"
            />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="block text-sm font-medium">Headline (optional)</span>
          <input
            name="title"
            type="text"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none"
            placeholder="This one hit me hard"
          />
        </label>

        <label className="space-y-2 block">
          <span className="block text-sm font-medium">Your response</span>
          <textarea
            name="body"
            required
            rows={6}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none"
            placeholder="Tell us what you heard, felt, remembered, or loved about this song..."
          />
        </label>

        {state.message ? (
          <p className={`text-sm ${state.ok ? 'text-green-300' : 'text-red-300'}`}>{state.message}</p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl border border-white/10 px-4 py-2 font-medium disabled:opacity-60"
        >
          {isPending ? 'Submitting...' : 'Submit response'}
        </button>
      </form>
    </section>
  );
}
