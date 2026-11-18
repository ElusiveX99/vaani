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

  if (!title || title.length > 120 || description.length > 2000) {
    redirect("/sessions?error=invalid_input");
  }

  if (
    accessType !== "community" &&
    accessType !== "invitation_only"
  ) {
    redirect("/sessions?error=invalid_access");
  }

  const { error } = await supabase
    .from("sessions")
    .insert({
      title,
      description: description || null,
      access_type: accessType,
    });

  if (error) {
    redirect("/sessions?error=create_failed");
  }

  revalidatePath("/sessions");
  revalidatePath("/home");
  redirect("/sessions?success=created");
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
