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
  onClose: () => void;
  onUnreadChange: (count: number) => void;
};

type Profile = { id: string; display_name: string | null; avatar_url: string | null; avatar_path: string | null };

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
  onClose,
  onUnreadChange,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(
    []
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { status: realtimeStatus } = useConferenceRealtime();

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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

  // When the chat drawer is opened, place the caret in the composer so the
  // participant can start typing immediately without an extra tap.
  useEffect(() => {
    if (!open || loading || !currentUserId) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, loading, currentUserId]);

  useEffect(() => {
    onUnreadChange(unreadCount);
  }, [unreadCount, onUnreadChange]);

  const browserOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const connectionStatus = !isOnline || !browserOnline
    ? "You're offline. Messages will refresh when you're connected again."
    : realtimeStatus === "connected"
      ? ""
      : realtimeStatus === "disconnected" || realtimeStatus === "reconnecting"
        ? "Live updates reconnecting. You can still send messages."
        : "Connecting to live updates…";

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
        const profileMap = new Map<string, Profile>(((profiles ?? []) as Profile[]).map((profile: Profile) => [profile.id, profile]));
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
      if (active) setIsOnline(false);
    };
    const handleOnline = () => {
      if (!active) return;
      setIsOnline(true);
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
      const rows = (data ?? []) as Message[];
      const senderIds = [...new Set(rows.map((message: Message) => message.sender_id))];
      const { data: profiles } = senderIds.length
        ? await supabase.from("profiles")
            .select("id, display_name, avatar_url, avatar_path")
            .in("id", senderIds)
        : { data: [] };
      if (!activeChatRef.current) return;
      const profileMap = new Map<string, Profile>(((profiles ?? []) as Profile[]).map((profile: Profile) => [profile.id, profile]));
      const enriched = rows.reverse().map((message: Message) => {
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
    return () => { activeChatRef.current = false; };
  }, []);

  useEffect(() => {
    const handleRealtime = (browserEvent: Event) => {
      const realtimeEvent = (browserEvent as CustomEvent<{
        sessionId?: string;
        table?: string;
        event?: string;
        new: Record<string, unknown>;
        old: Record<string, unknown>;
      } | null>).detail;
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
    };
    window.addEventListener("vaani:conference-realtime", handleRealtime);
    return () => window.removeEventListener("vaani:conference-realtime", handleRealtime);
  }, [sessionId]);

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
      className={`absolute right-3 top-3 bottom-3 z-40 flex min-h-0 w-[min(27rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-[1.35rem] border border-[#b99baf]/20 bg-[#211c25] shadow-[0_24px_80px_rgba(0,0,0,.48)] ring-1 ring-black/20 transition-[opacity,transform] duration-200 sm:right-4 sm:top-4 sm:bottom-4 ${
        open
          ? "visible translate-y-0 opacity-100"
          : "pointer-events-none invisible translate-y-2 opacity-0"
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[linear-gradient(115deg,rgba(112,78,105,.38),rgba(40,33,43,.2))] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#c5a07d]/20 bg-[#c5a07d]/[0.08] text-lg text-[#d9bd9b]" aria-hidden="true">✦</span>
          <div className="min-w-0">
            <p className="font-display text-[1.35rem] leading-none text-[#fff8fc]">Gathering chat</p>
            <p className="mt-1.5 text-[9px] font-semibold tracking-[.16em] text-[#c6b4c2]/65">SHARED WITH THIS GATHERING</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unreadCount > 0 && !open && (
            <span className="rounded-full bg-[#76516b] px-2 py-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gathering chat"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6b5cc]"
          >
            ×
          </button>
        </div>
      </header>

      <div
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(111,76,103,.10),transparent_55%)] px-4 py-5 sm:px-5"
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
          <div className="space-y-4">
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
                        ? "rounded-br-md border-[#9a7893]/30 bg-[#674c65] text-[#fffafd]"
                        : "rounded-bl-md border-white/[0.07] bg-[#302a34] text-[#f3edf2]"
                    }`}
                  >
                    {!own && (
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <ProfileAvatar name={message.sender_name || "Sakhi"} avatarUrl={message.avatar_url} size="sm" className="!h-5 !w-5 !text-[8px]" />
                        <p className="text-[10px] font-semibold text-white/55">{message.sender_name || "Sakhi"}</p>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.65]">
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

        </p>
      )}

      <form
        onSubmit={sendMessage}
        className="shrink-0 border-t border-white/[0.08] bg-[#1b171f] p-3.5 sm:p-4"
      >
        <textarea
          ref={inputRef}
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
          className="min-h-11 max-h-32 min-w-0 flex-1 resize-none rounded-xl border border-[#8f728a]/25 bg-[#2c2630] px-4 py-3 text-[13px] leading-relaxed text-white outline-none placeholder:text-[#c8bac7]/40 transition focus:border-[#c19db8]/65 focus:ring-2 focus:ring-[#9b7892]/15 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={
            sending ||
            !input.trim() ||
            !currentUserId
          }
          className="h-11 shrink-0 rounded-xl bg-[#8a6682] px-4 text-xs font-semibold tracking-wide text-white shadow-sm transition hover:bg-[#a17a98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6b5cc] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
