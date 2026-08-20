import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BookReleaseInterestForm } from '@/components/book/BookReleaseInterestForm';

export const metadata: Metadata = {
  title: 'The iDreamMusic Book | Songwriting in the Modality of the Muses',
  description:
    'Discover iDreamMusic: Songwriting in the Modality of the Muses by Mike Mancour, a songwriter’s companion for finding better ideas, writing better songs, and becoming a better songwriter.',
  openGraph: {
    title: 'iDreamMusic: Songwriting in the Modality of the Muses',
    description:
      'Nine sisters. Nine musical worlds. One song waiting to be found.',
    images: ['/books/idreammusic-book-cover.webp'],
    type: 'website',
  },
};

const bookMuses = [
  { slug: 'calliope', name: 'Calliope', focus: 'Story' },
  { slug: 'clio', name: 'Clio', focus: 'History & Roots' },
  { slug: 'erato', name: 'Erato', focus: 'Love' },
  { slug: 'euterpe', name: 'Euterpe', focus: 'Craft' },
  { slug: 'melpomene', name: 'Melpomene', focus: 'Blues' },
  { slug: 'polyhymnia', name: 'Polyhymnia', focus: 'Faith' },
  { slug: 'terpsichore', name: 'Terpsichore', focus: 'Rhythm' },
  { slug: 'thalia', name: 'Thalia', focus: 'Play' },
  { slug: 'urania', name: 'Urania', focus: 'Dream' },
] as const;

const readerTypes = [
  'Songwriters looking for fresh ways into a song',
  'Musicians ready to move beyond familiar creative habits',
  'Writers carrying unfinished ideas or creative blocks',
  'Creators who want assistance without surrendering authorship',
  'Anyone learning to listen more closely for what a song wants to become',
] as const;

type BookPageProps = {
  searchParams: Promise<{ signup?: string }>;
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const { signup } = await searchParams;
  const configuredPurchaseUrl = process.env.NEXT_PUBLIC_BOOK_PURCHASE_URL?.trim() || 'https://www.amazon.com/dp/B0HF1Q4QZC';
  const purchaseUrl =
    configuredPurchaseUrl && /^https?:\/\//i.test(configuredPurchaseUrl)
      ? configuredPurchaseUrl
      : null;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: 'iDreamMusic: Songwriting in the Modality of the Muses',
    alternateName: 'A Songwriter’s Companion',
    author: {
      '@type': 'Person',
      name: 'Mike Mancour',
    },
    description:
      'A songwriter’s companion exploring nine creative perspectives for catching, understanding, and shaping songs.',
    image: '/books/idreammusic-book-cover.webp',
    inLanguage: 'en',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="book-hero">
        <div className="container">
          <div className="book-hero-card">
            <div className="book-hero-grid">
              <div className="book-cover-wrap">
                <Image
                  src="/books/idreammusic-book-cover.webp"
                  alt="Cover of iDreamMusic: Songwriting in the Modality of the Muses by Mike Mancour"
                  width={1024}
                  height={1536}
                  priority
                  className="book-cover-image"
                  sizes="(max-width: 980px) 82vw, 36vw"
                />
              </div>

              <div>
                <div className="eyebrow">The iDreamMusic book</div>
                <h1 className="display book-title">
                  Songwriting in the Modality of the Muses
                </h1>
                <p className="lead">
                  A songwriter’s companion for finding better ideas, writing better
                  songs, and becoming a better songwriter.
                </p>
                <p className="copy">
                  Songs do not all arrive through the same door. Some come through
                  story. Some through memory, love, rhythm, sorrow, faith, humor,
                  craft, or dreams. This book offers nine creative perspectives for
                  recognizing, exploring, and shaping the songs waiting to be caught.
                </p>

                <div className="book-status-card">
                  <div className="eyebrow">
                    {purchaseUrl ? 'Available now' : 'Publication status'}
                  </div>
                  <strong>
                    {purchaseUrl
                      ? 'Now available on Amazon'
                      : 'Coming soon in paperback'}
                  </strong>
                  <p className="copy">
                    {purchaseUrl
                      ? 'The first edition is ready for songwriters, musicians, and creative explorers.'
                      : 'The proof copy has been ordered and the book is moving through final review toward publication.'}
                  </p>
                </div>

                <div className="button-row">
                  {purchaseUrl ? (
                    <a
                      href={purchaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button primary"
                    >
                      Buy on Amazon
                    </a>
                  ) : (
                    <a href="#release-updates" className="button primary">
                      Get Release Updates
                    </a>
                  )}

                  <Link href="/nine-muses" className="button">
                    Explore the Nine Muses
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="book-statement">
            <div className="eyebrow">The central idea</div>
            <h2 className="h2">Nine sisters. Nine musical worlds.</h2>
            <p className="lead">One song waiting to be found.</p>
            <p className="copy">
              The Muses are not formulas and they are not replacements for the
              songwriter. They are distinct ways of listening—each one helping the
              writer notice a different source, question, strength, or possibility
              within the song.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="eyebrow">The Nine Muses</div>
          <h2 className="h2">Nine creative perspectives</h2>
          <p className="copy" style={{ maxWidth: 820 }}>
            Each Muse opens a different doorway into songwriting. Follow any Muse to
            explore the living framework on iDreamMusic.
          </p>

          <div className="book-muse-grid">
            {bookMuses.map((muse) => (
              <Link
                key={muse.slug}
                href={`/muses/${muse.slug}`}
                className="book-muse-card"
              >
                <span>{muse.name}</span>
                <strong>{muse.focus}</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="two-col">
            <div className="card detail-panel">
              <div className="eyebrow">Who it is for</div>
              <h2 className="h2">For the songwriter still listening</h2>
              <ul className="book-reader-list">
                {readerTypes.map((readerType) => (
                  <li key={readerType}>{readerType}</li>
                ))}
              </ul>
            </div>

            <div className="card detail-panel">
              <div className="eyebrow">Book + platform</div>
              <h2 className="h2">Read the framework. Work the song.</h2>
              <p className="copy">
                The book introduces the philosophy and creative framework of the Nine
                Muses. iDreamMusic.com gives songwriters a place to capture Sparks,
                explore Muse perspectives, develop versions, organize the journey,
                and keep the human songwriter at the center.
              </p>
              <div className="quote-panel">
                The book introduces the Nine Muses. iDreamMusic gives songwriters a
                place to work with them.
              </div>
              <div className="button-row">
                <Link href="/studio/capture" className="button primary">
                  Catch a Spark
                </Link>
                <Link href="/nine-muses" className="button">
                  Meet the Muses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="card detail-panel book-author-card">
            <div>
              <div className="eyebrow">About the author</div>
              <h2 className="h2">Mike Mancour</h2>
              <p className="copy">
                Mike Mancour is a lifelong songwriter, performer, technologist, and
                founder of iDreamMusic. Across decades of music-making, hundreds of
                songs and fragments have taught him that songs are often caught before
                they are understood. His work brings together lived creative practice,
                the Nine Muses, and a human-led approach to music intelligence.
              </p>
              <p className="lead book-author-principle">
                Inspiration before generation.
              </p>
            </div>

            <div className="book-author-mark" aria-hidden="true">
              <span>MM</span>
              <small>Songcatcher</small>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="release-updates">
        <div className="container">
          <div className="book-updates-card">
            <div>
              <div className="eyebrow">Release updates</div>
              <h2 className="h2">
                {purchaseUrl
                  ? 'Follow what comes next'
                  : 'Be the first to know when the book is released'}
              </h2>
              <p className="copy">
                Join the iDreamMusic publishing list for future updates
                about the audiobook, companion workbook, and other iDreamMusic
                publishing projects.
              </p>
            </div>

            <BookReleaseInterestForm status={signup} />
          </div>
        </div>
      </section>
    </>
  );
}
