import { ROOT_CAUSE_ROUTE } from "./policies";
import type {
  AgentJob,
  OrchestratorDecision,
  RootCause,
} from "./types";

export function decideNextAction(
  job: AgentJob,
  context: {
    validationPassed?: boolean;
    validationRootCause?: RootCause;
    releaseApproved?: boolean;
    unresolvedHumanReview?: boolean;
  } = {}
): OrchestratorDecision {
  if (context.unresolvedHumanReview) {
    return {
      nextStatus: "HUMAN_REVIEW",
      action: "STOP",
      reason: "A governed editorial or safety decision requires a human.",
      humanApprovalRequired: true,
    };
  }

  switch (job.status) {
    case "NEW":
      return {
        nextAgent: "RESEARCH",
        nextStatus: "RESEARCHING",
        action: "START_RESEARCH",
        reason: "New improvement job begins with evidence discovery.",
        humanApprovalRequired: false,
      };

    case "RESEARCHED":
      return {
        nextAgent: "CURATION",
        nextStatus: "CURATING",
        action: "START_CURATION",
        reason: "Research candidates must be curated before ingestion.",
        humanApprovalRequired: false,
      };

    case "CURATED":
      return {
        nextAgent: "INGESTION",
        nextStatus: "STAGING",
        action: "START_INGESTION",
        reason: "Accepted evidence is ready for candidate-only knowledge build.",
        humanApprovalRequired: false,
      };

    case "STAGED":
      return {
        nextAgent: "VALIDATION",
        nextStatus: "VALIDATING",
        action: "START_VALIDATION",
        reason: "Candidate build must pass unchanged regression validation.",
        humanApprovalRequired: false,
      };

    case "VALIDATING":
    case "REVALIDATING": {
      if (context.validationPassed === true) {
        return {
          nextAgent: "RELEASE_MANAGER",
          nextStatus: "RELEASE_CANDIDATE",
          action: "PREPARE_RELEASE",
          reason: "Candidate passed validation and can be packaged.",
          humanApprovalRequired: false,
        };
      }

      if (context.validationPassed === false) {
        const route =
          context.validationRootCause
            ? ROOT_CAUSE_ROUTE[context.validationRootCause]
            : "HUMAN_REVIEW";

        if (route === "HUMAN_REVIEW") {
          return {
            nextStatus: "HUMAN_REVIEW",
            action: "STOP",
            reason: `Validation failed with root cause ${context.validationRootCause ?? "UNKNOWN"}.`,
            humanApprovalRequired: true,
          };
        }

        if (route === "CODE_IMPROVEMENT") {
          return {
            nextAgent: "CODE_IMPROVEMENT",
            nextStatus: "CODE_FIX",
            action: "APPLY_CODE_FIX",
            reason: `Validation failure routed to code improvement: ${context.validationRootCause}.`,
            humanApprovalRequired: false,
          };
        }

        // Research/Curation/Ingestion route:
        const status =
          route === "RESEARCH"
            ? "RESEARCHING"
            : route === "CURATION"
              ? "CURATING"
              : "STAGING";

        const action =
          route === "RESEARCH"
            ? "START_RESEARCH"
            : route === "CURATION"
              ? "START_CURATION"
              : "START_INGESTION";

        return {
          nextAgent: route as "RESEARCH" | "CURATION" | "INGESTION",
          nextStatus: status,
          action,
          reason: `Validation failure routed to ${route}: ${context.validationRootCause}.`,
          humanApprovalRequired: false,
        };
      }

      return {
        nextAgent: "VALIDATION",
        nextStatus: job.status,
        action: "START_VALIDATION",
        reason: "Validation result is not yet available.",
        humanApprovalRequired: false,
      };
    }

    case "CODE_FIX":
      return {
        nextAgent: "VALIDATION",
        nextStatus: "REVALIDATING",
        action: "REVALIDATE",
        reason: "Every candidate code repair must return through validation.",
        humanApprovalRequired: false,
      };

    case "RELEASE_CANDIDATE":
      if (context.releaseApproved === true) {
        return {
          nextAgent: "RELEASE_MANAGER",
          nextStatus: "RELEASED",
          action: "PROMOTE_RELEASE",
          reason: "The exact validated release candidate has explicit human approval.",
          humanApprovalRequired: true,
        };
      }
      return {
        nextStatus: "AWAITING_APPROVAL",
        action: "REQUEST_APPROVAL",
        reason: "v1 requires human approval for every production Muse release.",
        humanApprovalRequired: true,
      };

    case "AWAITING_APPROVAL":
      if (context.releaseApproved === true) {
        return {
          nextAgent: "RELEASE_MANAGER",
          nextStatus: "RELEASED",
          action: "PROMOTE_RELEASE",
          reason: "Human editor-in-chief approved the validated release candidate.",
          humanApprovalRequired: true,
        };
      }
      if (context.releaseApproved === false) {
        return {
          nextStatus: "REJECTED",
          action: "STOP",
          reason: "Human editor-in-chief rejected the release candidate.",
          humanApprovalRequired: true,
        };
      }
      return {
        nextStatus: "AWAITING_APPROVAL",
        action: "STOP",
        reason: "Awaiting explicit human release decision.",
        humanApprovalRequired: true,
      };

    case "RELEASED":
    case "REJECTED":
    case "CANCELLED":
    case "ROLLED_BACK":
    case "FAILED":
    case "BLOCKED":
    case "HUMAN_REVIEW":
      return {
        nextStatus: job.status,
        action: "STOP",
        reason: `No autonomous transition from terminal/gated status ${job.status}.`,
        humanApprovalRequired: job.status === "HUMAN_REVIEW",
      };

    default:
      return {
        nextStatus: "BLOCKED",
        action: "STOP",
        reason: `No v1 transition is defined from ${job.status}.`,
        humanApprovalRequired: false,
      };
  }
}
