export type SongStage = 'spark' | 'draft' | 'final';
export type Visibility = 'private' | 'public';
export type AppRole = 'owner' | 'manager' | 'writer' | 'listener';

export type SongOrigin =
  | 'dream'
  | 'comment'
  | 'thought'
  | 'road'
  | 'conversation'
  | 'prayer'
  | 'memory'
  | 'image'
  | 'riff'
  | 'title'
  | 'journal'
  | 'performance'
  | 'other';

export type SongSummary = {
  id: string;
  slug: string;
  title: string;
  hook_line: string | null;
  summary: string | null;
  current_stage: SongStage;
  muse_slug: string | null;
  song_origin?: SongOrigin | null;
  current_labels: string[];
  audio_url?: string | null;
  audio_title?: string | null;
};

export type SongAttachment = {
  id: string;
  title: string | null;
  file_type: 'audio' | 'image' | 'pdf' | 'doc' | 'video';
  mime_type: string | null;
  public_url: string | null;
  created_at: string;
};

export type SongDetail = SongSummary & {
  notes: Array<{
    id: string;
    title: string | null;
    body: string;
    visibility: Visibility;
    created_at: string;
  }>;
  versions: Array<{
    id: string;
    version_number: number;
    stage: SongStage;
    title: string | null;
    lyrics: string | null;
    arrangement_notes: string | null;
    story_behind_song: string | null;
    is_stage_primary: boolean;
    created_at: string;
  }>;
  posts: Array<{
    id: string;
    title: string;
    excerpt: string | null;
    approval_status: 'pending' | 'approved' | 'rejected';
    published_at: string | null;
  }>;
  attachments: SongAttachment[];
};

export type PendingBlogPost = {
  id: string;
  title: string;
  excerpt: string | null;
  post_type: string;
  created_at: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  song_title: string | null;
  author_name: string | null;
};
