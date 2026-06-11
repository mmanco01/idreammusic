import { Suspense } from 'react';
import { SignInForm } from '@/components/auth/SignInForm';

function SignInLoading() {
  return (
    <div className="card">
      <div className="eyebrow">Sign in</div>
      <h1 className="h2">Loading sign-in…</h1>
      <p className="copy">Preparing your sign-in form.</p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: '760px' }}>
        <Suspense fallback={<SignInLoading />}>
          <SignInForm />
        </Suspense>
      </div>
    </section>
  );
}