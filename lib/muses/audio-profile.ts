import OpenAI from "openai";

export const MUSE_AUDIO_ANALYSIS_VERSION =
  "muse-audio-profile-v1";

export type MuseAudioProfileStatus =
  | "pending"
  | "processing"
  | "ready"
  | "error";

export type AudioEvidenceLevel =
  | "observed"
  | "estimated"
  | "inferred"
  | "requires_stems"
  | "requires_live_recording";

export type TimedAudioEvidence = {
  statement: string;
  timestamps: string[];
  evidenceLevel: AudioEvidenceLevel;
  confidence: number;
};

export type MuseAudioProfile = {
  evidenceDeclaration: {
    audioAnalyzed: boolean;
    sourceFormat: string;
    fullMixOnly: boolean;
    stemsAvailable: boolean;
    limitations: string[];
  };
  overview: {
    summary: string;
    durationSecondsEstimate: number | null;
    overallConfidence: number;
  };
  tempo: {
    bpmEstimate: number | null;
    lowEstimate: number | null;
    highEstimate: number | null;
    feel: string;
    stability: string;
    confidence: number;
  };
  meter: {
    primary: string;
    alternatives: string[];
    confidence: number;
  };
  physicalCenter: TimedAudioEvidence;
  pulse: TimedAudioEvidence;
  pocket: TimedAudioEvidence;
  motion: TimedAudioEvidence;
  participation: TimedAudioEvidence;
  release: TimedAudioEvidence;
  rhythmicLayers: {
    drums: TimedAudioEvidence;
    bass: TimedAudioEvidence;
    rhythmInstruments: TimedAudioEvidence;
    leadVocal: TimedAudioEvidence;
    backingVocals: TimedAudioEvidence;
  };
  vocalPlacement: {
    overall: string;
    sectionNotes: Array<{
      section: string;
      placement: string;
      timestamps: string[];
      confidence: number;
    }>;
    confidence: number;
  };
  sections: Array<{
    label: string;
    start: string;
    end: string;
    energy: number;
    movement: string;
    transition: string;
    confidence: number;
  }>;
  chorusChange: {
    summary: string;
    movementChange: string;
    densityChange: string;
    evidence: string[];
    timestamps: string[];
    confidence: number;
  };
  repetition: {
    summary: string;
    functions: string[];
    fatigueRisk: string;
    timestamps: string[];
    confidence: number;
  };
  movementGap: {
    type: string;
    summary: string;
    evidence: string[];
    timestamps: string[];
    confidence: number;
  };
  arrangementSpace: {
    summary: string;
    crowdingRisks: string[];
    removalCandidates: string[];
    confidence: number;
  };
  lineage: {
    evidenced: string[];
    suggestedOnly: string[];
    notSupported: string[];
    confidence: number;
  };
  settingTests: {
    headphones: string;
    fullBandLive: string;
    audienceParticipation: string;
  };
  observations: Array<{
    label: string;
    statement: string;
    timestamps: string[];
    evidenceLevel: AudioEvidenceLevel;
    confidence: number;
  }>;
  unresolvedAudioQuestions: string[];
};

export type ResolvedAudioSource = {
  attachmentId: string;
  songId: string;
  songVersionId: string;
  filename: string;
  mimeType: string;
  format: "wav" | "mp3";
  url: string;
  attachment: Record<string, unknown>;
};

type ResolveAudioSourceArgs = {
  supabase: any;
  userId: string;
  songId: string;
  attachmentId?: string;
};

function cleanString(
  value: unknown,
  fallback = "",
) {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function firstString(
  row: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = cleanString(row[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function isAudioAttachment(
  row: Record<string, unknown>,
) {
  const mime = firstString(row, [
    "mime_type",
    "content_type",
    "media_type",
  ]).toLowerCase();

  const type = firstString(row, [
    "attachment_type",
    "type",
    "kind",
    "category",
  ]).toLowerCase();

  const filename = firstString(row, [
    "filename",
    "file_name",
    "name",
    "original_filename",
  ]).toLowerCase();

  return (
    mime.startsWith("audio/") ||
    type.includes("audio") ||
    /\.(mp3|wav)$/i.test(filename)
  );
}

function resolveAudioFormat({
  filename,
  mimeType,
  url,
}: {
  filename: string;
  mimeType: string;
  url: string;
}): "wav" | "mp3" {
  const haystack =
    `${filename} ${mimeType} ${url}`.toLowerCase();

  if (
    haystack.includes("audio/wav") ||
    haystack.includes("audio/x-wav") ||
    /\.wav(?:$|\?)/i.test(url) ||
    /\.wav$/i.test(filename)
  ) {
    return "wav";
  }

  if (
    haystack.includes("audio/mpeg") ||
    haystack.includes("audio/mp3") ||
    /\.mp3(?:$|\?)/i.test(url) ||
    /\.mp3$/i.test(filename)
  ) {
    return "mp3";
  }

  throw new Error(
    "The Audio Bridge currently accepts MP3 or WAV files. Convert this recording to MP3 or WAV and attach it to the song version.",
  );
}

async function loadOwnedSongAndVersion({
  supabase,
  userId,
  songId,
}: {
  supabase: any;
  userId: string;
  songId: string;
}) {
  const { data: song, error } = await supabase
    .from("songs")
    .select(`
      id,
      title_working,
      title_final,
      owner_user_id,
      song_versions (
        id,
        version_number,
        is_stage_primary,
        lyrics,
        arrangement_notes,
        created_at
      )
    `)
    .eq("id", songId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load the song for audio analysis: ${error.message}`,
    );
  }

  if (!song) {
    throw new Error(
      "The song was not found or does not belong to you.",
    );
  }

  const versions = Array.isArray(song.song_versions)
    ? [...song.song_versions].sort((a: any, b: any) => {
        if (
          a.is_stage_primary &&
          !b.is_stage_primary
        ) {
          return -1;
        }

        if (
          !a.is_stage_primary &&
          b.is_stage_primary
        ) {
          return 1;
        }

        return (
          Number(b.version_number ?? 0) -
          Number(a.version_number ?? 0)
        );
      })
    : [];

  const currentVersion = versions[0] ?? null;

  if (!currentVersion) {
    throw new Error(
      "This song does not have a current version to analyze.",
    );
  }

  return {
    song,
    currentVersion,
  };
}

async function findAttachmentId({
  supabase,
  songId,
  songVersionId,
  explicitAttachmentId,
}: {
  supabase: any;
  songId: string;
  songVersionId: string;
  explicitAttachmentId?: string;
}) {
  if (explicitAttachmentId) {
    return explicitAttachmentId;
  }

  const { data: transcripts } = await supabase
    .from("song_transcripts")
    .select(
      "attachment_id, song_version_id, updated_at, created_at",
    )
    .eq("song_id", songId)
    .order("updated_at", {
      ascending: false,
    })
    .limit(12);

  const transcriptAttachment =
    (transcripts ?? []).find(
      (row: any) =>
        row.song_version_id === songVersionId &&
        row.attachment_id,
    ) ??
    (transcripts ?? []).find(
      (row: any) => row.attachment_id,
    );

  if (transcriptAttachment?.attachment_id) {
    return String(
      transcriptAttachment.attachment_id,
    );
  }

  const versionAttempt = await supabase
    .from("attachments")
    .select("*")
    .eq("song_version_id", songVersionId)
    .limit(30);

  if (!versionAttempt.error) {
    const candidate =
      (versionAttempt.data ?? []).find(
        (row: Record<string, unknown>) =>
          isAudioAttachment(row),
      );

    if (candidate?.id) {
      return String(candidate.id);
    }
  }

  const songAttempt = await supabase
    .from("attachments")
    .select("*")
    .eq("song_id", songId)
    .limit(30);

  if (!songAttempt.error) {
    const candidate =
      (songAttempt.data ?? []).find(
        (row: Record<string, unknown>) =>
          isAudioAttachment(row),
      );

    if (candidate?.id) {
      return String(candidate.id);
    }
  }

  throw new Error(
    "No audio attachment could be resolved for the current song version. Attach an MP3 or WAV and, when possible, run transcription once so the attachment is linked to the version.",
  );
}

async function resolveAttachmentUrl({
  supabase,
  attachment,
}: {
  supabase: any;
  attachment: Record<string, unknown>;
}) {
  const directUrl = firstString(attachment, [
    "signed_url",
    "public_url",
    "file_url",
    "audio_url",
    "download_url",
    "url",
  ]);

  if (directUrl) {
    const parsed = new URL(directUrl);

    if (
      parsed.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !==
          "production" &&
        parsed.protocol === "http:"
      )
    ) {
      throw new Error(
        "The stored audio URL must use HTTPS.",
      );
    }

    return directUrl;
  }

  const storagePath = firstString(attachment, [
    "storage_path",
    "file_path",
    "object_path",
    "storage_key",
    "path",
  ]);

  if (!storagePath) {
    throw new Error(
      "The attachment row was found, but it contains neither a usable audio URL nor a recognized storage path.",
    );
  }

  const storedBucket = firstString(attachment, [
    "storage_bucket",
    "bucket_name",
    "bucket",
  ]);

  const bucketCandidates = Array.from(
    new Set(
      [
        storedBucket,
        process.env
          .MUSE_AUDIO_STORAGE_BUCKET,
        "song-audio",
        "attachments",
      ].filter(Boolean),
    ),
  ) as string[];

  const signedErrors: string[] = [];

  for (const bucket of bucketCandidates) {
    const { data, error } =
      await supabase.storage
        .from(bucket)
        .createSignedUrl(
          storagePath,
          15 * 60,
        );

    if (
      !error &&
      data?.signedUrl
    ) {
      return data.signedUrl;
    }

    signedErrors.push(
      `${bucket}: ${
        error?.message ?? "not found"
      }`,
    );
  }

  throw new Error(
    `The audio storage path could not be signed. Tried ${bucketCandidates.join(
      ", ",
    )}. ${signedErrors.join(" | ")}`,
  );
}

export async function resolveAudioSource({
  supabase,
  userId,
  songId,
  attachmentId,
}: ResolveAudioSourceArgs): Promise<ResolvedAudioSource> {
  const { currentVersion } =
    await loadOwnedSongAndVersion({
      supabase,
      userId,
      songId,
    });

  const resolvedAttachmentId =
    await findAttachmentId({
      supabase,
      songId,
      songVersionId:
        currentVersion.id,
      explicitAttachmentId:
        attachmentId,
    });

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", resolvedAttachmentId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load the audio attachment: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "The resolved audio attachment was not found.",
    );
  }

  const attachment =
    data as Record<string, unknown>;

  const rowOwner = firstString(attachment, [
    "owner_user_id",
    "user_id",
  ]);

  const rowSong = firstString(attachment, [
    "song_id",
  ]);

  const rowVersion = firstString(
    attachment,
    ["song_version_id"],
  );

  if (rowOwner && rowOwner !== userId) {
    throw new Error(
      "The audio attachment does not belong to the signed-in user.",
    );
  }

  if (rowSong && rowSong !== songId) {
    throw new Error(
      "The audio attachment does not belong to this song.",
    );
  }

  if (
    rowVersion &&
    rowVersion !== currentVersion.id
  ) {
    throw new Error(
      "The audio attachment belongs to a different song version.",
    );
  }

  if (!isAudioAttachment(attachment)) {
    throw new Error(
      "The linked attachment does not appear to be an audio file.",
    );
  }

  const url = await resolveAttachmentUrl({
    supabase,
    attachment,
  });

  const filename =
    firstString(attachment, [
      "filename",
      "file_name",
      "name",
      "original_filename",
    ]) || "song-audio";

  const mimeType =
    firstString(attachment, [
      "mime_type",
      "content_type",
      "media_type",
    ]) || "application/octet-stream";

  return {
    attachmentId:
      resolvedAttachmentId,
    songId,
    songVersionId:
      currentVersion.id,
    filename,
    mimeType,
    format: resolveAudioFormat({
      filename,
      mimeType,
      url,
    }),
    url,
    attachment,
  };
}

function clampConfidence(
  value: unknown,
  fallback = 0,
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    1,
    Math.max(0, number),
  );
}

function cleanStringArray(
  value: unknown,
  maxItems = 12,
) {
  return Array.isArray(value)
    ? value
        .map((item) =>
          cleanString(item),
        )
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function normalizeTimedEvidence(
  value: any,
): TimedAudioEvidence {
  const allowedLevels =
    new Set<AudioEvidenceLevel>([
      "observed",
      "estimated",
      "inferred",
      "requires_stems",
      "requires_live_recording",
    ]);

  const evidenceLevel =
    allowedLevels.has(
      value?.evidenceLevel,
    )
      ? value.evidenceLevel
      : "inferred";

  return {
    statement:
      cleanString(value?.statement) ||
      "No reliable observation returned.",
    timestamps: cleanStringArray(
      value?.timestamps,
      8,
    ),
    evidenceLevel,
    confidence: clampConfidence(
      value?.confidence,
    ),
  };
}

function normalizeAudioProfile(
  value: any,
  sourceFormat: string,
): MuseAudioProfile {
  const timedKeys = [
    "physicalCenter",
    "pulse",
    "pocket",
    "motion",
    "participation",
    "release",
  ] as const;

  const timed: Record<
    string,
    TimedAudioEvidence
  > = {};

  for (const key of timedKeys) {
    timed[key] =
      normalizeTimedEvidence(
        value?.[key],
      );
  }

  const layers =
    value?.rhythmicLayers ?? {};

  return {
    evidenceDeclaration: {
      audioAnalyzed: true,
      sourceFormat,
      fullMixOnly: true,
      stemsAvailable: false,
      limitations: Array.from(
        new Set([
          ...cleanStringArray(
            value?.evidenceDeclaration
              ?.limitations,
            10,
          ),
          "This profile is derived from the full mix, not isolated stems.",
          "Tempo, meter, instrument roles, section boundaries, and microtiming remain estimates unless separately verified.",
          "The Muse chat receives this saved profile rather than the raw audio file.",
        ]),
      ),
    },
    overview: {
      summary:
        cleanString(
          value?.overview?.summary,
        ) ||
        "Audio profile completed.",
      durationSecondsEstimate:
        Number.isFinite(
          Number(
            value?.overview
              ?.durationSecondsEstimate,
          ),
        )
          ? Number(
              value.overview
                .durationSecondsEstimate,
            )
          : null,
      overallConfidence:
        clampConfidence(
          value?.overview
            ?.overallConfidence,
        ),
    },
    tempo: {
      bpmEstimate:
        Number.isFinite(
          Number(
            value?.tempo?.bpmEstimate,
          ),
        )
          ? Number(
              value.tempo.bpmEstimate,
            )
          : null,
      lowEstimate:
        Number.isFinite(
          Number(
            value?.tempo?.lowEstimate,
          ),
        )
          ? Number(
              value.tempo.lowEstimate,
            )
          : null,
      highEstimate:
        Number.isFinite(
          Number(
            value?.tempo?.highEstimate,
          ),
        )
          ? Number(
              value.tempo.highEstimate,
            )
          : null,
      feel: cleanString(
        value?.tempo?.feel,
      ),
      stability: cleanString(
        value?.tempo?.stability,
      ),
      confidence: clampConfidence(
        value?.tempo?.confidence,
      ),
    },
    meter: {
      primary: cleanString(
        value?.meter?.primary,
        "unknown",
      ),
      alternatives: cleanStringArray(
        value?.meter?.alternatives,
        4,
      ),
      confidence: clampConfidence(
        value?.meter?.confidence,
      ),
    },
    physicalCenter:
      timed.physicalCenter,
    pulse: timed.pulse,
    pocket: timed.pocket,
    motion: timed.motion,
    participation:
      timed.participation,
    release: timed.release,
    rhythmicLayers: {
      drums: normalizeTimedEvidence(
        layers.drums,
      ),
      bass: normalizeTimedEvidence(
        layers.bass,
      ),
      rhythmInstruments:
        normalizeTimedEvidence(
          layers.rhythmInstruments,
        ),
      leadVocal:
        normalizeTimedEvidence(
          layers.leadVocal,
        ),
      backingVocals:
        normalizeTimedEvidence(
          layers.backingVocals,
        ),
    },
    vocalPlacement: {
      overall: cleanString(
        value?.vocalPlacement?.overall,
      ),
      sectionNotes: Array.isArray(
        value?.vocalPlacement
          ?.sectionNotes,
      )
        ? value.vocalPlacement.sectionNotes
            .map((item: any) => ({
              section: cleanString(
                item?.section,
              ),
              placement: cleanString(
                item?.placement,
              ),
              timestamps:
                cleanStringArray(
                  item?.timestamps,
                  5,
                ),
              confidence:
                clampConfidence(
                  item?.confidence,
                ),
            }))
            .filter(
              (item: any) =>
                item.section ||
                item.placement,
            )
            .slice(0, 12)
        : [],
      confidence: clampConfidence(
        value?.vocalPlacement
          ?.confidence,
      ),
    },
    sections: Array.isArray(
      value?.sections,
    )
      ? value.sections
          .map((item: any) => ({
            label: cleanString(
              item?.label,
              "section",
            ),
            start: cleanString(
              item?.start,
            ),
            end: cleanString(
              item?.end,
            ),
            energy: Math.min(
              100,
              Math.max(
                0,
                Number(
                  item?.energy ?? 0,
                ),
              ),
            ),
            movement: cleanString(
              item?.movement,
            ),
            transition: cleanString(
              item?.transition,
            ),
            confidence:
              clampConfidence(
                item?.confidence,
              ),
          }))
          .slice(0, 20)
      : [],
    chorusChange: {
      summary: cleanString(
        value?.chorusChange?.summary,
      ),
      movementChange: cleanString(
        value?.chorusChange
          ?.movementChange,
      ),
      densityChange: cleanString(
        value?.chorusChange
          ?.densityChange,
      ),
      evidence: cleanStringArray(
        value?.chorusChange?.evidence,
        8,
      ),
      timestamps: cleanStringArray(
        value?.chorusChange
          ?.timestamps,
        8,
      ),
      confidence: clampConfidence(
        value?.chorusChange
          ?.confidence,
      ),
    },
    repetition: {
      summary: cleanString(
        value?.repetition?.summary,
      ),
      functions: cleanStringArray(
        value?.repetition?.functions,
        8,
      ),
      fatigueRisk: cleanString(
        value?.repetition
          ?.fatigueRisk,
      ),
      timestamps: cleanStringArray(
        value?.repetition
          ?.timestamps,
        8,
      ),
      confidence: clampConfidence(
        value?.repetition
          ?.confidence,
      ),
    },
    movementGap: {
      type: cleanString(
        value?.movementGap?.type,
        "unknown",
      ),
      summary: cleanString(
        value?.movementGap?.summary,
      ),
      evidence: cleanStringArray(
        value?.movementGap?.evidence,
        8,
      ),
      timestamps: cleanStringArray(
        value?.movementGap
          ?.timestamps,
        8,
      ),
      confidence: clampConfidence(
        value?.movementGap
          ?.confidence,
      ),
    },
    arrangementSpace: {
      summary: cleanString(
        value?.arrangementSpace
          ?.summary,
      ),
      crowdingRisks:
        cleanStringArray(
          value?.arrangementSpace
            ?.crowdingRisks,
          8,
        ),
      removalCandidates:
        cleanStringArray(
          value?.arrangementSpace
            ?.removalCandidates,
          8,
        ),
      confidence: clampConfidence(
        value?.arrangementSpace
          ?.confidence,
      ),
    },
    lineage: {
      evidenced: cleanStringArray(
        value?.lineage?.evidenced,
        8,
      ),
      suggestedOnly:
        cleanStringArray(
          value?.lineage
            ?.suggestedOnly,
          8,
        ),
      notSupported:
        cleanStringArray(
          value?.lineage
            ?.notSupported,
          8,
        ),
      confidence: clampConfidence(
        value?.lineage?.confidence,
      ),
    },
    settingTests: {
      headphones: cleanString(
        value?.settingTests
          ?.headphones,
      ),
      fullBandLive: cleanString(
        value?.settingTests
          ?.fullBandLive,
      ),
      audienceParticipation:
        cleanString(
          value?.settingTests
            ?.audienceParticipation,
        ),
    },
    observations: Array.isArray(
      value?.observations,
    )
      ? value.observations
          .map((item: any) => {
            const normalized =
              normalizeTimedEvidence(
                item,
              );

            return {
              label: cleanString(
                item?.label,
                "Audio observation",
              ),
              ...normalized,
            };
          })
          .slice(0, 16)
      : [],
    unresolvedAudioQuestions:
      cleanStringArray(
        value?.unresolvedAudioQuestions,
        10,
      ),
  } as MuseAudioProfile;
}

function extractJson(
  raw: string,
) {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const start =
    withoutFence.indexOf("{");
  const end =
    withoutFence.lastIndexOf("}");

  if (
    start < 0 ||
    end <= start
  ) {
    throw new Error(
      "The audio model did not return a JSON object.",
    );
  }

  return JSON.parse(
    withoutFence.slice(
      start,
      end + 1,
    ),
  );
}

function buildAudioPrompt({
  songTitle,
  lyrics,
  arrangementNotes,
}: {
  songTitle: string;
  lyrics?: string | null;
  arrangementNotes?: string | null;
}) {
  return `
You are creating an evidence-disciplined audio profile for iDreamMusic.
Listen to the complete attached song recording.

Song title:
${songTitle}

Saved lyrics or transcript, when available:
${lyrics || "Not supplied."}

Saved arrangement notes, when available:
${arrangementNotes || "Not supplied."}

Return ONLY one valid JSON object. No markdown and no commentary.

Important boundaries:
- You are hearing a full stereo or mono mix, not isolated stems.
- Tempo, meter, instrument identity, section boundary, vocal placement,
  and microtiming are estimates. Use confidence honestly.
- Do not claim exact stem behavior when parts cannot be isolated.
- Do not infer a specific cultural lineage from generic rhythmic features.
- Distinguish evidenced lineage, suggested possibilities, and traditions
  not supported by the recording.
- Do not equate loudness or density with groove.
- Do not assume all listeners move identically.
- Timestamps must be M:SS or M:SS–M:SS and should be approximate.
- Do not reproduce long copyrighted lyrics.

Use exactly these top-level keys:
evidenceDeclaration, overview, tempo, meter, physicalCenter, pulse,
pocket, motion, participation, release, rhythmicLayers, vocalPlacement,
sections, chorusChange, repetition, movementGap, arrangementSpace,
lineage, settingTests, observations, unresolvedAudioQuestions.

Required shapes:

evidenceDeclaration:
{
  "limitations": ["..."]
}

overview:
{
  "summary": "...",
  "durationSecondsEstimate": number or null,
  "overallConfidence": 0 to 1
}

tempo:
{
  "bpmEstimate": number or null,
  "lowEstimate": number or null,
  "highEstimate": number or null,
  "feel": "...",
  "stability": "...",
  "confidence": 0 to 1
}

meter:
{
  "primary": "...",
  "alternatives": ["..."],
  "confidence": 0 to 1
}

physicalCenter, pulse, pocket, motion, participation, release,
and each rhythmicLayers item:
{
  "statement": "...",
  "timestamps": ["M:SS"],
  "evidenceLevel": "observed" | "estimated" | "inferred" |
                   "requires_stems" | "requires_live_recording",
  "confidence": 0 to 1
}

rhythmicLayers:
{
  "drums": timed evidence,
  "bass": timed evidence,
  "rhythmInstruments": timed evidence,
  "leadVocal": timed evidence,
  "backingVocals": timed evidence
}

vocalPlacement:
{
  "overall": "...",
  "sectionNotes": [
    {
      "section": "...",
      "placement": "ahead / behind / centered / mixed / unclear, with explanation",
      "timestamps": ["M:SS"],
      "confidence": 0 to 1
    }
  ],
  "confidence": 0 to 1
}

sections:
[
  {
    "label": "...",
    "start": "M:SS",
    "end": "M:SS",
    "energy": 0 to 100,
    "movement": "...",
    "transition": "...",
    "confidence": 0 to 1
  }
]

chorusChange:
{
  "summary": "...",
  "movementChange": "...",
  "densityChange": "...",
  "evidence": ["..."],
  "timestamps": ["M:SS"],
  "confidence": 0 to 1
}

repetition:
{
  "summary": "...",
  "functions": ["groove", "tension", "trance", "participation", "fatigue", "..."],
  "fatigueRisk": "...",
  "timestamps": ["M:SS"],
  "confidence": 0 to 1
}

movementGap:
{
  "type": "pulse_obscured | lyric_fighting_pocket |
           syncopation_without_anchor | layers_competing |
           chorus_energy_without_movement | repetition_without_participation |
           break_without_internal_pulse | release_without_reentry |
           arrangement_crowding_body | genre_movement_mismatch |
           audience_cue_missing | no_major_gap | other",
  "summary": "...",
  "evidence": ["..."],
  "timestamps": ["M:SS"],
  "confidence": 0 to 1
}

arrangementSpace:
{
  "summary": "...",
  "crowdingRisks": ["..."],
  "removalCandidates": ["..."],
  "confidence": 0 to 1
}

lineage:
{
  "evidenced": ["Only what the audio strongly supports"],
  "suggestedOnly": ["Possibilities requiring context"],
  "notSupported": ["Specific traditions the audio does not establish"],
  "confidence": 0 to 1
}

settingTests:
{
  "headphones": "...",
  "fullBandLive": "...",
  "audienceParticipation": "..."
}

observations:
[
  {
    "label": "...",
    "statement": "...",
    "timestamps": ["M:SS"],
    "evidenceLevel": "observed" | "estimated" | "inferred" |
                     "requires_stems" | "requires_live_recording",
    "confidence": 0 to 1
  }
]

unresolvedAudioQuestions:
["What stems, tempo map, live recording, or production detail would change the judgment?"]

Be specific, compact, and evidence-led.
  `.trim();
}

async function callAudioModel({
  openai,
  model,
  base64Audio,
  format,
  prompt,
}: {
  openai: OpenAI;
  model: string;
  base64Audio: string;
  format: "wav" | "mp3";
  prompt: string;
}) {
  const attempts = [
    prompt,
    `${prompt}

RETRY REQUIREMENT:
The previous output was not valid JSON. Return a fresh complete JSON object
from the beginning. No markdown fences and no text outside the JSON.`,
  ];

  let lastError: unknown = null;

  for (
    let index = 0;
    index < attempts.length;
    index += 1
  ) {
    try {
      const response =
        await openai.chat.completions.create(
          {
            model,
            modalities: ["text"],
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: attempts[index],
                  },
                  {
                    type: "input_audio",
                    input_audio: {
                      data: base64Audio,
                      format,
                    },
                  },
                ],
              },
            ],
            max_completion_tokens: 6000,
            store: false,
          } as any,
        );

      const content =
        response.choices[0]?.message
          ?.content;

      if (
        typeof content !== "string" ||
        !content.trim()
      ) {
        throw new Error(
          "The audio model returned no text profile.",
        );
      }

      return {
        raw: content,
        parsed: extractJson(content),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        "The audio model could not create a valid profile.",
      );
}

export async function analyzeAudioBuffer({
  openai,
  model,
  buffer,
  format,
  songTitle,
  lyrics,
  arrangementNotes,
}: {
  openai: OpenAI;
  model: string;
  buffer: Buffer;
  format: "wav" | "mp3";
  songTitle: string;
  lyrics?: string | null;
  arrangementNotes?: string | null;
}) {
  const base64Audio =
    buffer.toString("base64");

  const result =
    await callAudioModel({
      openai,
      model,
      base64Audio,
      format,
      prompt: buildAudioPrompt({
        songTitle,
        lyrics,
        arrangementNotes,
      }),
    });

  return {
    rawModelOutput: result.raw,
    profile: normalizeAudioProfile(
      result.parsed,
      format,
    ),
  };
}

export async function downloadAudio({
  source,
}: {
  source: ResolvedAudioSource;
}) {
  const maxBytes = Math.max(
    1_000_000,
    Number(
      process.env
        .MUSE_AUDIO_MAX_BYTES ??
        20 * 1024 * 1024,
    ),
  );

  const response = await fetch(
    source.url,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(
        120_000,
      ),
    },
  );

  if (!response.ok) {
    throw new Error(
      `The audio file could not be downloaded (${response.status}).`,
    );
  }

  const contentLength = Number(
    response.headers.get(
      "content-length",
    ) ?? 0,
  );

  if (
    contentLength > 0 &&
    contentLength > maxBytes
  ) {
    throw new Error(
      `The audio file is ${Math.ceil(
        contentLength / 1024 / 1024,
      )} MB. The current Audio Bridge limit is ${Math.floor(
        maxBytes / 1024 / 1024,
      )} MB. Upload a compressed MP3 or raise MUSE_AUDIO_MAX_BYTES.`,
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer(),
  );

  if (buffer.byteLength > maxBytes) {
    throw new Error(
      `The downloaded audio is ${Math.ceil(
        buffer.byteLength /
          1024 /
          1024,
      )} MB. The current Audio Bridge limit is ${Math.floor(
        maxBytes / 1024 / 1024,
      )} MB.`,
    );
  }

  return buffer;
}
