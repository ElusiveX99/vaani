"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProfileAvatar from "@/components/profile-avatar";
import Link from "next/link";

type Member = {
  user_id: string;
  role: string;
  status: string;
  can_control_reader?: boolean;
  display_name: string;
  avatar_url: string | null;
};

export default function SessionMembers({
  sessionId,
  currentUserId,
  initialMembers,
  showAll = false,
  localRole = "participant",
}: {
  sessionId: string;
  currentUserId: string;
  initialMembers: Member[];
  showAll?: boolean;
  localRole?: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const isOrganizer = localRole === "organizer";
  const canManage = isOrganizer || localRole === "in_charge" || localRole === "admin";

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const refresh = async () => {
      const { data, error } = await supabase
        .from("session_members")
        .select("user_id, role, status, can_control_reader")
        .eq("session_id", sessionId)
        .eq("status", "accepted")
        .order("created_at", { ascending: true });

      if (!active || error) return;

      const rows = (data ?? []) as Array<Pick<Member, "user_id" | "role" | "status" | "can_control_reader">>;
      const ids = [...new Set(rows.map((member) => member.user_id))];
      let profilesById = new Map<string, { display_name: string | null; avatar_url: string | null }>();

      if (ids.length > 0) {
        const { data: profiles, error: profileError } = await supabase.rpc(
          "get_session_member_profiles",
          { p_session_id: sessionId }
        );
        if (!active) return;
        if (profileError) {
          console.error("Session member profile RPC failed:", profileError);
          return;
        }
        profilesById = new Map((profiles ?? []).map((profile: { id: string; display_name: string | null; avatar_url: string | null; avatar_path: string | null }) => [profile.id, {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url || (profile.avatar_path
            ? (profile.avatar_path.startsWith("http")
              ? profile.avatar_path
              : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl)
            : null),
        }]));
      }

      setMembers(rows.map((member) => ({
        ...member,
        display_name: profilesById.get(member.user_id)?.display_name || "Vaani member",
        avatar_url: profilesById.get(member.user_id)?.avatar_url || null,
        can_control_reader: member.can_control_reader === true,
      })));
    };

    const handleLocalMutation = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string } | null>).detail;
      if (detail?.sessionId === sessionId) void refresh();
    };
    window.addEventListener("vaani:session-members-mutated", handleLocalMutation);

    const handleRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{
        sessionId?: string;
        table?: string;
      } | null>).detail;
      if (!detail || (detail.sessionId === sessionId && detail.table === "session_members")) {
        void refresh();
      }
    };
    window.addEventListener("vaani:conference-realtime", handleRealtime);

    return () => {
      active = false;
      window.removeEventListener("vaani:conference-realtime", handleRealtime);
      window.removeEventListener("vaani:session-members-mutated", handleLocalMutation);
    };
  }, [sessionId]);

  async function runMemberAction(userId: string, action: "remove" | "admin" | "reader", enabled?: boolean) {
    const key = `${userId}-${action}`;
    setBusy(key);
    setFeedback("");
    try {
      const endpoint = action === "remove"
        ? `/api/sessions/${sessionId}/members/remove`
        : action === "admin"
          ? `/api/sessions/${sessionId}/members/admin`
          : `/api/sessions/${sessionId}/members/reader-control`;
      const payload = action === "remove"
        ? { targetUserId: userId }
        : action === "admin"
          ? { targetUserId: userId, makeAdmin: Boolean(enabled) }
          : { targetUserId: userId, enabled: Boolean(enabled) };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The member action failed.");
      setFeedback(action === "remove" ? "Member removed from this gathering." : action === "admin" ? (enabled ? "Session admin assigned." : "Session admin removed.") : (enabled ? "Reader control granted." : "Reader control revoked."));
      if (action === "remove") {
        setMembers((previous) => previous.filter((member) => member.user_id !== userId));
      } else {
        setMembers((previous) => previous.map((member) => member.user_id !== userId ? member : {
          ...member,
          role: action === "admin" ? (enabled ? "admin" : "participant") : member.role,
          can_control_reader: action === "reader" ? Boolean(enabled) : (action === "admin" && !enabled ? false : member.can_control_reader),
        }));
      }
      window.dispatchEvent(new CustomEvent("vaani:session-members-mutated", { detail: { sessionId } }));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The member action failed.");
    } finally {
      setBusy("");
    }
  }

  const acceptedMembers = members.filter((member) => member.status === "accepted");
  const acceptedCount = acceptedMembers.length;
  const visibleMembers = showAll ? acceptedMembers : acceptedMembers.slice(0, 10);

  return (
    <section className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--ink)]">{showAll ? "All session members" : "Session members"} <span className="text-sm font-normal text-[var(--muted)]">({acceptedCount})</span></h2>
        {!showAll && acceptedCount > 10 && <Link href={`/sessions/${sessionId}/members`} className="button-secondary !min-h-9 !px-4 !py-2 text-xs">Show more</Link>}
      </div>

      {acceptedMembers.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No members yet.</p>
      ) : (
        <div className="mt-3 divide-y divide-[var(--line)]">
          {visibleMembers.map((member) => (
            <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <ProfileAvatar name={member.display_name} avatarUrl={member.avatar_url} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">
                    {member.display_name}{member.user_id === currentUserId ? " (You)" : ""}
                  </p>
                  <p className="mt-1 text-xs capitalize text-[var(--muted)]">{member.role.replaceAll("_", " ")}</p>
                </div>
              </div>
              {canManage && member.user_id !== currentUserId && member.role !== "organizer" && (
                <div className="flex flex-wrap items-center gap-2">
                  {isOrganizer && (member.role === "participant" || member.role === "admin") && (
                    <button type="button" disabled={busy !== ""} onClick={() => void runMemberAction(member.user_id, "admin", member.role !== "admin")} className="button-secondary !min-h-8 !px-3 !py-1.5 text-xs disabled:opacity-40">
                      {busy === `${member.user_id}-admin` ? "Updating…" : member.role === "admin" ? "Remove admin" : "Make admin"}
                    </button>
                  )}
                  {isOrganizer && member.role === "admin" && (
                    <button type="button" disabled={busy !== ""} onClick={() => void runMemberAction(member.user_id, "reader", !member.can_control_reader)} className="button-secondary !min-h-8 !px-3 !py-1.5 text-xs disabled:opacity-40">
                      {member.can_control_reader ? "Revoke reader control" : "Grant reader control"}
                    </button>
                  )}
                  {(isOrganizer || member.role === "participant") && (
                    <button type="button" disabled={busy !== ""} onClick={() => {
                      if (window.confirm(`Remove ${member.display_name} from this gathering?`)) void runMemberAction(member.user_id, "remove");
                    }} className="button-secondary !min-h-8 !border-red-200 !px-3 !py-1.5 text-xs !text-red-700 hover:!bg-red-50 disabled:opacity-40">
                      {busy === `${member.user_id}-remove` ? "Removing…" : "Remove"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {feedback && <p role="status" className="mt-3 text-xs text-[var(--muted)]">{feedback}</p>}
      {showAll && <Link href={`/sessions/${sessionId}`} className="mt-4 inline-flex text-sm font-semibold text-[var(--plum)] hover:underline">Back to gathering</Link>}
    </section>
  );
}
