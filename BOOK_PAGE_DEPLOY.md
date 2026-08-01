# iDreamMusic Book Page Deployment

## Included

- `/book` pre-launch and post-launch page
- Book cover optimized for web delivery
- Book link in primary navigation and footer
- Homepage book feature
- Nine Muse links
- Book/platform and author sections
- Release-interest signup form
- Automatic paperback CTA when a purchase URL is configured

## Before deployment

Run this migration in the Supabase SQL Editor:

```text
supabase/migrations/20260801_book_release_subscribers.sql
```

The table permits public inserts but does not permit public reads. Email addresses remain private in Supabase.

## Pre-launch configuration

No new Vercel environment variable is required during pre-launch. Leave this unset or blank:

```text
NEXT_PUBLIC_BOOK_PURCHASE_URL=
```

The page will display **Coming soon in paperback** and route visitors to the release-update form.

## After publication

Add the live Amazon/KDP paperback URL in Vercel:

```text
NEXT_PUBLIC_BOOK_PURCHASE_URL=https://...
```

Apply it to Production and Preview, then redeploy. The book page and homepage will automatically change to **Now available in paperback** and show a **Buy the Paperback** button.

## Smoke test

1. Open `/book` on desktop and phone.
2. Confirm the cover loads clearly.
3. Open two or three Muse links.
4. Submit a test release signup.
5. Confirm the email appears in `book_release_subscribers` in Supabase.
6. Confirm `/book` appears in the main navigation.
7. Confirm the homepage book card links to `/book`.
