-- Allow Song Intelligence to run from captured text even when no transcript exists.
-- The raw_result JSON stores source types, Spark-stage context, Muse direction,
-- and the generated starter question without requiring new result columns.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_analysis_runs'
      and column_name = 'transcript_id'
  ) then
    alter table public.ai_analysis_runs
      alter column transcript_id drop not null;
  end if;
end $$;
