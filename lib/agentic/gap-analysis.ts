import {
  getMuseProfile,
} from "@/lib/agentic/muse-sweep-definitions";

const ANALYSIS_VERSION = "muse-gap-analysis-v1.1";
const SOURCE_DEPTH = 2;
const TARGET_DEPTH = 3;

const MUSE_KEYS = [
  "calliope",
  "clio",
  "erato",
  "euterpe",
  "melpomene",
  "polyhymnia",
  "terpsichore",
  "thalia",
  "urania",
] as const;

type MuseKey = (typeof MUSE_KEYS)[number];

type RecommendationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "JOB_CREATED";

function isRecord(
  value: unknown,
): value is Record<string, any> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function asNumber(
  value: unknown,
): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function rounded(
  value: number,
  digits = 2,
) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(
  values: Array<number | null>,
): number | null {
  const usable = values.filter(
    (value): value is number =>
      typeof value === "number" &&
      Number.isFinite(value),
  );

  if (!usable.length) return null;

  return rounded(
    usable.reduce(
      (sum, value) => sum + value,
      0,
    ) / usable.length,
  );
}

function normalize(
  value: unknown,
) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

const CAPABILITY_COVERAGE_ALIASES: Record<string, string[]> = {
  character: [
    "character desire",
  ],
  scene: [
    "scene construction",
  ],
  wonder: [
    "wonder and imagination",
  ],
  "transcendence and mystery": [
    "transcendent songwriting",
  ],
};

function capabilityCoverageTerms(
  capability: string,
) {
  const normalized =
    normalize(capability);

  return new Set([
    normalized,
    ...(
      CAPABILITY_COVERAGE_ALIASES[
        normalized
      ] ?? []
    ).map(normalize),
  ]);
}

function validationEvidence(
  resultSummary: unknown,
) {
  if (!isRecord(resultSummary)) {
    return {
      classification: null,
      passRate: null,
      averageOverallScore: null,
      watchItems: [] as unknown[],
    };
  }

  const validation = isRecord(
    resultSummary.validation,
  )
    ? resultSummary.validation
    : {};

  const final = isRecord(validation.final)
    ? validation.final
    : {};

  const candidate = isRecord(final.candidate)
    ? final.candidate
    : {};

  const watchItems = Array.isArray(
    final.watchItems,
  )
    ? final.watchItems
    : Array.isArray(validation.watchItems)
      ? validation.watchItems
      : [];

  return {
    classification:
      typeof final.classification === "string"
        ? final.classification
        : null,
    passRate:
      asNumber(candidate.passRate),
    averageOverallScore:
      asNumber(
        candidate.averageOverallScore,
      ),
    watchItems,
  };
}

function requestedSourcesForGap(
  gapScore: number,
  weakCapabilityCount: number,
) {
  const scoreDriven =
    3 + Math.floor(gapScore / 20);

  return Math.max(
    3,
    Math.min(
      8,
      Math.max(
        scoreDriven,
        weakCapabilityCount + 2,
      ),
    ),
  );
}

function buildMission({
  museKey,
  weakCapabilities,
}: {
  museKey: MuseKey;
  weakCapabilities: string[];
}) {
  const profile = getMuseProfile(museKey);

  if (!weakCapabilities.length) {
    return `Hold ${profile.displayName} at Depth-02. Current evidence does not justify another broad knowledge-expansion cycle. Reassess after new benchmark, production, or songwriter-use evidence appears.`;
  }

  const focus =
    weakCapabilities.join(", ");

  return `Deepen ${profile.displayName} selectively around ${focus}. Research only sources that add material capability beyond the released Depth-02 library, prefer high-authority and high-novelty evidence, avoid redundant coverage, and preserve current production behavior until candidate validation and explicit human release approval are complete.`;
}

async function countProductionSources({
  supabase,
  museKey,
}: {
  supabase: any;
  museKey: MuseKey;
}) {
  const {
    count,
    error,
  } = await supabase
    .from("muse_knowledge_sources")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("muse_slug", museKey)
    .eq("scope", "global")
    .eq("is_active", true)
    .not("approved_at", "is", null);

  if (error) {
    throw new Error(
      `Could not count production sources for ${museKey}: ${error.message}`,
    );
  }

  return count ?? 0;
}

type AcceptedCandidate = {
  target_capabilities: unknown;
  authority_score: unknown;
  novelty_score: unknown;
  overlap_score: unknown;
  provenance_status: unknown;
  source_type: unknown;
};

async function loadAcceptedCandidates({
  supabase,
  jobId,
}: {
  supabase: any;
  jobId: string;
}): Promise<AcceptedCandidate[]> {
  const {
    data,
    error,
  } = await supabase
    .from("source_candidates")
    .select(
      `
        id,
        target_capabilities,
        authority_score,
        novelty_score,
        overlap_score,
        provenance_status,
        source_type
      `,
    )
    .eq("job_id", jobId)
    .eq("disposition", "ACCEPTED");

  if (error) {
    throw new Error(
      `Could not load accepted sources for ${jobId}: ${error.message}`,
    );
  }

  return (data ?? []) as AcceptedCandidate[];
}

function capabilityCoverage({
  capabilities,
  candidates,
}: {
  capabilities: string[];
  candidates: AcceptedCandidate[];
}) {
  return capabilities.map(
    (capability) => {
      const acceptedTerms =
        capabilityCoverageTerms(
          capability,
        );

      const count = candidates.filter(
        (candidate) =>
          Array.isArray(
            candidate.target_capabilities,
          ) &&
          candidate.target_capabilities.some(
            (value: unknown) =>
              acceptedTerms.has(
                normalize(value),
              ),
          ),
      ).length;

      return {
        capability,
        acceptedSourceCoverage: count,
      };
    },
  );
}

function computeGapScore({
  passRate,
  averageOverallScore,
  weakCapabilityCount,
  capabilityCount,
  incompleteProvenanceCount,
  acceptedSourceCount,
  averageNovelty,
  productionSourceCount,
  watchItemCount,
}: {
  passRate: number | null;
  averageOverallScore: number | null;
  weakCapabilityCount: number;
  capabilityCount: number;
  incompleteProvenanceCount: number;
  acceptedSourceCount: number;
  averageNovelty: number | null;
  productionSourceCount: number;
  watchItemCount: number;
}) {
  let score = 0;

  if (passRate === null) {
    score += 15;
  } else if (passRate < 100) {
    score += Math.min(
      35,
      (100 - passRate) * 1.5,
    );
  }

  if (averageOverallScore === null) {
    score += 8;
  } else if (averageOverallScore < 97) {
    score += Math.min(
      20,
      (97 - averageOverallScore) * 8,
    );
  }

  if (capabilityCount > 0) {
    score +=
      (weakCapabilityCount /
        capabilityCount) *
      30;
  }

  if (acceptedSourceCount > 0) {
    score +=
      (incompleteProvenanceCount /
        acceptedSourceCount) *
      10;
  } else {
    score += 20;
  }

  if (
    averageNovelty !== null &&
    averageNovelty < 80
  ) {
    score +=
      averageNovelty < 70
        ? 10
        : 5;
  }

  if (productionSourceCount < 20) {
    score += 8;
  }

  if (watchItemCount > 0) {
    score += Math.min(
      10,
      watchItemCount * 3,
    );
  }

  return rounded(
    Math.max(
      0,
      Math.min(100, score),
    ),
  );
}

export async function runMuseGapAnalysis({
  supabase,
  initiatedByUserId,
}: {
  supabase: any;
  initiatedByUserId: string;
}) {
  const {
    data: run,
    error: runError,
  } = await supabase
    .from("muse_gap_analysis_runs")
    .insert({
      analysis_version: ANALYSIS_VERSION,
      source_depth: SOURCE_DEPTH,
      target_depth: TARGET_DEPTH,
      status: "RUNNING",
      created_by: initiatedByUserId,
    })
    .select("*")
    .single();

  if (runError || !run) {
    throw new Error(
      runError?.message ||
        "Gap analysis run could not be created.",
    );
  }

  try {
    const {
      data: releasedJobs,
      error: jobsError,
    } = await supabase
      .from("agent_jobs")
      .select(
        `
          id,
          muse_key,
          candidate_version,
          status,
          result_summary,
          input,
          updated_at
        `,
      )
      .eq("status", "RELEASED")
      .like(
        "candidate_version",
        "%-depth-agent-02",
      )
      .order("updated_at", {
        ascending: false,
      });

    if (jobsError) {
      throw new Error(
        `Could not load released Depth-02 jobs: ${jobsError.message}`,
      );
    }

    const latestJobByMuse =
      new Map<string, any>();

    for (const job of releasedJobs ?? []) {
      const key = String(job.muse_key);
      if (!latestJobByMuse.has(key)) {
        latestJobByMuse.set(key, job);
      }
    }

    const recommendations: any[] = [];

    for (const museKey of MUSE_KEYS) {
      const profile =
        getMuseProfile(museKey);
      const job =
        latestJobByMuse.get(museKey) ??
        null;

      const productionSourceCount =
        await countProductionSources({
          supabase,
          museKey,
        });

      const candidates = job
        ? await loadAcceptedCandidates({
            supabase,
            jobId: String(job.id),
          })
        : [];

      const coverage = capabilityCoverage({
        capabilities:
          profile.targetCapabilities,
        candidates,
      });

      const weakCapabilities = coverage
        .filter(
          (item) =>
            item.acceptedSourceCoverage < 2,
        )
        .map(
          (item) => item.capability,
        );

      const validation =
        validationEvidence(
          job?.result_summary,
        );

      const incompleteProvenanceCount =
        candidates.filter(
          (candidate) =>
            String(
              candidate.provenance_status,
            ) !== "COMPLETE",
        ).length;

      const averageAuthority = average(
        candidates.map((candidate) =>
          asNumber(
            candidate.authority_score,
          ),
        ),
      );

      const averageNovelty = average(
        candidates.map((candidate) =>
          asNumber(
            candidate.novelty_score,
          ),
        ),
      );

      const averageOverlap = average(
        candidates.map((candidate) =>
          asNumber(
            candidate.overlap_score,
          ),
        ),
      );

      const gapScore = computeGapScore({
        passRate: validation.passRate,
        averageOverallScore:
          validation.averageOverallScore,
        weakCapabilityCount:
          weakCapabilities.length,
        capabilityCount:
          profile.targetCapabilities.length,
        incompleteProvenanceCount,
        acceptedSourceCount:
          candidates.length,
        averageNovelty,
        productionSourceCount,
        watchItemCount:
          validation.watchItems.length,
      });

      const shouldDeepen =
        !job ||
        weakCapabilities.length > 0 ||
        validation.passRate === null ||
        validation.passRate < 100 ||
        gapScore >= 20;

      const recommendation = shouldDeepen
        ? "DEEPEN"
        : "HOLD";

      const requestedSourceCount =
        shouldDeepen
          ? requestedSourcesForGap(
              gapScore,
              weakCapabilities.length,
            )
          : null;

      const proposedMission = buildMission({
        museKey,
        weakCapabilities:
          shouldDeepen
            ? weakCapabilities.length
              ? weakCapabilities
              : profile.targetCapabilities
                  .slice(0, 2)
            : [],
      });

      const sourceTypes = Array.from(
        new Set(
          candidates
            .map((candidate) =>
              String(
                candidate.source_type ?? "",
              ).trim(),
            )
            .filter(Boolean),
        ),
      );

      recommendations.push({
        run_id: run.id,
        muse_key: museKey,
        current_version:
          job?.candidate_version ?? null,
        recommendation,
        gap_score: gapScore,
        weak_capabilities:
          shouldDeepen
            ? weakCapabilities.length
              ? weakCapabilities
              : profile.targetCapabilities
                  .slice(0, 2)
            : [],
        requested_source_count:
          requestedSourceCount,
        proposed_mission:
          proposedMission,
        status: "PENDING",
        evidence: {
          releasedDepth02JobId:
            job?.id ?? null,
          validation,
          productionSourceCount,
          acceptedDepth02SourceCount:
            candidates.length,
          provenanceCompleteCount:
            candidates.length -
            incompleteProvenanceCount,
          incompleteProvenanceCount,
          averageAuthority,
          averageNovelty,
          averageOverlap,
          sourceTypes,
          capabilityCoverage: coverage,
        },
      });
    }

    const {
      data: inserted,
      error: recommendationError,
    } = await supabase
      .from(
        "muse_gap_analysis_recommendations",
      )
      .insert(recommendations)
      .select("*");

    if (recommendationError) {
      throw new Error(
        `Could not save gap recommendations: ${recommendationError.message}`,
      );
    }

    const deepenCount =
      recommendations.filter(
        (item) =>
          item.recommendation === "DEEPEN",
      ).length;

    const summary = {
      museCount: MUSE_KEYS.length,
      deepenCount,
      holdCount:
        MUSE_KEYS.length - deepenCount,
      sourceDepth: SOURCE_DEPTH,
      targetDepth: TARGET_DEPTH,
      policy:
        "No research job is created until a human approves a DEEPEN recommendation and explicitly creates approved jobs.",
    };

    const completedAt =
      new Date().toISOString();

    const {
      error: completionError,
    } = await supabase
      .from("muse_gap_analysis_runs")
      .update({
        status: "COMPLETE",
        summary,
        completed_at: completedAt,
        error_message: null,
      })
      .eq("id", run.id);

    if (completionError) {
      throw new Error(
        `Could not finalize gap analysis: ${completionError.message}`,
      );
    }

    return {
      status: "success",
      run: {
        ...run,
        status: "COMPLETE",
        summary,
        completed_at: completedAt,
      },
      recommendations:
        inserted ?? recommendations,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Muse gap analysis failed.";

    await supabase
      .from("muse_gap_analysis_runs")
      .update({
        status: "FAILED",
        error_message: message,
        completed_at:
          new Date().toISOString(),
      })
      .eq("id", run.id);

    throw error;
  }
}

export async function getLatestMuseGapAnalysis({
  supabase,
}: {
  supabase: any;
}) {
  const {
    data: runs,
    error: runError,
  } = await supabase
    .from("muse_gap_analysis_runs")
    .select("*")
    .order("created_at", {
      ascending: false,
    })
    .limit(1);

  if (runError) {
    throw new Error(
      `Could not load latest gap analysis: ${runError.message}`,
    );
  }

  const run = runs?.[0] ?? null;

  if (!run) {
    return {
      status: "success",
      run: null,
      recommendations: [],
    };
  }

  const {
    data: recommendations,
    error: recommendationError,
  } = await supabase
    .from(
      "muse_gap_analysis_recommendations",
    )
    .select("*")
    .eq("run_id", run.id)
    .order("gap_score", {
      ascending: false,
    });

  if (recommendationError) {
    throw new Error(
      `Could not load gap recommendations: ${recommendationError.message}`,
    );
  }

  return {
    status: "success",
    run,
    recommendations:
      recommendations ?? [],
  };
}

export async function decideMuseGapRecommendation({
  supabase,
  recommendationId,
  decision,
  decisionNotes,
  userId,
}: {
  supabase: any;
  recommendationId: string;
  decision: "APPROVED" | "REJECTED";
  decisionNotes?: string | null;
  userId: string;
}) {
  const {
    data: existing,
    error: loadError,
  } = await supabase
    .from(
      "muse_gap_analysis_recommendations",
    )
    .select("*")
    .eq("id", recommendationId)
    .single();

  if (loadError || !existing) {
    throw new Error(
      loadError?.message ||
        "Gap recommendation could not be found.",
    );
  }

  if (
    (existing.status as RecommendationStatus) !==
    "PENDING"
  ) {
    throw new Error(
      `Gap recommendation is already ${existing.status}.`,
    );
  }

  if (
    decision === "APPROVED" &&
    existing.recommendation !== "DEEPEN"
  ) {
    throw new Error(
      "Only a DEEPEN recommendation needs research approval. HOLD recommendations create no work.",
    );
  }

  const {
    data: updated,
    error: updateError,
  } = await supabase
    .from(
      "muse_gap_analysis_recommendations",
    )
    .update({
      status: decision,
      decision_notes:
        decisionNotes?.trim() || null,
      decided_by: userId,
      decided_at:
        new Date().toISOString(),
    })
    .eq("id", recommendationId)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(
      updateError?.message ||
        "Gap recommendation could not be updated.",
    );
  }

  return {
    status: "success",
    recommendation: updated,
  };
}

export async function createApprovedDepth03Jobs({
  supabase,
  runId,
  initiatedByUserId,
}: {
  supabase: any;
  runId: string;
  initiatedByUserId: string;
}) {
  const {
    data: run,
    error: runError,
  } = await supabase
    .from("muse_gap_analysis_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runError || !run) {
    throw new Error(
      runError?.message ||
        "Gap analysis run could not be found.",
    );
  }

  if (run.status !== "COMPLETE") {
    throw new Error(
      `Depth-03 jobs can only be created from a COMPLETE gap analysis; this run is ${run.status}.`,
    );
  }

  const {
    data: approved,
    error: approvedError,
  } = await supabase
    .from(
      "muse_gap_analysis_recommendations",
    )
    .select("*")
    .eq("run_id", runId)
    .eq("recommendation", "DEEPEN")
    .eq("status", "APPROVED")
    .order("muse_key", {
      ascending: true,
    });

  if (approvedError) {
    throw new Error(
      `Could not load approved Depth-03 recommendations: ${approvedError.message}`,
    );
  }

  const created: any[] = [];
  const reused: any[] = [];

  for (const recommendation of approved ?? []) {
    const museKey = String(
      recommendation.muse_key,
    ) as MuseKey;
    const profile =
      getMuseProfile(museKey);
    const candidateVersion =
      `${museKey}-depth-agent-03`;

    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from("agent_jobs")
      .select(
        "id,muse_key,candidate_version,status",
      )
      .eq(
        "candidate_version",
        candidateVersion,
      )
      .limit(1);

    if (existingError) {
      throw new Error(
        `Could not inspect existing ${profile.displayName} Depth-03 job: ${existingError.message}`,
      );
    }

    let job = existingRows?.[0] ?? null;

    if (!job) {
      const targetCapabilities =
        Array.isArray(
          recommendation.weak_capabilities,
        ) &&
        recommendation.weak_capabilities.length
          ? recommendation.weak_capabilities
          : profile.targetCapabilities;

      const {
        data: createdJob,
        error: createError,
      } = await supabase
        .from("agent_jobs")
        .insert({
          idempotency_key:
            `gap-analysis:${runId}:${museKey}:depth-03`,
          job_type:
            "MUSE_KNOWLEDGE_EXPANSION",
          priority: 60,
          risk_level: "LOW",
          muse_key: museKey,
          title:
            `${profile.displayName} Autonomous Depth Experiment 03`,
          mission:
            recommendation.proposed_mission,
          baseline_version:
            recommendation.current_version ||
            "muse-iq-v1.2",
          candidate_version:
            candidateVersion,
          status: "NEW",
          requested_source_count:
            recommendation.requested_source_count,
          autonomy_policy: {
            gap_analysis_required: true,
            human_release_required: true,
          },
          input: {
            gap_analysis_run_id: runId,
            gap_recommendation_id:
              recommendation.id,
            sweep_key:
              "gap-analysis-depth-03",
            sweep_version: 3,
            initiated_by:
              initiatedByUserId,
            target_capabilities:
              targetCapabilities,
            human_release_required: true,
            stop_at:
              "AWAITING_APPROVAL",
          },
          created_by:
            initiatedByUserId,
        })
        .select(
          "id,muse_key,candidate_version,status",
        )
        .single();

      if (createError || !createdJob) {
        throw new Error(
          createError?.message ||
            `Could not create ${profile.displayName} Depth-03 job.`,
        );
      }

      job = createdJob;

      const {
        error: auditError,
      } = await supabase
        .from("agent_audit_events")
        .insert({
          job_id: job.id,
          event_type:
            "MUSE_GAP_ANALYSIS_JOB_CREATED",
          actor_type: "HUMAN",
          actor_name:
            "gap-analysis-control-v1",
          from_status: null,
          to_status: "NEW",
          payload: {
            gapAnalysisRunId: runId,
            gapRecommendationId:
              recommendation.id,
            museKey,
            candidateVersion,
            requestedSourceCount:
              recommendation.requested_source_count,
            targetCapabilities,
            initiatedBy:
              initiatedByUserId,
          },
        });

      if (auditError) {
        throw new Error(
          `Depth-03 job was created but its audit event failed: ${auditError.message}`,
        );
      }

      created.push(job);
    } else {
      reused.push(job);
    }

    const {
      error: recommendationUpdateError,
    } = await supabase
      .from(
        "muse_gap_analysis_recommendations",
      )
      .update({
        status: "JOB_CREATED",
        created_job_id: job.id,
      })
      .eq("id", recommendation.id);

    if (recommendationUpdateError) {
      throw new Error(
        `Could not link ${profile.displayName} recommendation to its Depth-03 job: ${recommendationUpdateError.message}`,
      );
    }
  }

  return {
    status: "success",
    runId,
    created,
    reused,
    productionChanged: false,
    researchStarted: false,
  };
}
