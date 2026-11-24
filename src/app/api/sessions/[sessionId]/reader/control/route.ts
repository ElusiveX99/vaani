import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/security/request";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });

  const parsed = await readJsonBody<{ action?: unknown }>(request, 1024);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid request body." }, { status: parsed.status });
  const body = parsed.data;
  if (body.action !== "claim" && body.action !== "release") {
    return NextResponse.json({ error: "Invalid control action." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (body.action === "release") {
    const { error } = await supabase.rpc("release_session_reader_control", {
      p_session_id: sessionId,
    });
    if (error) {
      console.error("Reader control release failed:", error);
      return NextResponse.json({ error: "Unable to release reader control." }, { status: 500 });
    }
    return NextResponse.json({ success: true, released: true });
  }

  const { data, error } = await supabase.rpc("claim_session_reader_control", {
    p_session_id: sessionId,
  });
  if (error) {
    console.error("Reader control claim failed:", error);
    return NextResponse.json({ error: error.message || "You are not assigned to control this reader." }, { status: error.code === "42501" ? 403 : 400 });
  }

  const lease = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ success: true, ...(lease ?? {}) }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
