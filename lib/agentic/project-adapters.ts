import {
  getAgentAdminClient,
} from "@/lib/agentic/admin-client";

export {
  getAgentAdminClient,
};

import {
  createServerSupabaseClient,
} from "@/lib/supabase/server";

export class AgentAuthorizationError extends Error {
  status: number;

  constructor(
    status: number,
    message: string,
  ) {
    super(message);
    this.name = "AgentAuthorizationError";
    this.status = status;
  }
}

function allowedAdminEmails(): Set<string> {
  return new Set(
    (process.env.MUSE_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) =>
        email.trim().toLowerCase(),
      )
      .filter(Boolean),
  );
}

export async function requireAgentAdmin(
  _request?: Request,
) {
  const supabase =
    await createServerSupabaseClient();

  if (!supabase) {
    throw new AgentAuthorizationError(
      500,
      "Supabase is not available.",
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error(
      "Agent authentication error:",
      authError,
    );
  }

  if (!user) {
    throw new AgentAuthorizationError(
      401,
      "Please sign in to use Agent administration.",
    );
  }

  const adminEmails =
    allowedAdminEmails();

  const userEmail =
    user.email?.trim().toLowerCase() ?? "";

  if (
    !adminEmails.size ||
    !userEmail ||
    !adminEmails.has(userEmail)
  ) {
    throw new AgentAuthorizationError(
      403,
      "You are not authorized to administer iDreamMusic agents.",
    );
  }

  return {
    user,
    supabase,
  };
}

export function isAgentWorkerRequest(
  request: Request,
) {
  const secret =
    process.env.CRON_SECRET?.trim() ??
    "";

  if (!secret) {
    return false;
  }

  const authorization =
    request.headers.get(
      "authorization",
    ) ?? "";

  return (
    authorization ===
    `Bearer ${secret}`
  );
}