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

type ConferenceRealtimeStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

type ConferenceRealtimeContextValue = {
  revision: number;
  status: ConferenceRealtimeStatus;
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
  "session_documents",
  "session_reader_state",
  "session_messages",
  "session_members",
  "session_notifications",
  "session_join_requests",
  "sessions",
] as const;

export default function ConferenceRealtimeProvider({
  sessionId,
  children,
}: Props) {
  const [revision, setRevision] = useState(0);
  const [status, setStatus] =
    useState<ConferenceRealtimeStatus>("connecting");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const bump = () => {
      if (active) {
        setRevision((value) => value + 1);
      }
    };

    const channel = supabase.channel(`conference-realtime-${sessionId}`);

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `session_id=eq.${sessionId}`,
        },
        bump
      );
    }

    channel.subscribe((channelStatus) => {
      if (!active) return;

      if (channelStatus === "SUBSCRIBED") {
        setStatus("connected");
        bump();
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
      if (active) {
        setStatus("reconnecting");
        bump();
      }
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
    () => ({ revision, status }),
    [revision, status]
  );

  return (
    <ConferenceRealtimeContext.Provider value={value}>
      {children}
    </ConferenceRealtimeContext.Provider>
  );
}