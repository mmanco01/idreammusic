"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type GapRecommendation = {
  id: string;
  muse_key: string;
  current_version?: string | null;
  recommendation: "HOLD" | "DEEPEN";
  gap_score: number;
  weak_capabilities?: string[] | null;
  requested_source_count?: number | null;
  proposed_mission: string;
  evidence?: Record<string, any> | null;
  status:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "JOB_CREATED";
  created_job_id?: string | null;
};

type GapRun = {
  id: string;
  status: string;
  analysis_version?: string;
  source_depth?: number;
  target_depth?: number;
  summary?: Record<string, any>;
  created_at?: string;
  completed_at?: string | null;
};

type GapPayload = {
  status?: string;
  message?: string;
  run?: GapRun | null;
  recommendations?: GapRecommendation[];
  created?: any[];
  reused?: any[];
};

const MUSE_LABELS: Record<string, string> = {
  calliope: "Calliope · Story",
  clio: "Clio · Roots",
  erato: "Erato · Love",
  euterpe: "Euterpe · Craft",
  melpomene: "Melpomene · Blues",
  polyhymnia: "Polyhymnia · Faith",
  terpsichore: "Terpsichore · Rhythm",
  thalia: "Thalia · Play",
  urania: "Urania · Dream",
};

function numberOrDash(
  value: unknown,
  digits = 2,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toFixed(digits)
    : "—";
}

export function GapAnalysisControls() {
  const [run, setRun] =
    useState<GapRun | null>(null);
  const [recommendations, setRecommendations] =
    useState<GapRecommendation[]>([]);
  const [busy, setBusy] =
    useState<string | null>(null);
  const [notice, setNotice] =
    useState("");

  async function post(
    body: Record<string, unknown>,
  ) {
    const response = await fetch(
      "/api/admin/agent/gap-analysis",
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const payload =
      (await response
        .json()
        .catch(() => null)) as GapPayload | null;

    if (
      !response.ok ||
      payload?.status === "error"
    ) {
      throw new Error(
        payload?.message ||
          "Gap Analysis request failed.",
      );
    }

    return payload ?? {};
  }

  async function loadLatest() {
    setBusy("latest");
    try {
      const payload = await post({
        action: "latest",
      });
      setRun(payload.run ?? null);
      setRecommendations(
        payload.recommendations ?? [],
      );
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Gap Analysis could not load.",
      );
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void loadLatest();
  }, []);

  async function analyze() {
    setBusy("analyze");
    setNotice("");

    try {
      const payload = await post({
        action: "analyze",
      });
      setRun(payload.run ?? null);
      setRecommendations(
        payload.recommendations ?? [],
      );
      setNotice(
        "Nine-Muse gap analysis complete. Review the evidence before approving any Depth-03 research mission.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Gap Analysis could not run.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function decide(
    recommendationId: string,
    decision: "APPROVED" | "REJECTED",
  ) {
    setBusy(
      `${decision}:${recommendationId}`,
    );
    setNotice("");

    try {
      await post({
        action: "decide",
        recommendationId,
        decision,
        decisionNotes:
          decision === "APPROVED"
            ? "Human approved targeted Depth-03 research mission from Gap Analysis."
            : "Human rejected this Depth-03 research mission.",
      });
      await loadLatest();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Gap recommendation could not be updated.",
      );
      setBusy(null);
    }
  }

  async function createApprovedJobs() {
    if (!run?.id) return;

    setBusy("create-jobs");
    setNotice("");

    try {
      const payload = await post({
        action: "create-approved-jobs",
        runId: run.id,
      });

      setNotice(
        `Depth-03 planning gate complete: ${payload.created?.length ?? 0} job(s) created, ${payload.reused?.length ?? 0} existing job(s) reused. Research has not started.`,
      );
      await loadLatest();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Approved Depth-03 jobs could not be created.",
      );
      setBusy(null);
    }
  }

  const approvedCount = useMemo(
    () =>
      recommendations.filter(
        (item) =>
          item.recommendation === "DEEPEN" &&
          item.status === "APPROVED",
      ).length,
    [recommendations],
  );

  const deepenCount =
    recommendations.filter(
      (item) =>
        item.recommendation === "DEEPEN",
    ).length;

  const holdCount =
    recommendations.filter(
      (item) =>
        item.recommendation === "HOLD",
    ).length;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="card">
          <div className="eyebrow">
            Evidence first
          </div>
          <h2 className="h3">
            Analyze Nine Muses
          </h2>
          <p className="copy">
            Reads the released Depth-02 jobs and current global production library. It does not change production and does not create research work.
          </p>
          <button
            className="button primary"
            type="button"
            disabled={Boolean(busy)}
            onClick={analyze}
          >
            {busy === "analyze"
              ? "Analyzing…"
              : "Run Gap Analysis"}
          </button>
        </div>

        <div className="card">
          <div className="eyebrow">
            Current analysis
          </div>
          <h2 className="h3">
            {run
              ? `Depth-${run.source_depth ?? 2} → Depth-${run.target_depth ?? 3}`
              : "No analysis yet"}
          </h2>
          <p className="copy">
            DEEPEN: <strong>{deepenCount}</strong>
            <br />
            HOLD: <strong>{holdCount}</strong>
            <br />
            Approved missions waiting for job creation: <strong>{approvedCount}</strong>
          </p>
          <button
            className="button"
            type="button"
            disabled={Boolean(busy)}
            onClick={loadLatest}
          >
            {busy === "latest"
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </div>

        <div className="card">
          <div className="eyebrow">
            Human research gate
          </div>
          <h2 className="h3">
            Create Approved Depth-03 Jobs
          </h2>
          <p className="copy">
            This is intentionally separate from approval. Only approved DEEPEN missions become NEW candidate jobs. Research still does not start automatically from this button.
          </p>
          <button
            className="button primary"
            type="button"
            disabled={
              Boolean(busy) ||
              !run?.id ||
              approvedCount === 0
            }
            onClick={createApprovedJobs}
          >
            {busy === "create-jobs"
              ? "Creating…"
              : "Create Approved Jobs"}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="card">
          <p
            className="copy"
            style={{ margin: 0 }}
          >
            {notice}
          </p>
        </div>
      ) : null}

      {recommendations.length ? (
        <div className="pageStack">
          {recommendations.map(
            (item) => {
              const evidence =
                item.evidence ?? {};
              const validation =
                evidence.validation ?? {};
              const coverage =
                Array.isArray(
                  evidence.capabilityCoverage,
                )
                  ? evidence.capabilityCoverage
                  : [];
              const pending =
                item.status === "PENDING";

              return (
                <div
                  className="card"
                  key={item.id}
                >
                  <div className="eyebrow">
                    {MUSE_LABELS[
                      item.muse_key
                    ] || item.muse_key}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "flex-start",
                      gap: "1rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2
                        className="h3"
                        style={{
                          marginBottom: ".35rem",
                        }}
                      >
                        {item.recommendation}
                      </h2>
                      <p
                        className="copy"
                        style={{
                          marginTop: 0,
                          opacity: 0.78,
                        }}
                      >
                        Gap score {numberOrDash(
                          item.gap_score,
                          1,
                        )} · {item.status}
                      </p>
                    </div>
                    <strong>
                      {item.current_version ||
                        "No released Depth-02 version found"}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: ".55rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <div className="eyebrow">
                        Production sources
                      </div>
                      <strong>
                        {evidence.productionSourceCount ??
                          "—"}
                      </strong>
                    </div>
                    <div>
                      <div className="eyebrow">
                        Depth-02 accepted
                      </div>
                      <strong>
                        {evidence.acceptedDepth02SourceCount ??
                          "—"}
                      </strong>
                    </div>
                    <div>
                      <div className="eyebrow">
                        Muse IQ pass rate
                      </div>
                      <strong>
                        {validation.passRate ??
                          "—"}%
                      </strong>
                    </div>
                    <div>
                      <div className="eyebrow">
                        Muse IQ score
                      </div>
                      <strong>
                        {numberOrDash(
                          validation.averageOverallScore,
                        )}
                      </strong>
                    </div>
                    <div>
                      <div className="eyebrow">
                        Avg novelty
                      </div>
                      <strong>
                        {numberOrDash(
                          evidence.averageNovelty,
                        )}
                      </strong>
                    </div>
                    <div>
                      <div className="eyebrow">
                        Provenance complete
                      </div>
                      <strong>
                        {evidence.provenanceCompleteCount ??
                          "—"}/
                        {evidence.acceptedDepth02SourceCount ??
                          "—"}
                      </strong>
                    </div>
                  </div>

                  {item.weak_capabilities?.length ? (
                    <p className="copy">
                      <strong>
                        Evidence-backed focus:
                      </strong>{" "}
                      {item.weak_capabilities.join(
                        ", ",
                      )}
                    </p>
                  ) : null}

                  {coverage.length ? (
                    <p className="copy">
                      <strong>
                        Depth-02 accepted-source tag coverage:
                      </strong>{" "}
                      {coverage
                        .map(
                          (entry: any) =>
                            `${entry.capability} (${entry.acceptedSourceCoverage})`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}

                  <p className="copy">
                    <strong>
                      Proposed mission:
                    </strong>{" "}
                    {item.proposed_mission}
                  </p>

                  {item.recommendation ===
                  "DEEPEN" ? (
                    <p className="copy">
                      Proposed research budget:{" "}
                      <strong>
                        {item.requested_source_count ??
                          "—"}{" "}
                        source(s)
                      </strong>
                    </p>
                  ) : (
                    <p className="copy">
                      No new research budget proposed.
                    </p>
                  )}

                  {item.recommendation ===
                    "DEEPEN" && pending ? (
                    <div
                      className="button-row"
                      style={{
                        flexWrap: "wrap",
                        gap: ".55rem",
                      }}
                    >
                      <button
                        className="button primary"
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          decide(
                            item.id,
                            "APPROVED",
                          )
                        }
                      >
                        Approve Mission
                      </button>
                      <button
                        className="button"
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          decide(
                            item.id,
                            "REJECTED",
                          )
                        }
                      >
                        Reject Mission
                      </button>
                    </div>
                  ) : null}

                  {item.created_job_id ? (
                    <p
                      className="copy"
                      style={{
                        marginBottom: 0,
                        opacity: 0.78,
                      }}
                    >
                      Depth-03 candidate job:{" "}
                      <code>
                        {item.created_job_id}
                      </code>
                    </p>
                  ) : null}
                </div>
              );
            },
          )}
        </div>
      ) : (
        <div className="card">
          <p
            className="copy"
            style={{ margin: 0 }}
          >
            No saved gap analysis yet. Run the analyzer to produce the first nine-Muse learning plan.
          </p>
        </div>
      )}
    </>
  );
}
