revoke execute on function public.search_muse_knowledge_candidate(
  text,
  vector,
  text,
  uuid,
  integer,
  double precision,
  text[],
  text[]
) from public, anon, authenticated;

grant execute on function public.search_muse_knowledge_candidate(
  text,
  vector,
  text,
  uuid,
  integer,
  double precision,
  text[],
  text[]
) to service_role;
