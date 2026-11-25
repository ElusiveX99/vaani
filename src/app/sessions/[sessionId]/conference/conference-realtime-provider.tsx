"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type ConferenceRealtimeStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type ConferenceRealtimeTable =
  | "session_documents"
  | "session_reader_state"
  | "session_messages"
  | "session_members"
  | "session_notifications"
  | "session_join_requests"
  | "sessions";

export type ConferenceRealtimeEvent = {
  sessionId: string;
  table: ConferenceRealtimeTable;
  event: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type ConferenceRealtimeContextValue = {
  status: ConferenceRealtimeStatus;
  event: ConferenceRealtimeEvent | null;
  revision: number;
};

const ConferenceRealtimeContext =
  createContext<ConferenceRealtimeContextValue | null>(null);

export function useConferenceRealtime() {
  const context = useContext(ConferenceRealtimeContext);
  if (!context) {
    throw new Error(
      "useConferenceRealtime must be used inside ConferenceRealtimeProvider."
    );
  }
  return context;
}

type Props = {
  sessionId: string;
  children: ReactNode;
};

const REALTIME_TABLES = [
  { table: "session_documents", filterColumn: "session_id" },
  { table: "session_reader_state", filterColumn: "session_id" },
  { table: "session_messages", filterColumn: "session_id" },
  { table: "session_members", filterColumn: "session_id" },
  { table: "session_notifications", filterColumn: "session_id" },
  { table: "session_join_requests", filterColumn: "session_id" },
  { table: "sessions", filterColumn: "id" },
] as const;

export default function ConferenceRealtimeProvider({
  sessionId,
  children,
}: Props) {
  const [status, setStatus] =
    useState<ConferenceRealtimeStatus>("connecting");
  const [event, setEvent] =
    useState<ConferenceRealtimeEvent | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const channel = supabase.channel(`conference-realtime:${sessionId}`);

    const publish = (nextEvent?: ConferenceRealtimeEvent) => {
      if (!active) return;
      if (nextEvent) setEvent(nextEvent);
      setRevision((current) => current + 1);
      window.dispatchEvent(
        new CustomEvent("vaani:conference-realtime", {
          detail: nextEvent ?? null,
        })
      );
    };

    for (const { table, filterColumn } of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${filterColumn}=eq.${sessionId}`,
        },
        (payload: { eventType: string; new: unknown; old: unknown }) => {
          const nextEvent: ConferenceRealtimeEvent = {
            sessionId,
            table,
            event: payload.eventType as ConferenceRealtimeEvent["event"],
            new: (payload.new ?? {}) as Record<string, unknown>,
            old: (payload.old ?? {}) as Record<string, unknown>,
          };
          publish(nextEvent);
        }
      );
    }

    channel.subscribe((channelStatus: string) => {
      if (!active) return;
      if (channelStatus === "SUBSCRIBED") {
        setStatus("connected");
        publish();
      } else if (
        channelStatus === "CHANNEL_ERROR" ||
        channelStatus === "TIMED_OUT"
      ) {
        setStatus("reconnecting");
      } else if (channelStatus === "CLOSED") {
        setStatus("disconnected");
      } else if (channelStatus === "JOINING") {
        setStatus("connecting");
      }
    });

    const handleOffline = () => {
      if (active) setStatus("disconnected");
    };
    const handleOnline = () => {
      if (active) setStatus("reconnecting");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const value = useMemo(
    () => ({ status, event, revision }),
    [status, event, revision]
  );

  return (
    <ConferenceRealtimeContext.Provider value={value}>
      {children}
    </ConferenceRealtimeContext.Provider>
  );
}
