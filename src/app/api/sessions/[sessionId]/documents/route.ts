import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  return !origin || origin === new URL(request.url).origin;
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
    .select("role, status")
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

  return { supabase, userId };
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

  let body: { documentId?: unknown };
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

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

  const { error: updateError } = await auth.supabase
    .from("session_reader_state")
    .upsert({
      session_id: sessionId,
      current_document_id: body.documentId,
      current_page: 1,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "session_id" });

  if (updateError) {
    console.error("Reader document selection failed:", updateError);
    return json({ error: "Unable to update the active document." }, 500);
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

  let body: { documentId?: unknown };
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }
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
      .upsert({
        session_id: sessionId,
        current_document_id: null,
        current_page: 1,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "session_id" });

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
    if (wasActive) {
      await auth.supabase.from("session_reader_state").upsert({
        session_id: sessionId,
        current_document_id: document.id,
        current_page: 1,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
    }
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

  return json({ success: true, removedActiveDocument: wasActive });
}
