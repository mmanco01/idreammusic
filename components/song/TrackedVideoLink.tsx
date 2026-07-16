"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackSongEngagement } from "@/components/song/engagement";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  songId: string;
  href: string;
  songVersionId?: string | null;
  attachmentId?: string | null;
  sourcePage?: string;
  children: ReactNode;
};

export default function TrackedVideoLink({
  songId,
  href,
  songVersionId,
  attachmentId,
  sourcePage = "listen",
  onClick,
  children,
  ...anchorProps
}: Props) {
  return (
    <a
      {...anchorProps}
      href={href}
      onClick={(event) => {
        onClick?.(event);

        void trackSongEngagement({
          songId,
          songVersionId,
          attachmentId,
          eventType: "video_click",
          sourcePage,
          targetUrl: href,
          resourceKey: href,
        });
      }}
    >
      {children}
    </a>
  );
}
