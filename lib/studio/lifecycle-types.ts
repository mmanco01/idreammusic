export type LifecyclePhase = "capture" | "craft" | "release";
export type CraftFocus = "explore" | "shape" | "develop" | "refine" | "demo";
export type LifecycleSource = "inferred" | "manual" | "system";
export type SongVisibility = "private" | "shared" | "published" | "archived";

export type StudioLifecycleSong = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  current_stage: "spark" | "draft" | "final" | string;
  status: SongVisibility | string;
  published_at: string | null;
  updated_at: string;
  muse_slug: string | null;

  lifecycle_phase: LifecyclePhase;
  craft_focus: CraftFocus | null;
  lifecycle_source: LifecycleSource;
  ready_to_release_at: string | null;

  next_action: string | null;
  priority_tier: string | null;
  workflow_status: string | null;
  personal_rating: number | null;

  version_count: number;
  open_task_count: number;
  in_progress_task_count: number;

  ai_overall_score: number | null;
  ai_ready_for_release_score: number | null;
  ai_audience_score: number | null;

  audio_play_count: number;
  listener_rating_average: number | null;
  listener_rating_count: number;
};
