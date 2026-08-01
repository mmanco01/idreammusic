import Link from "next/link";

type SongUnavailableProps = {
  isSignedIn?: boolean;
};

export function SongUnavailable({
  isSignedIn = false,
}: SongUnavailableProps) {
  return (
    <section className="section">
      <div className="container">
        <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="eyebrow">Song access</div>
          <h1 className="h2">This song isn&apos;t available to you.</h1>
          <p className="copy" style={{ maxWidth: 680 }}>
            It may be private, removed, or shared only with selected
            collaborators. To protect each songwriter&apos;s work, iDreamMusic
            does not reveal private song details.
          </p>

          <div className="button-row" style={{ marginTop: "1.25rem" }}>
            {isSignedIn ? (
              <Link href="/studio" className="button primary">
                Return to My Studio
              </Link>
            ) : (
              <Link
                href="/auth/sign-in?next=/studio"
                className="button primary"
              >
                Sign in
              </Link>
            )}

            <Link href="/listen" className="button">
              Browse public songs
            </Link>

            {isSignedIn ? (
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="button">
                  Use another account
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
