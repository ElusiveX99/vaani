"use client";

import { useEffect, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { createClient } from "@/lib/supabase/client";
import ProfileAvatar from "@/components/profile-avatar";
import InlineFeedback from "@/components/inline-feedback";
import { getLiveKitUserId } from "@/lib/livekit/identity";

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
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { name: string; avatarUrl: string | null }>>({});
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);

  const isOrganizer = localRole === "organizer";
  const canManageParticipants =
    isOrganizer || localRole === "in_charge" || localRole === "admin";

  useEffect(() => {
    if (!open) return;

    let active = true;
    const supabase = createClient();

    let refreshInFlight = false;
    const refreshRoles = async () => {
      if(refreshInFlight)return;refreshInFlight=true;
      const { data, error } = await supabase
        .from("session_members")
        .select("user_id, role, can_control_reader")
        .eq("session_id", sessionId)
        .eq("status", "accepted");

      if (!active || error) {refreshInFlight=false;return;}

      const rows = (data ?? []) as Array<{ user_id: string; role: string; can_control_reader: boolean | null }>;
      const ids = rows.map((member) => member.user_id);
      const { data: profiles, error: profileError } = ids.length
        ? await supabase.from("profiles")
            .select("id, display_name, avatar_url, avatar_path")
            .in("id", ids)
        : { data: [], error: null };
      if (!active) return;
      if (profileError) console.warn("Participant profile lookup failed:", profileError);

      const profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
      for (const profile of profiles ?? []) {
        const avatarUrl = profile.avatar_url || (profile.avatar_path
          ? profile.avatar_path.startsWith("http")
            ? profile.avatar_path
            : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl
          : null);
        profileMap[profile.id] = { name: profile.display_name || "Vaani member", avatarUrl };
      }

      const next: Record<string, string> = {};
      const access: Record<string, boolean> = {};
      for (const member of rows) {
        next[member.user_id] = member.role;
        access[member.user_id] = member.can_control_reader === true;
      }
      setMemberRoles(next);
      setReaderAccess(access);
      setMemberProfiles(profileMap);
      setRolesLoaded(true);refreshInFlight=false;
    };

    void refreshRoles();

    const handleConferenceRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{
        table?: string;
        sessionId?: string;
      } | null>).detail;
      // Only membership events change this panel's data. A null payload
      // is emitted on reconnect and triggers one authoritative refresh.
      if (
        active &&
        (!detail ||
          (detail.sessionId === sessionId &&
            detail.table === "session_members"))
      ) {
        void refreshRoles();
      }
    };
    window.addEventListener("vaani:conference-realtime", handleConferenceRealtime);

    return () => {
      active = false;
      window.removeEventListener("vaani:conference-realtime", handleConferenceRealtime);
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

  const remoteParticipants = participants.filter((participant) => {
    if (participant.isLocal) return false;
    const userId = getLiveKitUserId(participant);
    return Boolean(userId && memberRoles[userId] && memberRoles[userId] !== "organizer");
  });
  const connectedByUser = new Map<string, typeof remoteParticipants>();
  for (const participant of remoteParticipants) {
    const userId = getLiveKitUserId(participant);
    if (!userId) continue;
    const current = connectedByUser.get(userId) ?? [];
    current.push(participant);
    connectedByUser.set(userId, current);
  }
  const managedMembers = Object.entries(memberRoles)
    .filter(([userId, role]) => userId !== getLiveKitUserId(participants.find((participant) => participant.isLocal) ?? { identity: "" } as never) && role !== "organizer")
    .sort(([a], [b]) => (memberProfiles[a]?.name ?? "").localeCompare(memberProfiles[b]?.name ?? ""));
  const visibleManagedMembers = showAllMembers ? managedMembers : managedMembers.slice(0, 10);

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
      if (!makeAdmin) {
        setReaderAccess((previous) => ({ ...previous, [targetUserId]: false }));
      }
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
      className="absolute inset-0 z-50 flex justify-end bg-[#0d0a10]/65 p-0 backdrop-blur-[3px] sm:p-3"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="participants-panel-title"
        className="flex h-full w-full max-w-[27rem] flex-col overflow-hidden rounded-none border border-[#b99baf]/15 bg-[#211c25] text-white shadow-[0_24px_90px_rgba(0,0,0,.55)] sm:rounded-[1.4rem]"
      >
        <header className="shrink-0 border-b border-white/[0.08] bg-[linear-gradient(120deg,rgba(112,78,105,.32),rgba(40,33,43,.15))] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[.18em] text-[#c4a8bd]">GATHERING CONTROLS</p>
              <h2 id="participants-panel-title" className="mt-2 font-display text-2xl leading-none text-[#fff8fc]">
                Manage participants
              </h2>
              <p className="mt-2 text-xs text-[#c8bbc8]/65">
                {remoteParticipants.length} connected device{remoteParticipants.length === 1 ? "" : "s"} · {managedMembers.length} other member{managedMembers.length === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close participants panel"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {!rolesLoaded ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
              Loading session members…
            </p>
          ) : managedMembers.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
              <p className="text-sm font-medium text-white/80">No other session members</p>
              <p className="mt-2 text-xs text-white/45">Accepted members will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {visibleManagedMembers.map(([targetUserId, targetRole]) => {
                const connections = connectedByUser.get(targetUserId) ?? [];
                const canModerateTarget = isOrganizer || targetRole === "participant";
                const canRemoveTarget = isOrganizer || targetRole === "participant";
                const canChangeAdminRole = isOrganizer && (targetRole === "participant" || targetRole === "admin");
                const participantName = memberProfiles[targetUserId]?.name || connections[0]?.name || "Vaani member";
                const avatarUrl = memberProfiles[targetUserId]?.avatarUrl || connections[0]?.attributes?.avatar_url || null;

                return (
                  <article key={targetUserId} className="rounded-2xl border border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015))] p-4 shadow-[0_8px_24px_rgba(0,0,0,.12)]">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProfileAvatar name={participantName} avatarUrl={avatarUrl} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{participantName}</p>
                          <p className="mt-1 text-xs capitalize text-white/45">{targetRole.replaceAll("_", " ")}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${connections.length ? "bg-emerald-400/10 text-emerald-300" : "bg-white/10 text-white/55"}`}>
                        {connections.length ? `Connected · ${connections.length} device${connections.length === 1 ? "" : "s"}` : "Offline"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {connections.map((participant) => {
                        const microphone = participant.getTrackPublication(Track.Source.Microphone);
                        const trackSid = microphone?.trackSid;
                        return (
                          <button
                            key={participant.identity}
                            type="button"
                            disabled={!trackSid || busy !== "" || !canModerateTarget}
                            onClick={() => moderate(targetUserId, participant.identity, "mute", trackSid)}
                            className="rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-[11px] font-semibold tracking-wide text-[#f0e7ef] transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Mute {connections.length > 1 ? "device" : "microphone"}
                          </button>
                        );
                      })}

                      {canRemoveTarget && (
                        <button
                          type="button"
                          disabled={busy !== ""}
                          onClick={() => moderate(targetUserId, connections[0]?.identity ?? "", "remove")}
                          className="rounded-full border border-red-300/15 bg-red-400/[0.08] px-3.5 py-2 text-[11px] font-semibold tracking-wide text-red-200 transition hover:bg-red-400/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy === `${targetUserId}-remove` ? "Removing…" : "Remove member"}
                        </button>
                      )}

                      {canChangeAdminRole && (
                        <button
                          type="button"
                          disabled={busy !== ""}
                          onClick={() => setAdmin(targetUserId, targetRole !== "admin")}
                          className="rounded-full border border-sky-300/15 bg-sky-400/[0.08] px-3.5 py-2 text-[11px] font-semibold tracking-wide text-sky-100 transition hover:bg-sky-400/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy === `${targetUserId}-role` ? "Updating…" : targetRole === "admin" ? "Remove admin" : "Make admin"}
                        </button>
                      )}

                      {isOrganizer && targetRole === "admin" && (
                        <button
                          type="button"
                          disabled={busy !== ""}
                          onClick={() => updateReaderAccess(targetUserId, !readerAccess[targetUserId])}
                          className="rounded-full border border-violet-300/15 bg-violet-400/[0.08] px-3.5 py-2 text-[11px] font-semibold tracking-wide text-violet-100 transition hover:bg-violet-400/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy === `${targetUserId}-reader` ? "Updating…" : readerAccess[targetUserId] ? "Revoke reader control" : "Allow reader control"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {managedMembers.length > 10 && (
                <button type="button" onClick={() => setShowAllMembers((value) => !value)} className="w-full rounded-full border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.06]">
                  {showAllMembers ? "Show fewer" : `Show all ${managedMembers.length} members`}
                </button>
              )}
            </div>
          )}

          {message && <div className="mt-4"><InlineFeedback tone="info">{message}</InlineFeedback></div>}
        </div>

        <footer className="shrink-0 border-t border-white/[0.08] bg-[#1b171f] px-5 py-4">
          <p className="text-[11px] leading-relaxed text-white/40">
            Roles and reader permissions belong to session membership, even while a member is offline. Mute applies to a connected device; removing a member revokes their session access and disconnects their devices.
          </p>
        </footer>
      </aside>
    </div>
  );
}
