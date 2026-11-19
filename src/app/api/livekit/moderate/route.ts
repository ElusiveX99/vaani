import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

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
    const targetUserId = String(body.targetUserId ?? "");
    const action = String(body.action ?? "");
    const trackSid = String(body.trackSid ?? "");

    if (!isUuid(sessionId) || !isUuid(targetUserId)) {
      return NextResponse.json(
        { error: "Invalid identifiers" },
        { status: 400 }
      );
    }

    if (targetUserId === userId) {
      return NextResponse.json(
        { error: "You cannot moderate yourself" },
        { status: 400 }
      );
    }

    if (
      action !== "remove" &&
      action !== "mute"
    ) {
      return NextResponse.json(
        { error: "Invalid moderation action" },
        { status: 400 }
      );
    }

    if (
      action === "mute" &&
      (!trackSid || trackSid.length > 200)
    ) {
      return NextResponse.json(
        { error: "Invalid track ID" },
        { status: 400 }
      );
    }

    const { data: session } = await supabase
      .from("sessions")
      .select("id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session || session.status !== "live") {
      return NextResponse.json(
        { error: "Live session not found" },
        { status: 404 }
      );
    }

    const { data: actor } = await supabase
      .from("session_members")
      .select("role, status")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (
      !actor ||
      actor.status !== "accepted" ||
      !["organizer", "in_charge", "admin"].includes(actor.role)
    ) {
      return NextResponse.json(
        { error: "Session management permission required" },
        { status: 403 }
      );
    }

    const { data: target } = await supabase
      .from("session_members")
      .select("role, status")
      .eq("session_id", sessionId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (
      !target ||
      target.status !== "accepted" ||
      target.role === "organizer" ||
      (actor.role !== "organizer" && target.role !== "participant")
    ) {
      return NextResponse.json(
        { error: "Participant cannot be moderated" },
        { status: 403 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit is not configured" },
        { status: 500 }
      );
    }

    const host = livekitUrl
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:");

    const roomService = new RoomServiceClient(
      host,
      apiKey,
      apiSecret
    );

    const roomName = `vaani-${sessionId}`;

    if (action === "remove") {
      const { error: membershipRemovalError } = await supabase.rpc(
        "remove_session_member",
        {
          p_session_id: sessionId,
          p_user_id: targetUserId,
        }
      );

      if (membershipRemovalError) {
        console.error(
          "Session membership removal failed:",
          membershipRemovalError
        );
        return NextResponse.json(
          { error: membershipRemovalError.message || "Unable to remove this session member." },
          { status: membershipRemovalError.code === "42501" ? 403 : 400 }
        );
      }

      await roomService.removeParticipant(
        roomName,
        targetUserId
      );
    } else {
      await roomService.mutePublishedTrack(
        roomName,
        targetUserId,
        trackSid,
        true
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Moderation action failed" },
      { status: 500 }
    );
  }
}
