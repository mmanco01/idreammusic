import { SectionIntro } from '@/components/SectionIntro';
import { ListenJukebox } from '@/components/ListenJukebox';
import { getSongs } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function ListenPage() {
  const songs = await getSongs();

  return (
    <section className="section">
      <div className="container">
        <SectionIntro
          eyebrow="Listen"
          title="The iDreamMusic Jukebox"
          text="One song, one public current version. Full history lives on the individual song page. This keeps Listen clean without hiding the journey."
        />

        {songs.length ? (
          <ListenJukebox songs={songs} />
        ) : (
          <div className="card">
            <h2 className="h3">
              No public songs yet
            </h2>

            <p className="copy">
              Publish a song/version and it will appear here automatically.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
