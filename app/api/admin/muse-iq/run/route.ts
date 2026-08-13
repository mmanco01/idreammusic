import {
  requireAgentAdmin,
} from "@/lib/agentic/project-adapters";
import {
  NextResponse,
} from "next/server";
import {
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import {
  scoreMuseIqResponse,
} from "@/lib/muses/validation/scoring";
import type {
  MuseIqBenchmark,
  MuseIqChatResponse,
} from "@/lib/muses/validation/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type RunRequest = {
  museSlug?: unknown;
  limit?: unknown;
  offset?: unknown;
  benchmarkKey?: unknown;
  deploymentLabel?: unknown;
  agentJobId?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(
        0,
        maxLength,
      )
    : "";
}

function cleanLimit(
  value: unknown,
): number {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      12,
      Math.floor(parsed),
    ),
  );
}

function cleanOffset(
  value: unknown,
): number {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(parsed),
  );
}

async function updateRunSummary({
  supabase,
  runId,
}: {
  supabase: any;
  runId: string;
}) {
  const { data, error } =
    await supabase
      .from(
        "muse_benchmark_results",
      )
      .select(
        "status, passed, overall_score, retrieval_score, citation_score, response_score, latency_ms",
      )
      .eq("run_id", runId);

  if (error) {
    throw new Error(
      `Could not summarize Muse IQ run: ${error.message}`,
    );
  }

  const rows = data ?? [];
  const completed =
    rows.filter(
      (row: any) =>
        [
          "passed",
          "failed",
          "error",
        ].includes(row.status),
    );

  const passed =
    completed.filter(
      (row: any) =>
        row.passed === true,
    ).length;

  const average = (
    key: string,
  ) => {
    const values =
      completed
        .map((row: any) =>
          Number(row[key]),
        )
        .filter(
          (value: number) =>
            Number.isFinite(value),
        );

    return values.length
      ? values.reduce(
          (
            sum: number,
            value: number,
          ) => sum + value,
          0,
        ) / values.length
      : null;
  };

  const allFinished =
    rows.length > 0 &&
    completed.length === rows.length;

  const { error: updateError } =
    await supabase
      .from(
        "muse_validation_runs",
      )
      .update({
        status: allFinished
          ? "completed"
          : "running",
        completed_at:
          allFinished
            ? new Date().toISOString()
            : null,
        completed_benchmarks:
          completed.length,
        passed_benchmarks:
          passed,
        failed_benchmarks:
          completed.length - passed,
        pass_rate:
          completed.length
            ? (passed /
                completed.length) *
              100
            : null,
        average_overall_score:
          average(
            "overall_score",
          ),
        average_retrieval_score:
          average(
            "retrieval_score",
          ),
        average_citation_score:
          average(
            "citation_score",
          ),
        average_response_score:
          average(
            "response_score",
          ),
        average_latency_ms:
          (() => {
            const value =
              average(
                "latency_ms",
              );

            return value === null
              ? null
              : Math.round(value);
          })(),
      })
      .eq("id", runId);

  if (updateError) {
    throw new Error(
      `Could not update Muse IQ run summary: ${updateError.message}`,
    );
  }
}

export async function POST(
  request: Request,
) {
  const supabase =
    await createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "Supabase is not available.",
      },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "Please sign in to run Muse IQ.",
      },
      { status: 401 },
    );
  }

  // Temporary Muse IQ access rule:
  // any signed-in user may run benchmarks.

  try {
    const body =
      (await request.json()) as RunRequest;

    const museSlug =
      cleanString(
        body.museSlug,
        50,
      ) || "calliope";

    const benchmarkKey =
      cleanString(
        body.benchmarkKey,
        150,
      );

    const deploymentLabel =
      cleanString(
        body.deploymentLabel,
        150,
      );

    const agentJobId =
      cleanString(
        body.agentJobId,
        100,
      );

    if (agentJobId) {
      try {
        await requireAgentAdmin(
          request,
        );
      } catch {
        return NextResponse.json(
          {
            status: "error",
            message:
              "Candidate Muse IQ requires Agent admin access.",
          },
          { status: 403 },
        );
      }
    }

    const limit =
      benchmarkKey
        ? 1
        : cleanLimit(body.limit);

    const offset =
      benchmarkKey
        ? 0
        : cleanOffset(body.offset);

    let benchmarkQuery =
      supabase
        .from("muse_benchmarks")
        .select("*")
        .eq("enabled", true)
        .eq(
          "muse_slug",
          museSlug,
        )
        .order(
          "benchmark_key",
          {
            ascending: true,
          },
        );

    if (benchmarkKey) {
      benchmarkQuery =
        benchmarkQuery
          .eq(
            "benchmark_key",
            benchmarkKey,
          )
          .limit(1);
    } else {
      benchmarkQuery =
        benchmarkQuery.range(
          offset,
          offset + limit - 1,
        );
    }

    const {
      data: benchmarkRows,
      error: benchmarkError,
    } = await benchmarkQuery;

    if (benchmarkError) {
      throw new Error(
        `Could not load Muse IQ benchmarks: ${benchmarkError.message}`,
      );
    }

    const benchmarks =
      (benchmarkRows ??
        []) as MuseIqBenchmark[];

    if (!benchmarks.length) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "No enabled benchmarks matched the request.",
        },
        { status: 404 },
      );
    }

    const runName =
      benchmarkKey
        ? `Muse IQ: ${benchmarkKey}`
        : `Muse IQ: ${museSlug} (${offset + 1}-${offset + benchmarks.length})`;

    const {
      data: run,
      error: runError,
    } = await supabase
      .from(
        "muse_validation_runs",
      )
      .insert({
        run_name: runName,
        run_type: "manual",
        status: "running",
        deployment_label:
          deploymentLabel ||
          null,
        benchmark_version:
          benchmarks[0]
            ?.version ?? "v1",
        started_at:
          new Date().toISOString(),
        total_benchmarks:
          benchmarks.length,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (runError || !run) {
      throw new Error(
        runError?.message ||
          "Could not create the Muse IQ run.",
      );
    }

    const origin =
      new URL(request.url).origin;
    const cookie =
      request.headers.get(
        "cookie",
      ) ?? "";

    const results: Array<
      Record<string, unknown>
    > = [];

    for (
      const benchmark of benchmarks
    ) {
      const startedAt =
        new Date();
      const startMs =
        Date.now();

      try {
        const chatResponse =
          await fetch(
            `${origin}/api/muses/chat`,
            {
              method: "POST",
              headers: {
                "content-type":
                  "application/json",
                ...(cookie
                  ? {
                      cookie,
                    }
                  : {}),
              },
              body: JSON.stringify({
                mode: "chat",
                museSlug:
                  benchmark.muse_slug,
                message:
                  benchmark.question,
                agentJobId:
                  agentJobId ||
                  undefined,
              }),
              cache: "no-store",
            },
          );

        const payload =
          (await chatResponse.json()) as MuseIqChatResponse;

        if (
          !chatResponse.ok ||
          payload.status !==
            "success"
        ) {
          throw new Error(
            payload.message ||
              `Muse chat returned HTTP ${chatResponse.status}.`,
          );
        }

        const score =
          scoreMuseIqResponse({
            benchmark,
            response: payload,
          });

        const completedAt =
          new Date();
        const latencyMs =
          Date.now() - startMs;

        const citations =
          payload.knowledgeCitations ??
          [];

        const resultRow = {
          run_id: run.id,
          benchmark_id:
            benchmark.id,
          status: score.passed
            ? "passed"
            : "failed",
          started_at:
            startedAt.toISOString(),
          completed_at:
            completedAt.toISOString(),
          latency_ms: latencyMs,
          http_status:
            chatResponse.status,
          conversation_id:
            payload.conversationId ??
            null,
          message_id:
            payload.messageId ??
            null,
          reply:
            payload.reply ?? null,
          raw_response:
            payload,
          retrieved_count:
            payload.knowledgeMetrics
              ?.retrievedCount ??
            null,
          cited_count:
            payload.knowledgeMetrics
              ?.citedCount ??
            null,
          average_relevance:
            payload.knowledgeMetrics
              ?.averageRelevance ??
            null,
          highest_relevance:
            payload.knowledgeMetrics
              ?.highestRelevance ??
            null,
          retrieved_source_titles:
            [],
          cited_source_titles:
            Array.from(
              new Set(
                citations.map(
                  (citation) =>
                    citation.title,
                ),
              ),
            ),
          retrieval_score:
            score.retrievalScore,
          citation_score:
            score.citationScore,
          response_score:
            score.responseScore,
          structure_score:
            score.structureScore,
          overall_score:
            score.overallScore,
          passed:
            score.passed,
          structure_valid:
            score.structureValid,
          citation_keys_valid:
            score.citationKeysValid,
          expected_concepts_found:
            score.expectedConceptsFound,
          expected_concepts_missing:
            score.expectedConceptsMissing,
          failure_categories:
            score.failureCategories,
          evaluator_notes:
            score.evaluatorNotes,
          benchmark_explanation:
            score.benchmarkExplanation,
          evaluator_details:
            score.evaluatorDetails,
        };

        const {
          error: insertError,
        } = await supabase
          .from(
            "muse_benchmark_results",
          )
          .insert(resultRow);

        if (insertError) {
          throw new Error(
            `Could not save benchmark result: ${insertError.message}`,
          );
        }

        results.push({
          benchmarkKey:
            benchmark.benchmark_key,
          status:
            resultRow.status,
          overallScore:
            score.overallScore,
          failureCategories:
            score.failureCategories,
        });
      } catch (error) {
        const completedAt =
          new Date();
        const latencyMs =
          Date.now() - startMs;
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Muse IQ benchmark error.";

        await supabase
          .from(
            "muse_benchmark_results",
          )
          .insert({
            run_id: run.id,
            benchmark_id:
              benchmark.id,
            status: "error",
            started_at:
              startedAt.toISOString(),
            completed_at:
              completedAt.toISOString(),
            latency_ms:
              latencyMs,
            passed: false,
            failure_categories:
              ["execution"],
            evaluator_notes:
              message,
            evaluator_details: {
              error: message,
            },
          });

        results.push({
          benchmarkKey:
            benchmark.benchmark_key,
          status: "error",
          error: message,
        });
      }
    }

    await updateRunSummary({
      supabase,
      runId: run.id,
    });

    const {
      data: completedRun,
    } = await supabase
      .from(
        "muse_validation_runs",
      )
      .select("*")
      .eq("id", run.id)
      .single();

    return NextResponse.json({
      status: "success",
      run:
        completedRun ?? run,
      results,
    });
  } catch (error) {
    console.error(
      "Muse IQ runner error:",
      error,
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Muse IQ could not run.",
      },
      { status: 500 },
    );
  }
}
