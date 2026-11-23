"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedClient() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) redirect("/login");
  return { supabase, userId: data.user.id };
}


function parseLocalDateTime(value: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(Number.NaN);
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const requested = [year, month, day, hour, minute];
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    guess += target - represented;
  }
  const finalParts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
  const actual = [Number(finalParts.year), Number(finalParts.month), Number(finalParts.day), Number(finalParts.hour), Number(finalParts.minute)];
  if (actual.some((part, index) => part !== requested[index])) return new Date(Number.NaN);
  return new Date(guess);
}

function isValidTimeZone(value: string) {
  try { Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date()); return true; } catch { return false; }
}

function isValidSessionId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function updateSessionLifecycle(
  formData: FormData,
  operation: "start_session" | "end_session" | "cancel_session" | "resume_session",
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
  const { supabase, userId } = await getAuthenticatedClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const accessType = String(formData.get("access_type") ?? "");
  const intent = String(formData.get("intent") ?? "publish");
  if (intent !== "draft" && intent !== "publish") redirect("/sessions/new?error=invalid_options");
  const isDraft = intent === "draft";
  const timeZone = String(formData.get("time_zone") ?? "Asia/Kolkata");
  const scheduledValue = String(formData.get("scheduled_start_local") ?? "");
  const scheduledStart = scheduledValue ? parseLocalDateTime(scheduledValue, timeZone) : null;
  if (!isValidTimeZone(timeZone)) redirect("/sessions/new?error=invalid_options");
  const instructions = String(formData.get("instructions") ?? "").trim();
  const recurrenceRule = String(formData.get("recurrence_rule") ?? "") || null;
  const recurrenceUntilValue = String(formData.get("recurrence_until_local") ?? "");
  const recurrenceUntil = recurrenceUntilValue ? parseLocalDateTime(`${recurrenceUntilValue}T23:59`, timeZone) : null;
  const durationValue = String(formData.get("duration_minutes") ?? "");
  const participantLimitValue = String(formData.get("participant_limit") ?? "");
  const duration = durationValue ? Number(durationValue) : null;
  const participantLimit = participantLimitValue ? Number(participantLimitValue) : null;

  if (!title || title.length > 120 || description.length > 2000 || instructions.length > 2000) {
    redirect("/sessions/new?error=invalid_input");
  }

  if (accessType !== "community" && accessType !== "link") {
    redirect("/sessions/new?error=invalid_access");
  }

  if (
    timeZone.length < 1 ||
    timeZone.length > 80 ||
    (recurrenceRule !== null && !["DAILY", "WEEKLY", "BIWEEKLY", "EVERY_3_WEEKS", "EVERY_4_WEEKS", "MONTHLY"].includes(recurrenceRule)) ||
    (recurrenceRule !== null && (!recurrenceUntil || Number.isNaN(recurrenceUntil.getTime()) || !scheduledStart || Number.isNaN(scheduledStart.getTime()) || recurrenceUntil <= scheduledStart || recurrenceUntil.getTime() > scheduledStart.getTime() + 366 * 24 * 60 * 60 * 1000)) ||
    (recurrenceRule === null && recurrenceUntilValue !== "") ||
    (duration !== null && (!Number.isInteger(duration) || duration < 15 || duration > 480)) ||
    (participantLimit !== null && (!Number.isInteger(participantLimit) || participantLimit < 2 || participantLimit > 500))
  ) {
    redirect("/sessions/new?error=invalid_options");
  }

  if (scheduledValue && (!scheduledStart || Number.isNaN(scheduledStart.getTime()) || scheduledStart.getTime() <= Date.now())) {
    redirect("/sessions/new?error=invalid_schedule");
  }
  if (!isDraft && recurrenceRule && !scheduledStart) {
    redirect("/sessions/new?error=invalid_recurrence");
  }

  const { data: sessionId, error } = await supabase.rpc("create_gathering", {
    p_title: title,
    p_description: description || null,
    p_access_type: accessType,
    p_is_draft: isDraft,
    p_published_at: isDraft ? null : new Date().toISOString(),
    p_scheduled_start_at: scheduledStart?.toISOString() ?? null,
    p_time_zone: timeZone,
    p_duration_minutes: duration,
    p_instructions: instructions || null,
    p_participant_limit: participantLimit,
    p_waiting_room_enabled: formData.get("waiting_room_enabled") === "on",
    p_recurrence_rule: recurrenceRule,
    p_recurrence_until: recurrenceUntil?.toISOString() ?? null,
  });

  if (error || typeof sessionId !== "string") {
    console.error("Gathering creation failed:", error?.code, error?.message, error?.details, error?.hint);
    redirect("/sessions/new?error=create_failed");
  }

  revalidatePath("/sessions");
  revalidatePath("/home");
  redirect(`/sessions/${sessionId}?success=${isDraft ? "draft_saved" : "created"}`);
}

export async function joinGatheringBySlug(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!/^[a-f0-9]{32}$/.test(slug)) redirect("/sessions?error=invalid_gathering_link");

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/g/${slug}`)}`);
  }

  const { data, error } = await supabase.rpc("request_gathering_join_by_slug", {
    p_slug: slug,
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result || typeof result.session_id !== "string") {
    redirect(`/g/${slug}?error=join_failed`);
  }

  revalidatePath("/sessions");
  revalidatePath("/home");
  revalidatePath(`/sessions/${result.session_id}`);
  if (result.outcome === "request_pending") {
    redirect(`/g/${slug}?requested=1`);
  }
  redirect(`/sessions/${result.session_id}?success=joined_by_invite`);
}

export async function joinCommunitySession(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();

  const sessionId = String(formData.get("session_id") ?? "");

  if (!isValidSessionId(sessionId)) {
    redirect("/sessions?error=invalid_session");
  }

  const { data: sessionInfo } = await supabase.from("sessions").select("waiting_room_enabled").eq("id", sessionId).maybeSingle();
  const { error } = await supabase.rpc("request_session_join", {
    p_session_id: sessionId,
  });

  if (error) {
    redirect("/sessions?error=join_failed");
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions?success=${sessionInfo?.waiting_room_enabled ? "join_request_sent" : "joined"}`);
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

  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");

  // One permanent, reusable link per participant and gathering.
  // Revoking it allows a fresh code to be generated.
  const generateInviteCode = () => {
    const space = BigInt(36) ** BigInt(10);
    const range = BigInt(1) << BigInt(64);
    const limit = range - (range % space);
    let value: bigint;
    do {
      value = BigInt("0x" + randomBytes(8).toString("hex"));
    } while (value >= limit);
    return (value % space).toString(36).padStart(10, "0");
  };

  let savedCode: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateInviteCode();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data, error } = await supabase.rpc("create_session_invite_link", {
      p_session_id: sessionId,
      p_short_code: token,
      p_token_hash: tokenHash,
    });

    if (!error && typeof data === "string") {
      savedCode = data;
      break;
    }
    if (error?.code === "23505") continue;

    console.error("Invitation link creation failed:", error?.code, error?.message, error?.details);
    redirect(`/sessions/${sessionId}?error=invite_link_failed`);
  }

  if (!savedCode) redirect(`/sessions/${sessionId}?error=invite_link_failed`);

  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}?success=invitation_created`);
}

export async function redeemInviteLink(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();

  if (!/^[a-z0-9]{10}$/.test(token)) redirect("/sessions?error=invalid_invite_link");

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/g/${token}`)}`);
  }
  const userId = auth.user.id;

  const { data: sessionId, error } = await supabase.rpc("redeem_session_invite_link", {
    p_token: token,
  });

  if (error || typeof sessionId !== "string") redirect(`/g/${token}?error=redeem_failed`);

  const [{data:membership},{data:pendingRequest}]=await Promise.all([
    supabase.from("session_members").select("status").eq("session_id",sessionId).eq("user_id",userId).maybeSingle(),
    supabase.from("session_join_requests").select("id").eq("session_id",sessionId).eq("user_id",userId).eq("status","pending").maybeSingle(),
  ]);
  revalidatePath("/sessions"); revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}?success=${membership?.status==="accepted"?"joined_by_invite":pendingRequest?"join_request_sent":"joined_by_invite"}`);
}



export async function updatePublishedSessionDetails(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const timeZone = String(formData.get("time_zone") ?? "Asia/Kolkata");
  const scheduledValue = String(formData.get("scheduled_start_local") ?? "");
  const durationValue = String(formData.get("duration_minutes") ?? "");
  const duration = durationValue ? Number(durationValue) : null;
  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");
  if (!isValidTimeZone(timeZone) || !title || title.length > 120 || description.length > 2000 || instructions.length > 2000) redirect(`/sessions/${sessionId}?error=published_edit_invalid`);
  const scheduled = scheduledValue ? parseLocalDateTime(scheduledValue, timeZone) : null;
  if (scheduledValue && (!scheduled || Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now())) redirect(`/sessions/${sessionId}?error=published_edit_invalid`);
  if (duration !== null && (!Number.isInteger(duration) || duration < 15 || duration > 480)) redirect(`/sessions/${sessionId}?error=published_edit_invalid`);
  const { error } = await supabase.rpc("update_published_session_details", {
    p_session_id: sessionId, p_title: title, p_description: description || null,
    p_scheduled_start_at: scheduled?.toISOString() ?? null, p_time_zone: timeZone,
    p_duration_minutes: duration, p_instructions: instructions || null,
  });
  if (error) {
    console.error("Published gathering update failed:", error.code, error.message);
    redirect(`/sessions/${sessionId}?error=published_edit_failed`);
  }
  revalidatePath("/sessions"); revalidatePath("/home"); revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}?success=published_edit_saved`);
}

export async function publishSessionDraft(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");

  // Publish from the values currently in the draft form. Publishing must never
  // silently use an older value stored in the database.
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const scheduledValue = String(formData.get("scheduled_start_local") ?? "");
  const timeZone = String(formData.get("time_zone") ?? "Asia/Kolkata");
  const scheduled = scheduledValue ? parseLocalDateTime(scheduledValue, timeZone) : null;
  const durationValue = String(formData.get("duration_minutes") ?? "");
  const limitValue = String(formData.get("participant_limit") ?? "");
  const duration = durationValue ? Number(durationValue) : null;
  const limit = limitValue ? Number(limitValue) : null;
  const accessType = String(formData.get("access_type") ?? "");
  const recurrenceRule = String(formData.get("recurrence_rule") ?? "") || null;
  const recurrenceUntilValue = String(formData.get("recurrence_until_local") ?? "");
  const recurrenceUntil = recurrenceUntilValue ? parseLocalDateTime(recurrenceUntilValue + "T23:59", timeZone) : null;
  const instructions = String(formData.get("instructions") ?? "").trim();

  if (
    !isValidTimeZone(timeZone) ||
    !title ||
    title.length > 120 ||
    description.length > 2000 ||
    instructions.length > 2000 ||
    !["community", "link"].includes(accessType)
  ) redirect("/sessions/" + sessionId + "?error=invalid_edit");

  if (!scheduled || Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
    redirect("/sessions/" + sessionId + "?error=invalid_edit");
  }

  if (
    (duration !== null && (!Number.isInteger(duration) || duration < 15 || duration > 480)) ||
    (limit !== null && (!Number.isInteger(limit) || limit < 2 || limit > 500))
  ) redirect("/sessions/" + sessionId + "?error=invalid_options");

  if (
    recurrenceRule !== null &&
    (!["DAILY", "WEEKLY", "BIWEEKLY", "EVERY_3_WEEKS", "EVERY_4_WEEKS", "MONTHLY"].includes(recurrenceRule) ||
      !recurrenceUntil ||
      Number.isNaN(recurrenceUntil.getTime()) ||
      recurrenceUntil <= scheduled ||
      recurrenceUntil.getTime() > scheduled.getTime() + 366 * 24 * 60 * 60 * 1000)
  ) redirect("/sessions/" + sessionId + "?error=invalid_recurrence");

  if (recurrenceRule === null && recurrenceUntilValue) {
    redirect("/sessions/" + sessionId + "?error=invalid_options");
  }

  const { error } = await supabase.rpc("publish_session_draft_with_details", {
    p_session_id: sessionId,
    p_title: title,
    p_description: description || null,
    p_access_type: accessType,
    p_scheduled_start_at: scheduled.toISOString(),
    p_time_zone: timeZone,
    p_duration_minutes: duration,
    p_participant_limit: limit,
    p_waiting_room_enabled: formData.get("waiting_room_enabled") === "on",
    p_instructions: instructions || null,
    p_recurrence_rule: recurrenceRule,
    p_recurrence_until: recurrenceUntil?.toISOString() ?? null,
  });
  if (error) redirect(`/sessions/${sessionId}?error=publish_failed`);
  revalidatePath("/sessions");
  revalidatePath("/home");
  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}?success=published`);
}

export async function updateSessionDetails(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const scheduledValue = String(formData.get("scheduled_start_local") ?? formData.get("scheduled_start_at") ?? "");
  const timeZone = String(formData.get("time_zone") ?? "Asia/Kolkata");
  if (!isValidTimeZone(timeZone)) redirect(`/sessions/${sessionId}?error=invalid_options`);
  const scheduled = parseLocalDateTime(scheduledValue, timeZone);
  const accessType = String(formData.get("access_type") ?? "");
  const durationValue = String(formData.get("duration_minutes") ?? "");
  const limitValue = String(formData.get("participant_limit") ?? "");
  const duration = durationValue ? Number(durationValue) : null;
  const limit = limitValue ? Number(limitValue) : null;
  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");
  if (!title || title.length > 120 || description.length > 2000 || (scheduledValue && (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()))) redirect(`/sessions/${sessionId}?error=invalid_edit`);
  if (!["community","link"].includes(accessType)) redirect(`/sessions/${sessionId}?error=invalid_access`);
  if ((duration !== null && (!Number.isInteger(duration) || duration < 15 || duration > 480)) || (limit !== null && (!Number.isInteger(limit) || limit < 2 || limit > 500))) redirect(`/sessions/${sessionId}?error=invalid_options`);
  const recurrenceRule = String(formData.get("recurrence_rule") ?? "") || null;
  const recurrenceUntilValue = String(formData.get("recurrence_until_local") ?? formData.get("recurrence_until") ?? "");
  const recurrenceUntil = recurrenceUntilValue ? (recurrenceUntilValue.length === 10 ? parseLocalDateTime(`${recurrenceUntilValue}T23:59`, timeZone) : new Date(recurrenceUntilValue)) : null;
  if (recurrenceRule !== null && (!["DAILY", "WEEKLY", "BIWEEKLY", "EVERY_3_WEEKS", "EVERY_4_WEEKS", "MONTHLY"].includes(recurrenceRule) || !recurrenceUntil || Number.isNaN(recurrenceUntil.getTime()) || recurrenceUntil <= scheduled || recurrenceUntil.getTime() > scheduled.getTime() + 366 * 24 * 60 * 60 * 1000)) redirect(`/sessions/${sessionId}?error=invalid_recurrence`);
  const { error } = await supabase.rpc("update_session_details", {
    p_session_id: sessionId,
    p_title: title,
    p_description: description || null,
    p_access_type: accessType,
    p_scheduled_start_at: scheduledValue ? scheduled.toISOString() : null,
    p_time_zone: timeZone,
    p_duration_minutes: duration,
    p_participant_limit: limit,
    p_waiting_room_enabled: formData.get("waiting_room_enabled") === "on",
    p_instructions: String(formData.get("instructions") ?? "").trim() || null,
    p_recurrence_rule: recurrenceRule,
    p_recurrence_until: recurrenceUntil?.toISOString() ?? null,
  });
  if (error) redirect(`/sessions/${sessionId}?error=update_failed`);
  revalidatePath("/sessions");
  revalidatePath("/home");
  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}?success=session_updated`);
}


export async function approveJoinRequest(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const requestId = String(formData.get("request_id") ?? "");
  if (!isValidSessionId(sessionId) || !isValidSessionId(requestId)) redirect("/sessions?error=invalid_session");
  const { error } = await supabase.rpc("approve_session_join_request", { p_request_id: requestId });
  if (error) redirect(`/sessions/${sessionId}?error=join_request_action_failed`);
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  redirect(`/sessions/${sessionId}?success=join_request_approved`);
}

export async function rejectJoinRequest(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const requestId = String(formData.get("request_id") ?? "");
  if (!isValidSessionId(sessionId) || !isValidSessionId(requestId)) redirect("/sessions?error=invalid_session");
  const { error } = await supabase.rpc("reject_session_join_request", { p_request_id: requestId });
  if (error) redirect(`/sessions/${sessionId}?error=join_request_action_failed`);
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  redirect(`/sessions/${sessionId}?success=join_request_rejected`);
}

export async function revokeInviteLink(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const linkId = String(formData.get("link_id") ?? "");
  if (!isValidSessionId(sessionId) || !isValidSessionId(linkId)) redirect("/sessions?error=invalid_session");
  const { error } = await supabase.rpc("revoke_session_invite_link", { p_link_id: linkId });
  if (error) redirect(`/sessions/${sessionId}?error=revoke_invitation_failed`);
  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}?success=invitation_revoked`);
}

export async function markSessionNotificationRead(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const notificationId = String(formData.get("notification_id") ?? "");
  if (!isValidSessionId(notificationId)) redirect("/sessions?error=notification_failed");
  const { error } = await supabase.rpc("mark_session_notification_read", { p_notification_id: notificationId });
  if (error) redirect("/sessions?error=notification_failed");
  revalidatePath("/sessions");
  redirect("/sessions?success=notification_read");
}

export async function cancelJoinRequest(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  const requestId = String(formData.get("request_id") ?? "");
  if (!isValidSessionId(sessionId) || !isValidSessionId(requestId)) redirect("/sessions?error=invalid_session");
  const { error } = await supabase.rpc("cancel_session_join_request", { p_request_id: requestId });
  if (error) redirect(`/sessions/${sessionId}?error=join_request_action_failed`);
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}?success=join_request_cancelled`);
}

export async function resumeSession(formData: FormData) {
  await updateSessionLifecycle(formData, "resume_session", "session_resumed", "resume_failed");
}


export async function deleteEndedSession(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");

  const { error } = await supabase.rpc("delete_ended_session", {
    p_session_id: sessionId,
  });

  if (error) {
    console.error("Ended gathering deletion failed:", error.code, error.message, error.details);
    redirect(`/sessions/${sessionId}?error=delete_failed`);
  }

  revalidatePath("/sessions");
  revalidatePath("/home");
  redirect("/sessions?success=session_deleted");
}


export async function deleteCancelledSession(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");
  const { error } = await supabase.rpc("delete_cancelled_session", { p_session_id: sessionId });
  if (error) {
    console.error("Cancelled gathering deletion failed:", error.code, error.message, error.details);
    redirect(`/sessions/${sessionId}?error=delete_cancelled_failed`);
  }
  revalidatePath("/sessions");
  revalidatePath("/home");
  redirect("/sessions?success=session_deleted");
}

export async function deleteSessionDraft(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const sessionId = String(formData.get("session_id") ?? "");
  if (!isValidSessionId(sessionId)) redirect("/sessions?error=invalid_session");

  const { error } = await supabase.rpc("delete_session_draft", {
    p_session_id: sessionId,
  });

  if (error) {
    console.error("Draft deletion failed:", error.code, error.message, error.details);
    redirect(`/sessions/${sessionId}?error=draft_delete_failed`);
  }

  revalidatePath("/sessions");
  revalidatePath("/home");
  redirect("/sessions?success=draft_deleted");
}


export async function updateSessionDraft(formData: FormData) {
  return updateSessionDetails(formData);
}
