"use client";

import { useEffect, useState } from "react";
import {
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";

type Props = {
  sessionId: string;
  open: boolean;
  onClose: () => void;
};

export default function ModerationPanel({
  sessionId,
  open,
  onClose,
}: Props) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const isOrganizer =
    localParticipant.attributes?.role === "organizer";

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !isOrganizer) return null;

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
    const key = \`\${targetUserId}-\${action}\`;

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
    <div
      className="absolute inset-0 z-50 flex justify-end bg-black/60"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#202020] text-white shadow-2xl"
        aria-label="Manage participants"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div>
            <h2 className="text-sm font-semibold">
              Manage participants
            </h2>

            <p className="mt-1 text-xs text-white/45">
              {remoteParticipants.length} participant
              {remoteParticipants.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close participant management"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {remoteParticipants.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
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
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {participant.name || participant.identity}
                      </p>

                      <p className="mt-1 text-xs capitalize text-white/50">
                        {(participant.attributes?.role ||
                          "participant"
                        ).replace("_", " ")}
                      </p>
                    </div>

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
                        className="rounded-md bg-white/10 px-3 py-2 text-xs transition hover:bg-white/20 disabled:opacity-40"
                      >
                        {busy ===
                        \`\${participant.identity}-mute\`
                          ? "Muting..."
                          : "Mute mic"}
                      </button>

                      <button
                        type="button"
                        disabled={busy !== ""}
                        onClick={() =>
                          moderate(
                            participant.identity,
                            "remove"
                          )
                        }
                        className="rounded-md bg-red-500/15 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/25 disabled:opacity-40"
                      >
                        {busy ===
                        \`\${participant.identity}-remove\`
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
            <p
              className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70"
              role="status"
            >
              {message}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
