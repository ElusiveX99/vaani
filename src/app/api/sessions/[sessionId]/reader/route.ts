import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("role, status")
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

  const canControl =
    membership.role === "organizer" ||
    membership.role === "in_charge";

  const {
    data: readerState,
    error: readerStateError,
  } = await supabase
    .from("session_reader_state")
    .select(
      "session_id, current_document_id, current_page, updated_by, updated_at"
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

  let document = null;

  if (readerState?.current_document_id) {
    const {
      data,
      error,
    } = await supabase
      .from("session_documents")
      .select(
        "id, title, storage_path, mime_type, size_bytes"
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

  if (!document) {
    const {
      data,
      error,
    } = await supabase
      .from("session_documents")
      .select(
        "id, title, storage_path, mime_type, size_bytes"
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
      document: null,
      readerState: readerState ?? null,
    });
  }

  const {
    data: signedUrlData,
    error: signedUrlError,
  } = await supabase.storage
    .from("session-pdfs")
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
      membership.role === "in_charge"
    )
  ) {
    return json(
      { error: "You do not have permission to control the reader." },
      403
    );
  }

  let body: {
    documentId?: unknown;
    currentPage?: unknown;
    expectedDocumentId?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json(
      { error: "Invalid JSON body." },
      400
    );
  }

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

  const readerStateUpdate = {
    current_page: currentPage,
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
      .select("session_id")
      .maybeSingle();

    if (updateError) {
      console.error(
        "Reader page update failed:",
        updateError
      );

      return json(
        { error: "Unable to update reader state." },
        500
      );
    }

    if (!updatedState) {
      return json(
        { error: "Reader document changed. Please refresh." },
        409
      );
    }
  } else {
    // Document selection: only the authorized manager can
    // change the active document.
    const { error: upsertError } = await supabase
      .from("session_reader_state")
      .upsert(
        {
          session_id: sessionId,
          current_document_id: documentId,
          ...readerStateUpdate,
        },
        {
          onConflict: "session_id",
        }
      );

    if (upsertError) {
      console.error(
        "Reader document selection failed:",
        upsertError
      );

      return json(
        { error: "Unable to update reader state." },
        500
      );
    }
  }

  return json({ success: true });
}
