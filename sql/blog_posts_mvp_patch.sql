-- Optional patch if your current blog_posts table does not already support listener responses.
-- Review before running.

alter table if exists public.blog_posts
  add column if not exists body text,
  add column if not exists author_name text,
  add column if not exists author_email text,
  add column if not exists published_at timestamptz;

create index if not exists idx_blog_posts_song_id on public.blog_posts(song_id);
create index if not exists idx_blog_posts_approval_status on public.blog_posts(approval_status);
create index if not exists idx_blog_posts_created_at on public.blog_posts(created_at desc);
