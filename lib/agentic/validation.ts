type ValidationTarget =
  | "baseline"
  | "candidate";

type ValidationPhase =
  | "BASELINE"
  | "CANDIDATE"
  | "RECHECK"
  | "FINALIZE"
  | "COMPLETE";

type ValidationBenchmarkResult = {
  benchmarkKey: string;
  status: string;
  passed: boolean;
  overallScore: number | null;
  retrievalScore: number | null;
  citationScore: number | null;
  responseScore: number | null;
  structureScore: number | null;
  failureCategories: string[];
  evaluatorNotes: string | null;
  runId: string;
};

type ValidationRecheck = {
  target: ValidationTarget;
  benchmarkKey: string;
  reason:
    | "response_variance"
    | "execution_failure";
  attempts: number;
  results: ValidationBenchmarkResult[];
  resolution:
    | null
    | "variance_pass"
    | "execution_recovered"
    | "unstable"
    | "confirmed_failure";
};

type MetricSummary = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  averageOverallScore: number | null;
  averageRetrievalScore: number | null;
  averageCitationScore: number | null;
  averageResponseScore: number | null;
  averageStructureScore: number | null;
};

type ValidationState = {
  agent: "validation-agent-v1";
  phase: ValidationPhase;
  batchSize: number;
  benchmarkCount: number;
  nextOffset: number;
  baselineRunIds: string[];
  candidateRunIds: string[];
  baselineResults: ValidationBenchmarkResult[];
  candidateResults: ValidationBenchmarkResult[];
  rechecks: ValidationRecheck[];
  startedAt: string;
  completedAt: string | null;
  final: Record<string, unknown> | null;
};

const AGENT_NAME =
  "validation-agent-v1" as const;

const BATCH_SIZE = 3;
const AVERAGE_OVERALL_REGRESSION_LIMIT = -0.5;
const INDIVIDUAL_OVERALL_REGRESSION_LIMIT = -3.0;

function isRecord(
  value: unknown,
): value is Record<string, any> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function finiteOrNull(
  value: unknown,
): number | null {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function stringArray(
  value: unknown,
): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (
            item,
          ): item is string =>
            typeof item === "string",
        )
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function average(
  rows: ValidationBenchmarkResult[],
  key:
    | "overallScore"
    | "retrievalScore"
    | "citationScore"
    | "responseScore"
    | "structureScore",
): number | null {
  const values = rows
    .map((row) => row[key])
    .filter(
      (
        value,
      ): value is number =>
        typeof value === "number" &&
        Number.isFinite(value),
    );

  if (!values.length) {
    return null;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

function metricSummary(
  rows: ValidationBenchmarkResult[],
): MetricSummary {
  const passed = rows.filter(
    (row) => row.passed,
  ).length;

  return {
    total: rows.length,
    passed,
    failed: rows.length - passed,
    passRate:
      rows.length
        ? (passed / rows.length) * 100
        : 0,
    averageOverallScore:
      average(rows, "overallScore"),
    averageRetrievalScore:
      average(rows, "retrievalScore"),
    averageCitationScore:
      average(rows, "citationScore"),
    averageResponseScore:
      average(rows, "responseScore"),
    averageStructureScore:
      average(rows, "structureScore"),
  };
}

function mergeBenchmarkResults(
  current: ValidationBenchmarkResult[],
  incoming: ValidationBenchmarkResult[],
) {
  const byKey =
    new Map<
      string,
      ValidationBenchmarkResult
    >(
      current.map((row) => [
        row.benchmarkKey,
        row,
      ]),
    );

  for (const row of incoming) {
    byKey.set(
      row.benchmarkKey,
      row,
    );
  }

  return Array.from(
    byKey.values(),
  ).sort((a, b) =>
    a.benchmarkKey.localeCompare(
      b.benchmarkKey,
    ),
  );
}

function isResponseVarianceCandidate(
  result: ValidationBenchmarkResult,
) {
  if (
    result.passed ||
    result.status !== "failed"
  ) {
    return false;
  }

  if (
    result.failureCategories.length !== 1 ||
    result.failureCategories[0] !== "response"
  ) {
    return false;
  }

  return (
    (result.retrievalScore ?? 0) >= 90 &&
    (result.citationScore ?? 0) >= 90 &&
    (result.structureScore ?? 0) >= 90
  );
}

function isExecutionRetryCandidate(
  result: ValidationBenchmarkResult,
) {
  if (result.passed) {
    return false;
  }

  return (
    result.status === "error" ||
    result.failureCategories.includes(
      "execution",
    )
  );
}

function averageRechecks(
  original: ValidationBenchmarkResult,
  rows: ValidationBenchmarkResult[],
): ValidationBenchmarkResult {
  const safeAverage = (
    key:
      | "overallScore"
      | "retrievalScore"
      | "citationScore"
      | "responseScore"
      | "structureScore",
  ) =>
    average(rows, key) ??
    original[key];

  return {
    ...original,
    status: "passed",
    passed: true,
    overallScore:
      safeAverage("overallScore"),
    retrievalScore:
      safeAverage("retrievalScore"),
    citationScore:
      safeAverage("citationScore"),
    responseScore:
      safeAverage("responseScore"),
    structureScore:
      safeAverage("structureScore"),
    failureCategories: [],
    evaluatorNotes:
      "Adjudicated as response-generation variance after two successful rechecks.",
    runId:
      rows[rows.length - 1]?.runId ??
      original.runId,
  };
}

function adjudicatedResults({
  target,
  results,
  rechecks,
}: {
  target: ValidationTarget;
  results: ValidationBenchmarkResult[];
  rechecks: ValidationRecheck[];
}) {
  return results.map((result) => {
    if (result.passed) {
      return result;
    }

    const recheck =
      rechecks.find(
        (item) =>
          item.target === target &&
          item.benchmarkKey ===
            result.benchmarkKey,
      );

    if (
      recheck?.resolution ===
      "variance_pass"
    ) {
      return averageRechecks(
        result,
        recheck.results.filter(
          (row) => row.passed,
        ),
      );
    }

    if (
      recheck?.resolution ===
      "execution_recovered"
    ) {
      const recovered =
        recheck.results.find(
          (row) => row.passed,
        );

      if (recovered) {
        return {
          ...recovered,
          evaluatorNotes:
            "Recovered after transient benchmark execution failure.",
        };
      }
    }

    return result;
  });
}

async function loadRunResults({
  supabase,
  runId,
}: {
  supabase: any;
  runId: string;
}): Promise<
  ValidationBenchmarkResult[]
> {
  const {
    data: rows,
    error,
  } = await supabase
    .from("muse_benchmark_results")
    .select(
      `
        benchmark_id,
        status,
        passed,
        overall_score,
        retrieval_score,
        citation_score,
        response_score,
        structure_score,
        failure_categories,
        evaluator_notes
      `,
    )
    .eq("run_id", runId);

  if (error) {
    throw new Error(
      `Could not load Muse IQ results for ${runId}: ${error.message}`,
    );
  }

  const benchmarkIds =
    Array.from(
      new Set(
        (rows ?? [])
          .map((row: any) =>
            String(
              row.benchmark_id ?? "",
            ),
          )
          .filter(Boolean),
      ),
    );

  if (!benchmarkIds.length) {
    return [];
  }

  const {
    data: benchmarkRows,
    error: benchmarkError,
  } = await supabase
    .from("muse_benchmarks")
    .select("id, benchmark_key")
    .in("id", benchmarkIds);

  if (benchmarkError) {
    throw new Error(
      `Could not resolve benchmark keys: ${benchmarkError.message}`,
    );
  }

  const keyById =
    new Map<string, string>(
      (benchmarkRows ?? []).map(
        (row: any) => [
          String(row.id),
          String(row.benchmark_key),
        ],
      ),
    );

  return (rows ?? [])
    .map(
      (
        row: any,
      ): ValidationBenchmarkResult => ({
        benchmarkKey:
          keyById.get(
            String(row.benchmark_id),
          ) ??
          String(row.benchmark_id),
        status:
          String(row.status ?? "error"),
        passed:
          row.passed === true,
        overallScore:
          finiteOrNull(row.overall_score),
        retrievalScore:
          finiteOrNull(row.retrieval_score),
        citationScore:
          finiteOrNull(row.citation_score),
        responseScore:
          finiteOrNull(row.response_score),
        structureScore:
          finiteOrNull(row.structure_score),
        failureCategories:
          stringArray(
            row.failure_categories,
          ),
        evaluatorNotes:
          typeof row.evaluator_notes ===
          "string"
            ? row.evaluator_notes
            : null,
        runId,
      }),
    )
    .sort((
      a: ValidationBenchmarkResult,
      b: ValidationBenchmarkResult,
    ) =>
      a.benchmarkKey.localeCompare(
        b.benchmarkKey,
      ),
    );
}

async function callMuseIq({
  origin,
  cookie,
  museSlug,
  deploymentLabel,
  agentJobId,
  limit,
  offset,
  benchmarkKey,
}: {
  origin: string;
  cookie: string;
  museSlug: string;
  deploymentLabel: string;
  agentJobId?: string | null;
  limit?: number;
  offset?: number;
  benchmarkKey?: string | null;
}) {
  const body: Record<
    string,
    unknown
  > = {
    museSlug,
    deploymentLabel:
      deploymentLabel.slice(0, 150),
  };

  if (benchmarkKey) {
    body.benchmarkKey = benchmarkKey;
  } else {
    body.limit = limit ?? BATCH_SIZE;
    body.offset = offset ?? 0;
  }

  if (agentJobId) {
    body.agentJobId = agentJobId;
  }

  const response =
    await fetch(
      `${origin}/api/admin/muse-iq/run`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
          ...(cookie
            ? { cookie }
            : {}),
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

  const payload =
    await response
      .json()
      .catch(() => null);

  if (
    !response.ok ||
    payload?.status !== "success" ||
    !payload?.run?.id
  ) {
    throw new Error(
      payload?.message ||
        `Muse IQ returned HTTP ${response.status}.`,
    );
  }

  return String(payload.run.id);
}

function makeRecheckQueue(
  baseline: ValidationBenchmarkResult[],
  candidate: ValidationBenchmarkResult[],
): ValidationRecheck[] {
  const queue: ValidationRecheck[] = [];

  for (const [
    target,
    rows,
  ] of [
    ["baseline", baseline],
    ["candidate", candidate],
  ] as const) {
    for (const row of rows) {
      if (
        isResponseVarianceCandidate(row)
      ) {
        queue.push({
          target,
          benchmarkKey:
            row.benchmarkKey,
          reason:
            "response_variance",
          attempts: 0,
          results: [],
          resolution: null,
        });

        continue;
      }

      if (
        isExecutionRetryCandidate(row)
      ) {
        queue.push({
          target,
          benchmarkKey:
            row.benchmarkKey,
          reason:
            "execution_failure",
          attempts: 0,
          results: [],
          resolution: null,
        });
      }
    }
  }

  return queue;
}

async function persistValidationState({
  supabase,
  jobId,
  baseSummary,
  state,
  status,
  currentAgent = null,
  lastError = null,
  requiresHumanReview,
}: {
  supabase: any;
  jobId: string;
  baseSummary: Record<string, any>;
  state: ValidationState;
  status: string;
  currentAgent?: string | null;
  lastError?: string | null;
  requiresHumanReview?: boolean;
}) {
  const update: Record<
    string,
    unknown
  > = {
    status,
    current_agent: currentAgent,
    last_error: lastError,
    result_summary: {
      ...baseSummary,
      validation: state,
    },
  };

  if (
    typeof requiresHumanReview ===
    "boolean"
  ) {
    update.requires_human_review =
      requiresHumanReview;
  }

  const { error } =
    await supabase
      .from("agent_jobs")
      .update(update)
      .eq("id", jobId);

  if (error) {
    throw new Error(
      `Could not save Validation Agent state: ${error.message}`,
    );
  }
}

function metricDelta(
  candidate: number | null,
  baseline: number | null,
) {
  if (
    candidate === null ||
    baseline === null
  ) {
    return null;
  }

  return candidate - baseline;
}

function round3(
  value: number | null,
) {
  return value === null
    ? null
    : Math.round(value * 1000) /
        1000;
}

function buildFinalComparison({
  benchmarkCount,
  baseline,
  candidate,
  rechecks,
}: {
  benchmarkCount: number;
  baseline: ValidationBenchmarkResult[];
  candidate: ValidationBenchmarkResult[];
  rechecks: ValidationRecheck[];
}) {
  const baselineEffective =
    adjudicatedResults({
      target: "baseline",
      results: baseline,
      rechecks,
    });

  const candidateEffective =
    adjudicatedResults({
      target: "candidate",
      results: candidate,
      rechecks,
    });

  const baselineSummary =
    metricSummary(baselineEffective);
  const candidateSummary =
    metricSummary(candidateEffective);

  const baselineByKey =
    new Map(
      baselineEffective.map((row) => [
        row.benchmarkKey,
        row,
      ]),
    );
  const candidateByKey =
    new Map(
      candidateEffective.map((row) => [
        row.benchmarkKey,
        row,
      ]),
    );

  const benchmarkDeltas =
    Array.from(
      new Set([
        ...baselineByKey.keys(),
        ...candidateByKey.keys(),
      ]),
    )
      .sort()
      .map((benchmarkKey) => {
        const baselineRow =
          baselineByKey.get(
            benchmarkKey,
          );
        const candidateRow =
          candidateByKey.get(
            benchmarkKey,
          );

        return {
          benchmarkKey,
          baselinePassed:
            baselineRow?.passed ?? false,
          candidatePassed:
            candidateRow?.passed ?? false,
          baselineOverall:
            baselineRow?.overallScore ?? null,
          candidateOverall:
            candidateRow?.overallScore ?? null,
          overallDelta:
            round3(
              metricDelta(
                candidateRow?.overallScore ??
                  null,
                baselineRow?.overallScore ??
                  null,
              ),
            ),
        };
      });

  const unstableBaseline =
    rechecks.some(
      (item) =>
        item.target === "baseline" &&
        (
          item.resolution ===
            "unstable" ||
          (
            item.reason ===
              "execution_failure" &&
            item.resolution ===
              "confirmed_failure"
          )
        ),
    );

  const unstableCandidate =
    rechecks.some(
      (item) =>
        item.target === "candidate" &&
        (
          item.resolution ===
            "unstable" ||
          (
            item.reason ===
              "execution_failure" &&
            item.resolution ===
              "confirmed_failure"
          )
        ),
    );

  const baselineCompletePass =
    baselineSummary.total ===
      benchmarkCount &&
    baselineSummary.passed ===
      benchmarkCount;
  const candidateCompletePass =
    candidateSummary.total ===
      benchmarkCount &&
    candidateSummary.passed ===
      benchmarkCount;

  const averageOverallDelta =
    round3(
      metricDelta(
        candidateSummary
          .averageOverallScore,
        baselineSummary
          .averageOverallScore,
      ),
    );
  const averageRetrievalDelta =
    round3(
      metricDelta(
        candidateSummary
          .averageRetrievalScore,
        baselineSummary
          .averageRetrievalScore,
      ),
    );
  const averageCitationDelta =
    round3(
      metricDelta(
        candidateSummary
          .averageCitationScore,
        baselineSummary
          .averageCitationScore,
      ),
    );
  const averageResponseDelta =
    round3(
      metricDelta(
        candidateSummary
          .averageResponseScore,
        baselineSummary
          .averageResponseScore,
      ),
    );
  const averageStructureDelta =
    round3(
      metricDelta(
        candidateSummary
          .averageStructureScore,
        baselineSummary
          .averageStructureScore,
      ),
    );

  const largeIndividualRegression =
    benchmarkDeltas.some(
      (row) =>
        row.overallDelta !== null &&
        row.overallDelta <
          INDIVIDUAL_OVERALL_REGRESSION_LIMIT,
    );

  const watchItems: string[] = [];

  for (const row of benchmarkDeltas) {
    if (
      row.overallDelta !== null &&
      row.overallDelta <= -1
    ) {
      watchItems.push(
        `${row.benchmarkKey} overall delta ${row.overallDelta.toFixed(3)}`,
      );
    }
  }

  if (
    averageCitationDelta !== null &&
    averageCitationDelta <= -1
  ) {
    watchItems.push(
      `Average citation delta ${averageCitationDelta.toFixed(3)}`,
    );
  }

  if (
    averageRetrievalDelta !== null &&
    averageRetrievalDelta <= -1
  ) {
    watchItems.push(
      `Average retrieval delta ${averageRetrievalDelta.toFixed(3)}`,
    );
  }

  const varianceRechecks =
    rechecks
      .filter(
        (item) =>
          item.resolution ===
          "variance_pass",
      )
      .map(
        (item) =>
          `${item.target}:${item.benchmarkKey}`,
      );

  if (varianceRechecks.length) {
    watchItems.push(
      `Response variance adjudicated for ${varianceRechecks.join(", ")}`,
    );
  }

  let classification: string;
  let targetStatus:
    | "RELEASE_CANDIDATE"
    | "DIAGNOSING"
    | "HUMAN_REVIEW";

  const baselineConfirmedFailures =
    rechecks.filter(
      (item) =>
        item.target === "baseline" &&
        item.resolution ===
          "confirmed_failure",
    );

  const baselineExecutionFailures =
    baselineConfirmedFailures.filter(
      (item) =>
        item.reason ===
          "execution_failure",
    );

  const repairedBaselineFailures =
    baselineConfirmedFailures.filter(
      (item) => {
        const candidateRow =
          candidateEffective.find(
            (row) =>
              row.benchmarkKey ===
              item.benchmarkKey,
          );

        return candidateRow?.passed ===
          true;
      },
    );

  const candidateRepairsBaseline =
    !baselineCompletePass &&
    candidateCompletePass &&
    baselineConfirmedFailures.length >
      0 &&
    baselineExecutionFailures.length ===
      0 &&
    repairedBaselineFailures.length ===
      baselineConfirmedFailures.length &&
    !largeIndividualRegression;

  if (
    unstableBaseline ||
    baselineExecutionFailures.length >
      0
  ) {
    classification =
      "BASELINE_NOT_STABLE";
    targetStatus =
      "HUMAN_REVIEW";
  } else if (
    candidateRepairsBaseline
  ) {
    classification =
      "BASELINE_DRIFT_REPAIRED";
    targetStatus =
      "RELEASE_CANDIDATE";

    watchItems.push(
      `Candidate repaired ${repairedBaselineFailures.length} confirmed baseline failure(s): ${repairedBaselineFailures
        .map(
          (item) =>
            item.benchmarkKey,
        )
        .join(", ")}`,
    );
  } else if (
    !baselineCompletePass
  ) {
    classification =
      "BASELINE_NOT_STABLE";
    targetStatus =
      "HUMAN_REVIEW";
  } else if (unstableCandidate) {
    classification =
      "CANDIDATE_RESPONSE_UNSTABLE";
    targetStatus =
      "HUMAN_REVIEW";
  } else if (
    !candidateCompletePass ||
    (
      averageOverallDelta !== null &&
      averageOverallDelta <
        AVERAGE_OVERALL_REGRESSION_LIMIT
    ) ||
    largeIndividualRegression
  ) {
    classification =
      "REGRESSION_DETECTED";
    targetStatus =
      "DIAGNOSING";
  } else {
    classification =
      averageOverallDelta !== null &&
      averageOverallDelta > 0.5
        ? "IMPROVED"
        : "VALIDATED_NO_REGRESSION";
    targetStatus =
      "RELEASE_CANDIDATE";
  }

  return {
    classification,
    targetStatus,
    benchmarkCount,
    thresholds: {
      averageOverallRegressionLimit:
        AVERAGE_OVERALL_REGRESSION_LIMIT,
      individualOverallRegressionLimit:
        INDIVIDUAL_OVERALL_REGRESSION_LIMIT,
      responseVarianceRechecks: 2,
    },
    baseline: {
      ...baselineSummary,
      averageOverallScore:
        round3(
          baselineSummary
            .averageOverallScore,
        ),
      averageRetrievalScore:
        round3(
          baselineSummary
            .averageRetrievalScore,
        ),
      averageCitationScore:
        round3(
          baselineSummary
            .averageCitationScore,
        ),
      averageResponseScore:
        round3(
          baselineSummary
            .averageResponseScore,
        ),
      averageStructureScore:
        round3(
          baselineSummary
            .averageStructureScore,
        ),
    },
    candidate: {
      ...candidateSummary,
      averageOverallScore:
        round3(
          candidateSummary
            .averageOverallScore,
        ),
      averageRetrievalScore:
        round3(
          candidateSummary
            .averageRetrievalScore,
        ),
      averageCitationScore:
        round3(
          candidateSummary
            .averageCitationScore,
        ),
      averageResponseScore:
        round3(
          candidateSummary
            .averageResponseScore,
        ),
      averageStructureScore:
        round3(
          candidateSummary
            .averageStructureScore,
        ),
    },
    deltas: {
      overall: averageOverallDelta,
      retrieval: averageRetrievalDelta,
      citation: averageCitationDelta,
      response: averageResponseDelta,
      structure: averageStructureDelta,
    },
    benchmarkDeltas,
    watchItems,
    varianceRechecks,
  };
}

export async function runValidationAgentStep({
  supabase,
  jobId,
  initiatedByUserId,
  origin,
  cookie,
}: {
  supabase: any;
  jobId: string;
  initiatedByUserId: string;
  origin: string;
  cookie: string;
}) {
  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("agent_jobs")
    .select(
      `
        id,
        muse_key,
        baseline_version,
        candidate_version,
        status,
        result_summary
      `,
    )
    .eq("id", jobId)
    .single();

  if (
    jobError ||
    !job
  ) {
    throw new Error(
      jobError?.message ||
        "Agent job could not be found.",
    );
  }

  const baseSummary =
    isRecord(job.result_summary)
      ? job.result_summary
      : {};
  const storedState =
    isRecord(baseSummary.validation)
      ? (baseSummary.validation as
          unknown as ValidationState)
      : null;

  if (
    storedState?.phase === "COMPLETE"
  ) {
    return {
      status: "success",
      agent: AGENT_NAME,
      jobId,
      phase: "COMPLETE",
      continueRequired: false,
      final: storedState.final,
    };
  }

  if (
    ![
      "STAGED",
      "VALIDATING",
    ].includes(String(job.status))
  ) {
    throw new Error(
      `Validation Agent cannot run while job ${jobId} is ${job.status}.`,
    );
  }

  let state: ValidationState;

  if (storedState) {
    state = storedState;
  } else {
    const {
      count: benchmarkCount,
      error: benchmarkCountError,
    } = await supabase
      .from("muse_benchmarks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("enabled", true)
      .eq("muse_slug", job.muse_key);

    if (benchmarkCountError) {
      throw new Error(
        `Could not count Muse IQ benchmarks: ${benchmarkCountError.message}`,
      );
    }

    if (!benchmarkCount) {
      throw new Error(
        `No enabled Muse IQ benchmarks exist for ${job.muse_key}.`,
      );
    }

    const {
      count: candidateDocumentCount,
      error: candidateDocumentError,
    } = await supabase
      .from("muse_knowledge_documents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("agent_job_id", jobId)
      .eq("curation_status", "draft");

    if (candidateDocumentError) {
      throw new Error(
        `Could not verify candidate documents: ${candidateDocumentError.message}`,
      );
    }

    if (!candidateDocumentCount) {
      throw new Error(
        "Validation Agent found no staged draft candidate documents.",
      );
    }

    state = {
      agent: AGENT_NAME,
      phase: "BASELINE",
      batchSize: BATCH_SIZE,
      benchmarkCount,
      nextOffset: 0,
      baselineRunIds: [],
      candidateRunIds: [],
      baselineResults: [],
      candidateResults: [],
      rechecks: [],
      startedAt:
        new Date().toISOString(),
      completedAt: null,
      final: null,
    };
  }

  await persistValidationState({
    supabase,
    jobId,
    baseSummary,
    state,
    status: "VALIDATING",
    currentAgent: AGENT_NAME,
    lastError: null,
  });

  if (
    state.phase === "BASELINE" ||
    state.phase === "CANDIDATE"
  ) {
    const target: ValidationTarget =
      state.phase === "BASELINE"
        ? "baseline"
        : "candidate";
    const offset = state.nextOffset;
    const limit = Math.min(
      state.batchSize,
      state.benchmarkCount - offset,
    );

    if (limit <= 0) {
      throw new Error(
        `Validation Agent computed an invalid ${target} batch.`,
      );
    }

    const label =
      `${job.candidate_version || jobId}-${target}-${offset + 1}-${offset + limit}`;

    const runId =
      await callMuseIq({
        origin,
        cookie,
        museSlug: job.muse_key,
        deploymentLabel: label,
        agentJobId:
          target === "candidate"
            ? jobId
            : null,
        limit,
        offset,
      });

    const results =
      await loadRunResults({
        supabase,
        runId,
      });

    if (results.length !== limit) {
      throw new Error(
        `Muse IQ ${target} batch expected ${limit} results but stored ${results.length}.`,
      );
    }

    if (target === "baseline") {
      state.baselineRunIds =
        Array.from(
          new Set([
            ...state.baselineRunIds,
            runId,
          ]),
        );
      state.baselineResults =
        mergeBenchmarkResults(
          state.baselineResults,
          results,
        );
    } else {
      state.candidateRunIds =
        Array.from(
          new Set([
            ...state.candidateRunIds,
            runId,
          ]),
        );
      state.candidateResults =
        mergeBenchmarkResults(
          state.candidateResults,
          results,
        );
    }

    state.nextOffset = offset + limit;

    if (
      state.nextOffset >=
      state.benchmarkCount
    ) {
      if (target === "baseline") {
        state.phase = "CANDIDATE";
        state.nextOffset = 0;
      } else {
        state.rechecks =
          makeRecheckQueue(
            state.baselineResults,
            state.candidateResults,
          );
        state.phase =
          state.rechecks.length
            ? "RECHECK"
            : "FINALIZE";
        state.nextOffset = 0;
      }
    }

    await persistValidationState({
      supabase,
      jobId,
      baseSummary,
      state,
      status: "VALIDATING",
      currentAgent: null,
      lastError: null,
    });

    return {
      status: "success",
      agent: AGENT_NAME,
      jobId,
      phase: state.phase,
      completedTarget: target,
      runId,
      batch: {
        offset,
        limit,
        results,
      },
      continueRequired: true,
    };
  }

  if (state.phase === "RECHECK") {
    const item =
      state.rechecks.find(
        (recheck) =>
          recheck.resolution === null,
      );

    if (!item) {
      state.phase = "FINALIZE";
      await persistValidationState({
        supabase,
        jobId,
        baseSummary,
        state,
        status: "VALIDATING",
        currentAgent: null,
      });

      return {
        status: "success",
        agent: AGENT_NAME,
        jobId,
        phase: state.phase,
        continueRequired: true,
      };
    }

    const runId =
      await callMuseIq({
        origin,
        cookie,
        museSlug: job.muse_key,
        deploymentLabel:
          `${job.candidate_version || jobId}-${item.target}-recheck-${item.benchmarkKey}-${item.attempts + 1}`,
        agentJobId:
          item.target === "candidate"
            ? jobId
            : null,
        benchmarkKey:
          item.benchmarkKey,
      });

    const results =
      await loadRunResults({
        supabase,
        runId,
      });

    if (results.length !== 1) {
      throw new Error(
        `Validation recheck expected one result but stored ${results.length}.`,
      );
    }

    item.results.push(results[0]);
    item.attempts += 1;

    if (
      item.reason ===
      "execution_failure"
    ) {
      const recovered =
        item.results.some(
          (row) => row.passed,
        );

      if (recovered) {
        item.resolution =
          "execution_recovered";
      } else if (
        item.attempts >= 2
      ) {
        item.resolution =
          "confirmed_failure";
      }
    } else if (
      item.attempts >= 2
    ) {
      const passCount =
        item.results.filter(
          (row) => row.passed,
        ).length;

      item.resolution =
        passCount === 2
          ? "variance_pass"
          : passCount === 1
            ? "unstable"
            : "confirmed_failure";
    }

    if (
      state.rechecks.every(
        (recheck) =>
          recheck.resolution !== null,
      )
    ) {
      state.phase = "FINALIZE";
    }

    await persistValidationState({
      supabase,
      jobId,
      baseSummary,
      state,
      status: "VALIDATING",
      currentAgent: null,
      lastError: null,
    });

    return {
      status: "success",
      agent: AGENT_NAME,
      jobId,
      phase: state.phase,
      recheck: {
        target: item.target,
        benchmarkKey:
          item.benchmarkKey,
        attempt: item.attempts,
        result: results[0],
        resolution: item.resolution,
      },
      continueRequired: true,
    };
  }

  if (state.phase === "FINALIZE") {
    const comparison =
      buildFinalComparison({
        benchmarkCount:
          state.benchmarkCount,
        baseline:
          state.baselineResults,
        candidate:
          state.candidateResults,
        rechecks:
          state.rechecks,
      });

    state.phase = "COMPLETE";
    state.completedAt =
      new Date().toISOString();
    state.final = {
      ...comparison,
      baselineVersion:
        job.baseline_version ?? null,
      candidateVersion:
        job.candidate_version ?? null,
      initiatedByUserId,
      completedAt:
        state.completedAt,
    };

    const targetStatus =
      String(comparison.targetStatus);

    await persistValidationState({
      supabase,
      jobId,
      baseSummary,
      state,
      status: targetStatus,
      currentAgent: null,
      lastError: null,
      requiresHumanReview:
        targetStatus === "HUMAN_REVIEW",
    });

    return {
      status: "success",
      agent: AGENT_NAME,
      jobId,
      phase: "COMPLETE",
      jobStatus: targetStatus,
      final: state.final,
      continueRequired: false,
    };
  }

  throw new Error(
    `Unsupported Validation Agent phase ${state.phase}.`,
  );
}
