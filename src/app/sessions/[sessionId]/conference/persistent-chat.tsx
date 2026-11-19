"use client";

import {
  FormEvent,
  UIEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

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
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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

    if (open) {
      setUnreadCount(0);
    }
  }, [open]);

  useEffect(() => {
    onUnreadChange(unreadCount);
  }, [unreadCount, onUnreadChange]);

  useEffect(() => {
    let active = true;

    const supabase = createClient();

    async function loadMessages() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        if (!active) return;

        currentUserIdRef.current = user.id;
        setCurrentUserId(user.id);

        const { data, error: queryError } =
          await supabase
            .from("session_messages")
            .select(
              "id, session_id, sender_id, body, created_at"
            )
            .eq("session_id", sessionId)
            .order("created_at", {
              ascending: true,
            });

        if (queryError) {
          throw queryError;
        }

        if (!active) return;

        setMessages((data ?? []) as Message[]);
        shouldScrollRef.current = true;
      } catch (err) {
        if (!active) return;

        console.error(
          "Unable to load session chat:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load chat."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMessages();

    const channel = supabase
      .channel(`session-chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (!active) return;

          const message =
            payload.new as Message;

          setMessages((previous) => {
            if (
              previous.some(
                (existing) =>
                  existing.id === message.id
              )
            ) {
              return previous;
            }

            return [...previous, message];
          });

          if (
            !openRef.current &&
            message.sender_id !==
              currentUserIdRef.current
          ) {
            setUnreadCount((previous) =>
              Math.min(previous + 1, 99)
            );
          }

          if (
            openRef.current ||
            shouldScrollRef.current
          ) {
            shouldScrollRef.current = true;
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
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

  async function sendMessage(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const body = input.trim();

    if (
      !body ||
      sending ||
      !currentUserId
    ) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: insertError } =
        await supabase
          .from("session_messages")
          .insert({
            session_id: sessionId,
            sender_id: currentUserId,
            body: body.slice(
              0,
              MAX_MESSAGE_LENGTH
            ),
          });

      if (insertError) {
        throw insertError;
      }

      setInput("");
      shouldScrollRef.current = true;
    } catch (err) {
      console.error(
        "Unable to send session chat message:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to send message."
      );
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
      className={`absolute inset-x-3 bottom-[76px] top-3 z-40 flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#202020] shadow-2xl transition-[opacity,transform] duration-150 ${
        open
          ? "visible translate-y-0 opacity-100"
          : "pointer-events-none invisible translate-y-2 opacity-0"
      }`}
      aria-hidden={!open}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div>
          <p className="text-sm font-semibold text-white">
            Session chat
          </p>

          <p className="text-[11px] text-white/40">
            Messages are saved for this session
          </p>
        </div>

        {unreadCount > 0 && !open && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
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
          <div className="flex h-full items-center justify-center text-xs text-white/40">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-white/40">
            <span>
              No messages yet.
              <br />
              Start the conversation.
            </span>
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
                      <p className="mb-1 text-[10px] font-medium text-white/40">
                        Member
                      </p>
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
                      {new Date(
                        message.created_at
                      ).toLocaleTimeString(
                        undefined,
                        {
                          hour: "numeric",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="shrink-0 border-t border-red-400/10 bg-red-950/40 px-3 py-2 text-[11px] text-red-200"
        >
          {error}
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
          placeholder="Type a message..."
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
          className="h-10 shrink-0 rounded-lg bg-blue-600 px-4 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
