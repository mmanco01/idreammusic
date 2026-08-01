import { subscribeToBookUpdates } from '@/app/book/actions';

type BookReleaseInterestFormProps = {
  status?: string;
};

const statusCopy: Record<string, { message: string; kind: 'success' | 'error' }> = {
  success: {
    message: 'You’re on the list. We’ll let you know when the book is available.',
    kind: 'success',
  },
  invalid: {
    message: 'Please enter a valid email address.',
    kind: 'error',
  },
  unavailable: {
    message: 'Release signup is temporarily unavailable. Please try again later.',
    kind: 'error',
  },
  error: {
    message: 'We couldn’t save your signup. Please try again.',
    kind: 'error',
  },
};

export function BookReleaseInterestForm({ status }: BookReleaseInterestFormProps) {
  const statusMessage = status ? statusCopy[status] : undefined;

  return (
    <form action={subscribeToBookUpdates} className="book-signup-form">
      <div className="book-signup-grid">
        <label>
          <span className="fieldLabel">Name (optional)</span>
          <input name="name" type="text" autoComplete="name" maxLength={120} />
        </label>

        <label>
          <span className="fieldLabel">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={320}
            required
          />
        </label>
      </div>

      <label className="book-honeypot" aria-hidden="true">
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="button-row">
        <button className="button primary" type="submit">
          Get Release Updates
        </button>
      </div>

      <p className="copy book-privacy-note">
        Used only for the book release and related iDreamMusic publishing updates.
      </p>

      {statusMessage ? (
        <div
          className={`statusMessage ${
            statusMessage.kind === 'success' ? 'statusSuccess' : 'statusError'
          }`}
          role="status"
        >
          {statusMessage.message}
        </div>
      ) : null}
    </form>
  );
}
