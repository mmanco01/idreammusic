import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  PRODUCTION_CREDIT_FIELDS,
  PRODUCTION_CREDIT_LABELS,
  isProductionCreditKey,
  type ProductionCreditRow,
} from "@/lib/production-credits";

type ProductionCreditsProps = {
  credits: ProductionCreditRow[];
  versionLabel?: string | null;
  defaultOpen?: boolean;
};

export function ProductionCredits({
  credits,
  versionLabel,
  defaultOpen = false,
}: ProductionCreditsProps) {
  const visibleCredits = credits
    .filter(
      (credit) =>
        isProductionCreditKey(credit.role_key) &&
        Boolean(credit.credit_value?.trim()),
    )
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );

  if (!visibleCredits.length) {
    return null;
  }

  return (
    <details
      className="card"
      open={defaultOpen}
      style={{
        border: "1px solid rgba(220, 182, 92, 0.38)",
        background:
          "linear-gradient(145deg, rgba(151, 106, 40, 0.10), rgba(255,255,255,0.025))",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStylePosition: "outside",
        }}
      >
        <span className="eyebrow">
          Human &amp; Creative Technology Credits
        </span>

        <span
          className="h3"
          style={{
            display: "block",
            marginTop: "0.35rem",
          }}
        >
          See how this recording was made
        </span>
      </summary>

      <p className="copy" style={{ maxWidth: 850 }}>
        This song was human-written and creatively directed,
        with selected technology used for music, voice, visual,
        or production assistance where listed.
      </p>

      {versionLabel ? (
        <div className="pillRow" style={{ marginBottom: "0.8rem" }}>
          <span className="pill">{versionLabel}</span>
          <span className="pill">Transparent production record</span>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: "0.75rem",
        }}
      >
        {visibleCredits.map((credit) => (
          <div
            key={credit.role_key}
            style={{
              padding: "0.85rem",
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "rgba(0,0,0,0.11)",
            }}
          >
            <div className="eyebrow">
              {PRODUCTION_CREDIT_LABELS[credit.role_key]}
            </div>

            <p
              className="copy"
              style={{
                margin: "0.35rem 0 0",
                whiteSpace: "pre-wrap",
              }}
            >
              {credit.credit_value}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

type PublicProductionCreditsProps = {
  songId: string;
  songVersionId?: string | null;
  versionNumber?: number | null;
  defaultOpen?: boolean;
};

export async function PublicProductionCredits({
  songId,
  songVersionId,
  versionNumber,
  defaultOpen = false,
}: PublicProductionCreditsProps) {
  if (!songVersionId) {
    return null;
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from("song_version_credits")
    .select(
      "id, song_id, song_version_id, role_key, credit_value, is_public, sort_order",
    )
    .eq("song_id", songId)
    .eq("song_version_id", songVersionId)
    .eq("is_public", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(
      "Unable to load public production credits:",
      error.message,
    );
    return null;
  }

  return (
    <ProductionCredits
      credits={(data ?? []) as ProductionCreditRow[]}
      versionLabel={
        versionNumber ? `Version ${versionNumber}` : null
      }
      defaultOpen={defaultOpen}
    />
  );
}
