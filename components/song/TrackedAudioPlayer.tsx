"use client";

import type { AudioHTMLAttributes } from "react";
import { trackSongEngagement } from "@/components/song/engagement";

type Props = AudioHTMLAttributes<HTMLAudioElement> & {
  songId: string;
  songVersionId?: string | null;
  attachmentId?: string | null;
  sourcePage?: string;
};

export default function TrackedAudioPlayer({
  songId,
  songVersionId,
  attachmentId,
  sourcePage = "listen",
  onPlay,
  children,
  ...audioProps
}: Props) {
  return (
    <audio
      {...audioProps}
      onPlay={(event) => {
        onPlay?.(event);

        void trackSongEngagement({
          songId,
          songVersionId,
          attachmentId,
          eventType: "audio_play",
          sourcePage,
          resourceKey:
            attachmentId || songVersionId || String(audioProps.src || ""),
        });
      }}
    >
      {children}
    </audio>
  );
}
