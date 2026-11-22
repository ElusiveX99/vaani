"use server";

import { createHash, randomBytes } from "node:crypto";

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
  const instructions = String(formData.get("instructions") ?? "").trim();
  const durationValue = String(formData.get("duration_minutes") ?? "");
  const participantLimitValue = String(formData.get("participant_limit") ?? "");
  const duration = durationValue ? Number(durationValue) : null;
  const participantLimit = participantLimitValue ? Number(participantLimitValue) : null;

  if (!title || title.length > 120 || description.length > 2000 || instructions.length > 2000) {
    redirect("/sessions/new?error=invalid_input");
  }

  if (accessType !== "community" && accessType !== "invitation_only" && accessType !== "link") {
    redirect("/sessions/new?error=invalid_access");
  }

  if (
    timeZone.length < 1 ||
    timeZone.length > 80 ||
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


export async function createInviteLink(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const expiryHoursValue = Number(formData.get("expiry_hours") ?? 0);
  const maxUsesValue = Number(formData.get("max_uses") ?? 0);

  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");
  if (label.length > 80 || ![0, 24, 72, 168, 720].includes(expiryHoursValue)) {
    redirect(`/sessions/${sessionId}?error=invalid_invite_link`);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = expiryHoursValue
    ? new Date(Date.now() + expiryHoursValue * 60 * 60 * 1000).toISOString()
    : null;
  const maxUses = maxUsesValue > 0 ? maxUsesValue : null;

  const { error } = await supabase.rpc("create_session_invite_link", {
    p_session_id: sessionId,
    p_token_hash: tokenHash,
    p_label: label || null,
    p_expires_at: expiresAt,
    p_max_uses: maxUses,
  });

  if (error) {
    redirect(`/sessions/${sessionId}?error=invite_link_failed`);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://vaaniju.vercel.app";
  const inviteUrl = `${origin}/sessions/join/${token}`;
  redirect(`/sessions/${sessionId}?success=invite_link_created&invite=${encodeURIComponent(inviteUrl)}`);
}

export async function inviteMemberByEmail(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();

  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");
  if (!email || email.length > 320) redirect(`/sessions/${sessionId}?error=invalid_invitee`);

  const { error } = await supabase.rpc("invite_user_to_session", {
    p_session_id: sessionId,
    p_email: email,
  });

  if (error) {
    redirect(`/sessions/${sessionId}?error=invite_member_failed`);
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  redirect(`/sessions/${sessionId}?success=member_invited`);
}

export async function revokeMemberInvitation(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");

  if (!isValidSessionId(sessionId) || !isValidSessionId(userId)) {
    redirect("/sessions?error=invalid_session");
  }

  const { error } = await supabase.rpc("revoke_session_invitation", {
    p_session_id: sessionId,
    p_user_id: userId,
  });

  if (error) redirect(`/sessions/${sessionId}?error=revoke_invitation_failed`);

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  redirect(`/sessions/${sessionId}?success=invitation_revoked`);
}

export async function redeemInviteLink(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const token = String(formData.get("token") ?? "").trim();

  if (!token) redirect("/sessions?error=invalid_invite_link");

  const { data: sessionId, error } = await supabase.rpc("redeem_session_invite_link", {
    p_token: token,
  });

  if (error || typeof sessionId !== "string") {
    redirect("/sessions?error=invite_link_failed");
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}?success=joined_by_invite`);
}
