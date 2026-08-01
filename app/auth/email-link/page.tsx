function safeConfirmationUrl(value: string | undefined) {
  if (!value || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  try {
    const confirmationUrl = new URL(value);
    const projectUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);

    if (confirmationUrl.origin !== projectUrl.origin) return null;
    if (!confirmationUrl.pathname.startsWith("/auth/v1/verify")) return null;

    return confirmationUrl.toString();
  } catch {
    return null;
  }
}

export default async function EmailLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation_url?: string }>;
}) {
  const { confirmation_url: confirmationUrlValue } = await searchParams;
  const confirmationUrl = safeConfirmationUrl(confirmationUrlValue);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="card formCard">
          <div className="eyebrow">Secure sign-in link</div>
          <h1 className="h2">Continue to iDreamMusic</h1>
          {confirmationUrl ? (
            <>
              <p className="copy" style={{ maxWidth: 680 }}>
                Click once to complete sign-in. This extra confirmation keeps
                email security scanners from using the one-time link before you
                do.
              </p>
              <div className="button-row">
                <a className="button primary" href={confirmationUrl}>
                  Complete secure sign-in
                </a>
              </div>
              <p className="copy" style={{ marginBottom: 0 }}>
                Working on an unfinished Spark? The most reliable option is to
                return to the original browser and enter the six-digit code from
                the same email.
              </p>
            </>
          ) : (
            <div className="statusMessage statusError">
              This sign-in link is incomplete or no longer valid. Return to the
              sign-in screen and request a new code.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
