import {
  createHash,
} from "node:crypto";

type ReleasePreparationResult = {
  status: "success";
  agent: "release-manager-v1";
  jobId: string;
  jobStatus: string;
  validationRunId: string;
  validationArtifactId: string;
  releaseCandidateId: string;
  approvalId: string;
  releaseCandidateStatus: string;
  approvalStatus: string;
  alreadyPrepared: boolean;
};

function isRecord(
  value: unknown,
): value is Record<string, any> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
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
        .map((item) =>
          item.trim(),
        )
        .filter(Boolean)
    : [];
}

function numberOrNull(
  value: unknown,
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function stableJson(
  value: unknown,
): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    const encoded =
      JSON.stringify(
        value,
      );

    return encoded ??
      "null";
  }

  if (
    Array.isArray(value)
  ) {
    return `[${value
      .map(stableJson)
      .join(",")}]`;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  return `{${Object.keys(
    record,
  )
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(
          key,
        )}:${stableJson(
          record[key],
        )}`,
    )
    .join(",")}}`;
}

function hashPayload(
  value: unknown,
): string {
  return createHash(
    "sha256",
  )
    .update(
      stableJson(value),
    )
    .digest(
      "hex",
    );
}

function benchmarkChanges(
  final:
    Record<string, any>,
) {
  const rows =
    Array.isArray(
      final.benchmarkDeltas,
    )
      ? final.benchmarkDeltas
      : [];

  const regressions =
    rows
      .filter(
        (row: any) =>
          numberOrNull(
            row?.overallDelta,
          ) !==
            null &&
          Number(
            row.overallDelta,
          ) <
            0,
      )
      .map(
        (row: any) => ({
          benchmarkKey:
            String(
              row.benchmarkKey ??
                "",
            ),
          baselineOverall:
            numberOrNull(
              row.baselineOverall,
            ),
          candidateOverall:
            numberOrNull(
              row.candidateOverall,
            ),
          overallDelta:
            numberOrNull(
              row.overallDelta,
            ),
        }),
      );

  const improvements =
    rows
      .filter(
        (row: any) =>
          numberOrNull(
            row?.overallDelta,
          ) !==
            null &&
          Number(
            row.overallDelta,
          ) >
            0,
      )
      .map(
        (row: any) => ({
          benchmarkKey:
            String(
              row.benchmarkKey ??
                "",
            ),
          baselineOverall:
            numberOrNull(
              row.baselineOverall,
            ),
          candidateOverall:
            numberOrNull(
              row.candidateOverall,
            ),
          overallDelta:
            numberOrNull(
              row.overallDelta,
            ),
        }),
      );

  return {
    regressions,
    improvements,
  };
}

async function loadJob({
  supabase,
  jobId,
}: {
  supabase: any;
  jobId: string;
}) {
  const {
    data: job,
    error,
  } =
    await supabase
      .from(
        "agent_jobs",
      )
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
      .eq(
        "id",
        jobId,
      )
      .single();

  if (
    error ||
    !job
  ) {
    throw new Error(
      error?.message ||
        "Agent job could not be found.",
    );
  }

  return job;
}

async function findExistingRelease({
  supabase,
  jobId,
}: {
  supabase: any;
  jobId: string;
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "release_candidates",
      )
      .select(
        `
          id,
          validation_run_id,
          status,
          created_at
        `,
      )
      .eq(
        "job_id",
        jobId,
      )
      .in(
        "status",
        [
          "PENDING",
          "AWAITING_APPROVAL",
          "APPROVED",
          "RELEASED",
        ],
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        1,
      );

  if (error) {
    throw new Error(
      `Could not inspect release candidates: ${error.message}`,
    );
  }

  return data?.[0] ??
    null;
}

async function findApproval({
  supabase,
  jobId,
  releaseCandidateId,
}: {
  supabase: any;
  jobId: string;
  releaseCandidateId: string;
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "agent_approvals",
      )
      .select(
        `
          id,
          status,
          requested_at
        `,
      )
      .eq(
        "job_id",
        jobId,
      )
      .eq(
        "release_candidate_id",
        releaseCandidateId,
      )
      .eq(
        "approval_type",
        "RELEASE",
      )
      .order(
        "requested_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        1,
      );

  if (error) {
    throw new Error(
      `Could not inspect release approvals: ${error.message}`,
    );
  }

  return data?.[0] ??
    null;
}

async function writeAuditEvent({
  supabase,
  jobId,
  eventType,
  actorType,
  actorName,
  fromStatus,
  toStatus,
  payload,
}: {
  supabase: any;
  jobId: string;
  eventType: string;
  actorType:
    | "SYSTEM"
    | "ORCHESTRATOR"
    | "AGENT"
    | "HUMAN";
  actorName: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  payload?: Record<
    string,
    unknown
  >;
}) {
  const {
    error,
  } =
    await supabase
      .from(
        "agent_audit_events",
      )
      .insert({
        job_id:
          jobId,
        event_type:
          eventType,
        actor_type:
          actorType,
        actor_name:
          actorName,
        from_status:
          fromStatus ??
          null,
        to_status:
          toStatus ??
          null,
        payload:
          payload ??
          {},
      });

  if (error) {
    throw new Error(
      `Could not write Agent audit event ${eventType}: ${error.message}`,
    );
  }
}

async function materializeValidationRun({
  supabase,
  job,
  validation,
}: {
  supabase: any;
  job: any;
  validation:
    Record<string, any>;
}) {
  const final =
    isRecord(
      validation.final,
    )
      ? validation.final
      : {};

  const {
    data: existingRows,
    error:
      existingError,
  } =
    await supabase
      .from(
        "validation_runs",
      )
      .select(
        `
          id,
          raw_report,
          started_at
        `,
      )
      .eq(
        "job_id",
        job.id,
      )
      .eq(
        "candidate_version",
        job.candidate_version,
      )
      .eq(
        "run_type",
        "REGRESSION",
      )
      .order(
        "started_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        10,
      );

  if (
    existingError
  ) {
    throw new Error(
      `Could not inspect Agent validation runs: ${existingError.message}`,
    );
  }

  const existing =
    (
      existingRows ??
      []
    ).find(
      (
        row: any,
      ) =>
        isRecord(
          row.raw_report,
        ) &&
        row.raw_report
          .validation_agent_started_at ===
          validation.startedAt,
    );

  if (existing) {
    return String(
      existing.id,
    );
  }

  const candidate =
    isRecord(
      final.candidate,
    )
      ? final.candidate
      : {};

  const {
    regressions,
    improvements,
  } =
    benchmarkChanges(
      final,
    );

  const failureCategories =
    Array.from(
      new Set(
        (
          Array.isArray(
            validation.candidateResults,
          )
            ? validation.candidateResults
            : []
        ).flatMap(
          (row: any) =>
            stringArray(
              row?.failureCategories,
            ),
        ),
      ),
    );

  const targetStatus =
    String(
      final.targetStatus ??
        "",
    );

  const runStatus =
    targetStatus ===
      "RELEASE_CANDIDATE"
      ? "PASS"
      : targetStatus ===
          "HUMAN_REVIEW"
        ? "HUMAN_REVIEW"
        : "FAIL";

  const {
    data: inserted,
    error,
  } =
    await supabase
      .from(
        "validation_runs",
      )
      .insert({
        job_id:
          job.id,
        build_id:
          null,
        run_type:
          "REGRESSION",
        baseline_version:
          job.baseline_version,
        candidate_version:
          job.candidate_version,
        status:
          runStatus,
        benchmark_total:
          Number(
            candidate.total ??
              final.benchmarkCount ??
              0,
          ),
        benchmark_passed:
          Number(
            candidate.passed ??
              0,
          ),
        overall_score:
          numberOrNull(
            candidate.averageOverallScore,
          ),
        retrieval_score:
          numberOrNull(
            candidate.averageRetrievalScore,
          ),
        citation_score:
          numberOrNull(
            candidate.averageCitationScore,
          ),
        response_score:
          numberOrNull(
            candidate.averageResponseScore,
          ),
        structure_score:
          numberOrNull(
            candidate.averageStructureScore,
          ),
        failure_categories:
          failureCategories,
        regressions,
        improvements,
        new_capability_results:
          [],
        root_cause_hypothesis:
          targetStatus ===
            "RELEASE_CANDIDATE"
            ? "No material regression detected after frozen-suite comparison and variance adjudication."
            : null,
        recommended_action:
          targetStatus ===
            "RELEASE_CANDIDATE"
            ? "Request human release approval."
            : "Review validation evidence before continuing.",
        raw_report: {
          validation_agent:
            "validation-agent-v1",
          validation_agent_started_at:
            validation.startedAt ??
            null,
          validation_agent_completed_at:
            validation.completedAt ??
            null,
          baseline_run_ids:
            validation.baselineRunIds ??
            [],
          candidate_run_ids:
            validation.candidateRunIds ??
            [],
          rechecks:
            validation.rechecks ??
            [],
          final,
        },
        started_at:
          validation.startedAt ??
          new Date().toISOString(),
        completed_at:
          validation.completedAt ??
          new Date().toISOString(),
      })
      .select(
        "id",
      )
      .single();

  if (
    error ||
    !inserted
  ) {
    throw new Error(
      error?.message ||
        "Could not materialize Agent validation run.",
    );
  }

  return String(
    inserted.id,
  );
}

async function materializeValidationArtifact({
  supabase,
  job,
  validation,
  validationRunId,
}: {
  supabase: any;
  job: any;
  validation:
    Record<string, any>;
  validationRunId: string;
}) {
  const payload = {
    agent:
      "validation-agent-v1",
    validationRunId,
    baselineVersion:
      job.baseline_version,
    candidateVersion:
      job.candidate_version,
    baselineRunIds:
      validation.baselineRunIds ??
      [],
    candidateRunIds:
      validation.candidateRunIds ??
      [],
    rechecks:
      validation.rechecks ??
      [],
    final:
      validation.final ??
      null,
  };

  const contentHash =
    hashPayload(
      payload,
    );

  const {
    data: existingRows,
    error:
      existingError,
  } =
    await supabase
      .from(
        "agent_artifacts",
      )
      .select(
        `
          id,
          content_hash
        `,
      )
      .eq(
        "job_id",
        job.id,
      )
      .eq(
        "artifact_type",
        "VALIDATION_REPORT",
      )
      .eq(
        "content_hash",
        contentHash,
      )
      .limit(
        1,
      );

  if (
    existingError
  ) {
    throw new Error(
      `Could not inspect validation artifacts: ${existingError.message}`,
    );
  }

  if (
    existingRows?.[0]
  ) {
    return String(
      existingRows[0].id,
    );
  }

  const {
    data: inserted,
    error,
  } =
    await supabase
      .from(
        "agent_artifacts",
      )
      .insert({
        job_id:
          job.id,
        parent_artifact_id:
          null,
        artifact_type:
          "VALIDATION_REPORT",
        artifact_version:
          1,
        created_by_agent:
          "validation-agent-v1",
        payload,
        content_hash:
          contentHash,
        immutable:
          true,
      })
      .select(
        "id",
      )
      .single();

  if (
    error ||
    !inserted
  ) {
    throw new Error(
      error?.message ||
        "Could not create immutable validation artifact.",
    );
  }

  return String(
    inserted.id,
  );
}

export async function prepareReleaseCandidate({
  supabase,
  jobId,
  initiatedByUserId,
}: {
  supabase: any;
  jobId: string;
  initiatedByUserId: string;
}): Promise<
  ReleasePreparationResult
> {
  const job =
    await loadJob({
      supabase,
      jobId,
    });

  if (
    ![
      "RELEASE_CANDIDATE",
      "AWAITING_APPROVAL",
    ].includes(
      String(
        job.status,
      ),
    )
  ) {
    throw new Error(
      `Release Manager cannot prepare job ${jobId} while it is ${job.status}.`,
    );
  }

  const summary =
    isRecord(
      job.result_summary,
    )
      ? job.result_summary
      : {};

  const validation =
    isRecord(
      summary.validation,
    )
      ? summary.validation
      : null;

  const final =
    validation &&
    isRecord(
      validation.final,
    )
      ? validation.final
      : null;

  if (
    !validation ||
    validation.phase !==
      "COMPLETE" ||
    !final
  ) {
    throw new Error(
      "Release Manager requires a completed Validation Agent report.",
    );
  }

  if (
    final.classification !==
      "VALIDATED_NO_REGRESSION" &&
    final.classification !==
      "IMPROVED"
  ) {
    throw new Error(
      `Release Manager cannot prepare validation classification ${String(
        final.classification,
      )}.`,
    );
  }

  if (
    final.targetStatus !==
      "RELEASE_CANDIDATE"
  ) {
    throw new Error(
      `Validation did not authorize release candidacy; target status is ${String(
        final.targetStatus,
      )}.`,
    );
  }

  const validationRunId =
    await materializeValidationRun({
      supabase,
      job,
      validation,
    });

  const validationArtifactId =
    await materializeValidationArtifact({
      supabase,
      job,
      validation,
      validationRunId,
    });

  const existingRelease =
    await findExistingRelease({
      supabase,
      jobId,
    });

  if (existingRelease) {
    let approval =
      await findApproval({
        supabase,
        jobId,
        releaseCandidateId:
          String(
            existingRelease.id,
          ),
      });

    if (
      !approval &&
      existingRelease.status ===
        "AWAITING_APPROVAL"
    ) {
      const {
        data:
          repairedApproval,
        error:
          repairedApprovalError,
      } =
        await supabase
          .from(
            "agent_approvals",
          )
          .insert({
            job_id:
              jobId,
            release_candidate_id:
              existingRelease.id,
            approval_type:
              "RELEASE",
            status:
              "PENDING",
            requested_reason:
              `Validation Agent completed ${job.candidate_version}. Human approval is required before production promotion.`,
          })
          .select(
            "id, status",
          )
          .single();

      if (
        repairedApprovalError ||
        !repairedApproval
      ) {
        throw new Error(
          repairedApprovalError?.message ||
            "Could not repair missing human release approval request.",
        );
      }

      approval =
        repairedApproval;
    }

    if (!approval) {
      throw new Error(
        "A release candidate already exists but its human approval record is missing.",
      );
    }

    if (
      existingRelease.status ===
        "AWAITING_APPROVAL" &&
      job.status !==
        "AWAITING_APPROVAL"
    ) {
      const {
        error:
          repairJobError,
      } =
        await supabase
          .from(
            "agent_jobs",
          )
          .update({
            status:
              "AWAITING_APPROVAL",
            current_agent:
              null,
            last_error:
              null,
          })
          .eq(
            "id",
            jobId,
          );

      if (
        repairJobError
      ) {
        throw new Error(
          `Could not repair Agent job approval state: ${repairJobError.message}`,
        );
      }
    }

    return {
      status:
        "success",
      agent:
        "release-manager-v1",
      jobId,
      jobStatus:
        existingRelease.status ===
          "AWAITING_APPROVAL"
          ? "AWAITING_APPROVAL"
          : String(
              job.status,
            ),
      validationRunId:
        String(
          existingRelease.validation_run_id,
        ),
      validationArtifactId,
      releaseCandidateId:
        String(
          existingRelease.id,
        ),
      approvalId:
        String(
          approval.id,
        ),
      releaseCandidateStatus:
        String(
          existingRelease.status,
        ),
      approvalStatus:
        String(
          approval.status,
        ),
      alreadyPrepared:
        true,
    };
  }

  const {
    data: candidateDocuments,
    error:
      candidateDocumentError,
  } =
    await supabase
      .from(
        "muse_knowledge_documents",
      )
      .select(
        `
          id,
          source_id,
          title,
          curation_status,
          candidate_version
        `,
      )
      .eq(
        "agent_job_id",
        jobId,
      )
      .eq(
        "candidate_version",
        job.candidate_version,
      )
      .eq(
        "curation_status",
        "draft",
      );

  if (
    candidateDocumentError
  ) {
    throw new Error(
      `Could not load candidate knowledge manifest: ${candidateDocumentError.message}`,
    );
  }

  if (
    !candidateDocuments?.length
  ) {
    throw new Error(
      "Release Manager found no draft candidate documents for this job.",
    );
  }

  const manifest = {
    createdBy:
      "release-manager-v1",
    preparedByUserId:
      initiatedByUserId,
    museKey:
      job.muse_key,
    fromVersion:
      job.baseline_version,
    toVersion:
      job.candidate_version,
    validationRunId,
    validationArtifactId,
    validationClassification:
      final.classification,
    validationDeltas:
      final.deltas ??
      {},
    watchItems:
      final.watchItems ??
      [],
    varianceRechecks:
      final.varianceRechecks ??
      [],
    candidateDocuments:
      candidateDocuments.map(
        (
          row: any,
        ) => ({
          id:
            row.id,
          sourceId:
            row.source_id,
          title:
            row.title,
          curationStatus:
            row.curation_status,
          candidateVersion:
            row.candidate_version,
        }),
      ),
  };

  const {
    data:
      releaseCandidate,
    error:
      releaseError,
  } =
    await supabase
      .from(
        "release_candidates",
      )
      .insert({
        job_id:
          jobId,
        build_id:
          null,
        validation_run_id:
          validationRunId,
        muse_key:
          job.muse_key,
        from_version:
          job.baseline_version,
        to_version:
          job.candidate_version,
        manifest,
        status:
          "AWAITING_APPROVAL",
        requires_approval:
          true,
      })
      .select(
        "id, status",
      )
      .single();

  if (
    releaseError ||
    !releaseCandidate
  ) {
    throw new Error(
      releaseError?.message ||
        "Could not create release candidate.",
    );
  }

  const {
    data:
      approval,
    error:
      approvalError,
  } =
    await supabase
      .from(
        "agent_approvals",
      )
      .insert({
        job_id:
          jobId,
        release_candidate_id:
          releaseCandidate.id,
        approval_type:
          "RELEASE",
        status:
          "PENDING",
        requested_reason:
          `Validation Agent completed ${job.candidate_version} with ${String(
            final.classification,
          )}. Human approval is required before production promotion.`,
      })
      .select(
        "id, status",
      )
      .single();

  if (
    approvalError ||
    !approval
  ) {
    throw new Error(
      approvalError?.message ||
        "Could not create human release approval request.",
    );
  }

  const {
    error:
      jobUpdateError,
  } =
    await supabase
      .from(
        "agent_jobs",
      )
      .update({
        status:
          "AWAITING_APPROVAL",
        current_agent:
          null,
        last_error:
          null,
      })
      .eq(
        "id",
        jobId,
      );

  if (
    jobUpdateError
  ) {
    throw new Error(
      `Could not move Agent job to AWAITING_APPROVAL: ${jobUpdateError.message}`,
    );
  }

  await writeAuditEvent({
    supabase,
    jobId,
    eventType:
      "VALIDATION_MATERIALIZED",
    actorType:
      "AGENT",
    actorName:
      "release-manager-v1",
    fromStatus:
      String(
        job.status,
      ),
    toStatus:
      "RELEASE_CANDIDATE",
    payload: {
      validationRunId,
      validationArtifactId,
      classification:
        final.classification,
      deltas:
        final.deltas ??
        {},
      watchItems:
        final.watchItems ??
        [],
    },
  });

  await writeAuditEvent({
    supabase,
    jobId,
    eventType:
      "RELEASE_APPROVAL_REQUESTED",
    actorType:
      "AGENT",
    actorName:
      "release-manager-v1",
    fromStatus:
      "RELEASE_CANDIDATE",
    toStatus:
      "AWAITING_APPROVAL",
    payload: {
      releaseCandidateId:
        releaseCandidate.id,
      approvalId:
        approval.id,
      candidateVersion:
        job.candidate_version,
    },
  });

  return {
    status:
      "success",
    agent:
      "release-manager-v1",
    jobId,
    jobStatus:
      "AWAITING_APPROVAL",
    validationRunId,
    validationArtifactId,
    releaseCandidateId:
      String(
        releaseCandidate.id,
      ),
    approvalId:
      String(
        approval.id,
      ),
    releaseCandidateStatus:
      String(
        releaseCandidate.status,
      ),
    approvalStatus:
      String(
        approval.status,
      ),
    alreadyPrepared:
      false,
  };
}

export async function approveReleaseCandidate({
  supabase,
  jobId,
  decidedByUserId,
  actorName,
  decisionNotes,
}: {
  supabase: any;
  jobId: string;
  decidedByUserId: string;
  actorName: string;
  decisionNotes?: string | null;
}) {
  const job =
    await loadJob({
      supabase,
      jobId,
    });

  if (
    job.status !==
      "AWAITING_APPROVAL"
  ) {
    throw new Error(
      `Release approval cannot be recorded while job ${jobId} is ${job.status}.`,
    );
  }

  const existingRelease =
    await findExistingRelease({
      supabase,
      jobId,
    });

  if (
    !existingRelease ||
    existingRelease.status !==
      "AWAITING_APPROVAL"
  ) {
    throw new Error(
      "No release candidate is awaiting approval for this job.",
    );
  }

  const approval =
    await findApproval({
      supabase,
      jobId,
      releaseCandidateId:
        String(
          existingRelease.id,
        ),
    });

  if (
    !approval ||
    approval.status !==
      "PENDING"
  ) {
    throw new Error(
      "No pending RELEASE approval exists for this release candidate.",
    );
  }

  const now =
    new Date().toISOString();

  const {
    error:
      approvalError,
  } =
    await supabase
      .from(
        "agent_approvals",
      )
      .update({
        status:
          "APPROVED",
        decision_notes:
          decisionNotes ??
          "Approved for release by the human Editor-in-Chief.",
        decided_at:
          now,
        decided_by:
          decidedByUserId,
      })
      .eq(
        "id",
        approval.id,
      );

  if (
    approvalError
  ) {
    throw new Error(
      `Could not approve release request: ${approvalError.message}`,
    );
  }

  const {
    error:
      releaseError,
  } =
    await supabase
      .from(
        "release_candidates",
      )
      .update({
        status:
          "APPROVED",
        approved_by:
          decidedByUserId,
        approved_at:
          now,
      })
      .eq(
        "id",
        existingRelease.id,
      );

  if (
    releaseError
  ) {
    throw new Error(
      `Could not mark release candidate approved: ${releaseError.message}`,
    );
  }

  const {
    error:
      jobError,
  } =
    await supabase
      .from(
        "agent_jobs",
      )
      .update({
        status:
          "RELEASE_CANDIDATE",
        current_agent:
          null,
        last_error:
          null,
      })
      .eq(
        "id",
        jobId,
      );

  if (
    jobError
  ) {
    throw new Error(
      `Could not return approved job to RELEASE_CANDIDATE: ${jobError.message}`,
    );
  }

  await writeAuditEvent({
    supabase,
    jobId,
    eventType:
      "RELEASE_APPROVED",
    actorType:
      "HUMAN",
    actorName,
    fromStatus:
      "AWAITING_APPROVAL",
    toStatus:
      "RELEASE_CANDIDATE",
    payload: {
      releaseCandidateId:
        existingRelease.id,
      approvalId:
        approval.id,
      decisionNotes:
        decisionNotes ??
        null,
    },
  });

  return {
    status:
      "success",
    jobId,
    jobStatus:
      "RELEASE_CANDIDATE",
    releaseCandidateId:
      String(
        existingRelease.id,
      ),
    releaseCandidateStatus:
      "APPROVED",
    approvalId:
      String(
        approval.id,
      ),
    approvalStatus:
      "APPROVED",
    productionChanged:
      false,
  };
}
