import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";

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

    const rateLimit = await enforceRateLimit(supabase, "livekit_token");
    if (rateLimit.error) return NextResponse.json({ error: "Unable to verify request rate." }, { status: 503 });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Too many conference token requests. Please wait a moment and try again." }, { status: 429 });

    const parsedBody = await readJsonBody<{ sessionId?: unknown }>(request, 4096);
    if (!parsedBody.ok) {
      const message = parsedBody.status === 413 ? "Request body is too large." : parsedBody.status === 415 ? "Content-Type must be application/json." : "Invalid request body.";
      return NextResponse.json({ error: message }, { status: parsedBody.status });
    }
    const body = parsedBody.data;

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

    const [{ data: profile, error: profileError }, { data: authUserData }] = await Promise.all([
      supabase.from("profiles")
        .select("display_name, avatar_url, avatar_path")
        .eq("id", userId)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);

    if (profileError) console.error("LiveKit profile lookup failed:", profileError);
    const metadata = authUserData.user?.user_metadata ?? {};
    const displayName =
      String(profile?.display_name || metadata.display_name || metadata.full_name || metadata.name || "")
        .trim()
        .slice(0, 80) || "Vaani member";
    const avatarUrl =
      typeof profile?.avatar_url === "string"
        ? profile.avatar_url
        : typeof profile?.avatar_path === "string" && profile.avatar_path.startsWith("http")
          ? profile.avatar_path
          : typeof profile?.avatar_path === "string"
            ? supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl
            : typeof metadata.avatar_url === "string"
              ? metadata.avatar_url
              : typeof metadata.picture === "string"
                ? metadata.picture
                : "";

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
      identity: `${userId}:${crypto.randomUUID()}`,
      name: displayName,
      attributes: {
        user_id: userId,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      },
      ttl: "2h",
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
