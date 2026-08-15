const SWEEP_KEY =
  "nine-muses-first-pass-v1";

const ORCHESTRATOR_NAME =
  "muse-sweep-orchestrator-v1";

type MuseSweepTarget = {
  museKey: string;
  displayName: string;
  candidateVersion: string;
  mission: string;
  targetCapabilities: string[];
};

const TARGETS: MuseSweepTarget[] = [
  {
    museKey: "clio",
    displayName: "Clio",
    candidateVersion: "clio-depth-agent-01",
    mission:
      "Strengthen Clio's ability to help songwriters work with roots, lineage, place, history, tradition, cultural memory, and historical context without turning songs into lectures.",
    targetCapabilities: [
      "historical context",
      "place and cultural memory",
      "lineage and tradition",
      "chronology and time",
      "roots-based songwriting",
    ],
  },
  {
    museKey: "erato",
    displayName: "Erato",
    candidateVersion: "erato-depth-agent-01",
    mission:
      "Strengthen Erato's ability to guide songs about intimacy, desire, vulnerability, attachment, relational tension, and emotionally specific romantic perspective.",
    targetCapabilities: [
      "intimacy and desire",
      "vulnerability",
      "relationship dynamics",
      "romantic point of view",
      "emotional specificity",
    ],
  },
  {
    museKey: "euterpe",
    displayName: "Euterpe",
    candidateVersion: "euterpe-depth-agent-01",
    mission:
      "Strengthen Euterpe's musical-craft guidance around melody, prosody, phrasing, harmony, hooks, song form, and the relationship between lyric and musical motion.",
    targetCapabilities: [
      "melody",
      "prosody and phrasing",
      "harmony",
      "hooks",
      "song form",
    ],
  },
  {
    museKey: "melpomene",
    displayName: "Melpomene",
    candidateVersion: "melpomene-depth-agent-01",
    mission:
      "Strengthen Melpomene's guidance for grief, lament, blues, suffering, catharsis, emotional restraint, tragic perspective, and earned emotional release.",
    targetCapabilities: [
      "grief and lament",
      "blues expression",
      "catharsis",
      "tragic perspective",
      "emotional restraint",
    ],
  },
  {
    museKey: "polyhymnia",
    displayName: "Polyhymnia",
    candidateVersion: "polyhymnia-depth-agent-01",
    mission:
      "Strengthen Polyhymnia's guidance for sacred song, devotion, prayer, hymnody, reverence, spiritual metaphor, communal singing, and language that serves faith without becoming generic.",
    targetCapabilities: [
      "sacred lyric",
      "devotion and prayer",
      "hymnody",
      "spiritual metaphor",
      "reverence and communal song",
    ],
  },
  {
    museKey: "terpsichore",
    displayName: "Terpsichore",
    candidateVersion: "terpsichore-depth-agent-01",
    mission:
      "Strengthen Terpsichore's rhythmic guidance around groove, meter, syncopation, repetition, feel, movement, rhythmic tension, and lyric-rhythm relationships.",
    targetCapabilities: [
      "groove",
      "meter",
      "syncopation",
      "repetition and feel",
      "lyric-rhythm relationship",
    ],
  },
  {
    museKey: "thalia",
    displayName: "Thalia",
    candidateVersion: "thalia-depth-agent-01",
    mission:
      "Strengthen Thalia's guidance for humor, irony, satire, comic timing, wordplay, incongruity, playful perspective, and balancing wit with emotional truth.",
    targetCapabilities: [
      "humor",
      "irony and satire",
      "comic timing",
      "wordplay",
      "playful point of view",
    ],
  },
  {
    museKey: "urania",
    displayName: "Urania",
    candidateVersion: "urania-depth-agent-01",
    mission:
      "Strengthen Urania's guidance for wonder, dreams, cosmic imagery, transcendence, mystery, scale, imagination, and the use of science or the heavens as metaphor.",
    targetCapabilities: [
      "wonder",
      "dream imagery",
      "cosmic perspective",
      "transcendence and mystery",
      "science and scale as metaphor",
    ],
  },
];

const TERMINAL_STATUSES =
  new Set([
    "AWAITING_APPROVAL",
    "DIAGNOSING",
    "HUMAN_REVIEW",
    "BLOCKED",
    "FAILED",
    "RELEASED",
  ]);

function isRecord(
  value: unknown,
): value is Record<string, any> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function targetForMuse(
  museKey: string,
) {
  return TARGETS.find(
    (target) =>
      target.museKey ===
      museKey,
  );
}

function nextActionForStatus(
  status: string,
) {
  if (
    status === "NEW" ||
    status === "RESEARCHING"
  ) {
    return "research";
  }

  if (
    status === "RESEARCHED" ||
    status === "CURATING"
  ) {
    return "curate";
  }

  if (
    status === "CURATED"
  ) {
    return "repair-or-stage";
  }

  if (
    status === "STAGING"
  ) {
    return "stage";
  }

  if (
    status === "STAGED" ||
    status === "VALIDATING"
  ) {
    return "validate";
  }

  if (
    status === "RELEASE_CANDIDATE"
  ) {
    return "prepare-release";
  }

  return TERMINAL_STATUSES.has(
    status,
  )
    ? "stop"
    : "attention";
}

async function loadSweepJobs({
  supabase,
}: {
  supabase: any;
}) {
  const {
    data,
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
          title,
          baseline_version,
          candidate_version,
          status,
          current_agent,
          last_error,
          input,
          result_summary,
          created_at,
          updated_at
        `,
      )
      .contains(
        "input",
        {
          sweep_key:
            SWEEP_KEY,
        },
      )
      .order(
        "muse_key",
        {
          ascending:
            true,
        },
      );

  if (error) {
    throw new Error(
      `Could not load Muse Sweep jobs: ${error.message}`,
    );
  }

  return data ?? [];
}

async function writeAudit({
  supabase,
  jobId,
  eventType,
  fromStatus,
  toStatus,
  payload,
}: {
  supabase: any;
  jobId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  payload?: Record<string, unknown>;
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
          "ORCHESTRATOR",
        actor_name:
          ORCHESTRATOR_NAME,
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
      `Could not write Muse Sweep audit event: ${error.message}`,
    );
  }
}

export async function ensureMuseSweepJobs({
  supabase,
  initiatedByUserId,
}: {
  supabase: any;
  initiatedByUserId: string;
}) {
  const candidateVersions =
    TARGETS.map(
      (target) =>
        target.candidateVersion,
    );

  const {
    data: existingRows,
    error: existingError,
  } =
    await supabase
      .from(
        "agent_jobs",
      )
      .select(
        `
          id,
          muse_key,
          candidate_version,
          status,
          input
        `,
      )
      .in(
        "candidate_version",
        candidateVersions,
      );

  if (existingError) {
    throw new Error(
      `Could not inspect existing Muse Sweep jobs: ${existingError.message}`,
    );
  }

  const existingByVersion =
    new Map<string, any>(
      (
        existingRows ??
        []
      ).map(
        (row: any) => [
          String(
            row.candidate_version,
          ),
          row,
        ],
      ),
    );

  const created:
    Array<Record<string, unknown>> =
    [];

  const reused:
    Array<Record<string, unknown>> =
    [];

  for (
    const target
    of TARGETS
  ) {
    const existing =
      existingByVersion.get(
        target.candidateVersion,
      );

    if (existing) {
      reused.push({
        jobId:
          existing.id,
        museKey:
          target.museKey,
        candidateVersion:
          target.candidateVersion,
        status:
          existing.status,
      });

      continue;
    }

    const {
      data: job,
      error: insertError,
    } =
      await supabase
        .from(
          "agent_jobs",
        )
        .insert({
          muse_key:
            target.museKey,
          title:
            `${target.displayName} Autonomous Depth Experiment 01`,
          mission:
            target.mission,
          baseline_version:
            "muse-iq-v1.2",
          candidate_version:
            target.candidateVersion,
          status:
            "NEW",
          requested_source_count:
            10,
          input: {
            sweep_key:
              SWEEP_KEY,
            sweep_version:
              1,
            initiated_by:
              initiatedByUserId,
            target_capabilities:
              target.targetCapabilities,
            human_release_required:
              true,
            stop_at:
              "AWAITING_APPROVAL",
          },
        })
        .select(
          `
            id,
            muse_key,
            candidate_version,
            status
          `,
        )
        .single();

    if (
      insertError ||
      !job
    ) {
      throw new Error(
        insertError?.message ||
          `Could not create ${target.displayName} Muse Sweep job.`,
      );
    }

    await writeAudit({
      supabase,
      jobId:
        job.id,
      eventType:
        "MUSE_SWEEP_JOB_CREATED",
      fromStatus:
        null,
      toStatus:
        "NEW",
      payload: {
        sweepKey:
          SWEEP_KEY,
        museKey:
          target.museKey,
        candidateVersion:
          target.candidateVersion,
        requestedSourceCount:
          10,
        targetCapabilities:
          target.targetCapabilities,
        initiatedBy:
          initiatedByUserId,
      },
    });

    created.push({
      jobId:
        job.id,
      museKey:
        job.muse_key,
      candidateVersion:
        job.candidate_version,
      status:
        job.status,
    });
  }

  return {
    status:
      "success",
    orchestrator:
      ORCHESTRATOR_NAME,
    sweepKey:
      SWEEP_KEY,
    targetCount:
      TARGETS.length,
    created,
    reused,
    jobs:
      await getMuseSweepStatus({
        supabase,
      }),
  };
}

async function callAgentRoute({
  origin,
  cookie,
  path,
}: {
  origin: string;
  cookie: string;
  path: string;
}) {
  const response =
    await fetch(
      `${origin}${path}`,
      {
        method:
          "POST",
        headers: {
          ...(cookie
            ? {
                cookie,
              }
            : {}),
        },
        cache:
          "no-store",
      },
    );

  const payload =
    await response
      .json()
      .catch(
        () => null,
      );

  if (
    !response.ok ||
    payload?.status !==
      "success"
  ) {
    throw new Error(
      payload?.message ||
        `${path} returned HTTP ${response.status}.`,
    );
  }

  return payload;
}

async function provenanceRepairNeeded({
  supabase,
  jobId,
}: {
  supabase: any;
  jobId: string;
}) {
  const {
    count,
    error,
  } =
    await supabase
      .from(
        "source_candidates",
      )
      .select(
        "id",
        {
          count:
            "exact",
          head:
            true,
        },
      )
      .eq(
        "job_id",
        jobId,
      )
      .eq(
        "disposition",
        "ACCEPTED",
      )
      .in(
        "provenance_status",
        [
          "PARTIAL",
          "UNKNOWN",
        ],
      );

  if (error) {
    throw new Error(
      `Could not inspect provenance for ${jobId}: ${error.message}`,
    );
  }

  return (
    count ??
    0
  ) > 0;
}

function repairAlreadyAttempted(
  resultSummary: unknown,
) {
  if (
    !isRecord(
      resultSummary,
    ) ||
    !isRecord(
      resultSummary.orchestrator,
    )
  ) {
    return false;
  }

  return (
    resultSummary.orchestrator
      .provenance_repair_attempted ===
    true
  );
}

async function markRepairAttempted({
  supabase,
  jobId,
}: {
  supabase: any;
  jobId: string;
}) {
  const {
    data: row,
    error: loadError,
  } =
    await supabase
      .from(
        "agent_jobs",
      )
      .select(
        "result_summary",
      )
      .eq(
        "id",
        jobId,
      )
      .single();

  if (
    loadError ||
    !row
  ) {
    throw new Error(
      loadError?.message ||
        "Could not reload Agent job after provenance repair.",
    );
  }

  const summary =
    isRecord(
      row.result_summary,
    )
      ? row.result_summary
      : {};

  const orchestrator =
    isRecord(
      summary.orchestrator,
    )
      ? summary.orchestrator
      : {};

  const {
    error: updateError,
  } =
    await supabase
      .from(
        "agent_jobs",
      )
      .update({
        result_summary: {
          ...summary,
          orchestrator: {
            ...orchestrator,
            sweep_key:
              SWEEP_KEY,
            provenance_repair_attempted:
              true,
            provenance_repair_attempted_at:
              new Date().toISOString(),
          },
        },
      })
      .eq(
        "id",
        jobId,
      );

  if (updateError) {
    throw new Error(
      `Could not mark provenance repair attempt: ${updateError.message}`,
    );
  }
}

async function advanceOneJob({
  supabase,
  job,
  origin,
  cookie,
}: {
  supabase: any;
  job: any;
  origin: string;
  cookie: string;
}) {
  const jobId =
    String(
      job.id,
    );

  const status =
    String(
      job.status,
    );

  const base =
    `/api/admin/agent/jobs/${jobId}`;

  if (
    status === "NEW" ||
    status ===
      "RESEARCHING"
  ) {
    const result =
      await callAgentRoute({
        origin,
        cookie,
        path:
          `${base}/research`,
      });

    return {
      jobId,
      museKey:
        job.muse_key,
      action:
        "research",
      result,
    };
  }

  if (
    status ===
      "RESEARCHED" ||
    status ===
      "CURATING"
  ) {
    const result =
      await callAgentRoute({
        origin,
        cookie,
        path:
          `${base}/curate`,
      });

    return {
      jobId,
      museKey:
        job.muse_key,
      action:
        "curate",
      result,
    };
  }

  if (
    status === "CURATED"
  ) {
    const shouldRepair =
      !repairAlreadyAttempted(
        job.result_summary,
      ) &&
      await provenanceRepairNeeded({
        supabase,
        jobId,
      });

    if (shouldRepair) {
      const result =
        await callAgentRoute({
          origin,
          cookie,
          path:
            `${base}/repair-provenance`,
        });

      await markRepairAttempted({
        supabase,
        jobId,
      });

      return {
        jobId,
        museKey:
          job.muse_key,
        action:
          "repair-provenance",
        result,
      };
    }

    const result =
      await callAgentRoute({
        origin,
        cookie,
        path:
          `${base}/stage-knowledge`,
      });

    return {
      jobId,
      museKey:
        job.muse_key,
      action:
        "stage",
      result,
    };
  }

  if (
    status === "STAGING"
  ) {
    const result =
      await callAgentRoute({
        origin,
        cookie,
        path:
          `${base}/stage-knowledge`,
      });

    return {
      jobId,
      museKey:
        job.muse_key,
      action:
        "stage",
      result,
    };
  }

  if (
    status === "STAGED" ||
    status ===
      "VALIDATING"
  ) {
    const result =
      await callAgentRoute({
        origin,
        cookie,
        path:
          `${base}/validate`,
      });

    return {
      jobId,
      museKey:
        job.muse_key,
      action:
        "validate",
      result,
    };
  }

  if (
    status ===
      "RELEASE_CANDIDATE"
  ) {
    const result =
      await callAgentRoute({
        origin,
        cookie,
        path:
          `${base}/prepare-release`,
      });

    return {
      jobId,
      museKey:
        job.muse_key,
      action:
        "prepare-release",
      result,
    };
  }

  return {
    jobId,
    museKey:
      job.muse_key,
    action:
      "none",
    result: {
      status:
        job.status,
      nextAction:
        nextActionForStatus(
          status,
        ),
    },
  };
}

export async function getMuseSweepStatus({
  supabase,
}: {
  supabase: any;
}) {
  const jobs =
    await loadSweepJobs({
      supabase,
    });

  return jobs.map(
    (job: any) => ({
      jobId:
        job.id,
      museKey:
        job.muse_key,
      candidateVersion:
        job.candidate_version,
      status:
        job.status,
      currentAgent:
        job.current_agent,
      lastError:
        job.last_error,
      nextAction:
        nextActionForStatus(
          String(
            job.status,
          ),
        ),
      updatedAt:
        job.updated_at,
    }),
  );
}

export async function runMuseSweepStep({
  supabase,
  origin,
  cookie,
  parallelism = 2,
}: {
  supabase: any;
  origin: string;
  cookie: string;
  parallelism?: number;
}) {
  const jobs =
    await loadSweepJobs({
      supabase,
    });

  if (
    jobs.length !==
      TARGETS.length
  ) {
    throw new Error(
      `Muse Sweep expected ${TARGETS.length} jobs but found ${jobs.length}. Run the start action first.`,
    );
  }

  const actionable =
    jobs.filter(
      (job: any) =>
        !TERMINAL_STATUSES.has(
          String(
            job.status,
          ),
        ),
    );

  const validationJobs =
    actionable.filter(
      (job: any) =>
        [
          "STAGED",
          "VALIDATING",
        ].includes(
          String(
            job.status,
          ),
        ),
    );

  // Validation is intentionally serialized. Other agent stages may advance
  // two Muses at a time to keep cost and latency controlled.
  const selected =
    validationJobs.length
      ? validationJobs.slice(
          0,
          1,
        )
      : actionable.slice(
          0,
          Math.max(
            1,
            Math.min(
              parallelism,
              2,
            ),
          ),
        );

  const results =
    await Promise.all(
      selected.map(
        async (
          job: any,
        ) => {
          try {
            return await advanceOneJob({
              supabase,
              job,
              origin,
              cookie,
            });
          } catch (
            error
          ) {
            return {
              jobId:
                job.id,
              museKey:
                job.muse_key,
              action:
                nextActionForStatus(
                  String(
                    job.status,
                  ),
                ),
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown Muse Sweep step error.",
            };
          }
        },
      ),
    );

  const status =
    await getMuseSweepStatus({
      supabase,
    });

  const waitingForApproval =
    status.filter(
      (job: any) =>
        job.status ===
          "AWAITING_APPROVAL",
    );

  const needsAttention =
    status.filter(
      (job: any) =>
        [
          "DIAGNOSING",
          "HUMAN_REVIEW",
          "BLOCKED",
          "FAILED",
        ].includes(
          String(
            job.status,
          ),
        ) ||
        Boolean(
          job.lastError,
        ),
    );

  const remaining =
    status.filter(
      (job: any) =>
        !TERMINAL_STATUSES.has(
          String(
            job.status,
          ),
        ),
    );

  return {
    status:
      "success",
    orchestrator:
      ORCHESTRATOR_NAME,
    sweepKey:
      SWEEP_KEY,
    advancedCount:
      selected.length,
    results,
    jobs:
      status,
    waitingForApproval,
    needsAttention,
    continueRequired:
      remaining.length >
      0,
  };
}

export const MUSE_SWEEP_KEY =
  SWEEP_KEY;

export const MUSE_SWEEP_TARGET_COUNT =
  TARGETS.length;
