import { muses } from '@/content/site';
import { SongUploadForm } from '@/components/studio/SongUploadForm';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ song?: string; stage?: string }>;
}) {
  const { song, stage } = await searchParams;

  const selectedStage =
    stage === 'draft' || stage === 'final' || stage === 'spark'
      ? stage
      : 'spark';

  const isExistingSongFlow = Boolean(song);

  let existingSongMuseSlug: string | null = null;
  let existingSongTitle: string | null = null;

  if (song) {
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const { data: existingSong } = await supabase
        .from('songs')
        .select('id, muse_slug, title_working, title_final')
        .eq('id', song)
        .maybeSingle();

      existingSongMuseSlug = existingSong?.muse_slug ?? null;
      existingSongTitle =
        existingSong?.title_final ??
        existingSong?.title_working ??
        null;
    }
  }

  const fallbackMuseSlug = muses[0]?.slug ?? 'calliope';
  const defaultMuseSlug = existingSongMuseSlug ?? fallbackMuseSlug;

  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">
              {isExistingSongFlow ? 'Add version' : 'Quick capture'}
            </div>
            <h1 className="h2">
              {isExistingSongFlow
                ? `Add ${selectedStage} version`
                : 'Upload to any Muse'}
            </h1>
            <p className="copy" style={{ maxWidth: 760 }}>
              {isExistingSongFlow
                ? `You are adding a new ${selectedStage} version to ${
                    existingSongTitle ? `"${existingSongTitle}"` : 'an existing song'
                  }.`
                : 'Pick the current, upload the audio file, and the app creates the song, stage, version, and attachment records automatically in Supabase.'}
            </p>
          </div>
        </div>

        <SongUploadForm
          museOptions={muses.map((muse) => ({
            slug: muse.slug,
            name: muse.name,
            label: muse.label,
          }))}
          existingSongId={song ?? null}
          initialStage={selectedStage}
          defaultMuseSlug={defaultMuseSlug}
          lockedMuse={isExistingSongFlow}
        />
      </div>
    </section>
  );
}