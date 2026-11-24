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