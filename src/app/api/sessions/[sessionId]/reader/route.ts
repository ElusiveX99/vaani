import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/security/request";

const SIGNED_URL_LIFETIME = 6 * 60 * 60;

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function json(
  body: unknown,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

async function getAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase.auth.getClaims();

  if (error || typeof data?.claims?.sub !== "string") {
    return null;
  }

  return data.claims.sub;
}

async function getLiveSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
) {
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("Reader session lookup failed:", error);

    return {
      response: json(
        { error: "Unable to load the session." },
        500
      ),
      session: null,
    };
  }

  if (!session) {
    return {
      response: json(
        { error: "Session not found." },
        404
      ),
      session: null,
    };
  }

  if (session.status !== "live") {
    return {
      response: json(
        { error: "Session is not live." },
        409
      ),
      session: null,
    };
  }

  return {
    response: null,
    session,
  };
}

async function getAcceptedMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  userId: string
) {
  return supabase
    .from("session_members")
    .select("role, status, can_control_reader")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const { sessionId } = await context.params;

  if (!isValidUuid(sessionId)) {
    return json(
      { error: "Invalid session ID." },
      400
    );
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUser(supabase);

  if (!userId) {
    return json(
      { error: "Unauthorized." },
      401
    );
  }

  const { response: sessionResponse } =
    await getLiveSession(supabase, sessionId);

  if (sessionResponse) return sessionResponse;

  const {
    data: membership,
    error: membershipError,
  } = await getAcceptedMembership(
    supabase,
    sessionId,
    userId
  );

  if (membershipError) {
    console.error(
      "Reader membership lookup failed:",
      membershipError
    );

    return json(
      { error: "Unable to verify session membership." },
      500
    );
  }

  if (!membership) {
    return json(
      { error: "You are not an accepted member of this session." },
      403
    );
  }

  const {
    data: readerState,
    error: readerStateError,
  } = await supabase
    .from("session_reader_state")
    .select(
      "session_id, current_document_id, current_page, current_offset, controller_user_id, controller_expires_at, controller_epoch, updated_by, updated_at"
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (readerStateError) {
    console.error(
      "Reader state lookup failed:",
      readerStateError
    );

    return json(
      { error: "Unable to load reader state." },
      500
    );
  }

  const canRequestControl =
    membership.role === "organizer" ||
    membership.role === "in_charge" ||
    (membership.role === "admin" && membership.can_control_reader === true);
  const canReclaimControl = membership.role === "organizer";

  const canControl =
    canRequestControl &&
    readerState?.controller_user_id === userId &&
    typeof readerState.controller_expires_at === "string" &&
    new Date(readerState.controller_expires_at).getTime() > Date.now();

  let document = null;

  if (readerState?.current_document_id) {
    const {
      data,
      error,
    } = await supabase
      .from("session_documents")
      .select(
        "id, title, storage_path, mime_type, size_bytes, library_document_id"
      )
      .eq("id", readerState.current_document_id)
      .eq("session_id", sessionId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error(
        "Selected document lookup failed:",
        error
      );

      return json(
        { error: "Unable to load the selected PDF." },
        500
      );
    }

    document = data;
  }

  if (!readerState) {
    const {
      data,
      error,
    } = await supabase
      .from("session_documents")
      .select(
        "id, title, storage_path, mime_type, size_bytes, library_document_id"
      )
      .eq("session_id", sessionId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Fallback document lookup failed:",
        error
      );

      return json(
        { error: "Unable to load session documents." },
        500
      );
    }

    document = data;
  }

  if (!document) {
    return json({
      canControl,
      canRequestControl,
      canReclaimControl,
      document: null,
      readerState: readerState ?? null,
    });
  }

  const {
    data: signedUrlData,
    error: signedUrlError,
  } = await supabase.storage
    .from(document.library_document_id ? "vaani-library-pdfs" : "session-pdfs")
    .createSignedUrl(
      document.storage_path,
      SIGNED_URL_LIFETIME
    );

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error(
      "PDF signed URL creation failed:",
      signedUrlError
    );

    return json(
      { error: "Unable to access the PDF." },
      500
    );
  }

  return json({
    canControl,
    canRequestControl,
    canReclaimControl,
    document: {
      id: document.id,
      title: document.title,
      mimeType: document.mime_type,
      sizeBytes: document.size_bytes,
      url: signedUrlData.signedUrl,
    },
    readerState:
      readerState ?? {
        session_id: sessionId,
        current_document_id: document.id,
        current_page: 1,
      },
  });
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const { sessionId } = await context.params;

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return json({ error: "Invalid request origin." }, 403);
  }

  if (!isValidUuid(sessionId)) {
    return json(
      { error: "Invalid session ID." },
      400
    );
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUser(supabase);

  if (!userId) {
    return json(
      { error: "Unauthorized." },
      401
    );
  }

  const { response: sessionResponse } =
    await getLiveSession(supabase, sessionId);

  if (sessionResponse) return sessionResponse;

  const {
    data: membership,
    error: membershipError,
  } = await getAcceptedMembership(
    supabase,
    sessionId,
    userId
  );

  if (membershipError) {
    console.error(
      "Reader membership lookup failed:",
      membershipError
    );

    return json(
      { error: "Unable to verify reader permissions." },
      500
    );
  }

  if (
    !membership ||
    !(
      membership.role === "organizer" ||
      membership.role === "in_charge" ||
      (membership.role === "admin" && membership.can_control_reader === true)
    )
  ) {
    return json(
      { error: "You do not have permission to control the reader." },
      403
    );
  }

  const parsed = await readJsonBody<{
    documentId?: unknown;
    currentPage?: unknown;
    expectedDocumentId?: unknown;
    currentOffset?: unknown;
    controllerEpoch?: unknown;
  }>(request, 4096);
  if (!parsed.ok) return json({ error: "Invalid JSON body." }, parsed.status);
  const body = parsed.data;

  const documentId =
    typeof body.documentId === "string"
      ? body.documentId
      : null;

  const currentPage = body.currentPage;

  const expectedDocumentId =
    body.expectedDocumentId === undefined
      ? null
      : typeof body.expectedDocumentId === "string"
        ? body.expectedDocumentId
        : false;

  if (
    !documentId ||
    !isValidUuid(documentId) ||
    typeof currentPage !== "number" ||
    !Number.isSafeInteger(currentPage) ||
    currentPage < 1 ||
    (body.currentOffset !== undefined &&
      (typeof body.currentOffset !== "number" ||
        !Number.isFinite(body.currentOffset) ||
        body.currentOffset < 0 ||
        body.currentOffset > 1)) ||
    (typeof body.controllerEpoch !== "number" ||
      !Number.isSafeInteger(body.controllerEpoch) ||
      body.controllerEpoch < 0) ||
    expectedDocumentId === false ||
    (
      typeof expectedDocumentId === "string" &&
      !isValidUuid(expectedDocumentId)
    )
  ) {
    return json(
      { error: "Invalid reader state." },
      400
    );
  }

  const { data: lease, error: leaseError } = await supabase
    .from("session_reader_state")
    .select("controller_user_id, controller_expires_at, controller_epoch")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (leaseError) {
    console.error("Reader control lease lookup failed:", leaseError);
    return json({ error: "Unable to verify reader control." }, 500);
  }

  if (
    !lease ||
    lease.controller_user_id !== userId ||
    !lease.controller_expires_at ||
    new Date(lease.controller_expires_at).getTime() <= Date.now() ||
    body.controllerEpoch !== lease.controller_epoch
  ) {
    return json(
      { error: "Reader control has changed. Claim control again before continuing." },
      409
    );
  }

  const {
    data: document,
    error: documentError,
  } = await supabase
    .from("session_documents")
    .select("id")
    .eq("id", documentId)
    .eq("session_id", sessionId)
    .eq("is_active", true)
    .maybeSingle();

  if (documentError) {
    console.error(
      "Reader document validation failed:",
      documentError
    );

    return json(
      { error: "Unable to verify the document." },
      500
    );
  }

  if (!document) {
    return json(
      { error: "Document not found." },
      404
    );
  }

  const currentOffset =
    typeof body.currentOffset === "number" ? body.currentOffset : 0;

  const readerStateUpdate = {
    current_page: currentPage,
    current_offset: currentOffset,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (typeof expectedDocumentId === "string") {
    // Page-only update: update only if this document is
    // still the active document. This prevents stale requests
    // from overwriting a newly selected document's page.
    if (expectedDocumentId !== documentId) {
      return json(
        { error: "Reader document changed. Please refresh." },
        409
      );
    }

    const {
      data: updatedState,
      error: updateError,
    } = await supabase
      .from("session_reader_state")
      .update(readerStateUpdate)
      .eq("session_id", sessionId)
      .eq("current_document_id", expectedDocumentId)
      .eq("controller_user_id", userId)
      .eq("controller_epoch", lease.controller_epoch)
      .gt("controller_expires_at", new Date().toISOString())
      .select("session_id")
      .maybeSingle();

    if (updateError) {
      console.error(
        "Reader page update failed:",
        updateError
      );
