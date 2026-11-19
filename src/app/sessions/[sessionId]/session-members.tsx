"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  user_id: string;
  role: string;
  status: string;
  display_name: string;
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
        .in("status", ["accepted", "invited"])
        .order("created_at", { ascending: true });

      if (!active || error) return;

      const rows = data ?? [];
      const ids = [...new Set(rows.map((member) => member.user_id))];
      let names = new Map<string, string>();

      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        if (!active) return;
        names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
      }

      setMembers(rows.map((member) => ({
        ...member,
        display_name: names.get(member.user_id) || "Vaani member",
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
    <section className="mt-7 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Session members</h2>
          <p className="mt-1 text-sm text-stone-600">Member roles and invitation status update live.</p>
        </div>
        <span className="text-sm text-stone-500">{acceptedCount} accepted</span>
      </div>

      {members.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No member information is currently available.</p>
      ) : (
        <div className="mt-5 divide-y divide-stone-100">
          {members.map((member) => (
            <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-medium text-stone-900">
                  {member.display_name}{member.user_id === currentUserId ? " (You)" : ""}
                </p>
                <p className="mt-1 text-xs capitalize text-stone-500">{member.role.replaceAll("_", " ")}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${member.status === "accepted" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                {member.status === "accepted" ? "Accepted" : "Invited"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
