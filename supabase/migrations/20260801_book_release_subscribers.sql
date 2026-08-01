-- Public book release interest list.
-- Visitors may add an email address, but no public role can read the list.

create table if not exists public.book_release_subscribers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  source text not null default 'book-page',
  created_at timestamptz not null default timezone('utc', now()),
  constraint book_release_subscribers_email_length
    check (char_length(email) between 3 and 320),
  constraint book_release_subscribers_source_check
    check (source = 'book-page')
);

create unique index if not exists book_release_subscribers_email_key
  on public.book_release_subscribers (email);

alter table public.book_release_subscribers enable row level security;

revoke all on table public.book_release_subscribers from anon, authenticated;
grant insert on table public.book_release_subscribers to anon, authenticated;

drop policy if exists "Public may join book release list"
  on public.book_release_subscribers;

create policy "Public may join book release list"
  on public.book_release_subscribers
  for insert
  to anon, authenticated
  with check (
    source = 'book-page'
    and char_length(email) between 3 and 320
  );

comment on table public.book_release_subscribers is
  'Private interest list for iDreamMusic book and publishing release updates.';
