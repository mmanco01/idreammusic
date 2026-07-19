export const PRODUCTION_CREDIT_FIELDS = [
  {
    key: "lyrics_songwriting",
    label: "Lyrics / songwriting",
    placeholder: "Mike Mancour",
    help: "The human writer or writers responsible for the words and song.",
  },
  {
    key: "creative_direction",
    label: "Creative direction",
    placeholder: "Mike Mancour",
    help: "The person who shaped the concept, meaning, choices, and final direction.",
  },
  {
    key: "music_generation",
    label: "Music generation",
    placeholder: "Suno, Eleven Music, or another tool",
    help: "Technology used to generate the musical performance or production.",
    listId: "music-generation-tools",
  },
  {
    key: "arrangement_production",
    label: "Arrangement / production",
    placeholder: "Suno; edited and directed by Mike Mancour",
    help: "Arrangement, instrumentation, production, or substantial human production work.",
  },
  {
    key: "lead_vocal",
    label: "Lead vocal / performance",
    placeholder: "Mike Mancour",
    help: "The human performer, generated singer, or credited vocal source.",
  },
  {
    key: "voice_model",
    label: "Voice model / vocal transformation",
    placeholder: "Mike Mancour authorized voice model using Kits AI",
    help: "Voice-clone or vocal-transformation technology used with authorization.",
    listId: "voice-tools",
  },
  {
    key: "mixing_mastering",
    label: "Mixing / mastering",
    placeholder: "Tool, service, or person",
    help: "Final audio mixing, mastering, cleanup, or finishing.",
  },
  {
    key: "video_generation",
    label: "Video generation",
    placeholder: "Runway, Revid, Sondo, or another tool",
    help: "Technology used to generate scenes, animation, or the music video.",
    listId: "video-generation-tools",
  },
  {
    key: "video_editing",
    label: "Video editing / finishing",
    placeholder: "Movavi",
    help: "Editing, assembly, timing, titles, color, and final video finishing.",
    listId: "video-editing-tools",
  },
  {
    key: "artwork",
    label: "Artwork / imagery",
    placeholder: "Artist, photographer, designer, or image tool",
    help: "Cover art, photography, illustration, or generated imagery.",
  },
  {
    key: "additional_notes",
    label: "Additional production notes",
    placeholder: "Any other human or technology contribution",
    help: "Additional contributors, tools, licensing notes, or production context.",
  },
] as const;

export type ProductionCreditKey =
  (typeof PRODUCTION_CREDIT_FIELDS)[number]["key"];

export type ProductionCreditRow = {
  id?: string;
  song_id?: string;
  song_version_id?: string;
  role_key: ProductionCreditKey;
  credit_value: string;
  is_public?: boolean;
  sort_order?: number;
};

export const PRODUCTION_CREDIT_LABELS: Record<
  ProductionCreditKey,
  string
> = Object.fromEntries(
  PRODUCTION_CREDIT_FIELDS.map((field) => [
    field.key,
    field.label,
  ]),
) as Record<ProductionCreditKey, string>;

export function isProductionCreditKey(
  value: string,
): value is ProductionCreditKey {
  return PRODUCTION_CREDIT_FIELDS.some(
    (field) => field.key === value,
  );
}

export function productionCreditsToMap(
  credits: ProductionCreditRow[],
): Partial<Record<ProductionCreditKey, string>> {
  const result: Partial<Record<ProductionCreditKey, string>> = {};

  for (const credit of credits) {
    if (
      isProductionCreditKey(credit.role_key) &&
      credit.credit_value?.trim()
    ) {
      result[credit.role_key] = credit.credit_value.trim();
    }
  }

  return result;
}
