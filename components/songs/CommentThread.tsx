"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseEnv } from '@/lib/supabase/env';

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_user_id: string;
};

type Props = {
  songId: string;
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

export function CommentThread({ songId }: Props) {
  const pathname = usePathname();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canUseSupabase = useMemo(() => hasSupabaseEnv(), []);

  async function loadComments() {
    if (!canUseSupabase) {
      setComments([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    setIsSignedIn(Boolean(user));
    setUserId(user?.id ?? null);

    const { data } = await supabase
      .from('comments')
      .select('id, body, created_at, author_user_id')
      .eq('entity_type', 'song')
      .eq('entity_id', songId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });

    setComments((data as CommentRow[] | null) ?? []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadComments();

    if (!canUseSupabase) return;

    const supabase = createClient();
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setIsSignedIn(Boolean(session?.user));
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [canUseSupabase, songId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUseSupabase) {
      setMessage('Supabase is not configured yet.');
      return;
    }

    try {
      setIsSaving(true);
      setMessage('');

      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage('Sign in before commenting.');
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('comments').insert({
        author_user_id: user.id,
        entity_type: 'song',
        entity_id: songId,
        body
      });

      if (error) throw error;

      setBody('');
      setMessage('Comment posted.');
      await loadComments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not post the comment.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="eyebrow">Listener conversation</div>
      <h2 className="h3">Comments</h2>

      {!canUseSupabase ? <p className="copy">Turn on Supabase to enable comments.</p> : null}

      {canUseSupabase && !isSignedIn ? (
        <p className="copy">
          <Link href={`/auth/sign-in?next=${encodeURIComponent(pathname)}`} className="textLink">
            Sign in
          </Link>{' '}
          to leave a comment.
        </p>
      ) : null}

      {canUseSupabase && isSignedIn ? (
        <form className="stack-list" onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <textarea
            rows={4}
            required
            placeholder="What did you hear in this song?"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="button-row">
            <button className="button primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : null}

      {message ? <div className="statusMessage statusSuccess">{message}</div> : null}

      {isLoading ? (
        <p className="copy" style={{ marginTop: '1rem' }}>Loading comments…</p>
      ) : comments.length ? (
        <div className="stack-list" style={{ marginTop: '1rem' }}>
          {comments.map((comment) => (
            <article key={comment.id} className="subsection">
              <div className="commentMeta">
                <span>{comment.author_user_id === userId ? 'You' : 'Songcatcher'}</span>
                <span>•</span>
                <span>{formatDate(comment.created_at)}</span>
              </div>
              <p className="copy">{comment.body}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="copy" style={{ marginTop: '1rem' }}>
          No comments yet. Be the first listener to leave one.
        </p>
      )}
    </div>
  );
}
