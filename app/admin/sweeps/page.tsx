import { getServerAuthContext } from "@/lib/auth";

import { MuseSweepControls } from "./muse-sweep-controls";

export const dynamic = "force-dynamic";

function AccessCard({ signedOut }: { signedOut: boolean }) {
  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="card">
          <div className="eyebrow">Manager</div>
          <h1 className="h2">Muse Sweep Control</h1>
          <p className="copy">
            {signedOut
              ? "Sign in with an authorized owner or manager account to operate Muse Sweeps."
              : "This page is reserved for iDreamMusic owner and manager accounts."}
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function MuseSweepsPage() {
  const { user, profile } = await getServerAuthContext();

  if (!user) return <AccessCard signedOut />;

  const canManage = profile?.role === "owner" || profile?.role === "manager";
  if (!canManage) return <AccessCard signedOut={false} />;

  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">Manager · Agent automation</div>
            <h1 className="h2">Muse Sweep Control</h1>
            <p className="copy" style={{ maxWidth: 900 }}>
              Start controlled Muse knowledge runs, watch their progress, and let the Agent pipeline work toward the human approval gate. Approval and production release remain explicit human actions in Review Center.
            </p>
          </div>
        </div>
        <MuseSweepControls />
      </div>
    </section>
  );
}
