"use client";

import { useEffect, useState } from "react";

type Props = {
  title: string;
  messages?: string[];
  compact?: boolean;
  className?: string;
};

export function AnimatedDots({ label = "Working" }: { label?: string }) {
  return (
    <span className="animated-dots" aria-label={`${label}…`}>
      <span aria-hidden="true">.</span>
      <span aria-hidden="true">.</span>
      <span aria-hidden="true">.</span>
    </span>
  );
}

export function AnalysisLoadingState({
  title,
  messages = [],
  compact = false,
  className = "",
}: Props) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;

    const timer = window.setInterval(() => {
      setMessageIndex((current: number) => (current + 1) % messages.length);
    }, 2400);

    return () => window.clearInterval(timer);
  }, [messages.length]);

  const activeMessage = messages[messageIndex] ?? "Still working—your result will appear here.";

  return (
    <div
      className={`analysis-loading-state${compact ? " analysis-loading-state--compact" : ""}${
        className ? ` ${className}` : ""
      }`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
    >
      <span className="analysis-loading-state__orb" aria-hidden="true">
        <span />
      </span>
      <div>
        <strong className="analysis-loading-state__title">
          {title}
          <AnimatedDots label={title} />
        </strong>
        {activeMessage ? (
          <p className="analysis-loading-state__message">{activeMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
