import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/security/request";

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

  const parsed = await readJsonBody<{ targetUserId?: unknown }>(request, 4096);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid request body." }, { status: parsed.status });
  }
  if (!isUuid(parsed.data.targetUserId)) {
    return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (parsed.data.targetUserId === userId) {
    return NextResponse.json({ error: "You cannot remove yourself from this gathering here." }, { status: 400 });
  }

  // The SECURITY DEFINER RPC enforces organizer/in-charge/admin hierarchy,
  // protects the organizer, revokes reader leases and updates membership.
  const { error } = await supabase.rpc("remove_session_member", {
    p_session_id: sessionId,
    p_user_id: parsed.data.targetUserId,
  });
  if (error) {
    console.error("Session member removal failed:", error);
    return NextResponse.json(
      { error: error.message || "Unable to remove this member." },
      { status: error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400 }
    );
  }

  return NextResponse.json({ success: true });
}
