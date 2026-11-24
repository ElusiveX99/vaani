import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitAction =
  | "livekit_token"
  | "livekit_moderation"
  | "document_mutation";

export async function enforceRateLimit(
  supabase: SupabaseClient,
  action: RateLimitAction
) {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_action: action,
  });

  if (error) {
    console.error("Rate-limit check failed:", error);
    return { allowed: false, error: true };
  }

  return { allowed: data === true, error: false };
}
