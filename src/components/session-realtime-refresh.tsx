"use client";

import { useEffect } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = { sessionId?: string };

/** Refresh only the current session or the signed-in user's gathering summaries. */
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
      }, 100);
    };

    const subscribe = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active || !auth.user?.id) return;

      // This project enforces private Realtime channels. Keep session
      // page and home refresh subscriptions within the same authorization
      // model as conference channels.
      let next = supabase.channel(
        sessionId ? `session-page-updates-${sessionId}` : `user-gathering-updates-${auth.user.id}`,
        { config: { private: true } }
      );

      if (sessionId) {
        next = next
          .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "session_members", filter: `session_id=eq.${sessionId}` }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            window.dispatchEvent(new CustomEvent("vaani:conference-realtime", {
              detail: {
                sessionId,
                table: "session_members",
                event: payload.eventType,
                new: payload.new,
                old: payload.old,
              },
            }));
            refresh();
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "session_join_requests", filter: `session_id=eq.${sessionId}` }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "session_notifications", filter: `session_id=eq.${sessionId}` }, refresh);
      } else {
        next = next
          .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `created_by=eq.${auth.user.id}` }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "session_members", filter: `user_id=eq.${auth.user.id}` }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "session_notifications", filter: `user_id=eq.${auth.user.id}` }, refresh);
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
