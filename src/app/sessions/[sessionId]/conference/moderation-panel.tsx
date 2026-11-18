"use client";

import { useState } from "react";
import {
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";

type Props = {
  sessionId: string;
};

export default function ModerationPanel({ sessionId }: Props) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const isOrganizer =
    localParticipant.attributes?.role === "organizer";

  if (!isOrganizer) return null;

  const remoteParticipants = participants.filter(
    (participant) =>
      !participant.isLocal &&
      participant.attributes?.role !== "organizer"
  );

  async function moderate(
    targetUserId: string,
    action: "remove" | "mute",
    trackSid?: string
  ) {
    const key = `${targetUserId}-${action}`;

    setBusy(key);
    setMessage("");

    try {
      const response = await fetch("/api/livekit/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          targetUserId,
          action,
          ...(trackSid ? { trackSid } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action failed.");
      }

      setMessage(
        action === "remove"
          ? "Participant removed."
          : "Participant microphone muted."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Moderation action failed."
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <details className="absolute right-4 top-4 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#202020] text-white shadow-2xl">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">
        Manage participants ({remoteParticipants.length})
      </summary>

      <div className="max-h-[60vh] overflow-y-auto border-t border-white/10 p-3">
        {remoteParticipants.length === 0 ? (
          <p className="py-3 text-sm text-white/50">
            No other participants are connected.
          </p>
        ) : (
          <div className="space-y-3">
            {remoteParticipants.map((participant) => {
              const microphone =
                participant.getTrackPublication(
                  Track.Source.Microphone
                );

              const trackSid = microphone?.trackSid;

              return (
                <div
                  key={participant.identity}
                  className="rounded-lg border border-white/10 p-3"
                >
                  <p className="truncate text-sm font-medium">
                    {participant.name || participant.identity}
                  </p>

                  <p className="mt-1 text-xs capitalize text-white/50">
                    {(participant.attributes?.role || "participant")
                      .replace("_", " ")}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!trackSid || busy !== ""}
                      onClick={() =>
                        moderate(
                          participant.identity,
                          "mute",
                          trackSid
                        )
                      }
                      className="rounded-md bg-white/10 px-3 py-2 text-xs hover:bg-white/20 disabled:opacity-40"
                    >
                      {busy === `${participant.identity}-mute`
                        ? "Muting..."
                        : "Mute mic"}
                    </button>

                    <button
                      type="button"
                      disabled={busy !== ""}
                      onClick={() =>
                        moderate(participant.identity, "remove")
                      }
                      className="rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-300 hover:bg-red-500/25 disabled:opacity-40"
                    >
                      {busy === `${participant.identity}-remove`
                        ? "Removing..."
                        : "Remove"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {message && (
          <p className="mt-3 text-xs text-white/70" role="status">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
