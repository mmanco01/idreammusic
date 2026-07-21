"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type AudioProfileResponse = {
  status?: string;
  message?: string;
  reused?: boolean;
  profile?: {
    id: string;
    status:
      | "pending"
      | "processing"
      | "ready"
      | "error";
    modelName?: string | null;
    sourceFilename?: string | null;
    sourceFormat?: string | null;
    sourceBytes?: number | null;
    profile?: {
      overview?: {
        summary?: string;
        overallConfidence?: number;
      };
      tempo?: {
        bpmEstimate?: number | null;
        lowEstimate?: number | null;
        highEstimate?: number | null;
        confidence?: number;
      };
      meter?: {
        primary?: string;
        confidence?: number;
      };
      movementGap?: {
        type?: string;
        summary?: string;
        confidence?: number;
      };
      physicalCenter?: {
        statement?: string;
        confidence?: number;
      };
    } | null;
    errorMessage?: string | null;
    completedAt?: string | null;
    updatedAt?: string | null;
  } | null;
};

function percent(
  value: unknown,
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return `${Math.round(
    Math.min(
      1,
      Math.max(0, number),
    ) * 100,
  )}%`;
}

function bytesLabel(
  value: unknown,
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  return `${(
    number /
    1024 /
    1024
  ).toFixed(1)} MB`;
}

export function MuseAudioBridgeCard({
  songId,
}: {
  songId: string;
}) {
  const [result, setResult] =
    useState<AudioProfileResponse | null>(
      null,
    );
  const [status, setStatus] =
    useState<
      "loading" | "idle" | "analyzing" | "error"
    >("loading");
  const [message, setMessage] =
    useState("");

  const loadStatus =
    useCallback(async () => {
      setStatus("loading");
      setMessage("");

      try {
        const params =
          new URLSearchParams({
            songId,
          });

        const response = await fetch(
          `/api/muses/audio-profile?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          (await response
            .json()
            .catch(() => null)) as
            | AudioProfileResponse
            | null;

        if (
          !response.ok ||
          data?.status !== "success"
        ) {
          throw new Error(
            data?.message ||
              "Audio Bridge status could not be loaded.",
          );
        }

        setResult(data);
        setStatus("idle");
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Audio Bridge status could not be loaded.",
        );
      }
    }, [songId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function analyze(
    force: boolean,
  ) {
    if (status === "analyzing") {
      return;
    }

    setStatus("analyzing");
    setMessage("");

    try {
      const response = await fetch(
        "/api/muses/audio-profile",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            songId,
            force,
          }),
        },
      );

      const data =
        (await response
          .json()
          .catch(() => null)) as
          | AudioProfileResponse
          | null;

      if (
        !response.ok ||
        data?.status !== "success" ||
        !data.profile
      ) {
        throw new Error(
          data?.message ||
            "Audio analysis failed.",
        );
      }

      setResult(data);
      setStatus("idle");
      setMessage(
        data.reused
          ? "The saved audio profile is already current."
          : "Audio profile saved. The Muses can use it in the next question.",
      );

      window.dispatchEvent(
        new CustomEvent(
          "muse-audio-profile-updated",
          {
            detail: {
              songId,
              profileId:
                data.profile.id,
            },
          },
        ),
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Audio analysis failed.",
      );
    }
  }

  const profile = result?.profile;
  const profileData =
    profile?.profile ?? null;
  const ready =
    profile?.status === "ready";

  return (
    <div
      style={{
        marginTop: "0.9rem",
        padding: "0.9rem",
        border:
          "1px solid rgba(111, 171, 197, 0.42)",
        borderRadius: 14,
        background:
          "linear-gradient(145deg, rgba(40, 105, 132, 0.14), rgba(255,255,255,0.02))",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "0.7rem",
        }}
      >
        <div>
          <div className="eyebrow">
            Muse Audio Bridge
          </div>
          <p
            className="copy"
            style={{
              margin: "0.3rem 0 0",
              fontSize: "0.88rem",
            }}
          >
            {status === "loading"
              ? "Checking the current song version…"
              : ready
                ? "A saved audio-derived profile is available to every Muse."
                : "Analyze the current MP3 or WAV once, then let every Muse use the saved evidence."}
          </p>
        </div>

        <div className="button-row">
          <button
            type="button"
            className={
              ready
                ? "button"
                : "button primary"
            }
            disabled={
              status === "loading" ||
              status === "analyzing"
            }
            onClick={() =>
              void analyze(ready)
            }
          >
            {status === "analyzing"
              ? "Listening and profiling…"
              : ready
                ? "Refresh audio profile"
                : "Analyze current audio"}
          </button>
        </div>
      </div>

      {ready && profileData ? (
        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            marginTop: "0.8rem",
          }}
        >
          <p
            className="copy"
            style={{
              margin: 0,
              fontSize: "0.88rem",
            }}
          >
            <strong>
              Physical center:
            </strong>{" "}
            {profileData
              .physicalCenter
              ?.statement ||
              "Profile ready."}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.45rem",
            }}
          >
            {profileData.tempo
              ?.bpmEstimate ? (
              <span className="pill">
                Tempo ≈{" "}
                {
                  profileData.tempo
                    .bpmEstimate
                }{" "}
                BPM
                {percent(
                  profileData.tempo
                    .confidence,
                )
                  ? ` · ${percent(
                      profileData.tempo
                        .confidence,
                    )}`
                  : ""}
              </span>
            ) : null}

            {profileData.meter
              ?.primary ? (
              <span className="pill">
                Meter ≈{" "}
                {
                  profileData.meter
                    .primary
                }
              </span>
            ) : null}

            {profileData.overview
              ?.overallConfidence !==
            undefined ? (
              <span className="pill">
                Profile confidence{" "}
                {percent(
                  profileData.overview
                    .overallConfidence,
                )}
              </span>
            ) : null}

            {profile.sourceFormat ? (
              <span className="pill">
                {profile.sourceFormat.toUpperCase()}
                {profile.sourceBytes
                  ? ` · ${bytesLabel(
                      profile.sourceBytes,
                    )}`
                  : ""}
              </span>
            ) : null}
          </div>

          {profileData.movementGap
            ?.summary ? (
            <p
              className="copy"
              style={{
                margin: 0,
                fontSize: "0.84rem",
                opacity: 0.86,
              }}
            >
              <strong>
                Current Movement Gap:
              </strong>{" "}
              {
                profileData
                  .movementGap
                  .summary
              }
            </p>
          ) : null}

          <p
            className="copy"
            style={{
              margin: 0,
              fontSize: "0.78rem",
              opacity: 0.7,
            }}
          >
            {profile.sourceFilename ||
              "Current audio"}
            {profile.modelName
              ? ` · ${profile.modelName}`
              : ""}
            {profile.completedAt
              ? ` · analyzed ${new Date(
                  profile.completedAt,
                ).toLocaleString()}`
              : ""}
          </p>
        </div>
      ) : null}

      {message ? (
        <p
          className="copy"
          style={{
            margin:
              "0.65rem 0 0",
            fontSize: "0.84rem",
            color:
              status === "error"
                ? "#ffb5b5"
                : undefined,
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
