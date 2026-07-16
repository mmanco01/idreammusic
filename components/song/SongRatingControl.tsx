"use client";

import { useEffect, useState } from "react";

type Props = {
  songId: string;
  compact?: boolean;
};

type RatingState = {
  status: "loading" | "idle" | "saving" | "success" | "error";
  averageRating: number | null;
  ratingCount: number;
  myRating: number | null;
  canRate: boolean;
  message: string;
};

export default function SongRatingControl({ songId, compact = false }: Props) {
  const [state, setState] = useState<RatingState>({
    status: "loading",
    averageRating: null,
    ratingCount: 0,
    myRating: null,
    canRate: false,
    message: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadRating() {
      try {
        const query = new URLSearchParams({ song_id: songId });
        const response = await fetch(`/api/song-ratings?${query.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        const result = (await response.json().catch(() => null)) as {
          status?: string;
          message?: string;
          average_rating?: number | null;
          rating_count?: number;
          my_rating?: number | null;
          can_rate?: boolean;
        } | null;

        if (cancelled) return;

        if (!response.ok || result?.status !== "success") {
          setState((current) => ({
            ...current,
            status: "error",
            message:
              result?.message ||
              `Rating lookup failed with status ${response.status}.`,
          }));
          return;
        }

        setState({
          status: "idle",
          averageRating: result.average_rating ?? null,
          ratingCount: result.rating_count || 0,
          myRating: result.my_rating ?? null,
          canRate: Boolean(result.can_rate),
          message: "",
        });
      } catch (error) {
        if (cancelled) return;

        setState((current) => ({
          ...current,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load song ratings.",
        }));
      }
    }

    void loadRating();

    return () => {
      cancelled = true;
    };
  }, [songId]);

  async function saveRating(rating: number) {
    if (!state.canRate || state.status === "saving") return;

    setState((current) => ({
      ...current,
      status: "saving",
      message: "",
    }));

    try {
      const response = await fetch("/api/song-ratings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          song_id: songId,
          rating,
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        status?: string;
        message?: string;
        average_rating?: number | null;
        rating_count?: number;
        my_rating?: number | null;
        can_rate?: boolean;
      } | null;

      if (!response.ok || result?.status !== "success") {
        setState((current) => ({
          ...current,
          status: "error",
          message:
            result?.message ||
            `Rating save failed with status ${response.status}.`,
        }));
        return;
      }

      setState({
        status: "success",
        averageRating: result.average_rating ?? null,
        ratingCount: result.rating_count || 0,
        myRating: result.my_rating ?? rating,
        canRate: Boolean(result.can_rate),
        message: result.message || "Your rating was saved.",
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        message: error instanceof Error ? error.message : "Rating save failed.",
      }));
    }
  }

  const averageText =
    state.averageRating === null
      ? "No listener ratings yet"
      : `${state.averageRating.toFixed(1)} / 5 from ${state.ratingCount} ${
          state.ratingCount === 1 ? "rating" : "ratings"
        }`;

  return (
    <div
      style={{
        display: "grid",
        gap: compact ? "0.3rem" : "0.5rem",
      }}
    >
      <div
        aria-label={averageText}
        style={{
          display: "flex",
          gap: compact ? "0.2rem" : "0.3rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = (state.myRating || 0) >= rating;

          return (
            <button
              key={rating}
              type="button"
              aria-label={`Rate this song ${rating} out of 5`}
              title={
                state.canRate
                  ? `Rate ${rating} out of 5`
                  : "Sign in to rate this song"
              }
              onClick={() => {
                void saveRating(rating);
              }}
              disabled={!state.canRate || state.status === "saving"}
              style={{
                border: 0,
                background: "transparent",
                padding: compact ? "0.1rem" : "0.15rem",
                cursor:
                  !state.canRate || state.status === "saving"
                    ? "not-allowed"
                    : "pointer",
                fontSize: compact ? "1.15rem" : "1.45rem",
                lineHeight: 1,
                color: selected ? "#f2c14e" : "rgba(255,255,255,0.42)",
              }}
            >
              {selected ? "★" : "☆"}
            </button>
          );
        })}

        <span
          className="copy"
          style={{ fontSize: compact ? "0.82rem" : "0.9rem" }}
        >
          {averageText}
        </span>
      </div>

      {!state.canRate && state.status !== "loading" ? (
        <div className="copy" style={{ fontSize: "0.82rem", opacity: 0.8 }}>
          Sign in to add your rating.
        </div>
      ) : null}

      {state.message ? (
        <div
          className="copy"
          role="status"
          style={{
            fontSize: "0.82rem",
            color: state.status === "error" ? "#ffb4b4" : "#d9f7d6",
          }}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
