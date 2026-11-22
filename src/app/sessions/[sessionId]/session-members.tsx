"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProfileAvatar from "@/components/profile-avatar";

type Member = {
  user_id: string;
  role: string;
  status: string;
  display_name: string;
  avatar_url: string | null;
};

export default function SessionMembers({
  sessionId,
  currentUserId,
  initialMembers,
}: {
  sessionId: string;
  currentUserId: string;
  initialMembers: Member[];
}) {
  const [members, setMembers] = useState(initialMembers);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const refresh = async () => {
      const { data, error } = await supabase
        .from("session_members")
        .select("user_id, role, status")
        .eq("session_id", sessionId)
        .eq("status", "accepted")
        .order("created_at", { ascending: true });

      if (!active || error) return;

      const rows = data ?? [];
      const ids = [...new Set(rows.map((member) => member.user_id))];
      let profilesById = new Map<string, { display_name: string | null; avatar_url: string | null }>();

      if (ids.length > 0) {
        const { data: profiles, error: profileError } = await supabase.rpc("get_session_member_profiles", { p_session_id: sessionId });
        if (!active) return;
        if (profileError) console.error("Session member profile lookup failed:", profileError);
        profilesById = new Map((profiles ?? []).map((profile) => [profile.id, { display_name: profile.display_name, avatar_url: profile.avatar_url || (profile.avatar_path ? (profile.avatar_path.startsWith("http") ? profile.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl) : null) }]));
      }

      setMembers(rows.map((member) => ({
        ...member,
        display_name: profilesById.get(member.user_id)?.display_name || "Vaani member",
        avatar_url: profilesById.get(member.user_id)?.avatar_url || null,
      })));
    };

    const channel = supabase
      .channel(`session-members-${sessionId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "session_members",
        filter: `session_id=eq.${sessionId}`,
      }, () => void refresh())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const acceptedCount = members.filter((member) => member.status === "accepted").length;

  return (
    <section className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Session members</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Member roles update live.</p>
        </div>
        <span className="text-sm text-[var(--muted)]">{acceptedCount} accepted</span>
      </div>

      {members.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">No member information is currently available.</p>
      ) : (
        <div className="mt-5 divide-y divide-stone-100">
          {members.map((member) => (
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
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${"bg-[var(--surface-soft)] text-[var(--ink)]"}`}>
                {"Accepted"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
