import {
  createClient,
} from "@supabase/supabase-js";

let agentAdminClient:
  ReturnType<typeof createClient>
  | null = null;

export function getAgentAdminClient() {
  if (agentAdminClient) {
    return agentAdminClient;
  }

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env
      .SUPABASE_SECRET_KEY ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured.",
    );
  }

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured.",
    );
  }

  agentAdminClient =
    createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

  return agentAdminClient;
}
