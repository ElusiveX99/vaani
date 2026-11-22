"use client";

import { useEffect, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { createClient } from "@/lib/supabase/client";
import ProfileAvatar from "@/components/profile-avatar";

type Props = {
  sessionId: string;
  open: boolean;
  localRole: string;
  onClose: () => void;
};

export default function ModerationPanel({
  sessionId,
  open,
  localRole,
  onClose,
}: Props) {
  const participants = useParticipants();

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  const [readerAccess, setReaderAccess] = useState<Record<string, boolean>>({});

  const isOrganizer = localRole === "organizer";
  const canManageParticipants =
    isOrganizer || localRole === "in_charge" || localRole === "admin";

  useEffect(() => {
    if (!open) return;

    let active = true;
    const supabase = createClient();

    const refreshRoles = async () => {
      const { data, error } = await supabase
        .from("session_members")
        .select("user_id, role, can_control_reader")
        .eq("session_id", sessionId)
        .eq("status", "accepted");

      if (!active || error) return;

      const next: Record<string, string> = {};
      const access: Record<string, boolean> = {};
      for (const member of data ?? []) {
        next[member.user_id] = member.role;
        access[member.user_id] = member.can_control_reader === true;
      }
      setMemberRoles(next);
      setReaderAccess(access);
    };

    void refreshRoles();

    const channel = supabase
      .channel(`session-member-roles-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_members",
          filter: `session_id=eq.${sessionId}`,
        },
        () => void refreshRoles()
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [open, sessionId]);

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

  if (!open || !canManageParticipants) return null;

  async function moderate(
    targetUserId: string,
    targetIdentity: string,
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
          targetIdentity,
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

  async function setAdmin(targetUserId: string, makeAdmin: boolean) {
    setBusy(`${targetUserId}-role`);
    setMessage("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/members/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ targetUserId, makeAdmin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Role update failed.");
      setMemberRoles((previous) => ({
        ...previous,
        [targetUserId]: makeAdmin ? "admin" : "participant",
      }));
      setMessage(makeAdmin ? "Session admin assigned." : "Session admin removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Role update failed.");
    } finally {
      setBusy("");
    }
  }

  async function updateReaderAccess(targetUserId: string, enabled: boolean) {
    setBusy(`${targetUserId}-reader`);
    setMessage("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/members/reader-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ targetUserId, enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reader access update failed.");
      setReaderAccess((previous) => ({ ...previous, [targetUserId]: enabled }));
      setMessage(enabled ? "Shared reader control granted." : "Shared reader control revoked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reader access update failed.");
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
                const targetUserId = participant.attributes?.user_id ?? participant.identity;
                const targetRole =
                  memberRoles[targetUserId] ??
                  participant.attributes?.role ??
                  "participant";
                const canModerateTarget =
                  isOrganizer || targetRole === "participant";
                const canChangeAdminRole =
                  isOrganizer &&
                  (targetRole === "participant" || targetRole === "admin");

                const participantName =
                  participant.name || participant.identity;

                return (
                  <article
                    key={participant.identity}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProfileAvatar name={participantName} avatarUrl={participant.attributes?.avatar_url || null} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{participantName}</p>
                          <p className="mt-1 text-xs capitalize text-white/45">{targetRole.replaceAll("_", " ")}</p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                        Connected
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!trackSid || busy !== "" || !canModerateTarget}
                        onClick={() =>
                          moderate(
                            targetUserId,
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
                        disabled={busy !== "" || !canModerateTarget}
                        onClick={() =>
                          moderate(targetUserId, participant.identity, "remove")
                        }
                        className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy === `${participant.identity}-remove`
                          ? "Removing..."
                          : "Remove"}
                      </button>

                      {canChangeAdminRole && (
                        <button
                          type="button"
                          disabled={busy !== ""}
                          onClick={() =>
                            setAdmin(
                              targetUserId,
                              targetRole !== "admin"
                            )
                          }
                          className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy === `${targetUserId}-role`
                            ? "Updating..."
                            : targetRole === "admin"
                              ? "Remove admin"
                              : "Make admin"}
                        </button>
                      )}

                      {isOrganizer && targetRole === "admin" && (
                        <button
                          type="button"
                          disabled={busy !== ""}
                          onClick={() =>
                            updateReaderAccess(
                              targetUserId,
                              !readerAccess[targetUserId]
                            )
                          }
                          className="rounded-lg bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy === `${targetUserId}-reader`
                            ? "Updating..."
                            : readerAccess[targetUserId]
                              ? "Revoke reader control"
                              : "Allow reader control"}
                        </button>
                      )}
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
