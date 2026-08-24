import Link from 'next/link';

import { mainNav, siteMeta } from '@/content/site';
import { getServerAuthContext } from '@/lib/auth';

import { MobileMenu } from '@/components/MobileMenu';

export async function Header() {
  const { user, profile } = await getServerAuthContext();

  const canManage =
    profile?.role === 'owner' ||
    profile?.role === 'manager';

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          <strong>{siteMeta.title}</strong>
          <span>{siteMeta.tagline}</span>
        </Link>

        {/* Existing desktop / tablet navigation */}
        <nav
          className="nav desktopNav"
          aria-label="Primary"
        >
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              scroll
            >
              {item.label}
            </Link>
          ))}

          {canManage ? (
            <Link href="/admin" scroll>
              Manager
            </Link>
          ) : null}
        </nav>

        <div className="authBar desktopAuth">
          {user ? (
            <>
              <span className="authName">
                {profile?.display_name ||
                  user.email ||
                  'Signed in'}
              </span>

              <form
                action="/auth/sign-out"
                method="post"
              >
                <button
                  className="button button-small"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              className="button button-small"
              href="/auth/sign-in"
              scroll
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Phone-only navigation */}
<MobileMenu>
            <nav
              className="mobileNav"
              aria-label="Mobile primary navigation"
            >
              {mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  scroll
                >
                  {item.label}
                </Link>
              ))}

              {canManage ? (
                <Link href="/admin" scroll>
                  Manager
                </Link>
              ) : null}
            </nav>

            <div className="mobileMenuAuth">
              {user ? (
                <>
                  <span className="authName">
                    {profile?.display_name ||
                      user.email ||
                      'Signed in'}
                  </span>

                  <form
                    action="/auth/sign-out"
                    method="post"
                  >
                    <button
                      className="button button-small"
                      type="submit"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  className="button button-small"
                  href="/auth/sign-in"
                  scroll
                >
                  Sign in
                </Link>
              )}
            </div>
</MobileMenu>
      </div>
    </header>
  );
}