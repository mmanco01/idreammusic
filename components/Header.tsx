import Link from 'next/link';
import { mainNav, siteMeta } from '@/content/site';
import { getServerAuthContext } from '@/lib/auth';

export async function Header() {
  const { user, profile } = await getServerAuthContext();
  const canReview = profile?.role === 'owner' || profile?.role === 'manager';

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          <strong>{siteMeta.title}</strong>
          <span>{siteMeta.tagline}</span>
        </Link>

        <nav className="nav" aria-label="Primary">
          {mainNav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          {canReview ? <Link href="/admin/review">Review</Link> : null}
        </nav>

        <div className="authBar">
          {user ? (
            <>
              <span className="authName">{profile?.display_name || user.email || 'Signed in'}</span>
              <form action="/auth/sign-out" method="post">
                <button className="button button-small" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link className="button button-small" href="/auth/sign-in">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
