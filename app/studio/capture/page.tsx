import { muses } from "@/content/site";
import { SongUploadForm } from "@/components/studio/SongUploadForm";
import { SparkCaptureForm } from "@/components/studio/SparkCaptureForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ song?: string; stage?: string; muse?: string }>;
}) {
  const { song, stage, muse } = await searchParams;

  const selectedStage =
    stage === "draft" || stage === "final" || stage === "spark"
      ? stage
      : "spark";

  const museOptions = muses.map((museOption) => ({
    slug: museOption.slug,
    name: museOption.name,
    label: museOption.label,
  }));

  const defaultCaptureMuseSlug = museOptions.some(
    (option) => option.slug === muse,
  )
    ? muse
    : undefined;

  if (!song) {
    return (
      <section className="section-tight">
        <div className="container pageStack">
          <div className="page-intro">
            <div>
              <div className="eyebrow">Expanded Spark Capture</div>
              <h1 className="h2">Catch it before it disappears</h1>
              <p className="copy" style={{ maxWidth: 820 }}>
                Begin with words only, record directly from this device, or
                gather several recordings and documents into one private Spark.
              </p>
            </div>
          </div>

          <SparkCaptureForm
            museOptions={museOptions}
            defaultMuseSlug={defaultCaptureMuseSlug}
          />
        </div>
      </section>
    );
  }

  let existingSongMuseSlug: string | null = null;
  let existingSongTitle: string | null = null;

  const supabase = await createServerSupabaseClient();

  if (supabase) {
    const { data: existingSong } = await (supabase as any)
      .from("songs")
      .select("id, muse_id, title_working, title_final, deleted_at")
      .eq("id", song)
      .is("deleted_at", null)
      .maybeSingle();

    existingSongTitle =
      existingSong?.title_final ?? existingSong?.title_working ?? null;

    if (existingSong?.muse_id) {
      const { data: muse } = await (supabase as any)
        .from("muses")
        .select("slug")
        .eq("id", existingSong.muse_id)
        .maybeSingle();

      existingSongMuseSlug = muse?.slug ?? null;
    }
  }

  const fallbackMuseSlug = muses[0]?.slug ?? "calliope";
  const defaultMuseSlug = existingSongMuseSlug ?? fallbackMuseSlug;

  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Add version</div>
            <h1 className="h2">Add {selectedStage} version</h1>
            <p className="copy" style={{ maxWidth: 760 }}>
              You are adding a new {selectedStage} version to{" "}
              {existingSongTitle ? `“${existingSongTitle}”` : "an existing song"}.
            </p>
          </div>
        </div>

        <SongUploadForm
          museOptions={museOptions}
          existingSongId={song}
          initialStage={selectedStage}
          defaultMuseSlug={defaultMuseSlug}
          lockedMuse
        />
      </div>
    </section>
  );
}
