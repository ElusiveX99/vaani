import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/security/request";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function hasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}

async function getContext(sessionId: string) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || typeof userId !== "string") {
    return { response: json({ error: "Unauthorized." }, 401) };
  }

  const { data: membership, error } = await supabase
    .from("session_members")
    .select("role, status, can_control_reader")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  if (error) {
    console.error("Document membership lookup failed:", error);
    return { response: json({ error: "Unable to verify permissions." }, 500) };
  }

  if (!membership || !["organizer", "in_charge", "admin"].includes(membership.role)) {
    return { response: json({ error: "You cannot manage this session library." }, 403) };
  }

  return { supabase, userId, membership };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return json({ error: "Invalid session ID." }, 400);

  const auth = await getContext(sessionId);
  if ("response" in auth) return auth.response;

  const { data: documents, error: documentsError } = await auth.supabase
    .from("session_documents")
    .select("id, title, size_bytes, created_at, uploaded_by, display_order, is_active")
    .eq("session_id", sessionId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (documentsError) {
    console.error("Session document list failed:", documentsError);
    return json({ error: "Unable to load session documents." }, 500);
  }

  const { data: readerState, error: readerError } = await auth.supabase
    .from("session_reader_state")
    .select("current_document_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (readerError) {
    console.error("Session reader state lookup failed:", readerError);
    return json({ error: "Unable to load the active document." }, 500);
  }

  return json({
    documents: documents ?? [],
    activeDocumentId: readerState?.current_document_id ?? null,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return json({ error: "Invalid session ID." }, 400);
  if (!hasValidOrigin(request)) return json({ error: "Invalid request origin." }, 403);

  const auth = await getContext(sessionId);
  if ("response" in auth) return auth.response;

  const parsed = await readJsonBody<{ documentId?: unknown }>(request, 4096);
  if (!parsed.ok) return json({ error: "Invalid request body." }, parsed.status);
  const body = parsed.data;

  if (body.documentId !== null && !isUuid(body.documentId)) {
    return json({ error: "Invalid document ID." }, 400);
  }

  if (body.documentId) {
    const { data: document, error } = await auth.supabase
      .from("session_documents")
      .select("id")
      .eq("id", body.documentId)
      .eq("session_id", sessionId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Document selection lookup failed:", error);
      return json({ error: "Unable to verify the document." }, 500);
    }
    if (!document) return json({ error: "Document not found." }, 404);
  }

  const canControlReader =
    auth.membership.role === "organizer" ||
    auth.membership.role === "in_charge" ||
    (auth.membership.role === "admin" && auth.membership.can_control_reader === true);

  if (!canControlReader) {
    return json({ error: "You do not have permission to control the shared reader." }, 403);
  }

  const { data: claimData, error: claimError } = await auth.supabase.rpc(
    "claim_session_reader_control",
    { p_session_id: sessionId }
  );
  if (claimError) {
    console.error("Reader claim before document selection failed:", claimError);
    return json({ error: claimError.message || "Unable to claim reader control." }, claimError.code === "42501" ? 403 : 400);
  }
  const lease = Array.isArray(claimData) ? claimData[0] : claimData;
  if (!lease?.granted || lease.active_controller_id !== auth.userId || typeof lease.epoch !== "number") {
    return json({ error: "Another assigned member is guiding the reading. The organizer can take control at any time." }, 409);
  }

  const { data: updatedState, error: updateError } = await auth.supabase
    .from("session_reader_state")
    .update({
      current_document_id: body.documentId,
      current_page: 1,
      current_offset: 0,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("controller_user_id", auth.userId)
    .eq("controller_epoch", lease.epoch)
    .gt("controller_expires_at", new Date().toISOString())
    .select("session_id")
    .maybeSingle();

  if (updateError) {
    console.error("Reader document selection failed:", updateError);
    return json({ error: "Unable to update the active document." }, 500);
  }

  if (!updatedState) {
    return json({ error: "Reader control changed. Claim control again before selecting a document." }, 409);
  }

  return json({ success: true, activeDocumentId: body.documentId });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return json({ error: "Invalid session ID." }, 400);
  if (!hasValidOrigin(request)) return json({ error: "Invalid request origin." }, 403);

  const auth = await getContext(sessionId);
  if ("response" in auth) return auth.response;

  const parsed = await readJsonBody<{ documentId?: unknown }>(request, 4096);
  if (!parsed.ok) return json({ error: "Invalid request body." }, parsed.status);
  const body = parsed.data;
  if (!isUuid(body.documentId)) return json({ error: "Invalid document ID." }, 400);

  const { data: document, error: lookupError } = await auth.supabase
    .from("session_documents")
    .select("id, storage_path")
    .eq("id", body.documentId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (lookupError) {
    console.error("Document deletion lookup failed:", lookupError);
    return json({ error: "Unable to find the document." }, 500);
  }
  if (!document) return json({ error: "Document not found." }, 404);

  const { data: readerState, error: stateError } = await auth.supabase
    .from("session_reader_state")
    .select("current_document_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (stateError) {
    console.error("Reader state lookup before deletion failed:", stateError);
    return json({ error: "Unable to verify the active document." }, 500);
  }

  const wasActive = readerState?.current_document_id === document.id;
  if (wasActive) {
    const { error: detachError } = await auth.supabase
      .from("session_reader_state")
      .update({
        current_document_id: null,
        current_page: 1,
        current_offset: 0,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("current_document_id", document.id);

    if (detachError) {
      console.error("Could not detach document before deletion:", detachError);
      return json({ error: "Unable to remove the document from the reader." }, 500);
    }
  }

  const { error: storageError } = await auth.supabase.storage
    .from("session-pdfs")
    .remove([document.storage_path]);

  if (storageError) {
    console.error("PDF storage deletion failed:", storageError);
    return json({ error: "The PDF could not be deleted from storage." }, 500);
  }

  const { error: deleteError } = await auth.supabase
    .from("session_documents")
    .delete()
    .eq("id", document.id)
    .eq("session_id", sessionId);

  if (deleteError) {
    console.error("PDF metadata deletion failed after storage removal:", deleteError);
    return json({ error: "The PDF file was removed, but its library record could not be deleted. Contact support before retrying." }, 500);
  }

  const { error: finalDetachError } = await auth.supabase
    .from("session_reader_state")
    .update({
      current_document_id: null,
      current_page: 1,
      current_offset: 0,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("current_document_id", document.id);

  if (finalDetachError) {
    console.error("Could not clear the deleted document from reader state:", finalDetachError);
    return json({ error: "The PDF was deleted, but the shared reader state could not be refreshed. Please refresh the conference." }, 500);
  }

  return json({ success: true, removedActiveDocument: wasActive });
}