import Link from "next/link";

import {
  AgentAuthorizationError,
  getAgentAdminClient,
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

type UsageRow = {
  id: string;
  created_at: string;
  activity_type: string;
  operation: string | null;
  model: string;
  input_tokens: number | string | null;
  output_tokens: number | string | null;
  total_tokens: number | string | null;
  web_search_calls: number | string | null;
  estimated_cost_usd: number | string | null;
  duration_ms: number | string | null;
  status: string;
  agent_job_id: string | null;
  metadata: Record<string, unknown> | null;
};

type AgentJobRow = {
  id: string;
  title: string;
  muse_key: string;
  status: string;
};

type Summary = {
  calls: number;
  cost: number;
  tokens: number;
  webSearches: number;
};

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarize(rows: UsageRow[]): Summary {
  return rows.reduce<Summary>(
    (total, row) => ({
      calls: total.calls + 1,
      cost: total.cost + num(row.estimated_cost_usd),
      tokens: total.tokens + num(row.total_tokens),
      webSearches: total.webSearches + num(row.web_search_calls),
    }),
    { calls: 0, cost: 0, tokens: 0, webSearches: 0 },
  );
}

function usd(value: number): string {
  if (value > 0 && value < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(2)}`;
}

function integer(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function duration(value: unknown): string {
  const ms = num(value);
  if (!ms) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function activityLabel(value: string): string {
  const labels: Record<string, string> = {
    talk_to_muse: "Talk to a Muse",
    song_intelligence: "Song Intelligence",
    agent_research: "Agent Research",
    agent_curation: "Agent Curation",
    agent_validation: "Agent Validation",
    muse_knowledge_embedding: "Knowledge Embedding",
    other: "Other",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function eventMuse(
  row: UsageRow,
  jobs: Map<string, AgentJobRow>,
): string | null {
  const metadata = row.metadata ?? {};
  const direct = metadata.muse_key ?? metadata.muse_slug;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  if (row.agent_job_id) {
    return jobs.get(row.agent_job_id)?.muse_key ?? null;
  }
  return null;
}

function aggregateBy(
  rows: UsageRow[],
  keyFor: (row: UsageRow) => string | null,
): Array<{ key: string; summary: Summary }> {
  const groups = new Map<string, UsageRow[]>();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([key, groupRows]) => ({ key, summary: summarize(groupRows) }))
    .sort((a, b) => b.summary.cost - a.summary.cost);
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="card" style={{ minHeight: 132 }}>
      <div className="eyebrow">{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: ".35rem" }}>
        {value}
      </div>
      <p className="copy" style={{ margin: ".35rem 0 0" }}>
        {note}
      </p>
    </div>
  );
}

function AccessMessage({ status }: { status: number }) {
  const signedOut = status === 401;
  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="card">
          <div className="eyebrow">AI operations</div>
          <h1 className="h2">AI Metrics</h1>
          <p className="copy">
            {signedOut
              ? "Sign in with an iDreamMusic agent-admin account to view AI usage and cost metrics."
              : "This page is reserved for authorized iDreamMusic agent administrators."}
          </p>
          {signedOut ? (
            <Link className="button primary" href="/auth/sign-in?next=/admin/metrics">
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default async function AIMetricsPage() {
  try {
    await requireAgentAdmin();
  } catch (error) {
    const status =
      error instanceof AgentAuthorizationError ? error.status : 500;
    return <AccessMessage status={status} />;
  }

  const admin = getAgentAdminClient();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS).toISOString();

  const { data, error } = await admin
    .from("ai_usage_events")
    .select(
      "id, created_at, activity_type, operation, model, input_tokens, output_tokens, total_tokens, web_search_calls, estimated_cost_usd, duration_ms, status, agent_job_id, metadata",
    )
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return (
      <section className="section-tight">
        <div className="container pageStack">
          <div className="card">
            <div className="eyebrow">AI operations</div>
            <h1 className="h2">AI Metrics</h1>
            <p className="copy">Could not load usage telemetry: {error.message}</p>
          </div>
        </div>
      </section>
    );
  }

  const rows = (data ?? []) as UsageRow[];
  const agentIds = [
    ...new Set(rows.map((row) => row.agent_job_id).filter(Boolean) as string[]),
  ];
  const jobs = new Map<string, AgentJobRow>();

  if (agentIds.length) {
    const { data: jobData } = await admin
      .from("agent_jobs")
      .select("id, title, muse_key, status")
      .in("id", agentIds);

    for (const job of (jobData ?? []) as AgentJobRow[]) {
      jobs.set(job.id, job);
    }
  }

  const last24Rows = rows.filter(
    (row) => new Date(row.created_at).getTime() >= now - DAY_MS,
  );
  const last7Rows = rows.filter(
    (row) => new Date(row.created_at).getTime() >= now - 7 * DAY_MS,
  );

  const summary24 = summarize(last24Rows);
  const summary7 = summarize(last7Rows);
  const summary30 = summarize(rows);
  const monthlyRunRate = summary7.cost * (30 / 7);

  const byActivity = aggregateBy(rows, (row) => row.activity_type);
  const byMuse = aggregateBy(rows, (row) => eventMuse(row, jobs));
  const expensive = [...rows]
    .sort(
      (a, b) => num(b.estimated_cost_usd) - num(a.estimated_cost_usd),
    )
    .slice(0, 10);

  const thStyle = {
    textAlign: "left" as const,
    padding: ".65rem .55rem",
    borderBottom: "1px solid var(--border, rgba(127,127,127,.25))",
    whiteSpace: "nowrap" as const,
  };
  const tdStyle = {
    padding: ".65rem .55rem",
    borderBottom: "1px solid var(--border, rgba(127,127,127,.16))",
    verticalAlign: "top" as const,
  };

  return (
    <section className="section-tight">
      <div className="container pageStack">
        <div className="page-intro">
          <div>
            <div className="eyebrow">AI operations</div>
            <h1 className="h2">AI Metrics</h1>
            <p className="copy" style={{ maxWidth: 820 }}>
              Estimated OpenAI usage costs recorded by iDreamMusic. These are
              operational estimates from the dated pricing map, not invoice totals.
            </p>
            <div className="button-row">
              <Link className="button" href="/admin/review">
                Review queue
              </Link>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "1rem",
          }}
        >
          <MetricCard
            label="Last 24 hours"
            value={usd(summary24.cost)}
            note={`${summary24.calls} AI calls · ${integer(summary24.tokens)} tokens`}
          />
          <MetricCard
            label="Last 7 days"
            value={usd(summary7.cost)}
            note={`${summary7.calls} calls · ${integer(summary7.webSearches)} web searches`}
          />
          <MetricCard
            label="Last 30 days"
            value={usd(summary30.cost)}
            note={`${summary30.calls} calls captured`}
          />
          <MetricCard
            label="7-day run-rate"
            value={usd(monthlyRunRate)}
            note="Projected 30-day spend if the last 7 days repeat"
          />
        </div>

        <div className="card">
          <div className="eyebrow">By capability · last 30 days</div>
          <h2 className="h3">Where the AI spend is going</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Capability</th>
                  <th style={thStyle}>Calls</th>
                  <th style={thStyle}>Cost</th>
                  <th style={thStyle}>Avg / call</th>
                  <th style={thStyle}>Tokens</th>
                  <th style={thStyle}>Web searches</th>
                </tr>
              </thead>
              <tbody>
                {byActivity.map(({ key, summary }) => (
                  <tr key={key}>
                    <td style={tdStyle}>{activityLabel(key)}</td>
                    <td style={tdStyle}>{integer(summary.calls)}</td>
                    <td style={tdStyle}>{usd(summary.cost)}</td>
                    <td style={tdStyle}>
                      {usd(summary.calls ? summary.cost / summary.calls : 0)}
                    </td>
                    <td style={tdStyle}>{integer(summary.tokens)}</td>
                    <td style={tdStyle}>{integer(summary.webSearches)}</td>
                  </tr>
                ))}
                {!byActivity.length ? (
                  <tr>
                    <td style={tdStyle} colSpan={6}>
                      No AI usage events have been recorded in the last 30 days.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {byMuse.length ? (
          <div className="card">
            <div className="eyebrow">Muse view · last 30 days</div>
            <h2 className="h3">Cost by Muse</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Muse</th>
                    <th style={thStyle}>Calls</th>
                    <th style={thStyle}>Cost</th>
                    <th style={thStyle}>Tokens</th>
                    <th style={thStyle}>Web searches</th>
                  </tr>
                </thead>
                <tbody>
                  {byMuse.map(({ key, summary }) => (
                    <tr key={key}>
                      <td style={tdStyle}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </td>
                      <td style={tdStyle}>{integer(summary.calls)}</td>
                      <td style={tdStyle}>{usd(summary.cost)}</td>
                      <td style={tdStyle}>{integer(summary.tokens)}</td>
                      <td style={tdStyle}>{integer(summary.webSearches)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="card">
          <div className="eyebrow">Cost watch</div>
          <h2 className="h3">Most expensive recent calls</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Capability</th>
                  <th style={thStyle}>Cost</th>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>Tokens</th>
                  <th style={thStyle}>Searches</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Context</th>
                </tr>
              </thead>
              <tbody>
                {expensive.map((row) => {
                  const job = row.agent_job_id
                    ? jobs.get(row.agent_job_id)
                    : null;
                  const muse = eventMuse(row, jobs);
                  const context = job?.title ?? muse ?? row.operation ?? "—";
                  return (
                    <tr key={row.id}>
                      <td style={tdStyle}>
                        {new Date(row.created_at).toLocaleString("en-US", {
                          timeZone: "America/Chicago",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td style={tdStyle}>{activityLabel(row.activity_type)}</td>
                      <td style={tdStyle}>{usd(num(row.estimated_cost_usd))}</td>
                      <td style={tdStyle}>{row.model}</td>
                      <td style={tdStyle}>{integer(num(row.total_tokens))}</td>
                      <td style={tdStyle}>{integer(num(row.web_search_calls))}</td>
                      <td style={tdStyle}>{duration(row.duration_ms)}</td>
                      <td style={tdStyle}>{context}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Operating posture</div>
          <h2 className="h3">Research defaults</h2>
          <p className="copy">
            Ordinary Research Agent jobs default to a 10-candidate pool. A job can
            still request a larger explicit <code>target_candidate_pool</code> for a
            deeper scouting pass.
          </p>
        </div>
      </div>
    </section>
  );
}
