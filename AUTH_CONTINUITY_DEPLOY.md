# Authentication Continuity Deployment

This change makes the email code the primary mobile sign-in path while retaining a secure link as a secondary path.

## What changes

- Email sign-in now presents a six-digit OTP field.
- The original browser remains on the code-entry screen while the user checks the email app.
- Spark Capture automatically stores unfinished text, notes, recordings, and uploaded files in that browser using IndexedDB.
- After code verification, the user returns to the exact capture path, including the selected Muse.
- The restored draft is removed from browser storage after the Spark is successfully saved or the user selects Start Over.
- The secondary email link goes through `/auth/email-link`, which requires a human click before consuming the Supabase confirmation URL.

## Safe release order

Do not replace the Supabase email template before `/auth/email-link` is live in production. The new template points its secondary link to that route.

1. Apply this code patch and run `npm run build`.
2. Push the authentication branch and merge it to production.
3. Confirm `https://idreammusic.com/auth/email-link` loads the confirmation page.
4. Then replace the Supabase Magic Link email template with the supplied HTML.
5. Test the six-digit code flow immediately.

Before step 4, Supabase's existing magic-link email remains usable. After step 4, the new email supplies both the code and the protected secondary link.

## Required Supabase email-template change

The code cannot appear until the hosted Supabase Magic Link template includes `{{ .Token }}`.

1. Open Supabase Dashboard.
2. Go to **Authentication → Email Templates → Magic Link**.
3. Set the subject to: `Your iDreamMusic sign-in code`
4. Replace the body with:
   `docs/supabase/idreammusic-magic-link-template.html`
5. Save the template.

The template includes both:

- `{{ .Token }}` for the six-digit code.
- `{{ .ConfirmationURL }}` behind the secondary secure-link confirmation page.

## Redirect configuration

Keep the production Site URL set to:

`https://idreammusic.com`

Allow these Redirect URLs:

- `https://idreammusic.com/**`
- The stable Vercel branch preview URL plus `/**` when preview authentication is needed.

## Test plan

1. Sign out of iDreamMusic on a phone.
2. Open `/studio/capture?muse=calliope` in the phone browser.
3. Enter text, add a note, make a short recording, and attach a small file.
4. Select **Save this Spark and sign in**.
5. Submit the email address.
6. Leave the browser and open the phone email app.
7. Read the six-digit code without selecting the link.
8. Return to the original browser and enter the code.
9. Confirm the user returns to `/studio/capture?muse=calliope`.
10. Confirm the text, note, recording, and file are restored.
11. Save the Spark and confirm the local recovery notice is gone on the next capture.
12. Repeat once using the secondary secure link.

## Scope boundary

This release preserves a draft within the same browser profile. It does not yet synchronize an anonymous draft between different phones, computers, browsers, or private/incognito sessions. True cross-device draft handoff should be a later, separately secured feature.

No SQL migration and no new npm dependency are required.
