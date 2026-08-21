"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const SWEEP_KEY = "seven-muses-depth-agent-02";
const museOptions = [
  ["calliope", "Calliope — Story"],
  ["clio", "Clio — Roots"],
  ["erato", "Erato — Love"],
  ["euterpe", "Euterpe — Craft"],
  ["melpomene", "Melpomene — Blues"],
  ["polyhymnia", "Polyhymnia — Faith"],
  ["terpsichore", "Terpsichore — Rhythm"],
  ["thalia", "Thalia — Play"],
  ["urania", "Urania — Dream"],
] as const;

type SweepJob = { status?: string; muse_key?: string; title?: string; last_error?: string | null };
type SweepStatus = {
  status?: string;
  displayName?: string;
  schedulerSweepKey?: string;
  schedulerMatchesSweep?: boolean;
  jobs?: SweepJob[];
  message?: string;
};

function groupFor(status: string) {
  if (["AWAITING_APPROVAL", "HUMAN_REVIEW"].includes(status)) return "Awaiting approval";
  if (status === "RELEASED") return "Released";
  if (["BLOCKED", "FAILED", "DIAGNOSING"].includes(status)) return "Needs attention";
  return "Working";
}

export function MuseSweepControls() {
  const [status, setStatus] = useState<SweepStatus | null>(null);
  const [selectedMuse, setSelectedMuse] = useState("clio");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function post(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status === "error") {
      throw new Error(payload?.message || `Request returned HTTP ${response.status}.`);
    }
    return payload;
  }

  async function refreshStatus() {
    setBusy("status");
    try {
      const payload = await post("/api/admin/agent/muse-sweep", {
        action: "status",
        sweepKey: SWEEP_KEY,
      });
      setStatus(payload);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sweep status could not load.");
    } finally {
      setBusy(null);
    }
  }

  async function startRemainingSweep() {
    setBusy("start");
    setNotice("");
    try {
      const payload = await post("/api/admin/agent/muse-sweep", {
        action: "start",
        sweepKey: SWEEP_KEY,
      });
      setNotice(`Remaining Depth-02 sweep ready: ${payload.created?.length ?? 0} jobs created, ${payload.reused?.length ?? 0} reused.`);
      await refreshStatus();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Muse Sweep could not start.");
    } finally {
      setBusy(null);
    }
  }

  async function advanceSweep() {
    setBusy("step");
    setNotice("");
    try {
      const payload = await post("/api/admin/agent/muse-sweep", {
        action: "step",
        sweepKey: SWEEP_KEY,
        parallelism: 1,
      });
      setNotice(payload.message || `Sweep advanced ${payload.advancedCount ?? 0} governed step(s).`);
      await refreshStatus();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Muse Sweep step failed.");
    } finally {
      setBusy(null);
    }
  }

  async function startOneMuse() {
    setBusy("one");
    setNotice("");
    try {
      const payload = await post("/api/admin/agent/muse-run", {
        museKey: selectedMuse,
        depth: 2,
      });
      setNotice(`${payload.displayName ?? selectedMuse} Depth-02 ${payload.created ? "created" : "already exists"}: ${payload.candidateVersion ?? ""} · ${payload.job?.status ?? ""}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Single Muse run could not start.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => { void refreshStatus(); }, []);

  const groups = useMemo(() => {
    const result: Record<string, number> = {
      Working: 0,
      "Awaiting approval": 0,
      Released: 0,
      "Needs attention": 0,
    };
    for (const job of status?.jobs ?? []) {
      const group = groupFor(job.status ?? "NEW");
      result[group] = (result[group] ?? 0) + 1;
    }
    return result;
  }, [status]);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        <div className="card">
          <div className="eyebrow">Depth-02 rollout</div>
          <h2 className="h3">Run Remaining Seven Muses</h2>
          <p className="copy">Creates one controlled sweep for Clio, Erato, Euterpe, Melpomene, Polyhymnia, Terpsichore, and Thalia. Every Muse stops at the human approval gate.</p>
          <div className="button-row" style={{ flexWrap: "wrap", gap: ".55rem" }}>
            <button className="button primary" type="button" disabled={Boolean(busy)} onClick={startRemainingSweep}>
              {busy === "start" ? "Starting…" : "Start Remaining Depth-02"}
            </button>
            <button className="button" type="button" disabled={Boolean(busy)} onClick={advanceSweep}>
              {busy === "step" ? "Advancing…" : "Advance One Sweep Step"}
            </button>
          </div>
          <p className="copy" style={{ marginBottom: 0, opacity: 0.78, fontSize: ".88rem" }}>The one-step control is for smoke testing and recovery. Once the scheduler is aimed at this sweep, you should not need to babysit it.</p>
        </div>

        <div className="card">
          <div className="eyebrow">One-off run</div>
          <h2 className="h3">Start One Muse</h2>
          <p className="copy">Create one governed Depth-02 Muse job without SQL. If that candidate already exists, the existing job is returned instead of creating a duplicate.</p>
          <label className="copy" htmlFor="single-muse" style={{ display: "block", marginBottom: ".45rem", fontWeight: 700 }}>Muse</label>
          <select id="single-muse" value={selectedMuse} disabled={Boolean(busy)} onChange={(event) => setSelectedMuse(event.target.value)} style={{ width: "100%", minHeight: 42, marginBottom: ".8rem", borderRadius: 10, padding: "0 .7rem" }}>
            {museOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="button primary" type="button" disabled={Boolean(busy)} onClick={startOneMuse}>
            {busy === "one" ? "Starting…" : "Start Muse Run"}
          </button>
        </div>

        <div className="card">
          <div className="eyebrow">Automation status</div>
          <h2 className="h3">Sweep Worker</h2>
          <p className="copy">Selected sweep: <strong>{status?.displayName || "Remaining Depth-02"}</strong></p>
          <p className="copy">Scheduler target: <strong>{status?.schedulerSweepKey || "unknown"}</strong></p>
          <p className="copy">{status?.schedulerMatchesSweep ? "Scheduler is aimed at this sweep." : "Scheduler is not yet aimed at this sweep."}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: ".55rem", marginTop: ".8rem" }}>
            {Object.entries(groups).map(([label, value]) => (
              <div key={label} style={{ border: "1px solid rgba(255,255,255,.13)", borderRadius: 10, padding: ".6rem" }}>
                <div className="eyebrow">{label}</div><strong style={{ fontSize: "1.2rem" }}>{value}</strong>
              </div>
            ))}
          </div>
          <div className="button-row" style={{ marginTop: ".8rem", flexWrap: "wrap", gap: ".55rem" }}>
            <button className="button" type="button" disabled={Boolean(busy)} onClick={refreshStatus}>{busy === "status" ? "Refreshing…" : "Refresh Status"}</button>
            <Link className="button" href="/admin/review">Review Center</Link>
          </div>
        </div>
      </div>

      {notice ? <div className="card"><div className="eyebrow">Control response</div><p className="copy" style={{ marginBottom: 0 }}>{notice}</p></div> : null}

      <div className="card">
        <div className="eyebrow">Human gate</div>
        <h2 className="h3">What the automation may do</h2>
        <p className="copy">Research → Curation → Knowledge staging → Muse IQ validation → Prepare Human Review.</p>
        <p className="copy" style={{ marginBottom: 0 }}><strong>It may not approve or release production knowledge.</strong> Those decisions remain in Review Center for an authorized human.</p>
      </div>
    </>
  );
}
