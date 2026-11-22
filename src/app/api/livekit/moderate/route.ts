import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { readJsonBody } from "@/lib/security/request";

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

    const parsedBody = await readJsonBody<{
      sessionId?: unknown;
      targetUserId?: unknown;
      targetIdentity?: unknown;
      action?: unknown;
      trackSid?: unknown;
    }>(request, 4096);
    if (!parsedBody.ok) {
      const message = parsedBody.status === 413 ? "Request body is too large." : parsedBody.status === 415 ? "Content-Type must be application/json." : "Invalid request body.";
      return NextResponse.json({ error: message }, { status: parsedBody.status });
    }
    const body = parsedBody.data;

    const sessionId = String(body.sessionId ?? "");
    const targetUserId = String(body.targetUserId ?? "");
    const targetIdentity = String(body.targetIdentity ?? "");
    const action = String(body.action ?? "");
    const trackSid = String(body.trackSid ?? "");

    if (!isUuid(sessionId) || !isUuid(targetUserId) || !targetIdentity || targetIdentity.length > 255) {
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

    const participants = await roomService.listParticipants(roomName);
    const targetConnections = participants.filter((participant) =>
      participant.attributes?.user_id === targetUserId
    );

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

      await Promise.all(targetConnections.map((participant) =>
        roomService.removeParticipant(roomName, participant.identity)
      ));
    } else {
      const targetConnection = targetConnections.find((participant) => participant.identity === targetIdentity);
      if (!targetConnection) {
        return NextResponse.json({ error: "That device is no longer connected." }, { status: 404 });
      }
      await roomService.mutePublishedTrack(roomName, targetIdentity, trackSid, true);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Moderation action failed" },
      { status: 500 }
    );
  }
}
