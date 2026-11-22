import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/security/request";

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });

  const parsed = await readJsonBody<{ targetUserId?: unknown; enabled?: unknown }>(request, 4096);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid request body." }, { status: parsed.status });
  const body = parsed.data;
  if (!isUuid(body.targetUserId) || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid reader-control assignment." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { error } = await supabase.rpc("set_session_reader_access", {
    p_session_id: sessionId,
    p_user_id: body.targetUserId,
    p_enabled: body.enabled,
  });
  if (error) {
    console.error("Reader-control assignment failed:", error);
    return NextResponse.json({ error: error.message || "Unable to update reader access." }, { status: error.code === "42501" ? 403 : 400 });
  }

  return NextResponse.json({ success: true });
}
