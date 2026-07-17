'use client';

import { useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type TrackedAudioPlayerProps = {
  songId: string;
  songVersionId?: string | null;
  audioUrl: string;
};

function getAnonymousSessionId() {
  const storageKey = 'idreammusic_listener_session';

  let sessionId = window.sessionStorage.getItem(storageKey);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, sessionId);
  }

  return sessionId;
}

export function TrackedAudioPlayer({
  songId,
  songVersionId,
  audioUrl,
}: TrackedAudioPlayerProps) {
  const recordedRef = useRef(false);

  async function recordPlay() {
    if (recordedRef.current) return;
    recordedRef.current = true;

    try {
      const supabase = createBrowserSupabaseClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const anonymousSessionId = user ? null : getAnonymousSessionId();

      /*
       * This counts a song once per signed-in user/browser session.
       * The database's unique event_key prevents duplicate counts when
       * pause/play is clicked repeatedly during the same visit.
       */
      const listenerIdentity = user?.id ?? anonymousSessionId;

      const eventKey = [
        'audio_play',
        listenerIdentity,
        songId,
        songVersionId ?? 'current',
      ].join(':');

      const { error } = await supabase
        .from('song_engagement_events')
        .insert({
          song_id: songId,
          song_version_id: songVersionId ?? null,
          event_type: 'audio_play',
          user_id: user?.id ?? null,
          anonymous_session_id: anonymousSessionId,
          event_key: eventKey,
          source_page: '/listen',
        });

      /*
       * Duplicate event keys are expected when someone pauses and
       * resumes the same song during one session.
       */
      if (error && error.code !== '23505') {
        console.error('Unable to record audio play:', error);
        recordedRef.current = false;
      }
    } catch (error) {
      console.error('Unable to record audio play:', error);
      recordedRef.current = false;
    }
  }

  return (
    <audio
      controls
      preload="none"
      src={audioUrl}
      onPlay={recordPlay}
      style={{ width: '100%' }}
    >
      Your browser does not support audio playback.
    </audio>
  );
}
