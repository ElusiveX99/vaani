import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getClaims();

    const userId = authData?.claims?.sub;

    if (authError || typeof userId !== "string") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const sessionId = String(body.sessionId ?? "");

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        sessionId
      )
    ) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } =
      await supabase
        .from("sessions")
        .select("id, status")
        .eq("id", sessionId)
        .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.status !== "live") {
      return NextResponse.json(
        { error: "Session is not live" },
        { status: 409 }
      );
    }

    const { data: membership, error: membershipError } =
      await supabase
        .from("session_members")
        .select("role, status")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();

    if (
      membershipError ||
      membership?.status !== "accepted"
    ) {
      return NextResponse.json(
        { error: "Conference access denied" },
        { status: 403 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    const displayName =
      String(profile?.display_name ?? "").trim().slice(0, 80) ||
      "Vaani member";

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit is not configured" },
        { status: 500 }
      );
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: displayName,
      attributes: {
        role: membership.role,
      },
      ttl: "10m",
    });

    token.addGrant({
      roomJoin: true,
      room: `vaani-${sessionId}`,
      canPublish: true,
      canSubscribe: true,
    });

    const participantToken = await token.toJwt();

    return NextResponse.json({
      serverUrl: livekitUrl,
      participantToken,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to create conference token" },
      { status: 500 }
    );
  }
}
