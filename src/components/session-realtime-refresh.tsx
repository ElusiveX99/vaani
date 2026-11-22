"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = { sessionId?: string };

/** Refreshes server-rendered session views when their database state changes. */
export default function SessionRealtimeRefresh({ sessionId }: Props) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    const supabase = createClient();

    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (active) router.refresh();
      }, 120);
    };

    const subscribe = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;

      let next = supabase.channel(
        sessionId ? `session-page-updates-${sessionId}` : "vaani-global-session-updates"
      );

      if (sessionId) {
        next = next
          .on("postgres_changes", {
            event: "*", schema: "public", table: "sessions",
            filter: `id=eq.${sessionId}`,
          }, refresh)
          .on("postgres_changes", {
            event: "*", schema: "public", table: "session_members",
            filter: `session_id=eq.${sessionId}`,
          }, refresh)
          .on("postgres_changes", {
            event: "*", schema: "public", table: "session_join_requests",
            filter: `session_id=eq.${sessionId}`,
          }, refresh)
          .on("postgres_changes", {
            event: "*", schema: "public", table: "session_notifications",
            filter: `session_id=eq.${sessionId}`,
          }, refresh);
      } else {
        next = next.on("postgres_changes", {
          event: "*", schema: "public", table: "sessions",
        }, refresh);

        if (data.user?.id) {
          next = next
            .on("postgres_changes", {
              event: "*", schema: "public", table: "session_members",
              filter: `user_id=eq.${data.user.id}`,
            }, refresh)
            .on("postgres_changes", {
              event: "*", schema: "public", table: "session_notifications",
              filter: `user_id=eq.${data.user.id}`,
            }, refresh);
        }
      }

      channel = next;
      next.subscribe();
    };

    void subscribe();

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, sessionId]);

  return null;
}
