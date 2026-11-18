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

  const remoteParticipants = participants.filter(
    (participant) =>
      !participant.isLocal &&
      participant.attributes?.role !== "organizer"
  );

  if (!open || !isOrganizer) return null;

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
        credentials: "same-origin",
        cache: "no-store",
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="participants-panel-title"
        className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#1b1b1b] text-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
          <div>
            <h2
              id="participants-panel-title"
              className="text-base font-semibold text-white"
            >
              Manage participants
            </h2>

            <p className="mt-1 text-xs text-white/50">
              {remoteParticipants.length} participant
              {remoteParticipants.length === 1 ? "" : "s"} connected
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close participants panel"
            className="rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {remoteParticipants.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <p className="text-sm font-medium text-white/80">
                No other participants
              </p>

              <p className="mt-2 text-xs text-white/45">
                Participants will appear here when they join.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {remoteParticipants.map((participant) => {
                const microphone =
                  participant.getTrackPublication(
                    Track.Source.Microphone
                  );

                const trackSid = microphone?.trackSid;

                const participantName =
                  participant.name || participant.identity;

                return (
                  <article
                    key={participant.identity}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {participantName}
                        </p>

                        <p className="mt-1 text-xs capitalize text-white/45">
                          {(participant.attributes?.role || "participant")
                            .replaceAll("_", " ")}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                        Connected
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
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
                        className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy === `${participant.identity}-mute`
                          ? "Muting..."
                          : "Mute microphone"}
                      </button>

                      <button
                        type="button"
                        disabled={busy !== ""}
                        onClick={() =>
                          moderate(participant.identity, "remove")
                        }
                        className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy === `${participant.identity}-remove`
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {message && (
            <p
              role="status"
              aria-live="polite"
              className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75"
            >
              {message}
            </p>
          )}
        </div>

        <footer className="shrink-0 border-t border-white/10 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-white/40">
            Moderation actions affect participants in this live conference.
          </p>
        </footer>
      </aside>
    </div>
  );
}
