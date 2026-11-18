import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getClaims();

    const userId = authData?.claims?.sub;

    if (authError || typeof userId !== "string") {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    let body: { sessionId?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const sessionId =
      typeof body.sessionId === "string"
        ? body.sessionId
        : "";

    if (!isValidUuid(sessionId)) {
      return NextResponse.json(
        { error: "Invalid session ID." },
        { status: 400 }
      );
    }

    const {
      data: session,
      error: sessionError,
    } = await supabase
      .from("sessions")
      .select("id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error(
        "LiveKit session lookup failed:",
        sessionError
      );

      return NextResponse.json(
        { error: "Unable to verify the session." },
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
      .maybeSingle();

    if (membershipError) {
      console.error(
        "LiveKit membership lookup failed:",
        membershipError
      );

      return NextResponse.json(
        { error: "Unable to verify conference membership." },
        { status: 500 }
      );
    }

    if (membership?.status !== "accepted") {
      return NextResponse.json(
        { error: "Conference access denied." },
        { status: 403 }
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error(
        "LiveKit profile lookup failed:",
        profileError
      );
    }

    const displayName =
      String(profile?.display_name ?? "")
        .trim()
        .slice(0, 80) || "Vaani member";

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit is not configured." },
        { status: 500 }
      );
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: displayName,
      attributes: {
        role: membership.role,
      },
      ttl: "8h",
    });

    token.addGrant({
      roomJoin: true,
      room: `vaani-${sessionId}`,
      canPublish: true,
      canSubscribe: true,
    });

    const participantToken = await token.toJwt();

    return NextResponse.json(
      {
        serverUrl: livekitUrl,
        participantToken,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("LiveKit token creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create conference token." },
      { status: 500 }
    );
  }
}
