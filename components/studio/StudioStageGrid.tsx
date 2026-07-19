import Link from "next/link";
import type { StudioPortfolioSong } from "@/components/studio/StudioPortfolio";

type Props = {
  songs: StudioPortfolioSong[];
  isSignedIn: boolean;
};

function isActiveSong(song: StudioPortfolioSong) {
  return (
    !song.is_finished &&
    song.priority_tier !== "archive" &&
    song.workflow_status !== "archived"
  );
}

export default function StudioStageGrid({
  songs,
  isSignedIn,
}: Props) {
  const activeSongs = songs.filter(isActiveSong);
  const activeTaskCount = songs.reduce(
    (total, song) =>
      total + song.open_task_count + song.in_progress_task_count,
    0,
  );
  const analyzedSongCount = songs.filter(
    (song) => song.ai_overall_score !== null,
  ).length;

  return (
    <div className="stage-grid">
      <div className="stage-card">
        <div className="eyebrow">Begin</div>
        <h3 className="h3">Capture</h3>

        <p className="copy">
          Upload a spark, draft, final cut, lyric sheet, or voice memo and
          connect it to the right Muse.
        </p>

        <div className="pillRow" style={{ marginTop: "0.55rem" }}>
          <span className="pill">{songs.length} songs</span>
        </div>

        <Link
          className="button"
          href={
            isSignedIn
              ? "/studio/capture"
              : "/auth/sign-in?next=/studio/capture"
          }
        >
          New upload
        </Link>
      </div>

      <div className="stage-card">
        <div className="eyebrow">Create</div>
        <h3 className="h3">Develop</h3>

        <p className="copy">
          Generate transcripts and Song Intelligence, create development
          tasks, and move songs through Now, Next, and Later.
        </p>

        <div className="pillRow" style={{ marginTop: "0.55rem" }}>
          <span className="pill">{activeTaskCount} active tasks</span>
          <span className="pill">{analyzedSongCount} analyzed</span>
        </div>

        <Link className="button" href="#song-portfolio">
          Open workspace
        </Link>
      </div>

      <div
        className="stage-card"
        style={{
          borderColor: "rgba(231, 190, 101, 0.7)",
          background:
            "linear-gradient(145deg, rgba(196, 145, 47, 0.13), rgba(255,255,255,0.025))",
        }}
      >
        <div className="eyebrow">Decide</div>
        <h3 className="h3">Review &amp; Prioritize</h3>

        <p className="copy">
          Compare active songs using the single Opportunity Intelligence
          ranking in your portfolio, then choose the next meaningful move.
        </p>

        <div className="pillRow" style={{ marginTop: "0.55rem" }}>
          <span className="pill">{activeSongs.length} active songs</span>
          <span className="pill">One ranking model</span>
        </div>

        <div
          className="button-row"
          style={{ marginTop: "auto", paddingTop: "0.75rem" }}
        >
          <Link className="button primary" href="#song-portfolio">
            Compare opportunities
          </Link>
        </div>
      </div>
    </div>
  );
}
