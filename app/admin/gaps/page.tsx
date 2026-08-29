import Link from "next/link";

import {
  getServerAuthContext,
} from "@/lib/auth";

import {
  GapAnalysisControls,
} from "./gap-analysis-controls";

export const dynamic = "force-dynamic";

function AccessCard({
  signedOut,
}: {
  signedOut: boolean;
}) {
  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="card">
          <div className="eyebrow">
            Manager · Agent automation
          </div>
          <h1 className="h2">
            Muse Gap Analysis
          </h1>
          <p className="copy">
            {signedOut
              ? "Sign in with an authorized owner or manager account to use Muse Gap Analysis."
              : "This page is reserved for iDreamMusic owner and manager accounts."}
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function MuseGapAnalysisPage() {
  const { user, profile } =
    await getServerAuthContext();

  if (!user) {
    return <AccessCard signedOut />;
  }

  const canManage =
    profile?.role === "owner" ||
    profile?.role === "manager";

  if (!canManage) {
    return <AccessCard signedOut={false} />;
  }

  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">
              Manager · Agent automation
            </div>
            <h1 className="h2">
              Nine-Muse Gap Analysis
            </h1>
            <p
              className="copy"
              style={{ maxWidth: 900 }}
            >
              Decide what is worth learning next. The analyzer reads released Depth-02 evidence, source coverage, provenance, novelty, and validation results. It can recommend HOLD or a targeted Depth-03 mission. No research job exists until you explicitly approve a DEEPEN recommendation and create the approved jobs.
            </p>
            <div className="button-row">
              <Link
                className="button"
                href="/admin/sweeps"
              >
                Back to Muse Sweeps
              </Link>
              <Link
                className="button"
                href="/admin/review"
              >
                Review Center
              </Link>
            </div>
          </div>
        </div>

        <GapAnalysisControls />
      </div>
    </section>
  );
}
