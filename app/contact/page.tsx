import Link from 'next/link';
import { SectionIntro } from '@/components/SectionIntro';

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.8rem 1rem',
  borderRadius: '999px',
  border: '1px solid rgba(214, 176, 72, 0.35)',
  background: 'rgba(214, 176, 72, 0.12)',
  color: '#f7e6b0',
  fontWeight: 600,
  textDecoration: 'none'
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.8rem 1rem',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.92)',
  fontWeight: 600,
  textDecoration: 'none'
};

export default function Page() {
  return (
    <section className="section">
      <div className="container">
        <SectionIntro
          eyebrow="Contact"
          title="Join the current"
          text="Whether you are reaching out about songs, collaboration, dreamborn music, the Nine Muses, or the wider vision of iDreamMusic, this is the place to connect. Some paths begin with a conversation. Others begin by catching and sharing a song."
        />

        <div className="card-grid">
          <div className="card">
            <h3 className="h3">General Contact</h3>
            <p className="copy">
              Questions about the music, the site, the Nine Muses, or the vision of
              iDreamMusic? Reach out here for general inquiries, media requests,
              speaking invitations, or anything that does not fit another path.
            </p>

            <div className="pillRow" style={{ marginTop: '1rem' }}>
              <a href="mailto:mmanco01@msn.com?subject=iDreamMusic%20General%20Inquiry" style={buttonStyle}>
                Email Mike
              </a>
            </div>
          </div>

          <div className="card">
            <h3 className="h3">Collaboration</h3>
            <p className="copy">
              If you are a songwriter, musician, producer, vocalist, visual artist,
              or creative partner who feels drawn to this world, start here.
              Collaboration may include co-writing, production, featured performances,
              or helping shape what iDreamMusic becomes.
            </p>

            <div className="pillRow" style={{ marginTop: '1rem' }}>
              <a
                href="mailto:mmanco01@msn.com?subject=iDreamMusic%20Collaboration"
                style={buttonStyle}
              >
                Start a collaboration
              </a>
            </div>
          </div>

          <div className="card">
            <h3 className="h3">Share a Song</h3>
            <p className="copy">
              Approved contributors can sign in and upload songs directly through the
              Muse page that best fits the current of the work. If you are not yet a
              contributor but want to share your music, reach out first to begin the
              conversation.
            </p>

            <div className="pillRow" style={{ marginTop: '1rem' }}>
              <Link href="/nine-muses" style={buttonStyle}>
                Explore the Muses
              </Link>
              <a
                href="mailto:mmanco01@msn.com?subject=iDreamMusic%20Contributor%20Access"
                style={secondaryButtonStyle}
              >
                Request contributor access
              </a>
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="card">
          <div className="eyebrow">For now</div>
          <h2 className="h2">Current contact path</h2>
          <p className="copy" style={{ maxWidth: 760 }}>
            Until a dedicated iDreamMusic email is in place, use{' '}
            <a
              href="mailto:mmanco01@msn.com"
              style={{ color: '#f7e6b0', textDecoration: 'none', fontWeight: 600 }}
            >
              mmanco01@msn.com
            </a>{' '}
            as the main contact address.
          </p>
          <div className="quote-panel">
            Songs are caught, not written. Some arrive as sparks. Some become
            collaborations. Some are ready to be shared. Follow the current that fits.
          </div>
        </div>
      </div>
    </section>
  );
}