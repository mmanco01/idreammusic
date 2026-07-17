import { cache } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildPublicAssetUrl } from '@/lib/storage';
import { sampleSongDetail, sampleSongs } from '@/lib/sample-data';
import type { PendingBlogPost, SongDetail, SongOrigin, SongSummary } from '@/lib/types';

function attachSongMetadataToSongs(
  songs: SongSummary[],
  attachmentRows: any[] | null | undefined,
  originRows: any[] | null | undefined
): SongSummary[] {
  const audioMap = new Map<string, { audio_url: string | null; audio_title: string | null }>();
  const originMap = new Map<string, SongOrigin | null>();

  for (const row of attachmentRows ?? []) {
    if (!audioMap.has(row.song_id)) {
      audioMap.set(row.song_id, {
        audio_url: buildPublicAssetUrl(row.storage_path, row.bucket),
        audio_title: row.title ?? null,
      });
    }
  }

  for (const row of originRows ?? []) {
    originMap.set(row.id, (row.song_origin as SongOrigin | null) ?? null);
  }

  return songs.map((song) => ({
    ...song,
    audio_url: audioMap.get(song.id)?.audio_url ?? null,
    audio_title: audioMap.get(song.id)?.audio_title ?? null,
    song_origin: originMap.get(song.id) ?? null,
  }));
}

type PublicListenSongRow = {
  song_id: string;
  slug: string;
  title: string | null;
  hook_line: string | null;
  summary: string | null;
  current_stage: string | null;
  muse_slug: string | null;
  muse_name: string | null;
  muse_label: string | null;
  song_version_id: string;
  version_number: number | null;
  version_stage: string | null;
  latest_public_activity_at: string | null;
  primary_bucket: 'featured' | 'finished' | 'crafting' | 'sparks';
  bucket_rank: number;
  audio_bucket: string | null;
  audio_storage_path: string | null;
  audio_title: string | null;
};

function mapPublicListenSong(row: PublicListenSongRow): SongSummary {
  return {
    id: row.song_id,
    slug: row.slug,
    title: row.title ?? 'Untitled song',
    hook_line: row.hook_line,
    summary: row.summary,
    current_stage: row.current_stage,
    muse_slug: row.muse_slug,
    song_origin: null,
    current_labels: [],
    audio_url: row.audio_storage_path
      ? buildPublicAssetUrl(row.audio_storage_path, row.audio_bucket ?? 'song-assets')
      : null,
    audio_title: row.audio_title,
    song_version_id: row.song_version_id,
    version_number: row.version_number,
    version_stage: row.version_stage,
    latest_public_activity_at: row.latest_public_activity_at,
    primary_bucket: row.primary_bucket,
    bucket_rank: row.bucket_rank,
  } as SongSummary;
}

function attachPublicEngagementMetrics(
  songs: SongSummary[],
  engagementRows: any[] | null | undefined,
  ratingRows: any[] | null | undefined
): SongSummary[] {
  const engagementMap = new Map<string, any>();
  const ratingMap = new Map<string, any>();

  for (const row of engagementRows ?? []) {
    engagementMap.set(row.song_id, row);
  }

  for (const row of ratingRows ?? []) {
    ratingMap.set(row.song_id, row);
  }

  return songs.map((song) => {
    const engagement = engagementMap.get(song.id);
    const ratings = ratingMap.get(song.id);

    return {
      ...song,
      listen_count: Number(engagement?.audio_play_count ?? 0),
      audio_play_count: Number(engagement?.audio_play_count ?? 0),
      video_click_count: Number(engagement?.video_click_count ?? 0),
      average_rating: Number(ratings?.average_rating ?? 0),
      rating_count: Number(ratings?.rating_count ?? 0),
      last_audio_play_at: engagement?.last_audio_play_at ?? null,
      last_video_click_at: engagement?.last_video_click_at ?? null,
      favorite_count: 0,
    } as SongSummary;
  });
}

export const getSongs = cache(async (): Promise<SongSummary[]> => {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return sampleSongs;

  const [
    { data: songRows, error: songError },
    { data: engagementRows, error: engagementError },
    { data: ratingRows, error: ratingError },
  ] = await Promise.all([
    (supabase as any)
      .from('public_listen_song_cards')
      .select('*')
      .order('bucket_rank', { ascending: true })
      .order('latest_public_activity_at', { ascending: false }),

    (supabase as any)
      .from('song_engagement_summaries')
      .select(
        'song_id, audio_play_count, video_click_count, last_audio_play_at, last_video_click_at'
      ),

    (supabase as any)
      .from('song_rating_summaries')
      .select('song_id, average_rating, rating_count'),
  ]);

  if (songError || !songRows) {
    console.error('Unable to load public songs:', songError);
    return sampleSongs;
  }

  if (engagementError) {
    console.error('Unable to load engagement summaries:', engagementError);
  }

  if (ratingError) {
    console.error('Unable to load rating summaries:', ratingError);
  }

  const songs = (songRows as PublicListenSongRow[]).map(mapPublicListenSong);

  return attachPublicEngagementMetrics(songs, engagementRows, ratingRows);
});

export const getPublicSongsByMuse = cache(async (museSlug: string): Promise<SongSummary[]> => {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return sampleSongs.filter((song) => song.muse_slug === museSlug);
  }

  const [
    { data: songRows, error: songError },
    { data: engagementRows, error: engagementError },
    { data: ratingRows, error: ratingError },
  ] = await Promise.all([
    (supabase as any)
      .from('public_listen_song_cards')
      .select('*')
      .eq('muse_slug', museSlug)
      .order('bucket_rank', { ascending: true })
      .order('latest_public_activity_at', { ascending: false })
      .limit(12),

    (supabase as any)
      .from('song_engagement_summaries')
      .select(
        'song_id, audio_play_count, video_click_count, last_audio_play_at, last_video_click_at'
      ),

    (supabase as any)
      .from('song_rating_summaries')
      .select('song_id, average_rating, rating_count'),
  ]);

  if (songError || !songRows) {
    console.error(`Unable to load public songs for muse "${museSlug}":`, songError);
    return [];
  }

  if (engagementError) {
    console.error('Unable to load engagement summaries:', engagementError);
  }

  if (ratingError) {
    console.error('Unable to load rating summaries:', ratingError);
  }

  const songs = (songRows as PublicListenSongRow[]).map(mapPublicListenSong);

  return attachPublicEngagementMetrics(songs, engagementRows, ratingRows);
});

export const getSongBySlug = cache(async (slug: string): Promise<SongDetail | null> => {
  const supabase = await createServerSupabaseClient();

  if (!supabase) return slug === sampleSongDetail.slug ? sampleSongDetail : null;

  const { data: song, error } = await supabase
    .from('public_song_cards')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !song) return null;

  const [
    { data: versions },
    { data: notes },
    { data: posts },
    { data: attachments },
    { data: songMeta },
    { data: links },
  ] = await Promise.all([
    supabase
      .from('song_versions')
      .select(
        'id, version_number, stage, title, lyrics, arrangement_notes, story_behind_song, visibility, is_stage_primary, created_at'
      )
      .eq('song_id', song.id)
      .eq('visibility', 'public')
      .order('version_number', { ascending: true }),
    supabase
      .from('writer_notes')
      .select('id, title, body, visibility, created_at')
      .eq('song_id', song.id)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false }),
    supabase
      .from('blog_posts')
      .select('id, title, excerpt, approval_status, published_at')
      .eq('song_id', song.id)
      .eq('approval_status', 'approved')
      .order('published_at', { ascending: false }),
    supabase
      .from('attachments')
      .select('id, song_id, song_version_id, title, file_type, mime_type, bucket, storage_path, created_at')
      .eq('song_id', song.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('songs')
      .select('id, song_origin')
      .eq('id', song.id)
      .maybeSingle(),
    (supabase as any)
      .from('public_song_video_links')
      .select('id, song_version_id, title, url, link_type, sort_order, created_at')
      .eq('song_id', song.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
  ]);

  const publicVersionIds = new Set((versions ?? []).map((version: any) => version.id));

  const attachmentRows = (attachments ?? []).filter(
    (row: any) => !row.song_version_id || publicVersionIds.has(row.song_version_id)
  );

  const attachmentsWithUrls = attachmentRows.map((row: any) => ({
    id: row.id,
    song_id: row.song_id,
    song_version_id: row.song_version_id ?? null,
    title: row.title ?? null,
    file_type: row.file_type,
    mime_type: row.mime_type ?? null,
    bucket: row.bucket,
    storage_path: row.storage_path,
    public_url: buildPublicAssetUrl(row.storage_path, row.bucket),
    created_at: row.created_at,
  }));

  const versionsWithAttachments = (versions ?? []).map((version: any) => {
    const versionAttachments = attachmentsWithUrls.filter(
      (attachment) => attachment.song_version_id === version.id
    );

    const audioAttachment =
      versionAttachments.find((attachment) => attachment.file_type === 'audio') ??
      versionAttachments[0] ??
      null;

    return {
      ...version,
      attachments: versionAttachments,
      audio_url: audioAttachment?.public_url ?? null,
      audio_mime_type: audioAttachment?.mime_type ?? null,
      audio_title: audioAttachment?.title ?? null,
    };
  });

  const topLevelAudio =
    versionsWithAttachments.find((version: any) => version.is_stage_primary && version.audio_url)?.audio_url ??
    versionsWithAttachments.find((version: any) => version.audio_url)?.audio_url ??
    attachmentsWithUrls.find((attachment) => attachment.file_type === 'audio')?.public_url ??
    null;

  const topLevelAudioTitle =
    versionsWithAttachments.find((version: any) => version.is_stage_primary && version.audio_title)?.audio_title ??
    versionsWithAttachments.find((version: any) => version.audio_title)?.audio_title ??
    attachmentsWithUrls.find((attachment) => attachment.file_type === 'audio')?.title ??
    null;

  return {
    id: song.id,
    slug: song.slug,
    title: song.title,
    hook_line: song.hook_line,
    summary: song.summary,
    current_stage: song.current_stage,
    muse_slug: song.muse_slug,
    song_origin: (songMeta?.song_origin as SongOrigin | null) ?? (song.song_origin as SongOrigin | null) ?? null,
    current_labels: song.current_labels ?? [],
    audio_url: topLevelAudio,
    audio_title: topLevelAudioTitle,
    versions: versionsWithAttachments,
    notes: notes ?? [],
    posts: posts ?? [],
    attachments: attachmentsWithUrls,
    links: (links ?? []).map((row: any) => ({
      id: row.id,
      song_version_id: row.song_version_id ?? null,
      title: row.title ?? null,
      url: row.url,
      link_type: row.link_type,
      created_at: row.created_at,
    })),
  } as SongDetail;
});

export const getMySongs = cache(async (userId: string): Promise<SongSummary[]> => {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('songs')
    .select('id, slug, title_working, title_final, current_stage, summary, hook_line, muse_id, song_origin, updated_at')
    .eq('owner_user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error || !data?.length) return [];

  const museIds = [...new Set(data.map((row: any) => row.muse_id).filter(Boolean))];

  const museMap = new Map<string, string>();
  if (museIds.length) {
    const { data: museRows } = await supabase
      .from('muses')
      .select('id, slug')
      .in('id', museIds);

    for (const muse of museRows ?? []) {
      museMap.set(muse.id, muse.slug);
    }
  }

  const songs: SongSummary[] = data.map((row: any) => ({
    id: row.id,
    slug: row.slug,
    title: row.title_final ?? row.title_working,
    hook_line: row.hook_line,
    summary: row.summary,
    current_stage: row.current_stage,
    muse_slug: row.muse_id ? museMap.get(row.muse_id) ?? null : null,
    song_origin: (row.song_origin as SongOrigin | null) ?? null,
    current_labels: [],
  }));

  const ids = songs.map((song) => song.id);
  const { data: attachments } = await supabase
    .from('attachments')
    .select('song_id, bucket, storage_path, title, created_at')
    .eq('file_type', 'audio')
    .in('song_id', ids)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return attachSongMetadataToSongs(songs, attachments, data);
});

export const getPendingBlogPosts = cache(async (): Promise<PendingBlogPost[]> => {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, excerpt, post_type, created_at, approval_status, author_user_id, song_id')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data?.length) return [];

  const authorIds = [...new Set(data.map((row: any) => row.author_user_id).filter(Boolean))];
  const songIds = [...new Set(data.map((row: any) => row.song_id).filter(Boolean))];

  const [profilesResult, songsResult] = await Promise.all([
    authorIds.length
      ? supabase.from('profiles').select('id, display_name').in('id', authorIds)
      : Promise.resolve({ data: [] as any[] }),
    songIds.length
      ? supabase.from('songs').select('id, title_working, title_final').in('id', songIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const authorMap = new Map<string, string | null>();
  for (const profile of profilesResult.data ?? []) {
    authorMap.set(profile.id, profile.display_name ?? null);
  }

  const songMap = new Map<string, string | null>();
  for (const song of songsResult.data ?? []) {
    songMap.set(song.id, song.title_final ?? song.title_working ?? null);
  }

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt ?? null,
    post_type: row.post_type,
    created_at: row.created_at,
    approval_status: row.approval_status,
    song_title: row.song_id ? songMap.get(row.song_id) ?? null : null,
    author_name: row.author_user_id ? authorMap.get(row.author_user_id) ?? null : null,
  }));
});
