import Link from 'next/link';
import MuseCard from '@/components/MuseCard';
import { SectionIntro } from '@/components/SectionIntro';
import { muses, veiledMuse } from '@/content/site';
import { getMyMuseRepresentationTheme } from '@/lib/profile';
import { resolveMuseImage } from '@/lib/muse-representation';

export default async function Page() {
  const theme = await getMyMuseRepresentationTheme();

  return (
    <section className="section">
      <div className="container">
        <SectionIntro
          eyebrow="Nine Muses"
          title="Not boxes. Doorways."
          text="Each Muse is a living current of inspiration — a source from which songs may emerge. Some songs come through memory. Some through longing. Some through pain, rhythm, worship, joy, story, craft, or dream. The Nine Muses offer a way of understanding not just what a song sounds like, but where it came from."
        />

        <Link
          href="/muses/veiled"
          className="card"
          style={{
            display: 'block',
            marginBottom: '1.5rem',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div className="eyebrow">Before the current is known</div>
          <h2 className="h2">{veiledMuse.name}</h2>
          {veiledMuse.tagline ? (
            <p
              className="copy"
              style={{ fontStyle: 'italic', marginTop: '-0.25rem', marginBottom: '0.75rem' }}
            >
              {veiledMuse.tagline}
            </p>
          ) : null}

          <p className="copy" style={{ maxWidth: 760 }}>
            {veiledMuse.description}
          </p>

          <div className="pillRow" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <span className="pill">{veiledMuse.label}</span>
            {veiledMuse.iconTag ? <span className="pill">{veiledMuse.iconTag}</span> : null}
            <span className="pill">Open Veiled Muse</span>
          </div>

          <img
            src={veiledMuse.image}
            alt={veiledMuse.name}
            style={{
              maxWidth: 320,
              width: '100%',
              borderRadius: '18px',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'block',
            }}
          />

          <p className="copy" style={{ marginTop: '1rem', maxWidth: 760 }}>
            Use The Veiled Muse for songs that are real but not yet ready to be named. A spark can begin here and later
            move into Story, Love, Blues, Dream, or any of the other eight currents once its deeper source becomes
            clear.
          </p>
        </Link>

        <div className="muse-grid">
          {muses.map((muse) => (
            <MuseCard
              key={muse.slug}
              muse={muse}
              imageOverride={resolveMuseImage(muse.slug, muse.image, theme)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}