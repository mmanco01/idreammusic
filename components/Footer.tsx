import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="divider" />
        <p>Songs are caught, not written.</p>
        <p style={{ color: 'var(--muted)' }}>
          Explore the currents. Honor the process. Share what you catch.
        </p>
        <div className="pillRow" style={{ marginTop: '1rem' }}>
          <Link className="textLink" href="/book">
            The iDreamMusic Book
          </Link>
          <Link className="textLink" href="/contact">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
