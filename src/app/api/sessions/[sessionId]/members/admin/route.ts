import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
  }

  let body: { targetUserId?: unknown; makeAdmin?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  if (!isUuid(body.targetUserId) || typeof body.makeAdmin !== "boolean") {
    return NextResponse.json({ error: "Invalid role assignment." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const { error: rpcError } = await supabase.rpc("set_session_admin", {
    p_session_id: sessionId,
    p_user_id: body.targetUserId,
    p_make_admin: body.makeAdmin,
  });
  if (rpcError) {
    console.error("Session admin update failed:", rpcError);
    return NextResponse.json({ error: rpcError.message || "Unable to update session admin." }, { status: rpcError.code === "42501" ? 403 : 400 });
  }

  return NextResponse.json({ success: true });
}
