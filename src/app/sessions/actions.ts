"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedClient() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  if (error || typeof data?.claims?.sub !== "string") {
    redirect("/login");
  }

  return {
    supabase,
    userId: data.claims.sub,
  };
}

function isValidSessionId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function updateSessionLifecycle(
  formData: FormData,
  operation: "start_session" | "end_session" | "cancel_session",
  success: string,
  failure: string
) {
  const { supabase } = await getAuthenticatedClient();

  const sessionId = String(formData.get("session_id") ?? "");

  if (!isValidSessionId(sessionId)) {
    redirect("/sessions?error=invalid_session");
  }

  const { error } = await supabase.rpc(operation, {
    p_session_id: sessionId,
  });

  if (error) {
    redirect(`/sessions/${sessionId}?error=${failure}`);
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/home");

  redirect(`/sessions/${sessionId}?success=${success}`);
}

export async function createSession(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const accessType = String(formData.get("access_type") ?? "");
  const intent = String(formData.get("intent") ?? "publish");
  const isDraft = intent === "draft";
  const scheduledValue = String(formData.get("scheduled_start_at") ?? "");
  const scheduledStart = scheduledValue ? new Date(scheduledValue) : null;
  const timeZone = String(formData.get("time_zone") ?? "Asia/Kolkata");
  const gatheringType = String(formData.get("gathering_type") ?? "");
  const language = String(formData.get("language") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const durationValue = String(formData.get("duration_minutes") ?? "");
  const participantLimitValue = String(formData.get("participant_limit") ?? "");
  const duration = durationValue ? Number(durationValue) : null;
  const participantLimit = participantLimitValue ? Number(participantLimitValue) : null;

  if (!title || title.length > 120 || description.length > 2000 || instructions.length > 2000) {
    redirect("/sessions/new?error=invalid_input");
  }

  if (accessType !== "community" && accessType !== "invitation_only") {
    redirect("/sessions/new?error=invalid_access");
  }

  if (!["chaturasi_gaayan", "vaani_paath", "other"].includes(gatheringType)) {
    redirect("/sessions/new?error=invalid_type");
  }

  if (
    timeZone.length < 1 ||
    timeZone.length > 80 ||
    (language && language.length > 40) ||
    (duration !== null && (!Number.isInteger(duration) || duration < 15 || duration > 480)) ||
    (participantLimit !== null && (!Number.isInteger(participantLimit) || participantLimit < 2 || participantLimit > 500))
  ) {
    redirect("/sessions/new?error=invalid_options");
  }

  if (!isDraft && (!scheduledStart || Number.isNaN(scheduledStart.getTime()) || scheduledStart.getTime() <= Date.now())) {
    redirect("/sessions/new?error=invalid_schedule");
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      title,
      description: description || null,
      access_type: accessType,
      is_draft: isDraft,
      published_at: isDraft ? null : new Date().toISOString(),
      scheduled_start_at: scheduledStart?.toISOString() ?? null,
      time_zone: timeZone,
      duration_minutes: duration,
      gathering_type: gatheringType,
      language: language || null,
      instructions: instructions || null,
      participant_limit: participantLimit,
      waiting_room_enabled: formData.get("waiting_room_enabled") === "on",
      allow_participant_invites: formData.get("allow_participant_invites") === "on",
    })
    .select("id")
    .single();

  if (error || !session) {
    redirect("/sessions/new?error=create_failed");
  }

  revalidatePath("/sessions");
  revalidatePath("/home");
  redirect(`/sessions/${session.id}?success=${isDraft ? "draft_saved" : "created"}`);
}

export async function joinCommunitySession(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();

  const sessionId = String(formData.get("session_id") ?? "");

  if (!isValidSessionId(sessionId)) {
    redirect("/sessions?error=invalid_session");
  }

  const { error } = await supabase.rpc("join_community_session", {
    p_session_id: sessionId,
  });

  if (error) {
    redirect("/sessions?error=join_failed");
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  redirect("/sessions?success=joined");
}

export async function respondToInvitation(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();

  const sessionId = String(formData.get("session_id") ?? "");
  const accept = String(formData.get("accept") ?? "") === "true";

  if (!isValidSessionId(sessionId)) {
    redirect("/sessions?error=invalid_session");
  }

  const { error } = await supabase.rpc(
    "respond_to_session_invitation",
    {
      p_session_id: sessionId,
      p_accept: accept,
    }
  );

  if (error) {
    redirect("/sessions?error=invitation_failed");
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  redirect("/sessions?success=invitation_updated");
}

export async function leaveSession(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();

  const sessionId = String(formData.get("session_id") ?? "");

  if (!isValidSessionId(sessionId)) {
    redirect("/sessions?error=invalid_session");
  }

  const { error } = await supabase.rpc("leave_session", {
    p_session_id: sessionId,
  });

  if (error) {
    redirect("/sessions?error=leave_failed");
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  redirect("/sessions?success=left");
}

export async function startSession(formData: FormData) {
  await updateSessionLifecycle(
    formData,
    "start_session",
    "session_started",
    "start_failed"
  );
}

export async function endSession(formData: FormData) {
  await updateSessionLifecycle(
    formData,
    "end_session",
    "session_ended",
    "end_failed"
  );
}

export async function cancelSession(formData: FormData) {
  await updateSessionLifecycle(
    formData,
    "cancel_session",
    "session_cancelled",
    "cancel_failed"
  );
}
