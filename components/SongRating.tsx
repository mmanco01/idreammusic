'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type SongRatingProps = {
  songId: string;
};

export function SongRating({ songId }: SongRatingProps) {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadRating() {
      const supabase = createClient();

      if (!supabase) {
        if (isMounted) {
          setMessage('Ratings are temporarily unavailable.');
          setIsLoading(false);
        }

        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (!user) {
        setUserId(null);
        setIsLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from('song_ratings')
        .select('rating')
        .eq('song_id', songId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        setMessage('Could not load your rating.');
      } else if (data) {
        setRating(Number(data.rating) || 0);
      }

      setIsLoading(false);
    }

    loadRating();

    return () => {
      isMounted = false;
    };
  }, [songId]);

  async function saveRating(nextRating: number) {
    if (!userId || isSaving) return;

    const supabase = createClient();

    if (!supabase) {
      setMessage('Ratings are temporarily unavailable.');
      return;
    }

    setIsSaving(true);
    setMessage('');

    const previousRating = rating;
    setRating(nextRating);

    const { error } = await supabase
      .from('song_ratings')
      .upsert(
        {
          song_id: songId,
          user_id: userId,
          rating: nextRating,
        },
        {
          onConflict: 'song_id,user_id',
        }
      );

    if (error) {
      setRating(previousRating);
      setMessage(`Rating failed: ${error.message}`);
      setIsSaving(false);
      return;
    }

    setMessage('Rating saved.');
    setIsSaving(false);

    router.refresh();
  }

  if (isLoading) {
    return (
      <div style={{ marginTop: '0.9rem' }}>
        <span className="copy">Loading rating…</span>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ marginTop: '0.9rem' }}>
        <span className="copy">
          Sign in to rate this song.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: '0.9rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.6rem',
      }}
    >
      <span className="copy">Your rating:</span>

      <div
        role="radiogroup"
        aria-label="Rate this song from 1 to 5 stars"
        style={{
          display: 'flex',
          gap: '0.15rem',
        }}
        onMouseLeave={() => setHoverRating(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const activeRating = hoverRating || rating;
          const isActive = star <= activeRating;

          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              disabled={isSaving}
              onMouseEnter={() => setHoverRating(star)}
              onFocus={() => setHoverRating(star)}
              onBlur={() => setHoverRating(0)}
              onClick={() => saveRating(star)}
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                padding: '0.1rem',
                cursor: isSaving ? 'wait' : 'pointer',
                fontSize: '1.65rem',
                lineHeight: 1,
  color: isActive
    ? '#f4c542'
    : 'rgba(255, 255, 255, 0.55)',
  textShadow: isActive
    ? '0 0 8px rgba(244, 197, 66, 0.35)'
    : 'none',
  opacity: 1,
              }}
            >
              ★
            </button>
          );
        })}
      </div>

      {rating > 0 ? (
        <span className="copy">
          {rating} of 5
        </span>
      ) : null}

      {message ? (
        <span className="copy">{message}</span>
      ) : null}
    </div>
  );
}
