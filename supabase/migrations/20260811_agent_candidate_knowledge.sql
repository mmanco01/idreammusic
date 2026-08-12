alter table public.muse_knowledge_documents
  add column if not exists agent_job_id uuid
    references public.agent_jobs(id)
    on delete set null;

alter table public.muse_knowledge_documents
  add column if not exists candidate_version text;

create index if not exists
  muse_knowledge_documents_agent_job_idx
on public.muse_knowledge_documents(agent_job_id)
where agent_job_id is not null;

create or replace function public.search_muse_knowledge_candidate(
  p_query_text text,
  p_query_embedding vector,
  p_muse_slug text,
  p_agent_job_id uuid,
  p_match_count integer default 8,
  p_min_similarity double precision default 0.20,
  p_source_types text[] default null,
  p_traditions text[] default null
)
returns table(
  chunk_id uuid,
  source_id uuid,
  document_id uuid,
  source_key text,
  source_type text,
  title text,
  author_creator text,
  editor_translator text,
  tradition text,
  historical_period text,
  publication_year integer,
  canonical_url text,
  bibliographic_citation text,
  evidence_classification text,
  rights_status text,
  verification_status text,
  source_quality smallint,
  heading text,
  content text,
  content_origin text,
  source_locator text,
  citation_text text,
  semantic_similarity double precision,
  lexical_rank real,
  hybrid_score double precision
)
language sql
stable
set search_path to 'public', 'extensions'
as $function$
  with scored as (
    select
      c.id as chunk_id,
      s.id as source_id,
      d.id as document_id,
      s.source_key,
      s.source_type,
      s.title,
      s.author_creator,
      s.editor_translator,
      s.tradition,
      s.historical_period,
      s.publication_year,
      s.canonical_url,
      s.bibliographic_citation,
      s.evidence_classification,
      s.rights_status,
      s.verification_status,
      s.source_quality,
      c.heading,
      c.content,
      c.content_origin,
      coalesce(c.source_locator, s.source_locator) as source_locator,
      c.citation_text,
      (1 - (c.embedding <=> p_query_embedding))::double precision
        as semantic_similarity,
      case
        when nullif(trim(coalesce(p_query_text, '')), '') is null
          then 0::real
        else ts_rank_cd(
          c.search_vector,
          websearch_to_tsquery(
            'english'::regconfig,
            p_query_text
          )
        )
      end as lexical_rank
    from public.muse_knowledge_chunks c
    join public.muse_knowledge_documents d
      on d.id = c.document_id
    join public.muse_knowledge_sources s
      on s.id = c.source_id
    where
      c.embedding is not null
      and c.muse_slug = p_muse_slug
      and s.muse_slug = p_muse_slug
      and s.is_active = true
      and (
        d.curation_status = 'approved'
        or (
          d.curation_status = 'draft'
          and d.agent_job_id = p_agent_job_id
        )
      )
      and (
        p_source_types is null
        or s.source_type = any(p_source_types)
      )
      and (
        p_traditions is null
        or s.tradition = any(p_traditions)
      )
  )
  select
    scored.chunk_id,
    scored.source_id,
    scored.document_id,
    scored.source_key,
    scored.source_type,
    scored.title,
    scored.author_creator,
    scored.editor_translator,
    scored.tradition,
    scored.historical_period,
    scored.publication_year,
    scored.canonical_url,
    scored.bibliographic_citation,
    scored.evidence_classification,
    scored.rights_status,
    scored.verification_status,
    scored.source_quality,
    scored.heading,
    scored.content,
    scored.content_origin,
    scored.source_locator,
    scored.citation_text,
    scored.semantic_similarity,
    scored.lexical_rank,
    (
      scored.semantic_similarity * 0.84
      + least(scored.lexical_rank::double precision, 1.0) * 0.11
      + (scored.source_quality::double precision / 5.0) * 0.05
    ) as hybrid_score
  from scored
  where scored.semantic_similarity >= p_min_similarity
  order by hybrid_score desc
  limit greatest(1, least(p_match_count, 20));
$function$;
