import Link from "next/link";
import { notFound } from "next/navigation";
import { getMuseBySlug, MUSE_OPTIONS } from "@/lib/muses";
import { MuseChatPanel } from "@/components/studio/MuseChatPanel";

type MusePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function MusePage({ params }: MusePageProps) {
  const { slug } = await params;
  const muse = getMuseBySlug(slug);

  if (!muse) {
    notFound();
  }

  return (
    <main>
      <section className="section">
        <div className="container pageStack">
          <div className="page-intro">
            <div>
              <div className="eyebrow">The Nine Muses</div>

              <h1 className="h2">
                {muse.name} — Muse of {muse.domain}
              </h1>

              <p className="copy" style={{ maxWidth: 850 }}>
                {muse.purpose}
              </p>
            </div>

            <div className="button-row">
              <Link className="button primary" href={`/studio/capture?muse=${muse.slug}`}>
                Capture a song
              </Link>

              <Link className="button" href="/nine-muses">
                See all Muses
              </Link>
            </div>
          </div>

          <section className="card">
            <div className="eyebrow">Creative lens</div>

            <h2 className="h3">How {muse.name} approaches a song</h2>

            <p className="copy" style={{ maxWidth: 900 }}>
              {muse.creativeLens}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              <div
                style={{
                  padding: "1rem",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                }}
              >
                <div className="eyebrow">Personality</div>
                <p className="copy" style={{ marginTop: "0.45rem" }}>
                  {muse.personality}
                </p>
              </div>

              <div
                style={{
                  padding: "1rem",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                }}
              >
                <div className="eyebrow">Speaking style</div>
                <p className="copy" style={{ marginTop: "0.45rem" }}>
                  {muse.speakingStyle}
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="eyebrow">Songwriting strengths</div>

            <h2 className="h3">What {muse.name} helps develop</h2>

            <div
              className="pillRow"
              style={{ marginTop: "0.8rem" }}
            >
              {muse.songwritingStrengths.map((strength) => (
                <span className="pill" key={strength}>
                  {strength}
                </span>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="eyebrow">Guiding questions</div>

            <h2 className="h3">
              Questions {muse.name} naturally asks
            </h2>

            <ul
              className="copy"
              style={{
                marginTop: "0.8rem",
                paddingLeft: "1.25rem",
                columns: 2,
                columnGap: "2rem",
              }}
            >
              {muse.questionsSheAsks.map((question) => (
                <li
                  key={question}
                  style={{
                    marginBottom: "0.55rem",
                    breakInside: "avoid",
                  }}
                >
                  {question}
                </li>
              ))}
            </ul>
          </section>

          <MuseChatPanel
            defaultMuseSlug={muse.slug}
            museOptions={MUSE_OPTIONS}
            lockedMuse
          />
        </div>
      </section>
    </main>
  );
}
