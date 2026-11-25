"use client";

import {
  FormEvent,
  UIEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import ProfileAvatar from "@/components/profile-avatar";
import { useConferenceRealtime } from "./conference-realtime-provider";

type Props = {
  sessionId: string;
  open: boolean;
  onUnreadChange: (count: number) => void;
};

type Message = {
  id: string;
  session_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  pending?: boolean;
  sender_name?: string;
  avatar_url?: string | null;
};

const MAX_MESSAGE_LENGTH = 2000;

export default function PersistentChat({
  sessionId,
  open,
  onUnreadChange,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(
    []
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { event: realtimeEvent, status: realtimeStatus } = useConferenceRealtime();

  const bottomRef = useRef<HTMLDivElement | null>(
    null
  );

  const shouldScrollRef = useRef(true);
  const openRef = useRef(open);
  const currentUserIdRef = useRef<string | null>(
    null
  );

  useEffect(() => {
    openRef.current = open;

    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      setUnreadCount(0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    onUnreadChange(unreadCount);
  }, [unreadCount, onUnreadChange]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let historyRequest = 0;
    let historyLoading = false;

    async function loadMessages() {
      if (historyLoading) return;
      historyLoading = true;
      const request = ++historyRequest;
      try {
        const { data, error: queryError } = await supabase
          .from("session_messages")
          .select("id, session_id, sender_id, body, created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (queryError) throw queryError;
        if (!active || request !== historyRequest) return;

        const rows = ((data ?? []) as Message[]).reverse();
        const senderIds = [...new Set(rows.map((message) => message.sender_id))];
        const { data: profiles } = senderIds.length
          ? await supabase.from("profiles").select("id, display_name, avatar_url, avatar_path").in("id", senderIds)
          : { data: [] };
        if (!active || request !== historyRequest) return;
        const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        const enriched = rows.map((message) => ({
          ...message,
          sender_name: profileMap.get(message.sender_id)?.display_name || "Sakhi",
          avatar_url: profileMap.get(message.sender_id)?.avatar_url || (profileMap.get(message.sender_id)?.avatar_path ? (profileMap.get(message.sender_id)!.avatar_path!.startsWith("http") ? profileMap.get(message.sender_id)!.avatar_path : supabase.storage.from("profile-avatars").getPublicUrl(profileMap.get(message.sender_id)!.avatar_path!).data.publicUrl) : null),
        }));

        setMessages((previous) => {
          const merged = new Map<string, Message>();
          for (const message of enriched) merged.set(message.id, message);
          for (const message of previous) {
            const current = merged.get(message.id);
            merged.set(message.id, current ? { ...message, ...current, sender_name: current.sender_name || message.sender_name, avatar_url: current.avatar_url || message.avatar_url } : message);
          }
          return [...merged.values()].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
        shouldScrollRef.current = true;
        setLoading(false);
        setError("");
      } catch (err) {
        if (!active || request !== historyRequest) return;
        console.error("Unable to load session chat:", err);
        setError("The gathering chat could not be loaded. Please try again.");
        setLoading(false);
      } finally {
        historyLoading = false;
      }
    }

    function addMessage(message: Message) {
      setMessages((previous) => {
        if (previous.some((item) => item.id === message.id)) return previous;
        return [...previous, message].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      if (!openRef.current && message.sender_id !== currentUserIdRef.current) {
        setUnreadCount((count) => Math.min(count + 1, 99));
      }
      if (openRef.current || shouldScrollRef.current) {
        shouldScrollRef.current = true;
      }
    }

    async function initialize() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          throw new Error("Your session has expired. Please sign in again.");
        }
        if (!active) return;

        currentUserIdRef.current = user.id;
        setCurrentUserId(user.id);

        // History and sending must work even if the Realtime websocket
        // or publication is unavailable.
        await loadMessages();

      } catch (err) {
        if (!active) return;
        console.error("Unable to initialize session chat:", err);
        setError(err instanceof Error ? err.message : "Unable to load chat.");
        setLoading(false);
      }
    }

    void initialize();

    const handleVisibility = () => {
      if (active && document.visibilityState === "visible") void loadMessages();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleOffline = () => {
      if (active) setConnectionStatus("You're offline. Messages will refresh when you're connected again.");
    };
    const handleOnline = () => {
      if (!active) return;
      setConnectionStatus("Connection restored. Refreshing messages...");
      void loadMessages();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    if (typeof navigator !== "undefined" && !navigator.onLine) handleOffline();

    return () => {
      active = false;
      historyRequest += 1;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [sessionId]);

  useEffect(() => {
    if (realtimeStatus !== "connected" || loading) return;
    // Reconcile message history after the shared socket reconnects.
    // Normal inserts are applied from their exact row payload below.
    void (async () => {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("session_messages")
        .select("id, session_id, sender_id, body, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError || !data) return;
      const senderIds = [...new Set(data.map((message) => message.sender_id))];
      const { data: profiles } = senderIds.length
        ? await supabase.from("profiles")
            .select("id, display_name, avatar_url, avatar_path")
            .in("id", senderIds)
        : { data: [] };
      if (!activeChatRef.current) return;
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const enriched = data.reverse().map((message) => {
        const profile = profileMap.get(message.sender_id);
        const avatarUrl = profile?.avatar_url || (profile?.avatar_path
          ? profile.avatar_path.startsWith("http")
            ? profile.avatar_path
            : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl
          : null);
        return { ...message, sender_name: profile?.display_name || "Sakhi", avatar_url: avatarUrl };
      }) as Message[];
      setMessages((previous) => {
        const merged = new Map(previous.filter((item) => !item.pending).map((item) => [item.id, item]));
        for (const message of enriched) merged.set(message.id, { ...merged.get(message.id), ...message });
        return [...merged.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
    })();
  }, [realtimeStatus, sessionId, loading]);

  const activeChatRef = useRef(true);
  useEffect(() => {
    activeChatRef.current = true;
    return () => { activeChatRef.current = false; };
  }, []);

  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.sessionId !== sessionId || realtimeEvent.table !== "session_messages") return;
    if (realtimeEvent.event === "DELETE") {
      const id = String(realtimeEvent.old.id ?? "");
      if (id) setMessages((previous) => previous.filter((message) => message.id !== id));
      return;
    }
    const row = realtimeEvent.new;
    const id = String(row.id ?? "");
    const senderId = String(row.sender_id ?? "");
    if (!id || !senderId || typeof row.body !== "string" || typeof row.created_at !== "string") return;
    void (async () => {
      const supabase = createClient();
      const { data: profile } = await supabase.from("profiles")
        .select("display_name, avatar_url, avatar_path")
        .eq("id", senderId)
        .maybeSingle();
      const avatarUrl = profile?.avatar_url || (profile?.avatar_path
        ? profile.avatar_path.startsWith("http")
          ? profile.avatar_path
          : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl
        : null);
      const incoming: Message = {
        id,
        session_id: sessionId,
        sender_id: senderId,
        body: row.body as string,
        created_at: row.created_at as string,
        sender_name: profile?.display_name || "Sakhi",
        avatar_url: avatarUrl,
      };
      setMessages((previous) => {
        const existingIndex = previous.findIndex((message) => message.id === id);
        if (existingIndex >= 0) {
          return previous.map((message) => message.id === id ? { ...message, ...incoming } : message);
        }
        return [...previous, incoming].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
      if (!openRef.current && senderId !== currentUserIdRef.current) {
        setUnreadCount((count) => Math.min(count + 1, 99));
      }
    })();
  }, [realtimeEvent, sessionId]);

  useEffect(() => {
    if (!open || !shouldScrollRef.current) {
      return;
    }

    const frame =
      window.requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });

    return () =>
      window.cancelAnimationFrame(frame);
  }, [messages.length, open]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = input.trim();
    if (!body || sending || !currentUserId) return;

    const temporaryId = "pending-" + crypto.randomUUID();
    const optimisticMessage: Message = {
      id: temporaryId,
      session_id: sessionId,
      sender_id: currentUserId,
      body: body.slice(0, MAX_MESSAGE_LENGTH),
      created_at: new Date().toISOString(),
      pending: true,
    };

    // Render immediately for the sender; do not depend on Realtime echo.
    setMessages((previous) => [...previous, optimisticMessage]);
    setInput("");
    setSending(true);
    setError("");
    shouldScrollRef.current = true;

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("session_messages")
        .insert({
          session_id: sessionId,
          sender_id: currentUserId,
          body: optimisticMessage.body,
        })
        .select("id, session_id, sender_id, body, created_at")
        .single();

      if (insertError) throw insertError;
      const savedMessage = data as Message;

      // Realtime may arrive before this response; deduplicate by DB ID.
      setMessages((previous) => {
        const withoutTemporary = previous.filter(
          (message) => message.id !== temporaryId
        );
        if (withoutTemporary.some((message) => message.id === savedMessage.id)) {
          return withoutTemporary;
        }
        return [...withoutTemporary, savedMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    } catch (err) {
      console.error("Unable to send session chat message:", err);
      setMessages((previous) => previous.filter((message) => message.id !== temporaryId));
      setInput(body);
      setError("Your message could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function handleScroll(
    event: UIEvent<HTMLDivElement>
  ) {
    const element = event.currentTarget;

    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    shouldScrollRef.current =
      distanceFromBottom < 100;
  }

  return (
    <div
      className={`absolute inset-x-3 bottom-3 top-3 z-40 flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#202020] shadow-2xl transition-[opacity,transform] duration-150 ${
        open
          ? "visible translate-y-0 opacity-100"
          : "pointer-events-none invisible translate-y-2 opacity-0"
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div>
          <p className="text-sm font-semibold text-white">
            Gathering chat
          </p>

        </div>

        {unreadCount > 0 && !open && (
          <span className="rounded-full bg-[#76516b] px-2 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </header>

      <div
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
      >
        {loading ? (
          <div className="flex h-full flex-col justify-center gap-3 px-4" role="status" aria-label="Loading gathering messages">
            <span className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
            <span className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
            <span className="h-3 w-3/5 animate-pulse rounded bg-white/10" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium text-white/65">A quiet beginning</p>
            <p className="mt-2 max-w-xs text-xs leading-6 text-white/35">Messages shared with the gathering will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => {
              const own =
                message.sender_id ===
                currentUserId;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    own
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      own
                        ? "rounded-br-md bg-blue-600 text-white"
                        : "rounded-bl-md bg-white/10 text-white/90"
                    }`}
                  >
                    {!own && (
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <ProfileAvatar name={message.sender_name || "Sakhi"} avatarUrl={message.avatar_url} size="sm" className="!h-5 !w-5 !text-[8px]" />
                        <p className="text-[10px] font-semibold text-white/55">{message.sender_name || "Sakhi"}</p>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                      {message.body}
                    </p>

                    <p
                      className={`mt-1 text-[9px] ${
                        own
                          ? "text-white/60"
                          : "text-white/30"
                      }`}
                    >
                      {message.pending
                        ? "Sending..."
                        : new Date(
                            message.created_at
                          ).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </p>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {(error || connectionStatus) && (
        <p
          role={error ? "alert" : "status"}
          className={`shrink-0 border-t px-3 py-1.5 text-[10px] ${error ? "border-red-400/10 bg-red-950/40 text-red-200" : "border-white/5 text-white/60"}`}
        >
          {error || connectionStatus}
          {!error && connectionStatus && " · Messages refresh automatically"}
        </p>
      )}

      <form
        onSubmit={sendMessage}
        className="flex shrink-0 items-end gap-2 border-t border-white/10 p-3"
      >
        <textarea
          value={input}
          onChange={(event) => {
            setInput(
              event.target.value.slice(
                0,
                MAX_MESSAGE_LENGTH
              )
            );
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Message to the gathering"
          placeholder="Share a message with the gathering..."
          disabled={
            sending || !currentUserId
          }
          className="min-h-10 max-h-28 flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-white/25 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={
            sending ||
            !input.trim() ||
            !currentUserId
          }
          className="h-10 shrink-0 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition hover:bg-[#89647e] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
