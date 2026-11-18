import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const { sessionId } = await context.params;

  if (!isValidUuid(sessionId)) {
    return NextResponse.json(
      { error: "Invalid session ID." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const userId = claimsData.claims.sub;

  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    console.error("Reader session lookup failed:", sessionError);

    return NextResponse.json(
      { error: "Unable to load the session." },
      { status: 500 }
    );
  }

  if (!session) {
    return NextResponse.json(
      { error: "Session not found." },
      { status: 404 }
    );
  }

  if (session.status !== "live") {
    return NextResponse.json(
      { error: "Session is not live." },
      { status: 409 }
    );
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("session_members")
    .select("role, status")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  if (membershipError) {
    console.error("Reader membership lookup failed:", membershipError);

    return NextResponse.json(
      { error: "Unable to verify session membership." },
      { status: 500 }
    );
  }

  if (!membership) {
    return NextResponse.json(
      { error: "You are not an accepted member of this session." },
      { status: 403 }
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
    console.error("Reader state lookup failed:", readerStateError);

    return NextResponse.json(
      { error: "Unable to load reader state." },
      { status: 500 }
    );
  }

  let document = null;

  if (readerState?.current_document_id) {
    const {
      data,
      error: documentError,
    } = await supabase
      .from("session_documents")
      .select(
        "id, title, storage_path, mime_type, size_bytes, display_order"
      )
      .eq("id", readerState.current_document_id)
      .eq("session_id", sessionId)
      .eq("is_active", true)
      .maybeSingle();

    if (documentError) {
      console.error("Selected reader document lookup failed:", documentError);

      return NextResponse.json(
        { error: "Unable to load the selected PDF." },
        { status: 500 }
      );
    }

    document = data;
  }

  if (!document) {
    const {
      data,
      error: documentError,
    } = await supabase
      .from("session_documents")
      .select(
        "id, title, storage_path, mime_type, size_bytes, display_order"
      )
      .eq("session_id", sessionId)
      .eq("is_active", true)
      .order("display_order", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (documentError) {
      console.error("Fallback reader document lookup failed:", documentError);

      return NextResponse.json(
        { error: "Unable to load session documents." },
        { status: 500 }
      );
    }

    document = data;
  }

  if (!document) {
    return NextResponse.json({
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
      60 * 60
    );

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error(
      "Failed to create PDF signed URL:",
      signedUrlError
    );

    return NextResponse.json(
      { error: "Unable to access the PDF." },
      { status: 500 }
    );
  }

  return NextResponse.json({
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
    return NextResponse.json(
      { error: "Invalid session ID." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const userId = claimsData.claims.sub;

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("session_members")
    .select("role, status")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  if (membershipError) {
    console.error("Reader control membership lookup failed:", membershipError);

    return NextResponse.json(
      { error: "Unable to verify reader permissions." },
      { status: 500 }
    );
  }

  if (
    !membership ||
    !(
      membership.role === "organizer" ||
      membership.role === "in_charge"
    )
  ) {
    return NextResponse.json(
      { error: "You do not have permission to control the reader." },
      { status: 403 }
    );
  }

  let body: {
    documentId?: unknown;
    currentPage?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const documentId =
    typeof body.documentId === "string"
      ? body.documentId
      : null;

  const currentPage = body.currentPage;

  if (
    !documentId ||
    !isValidUuid(documentId) ||
    typeof currentPage !== "number" ||
    !Number.isSafeInteger(currentPage) ||
    currentPage < 1
  ) {
    return NextResponse.json(
      { error: "Invalid reader state." },
      { status: 400 }
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
    console.error("Reader document validation failed:", documentError);

    return NextResponse.json(
      { error: "Unable to verify the document." },
      { status: 500 }
    );
  }

  if (!document) {
    return NextResponse.json(
      { error: "Document not found." },
      { status: 404 }
    );
  }

  const { error: upsertError } = await supabase
    .from("session_reader_state")
    .upsert(
      {
        session_id: sessionId,
        current_document_id: documentId,
        current_page: currentPage,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "session_id",
      }
    );

  if (upsertError) {
    console.error("Reader state update failed:", upsertError);

    return NextResponse.json(
      { error: "Unable to update reader state." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}
