-- Apply this if you already ran 0001 before the auth/upload pass.
-- It refreshes the bucket visibility and completes the Muse/current seed set.

insert into storage.buckets (id, name, public)
values ('song-assets', 'song-assets', true)
on conflict (id) do update set public = excluded.public;

insert into public.muses (name, slug, description)
values
  ('Calliope', 'calliope', 'Story / narrative inspiration'),
  ('Clio', 'clio', 'Roots / history and lifeborne inspiration'),
  ('Erato', 'erato', 'Love / relational inspiration'),
  ('Euterpe', 'euterpe', 'Craft / musical workmanship'),
  ('Melpomene', 'melpomene', 'Blues / pain and soul'),
  ('Polyhymnia', 'polyhymnia', 'Faith / sacred inspiration'),
  ('Terpsichore', 'terpsichore', 'Rhythm / motion and groove'),
  ('Thalia', 'thalia', 'Play / joy and release'),
  ('Urania', 'urania', 'Dream / cosmic inspiration')
on conflict (slug) do nothing;

insert into public.currents (name, slug, description)
values
  ('Dreamborne', 'dreamborne', 'Caught through dream and image'),
  ('Storyborne', 'storyborne', 'Narrative-driven inspiration'),
  ('Faithborne', 'faithborne', 'Spiritually resonant inspiration'),
  ('Rootsborne', 'rootsborne', 'Grounded in history and home'),
  ('Craftborne', 'craftborne', 'Developed through discipline and craft'),
  ('Rhythmborne', 'rhythmborne', 'Driven by groove and pulse'),
  ('Playborne', 'playborne', 'Carried by joy, fun, and release'),
  ('Loveborne', 'loveborne', 'Relationship-centered inspiration'),
  ('Bluesborne', 'bluesborne', 'Born from pain, struggle, and truth')
on conflict (slug) do nothing;
