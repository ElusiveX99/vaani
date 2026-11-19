"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useRoomContext,
  useLocalParticipant,
  useRemoteParticipants,
} from "@livekit/components-react";
import {
  DisconnectReason,
  RoomEvent,
  Track,
} from "livekit-client";
import "@livekit/components-styles";

import PdfUploader from "./pdf-uploader";
import ModerationPanel from "./moderation-panel";
import PersistentChat from "./persistent-chat";
import SynchronizedReader from "./synchronized-reader";

type Props = {
  sessionId: string;
  title: string;
  canManageDocuments: boolean;
};

type Credentials = {
  serverUrl: string;
  participantToken: string;
};

type ControlIconName =
  | "mic"
  | "camera"
  | "screen"
  | "people"
  | "chat"
  | "leave";

type MediaAction =
  | "microphone"
  | "camera"
  | "screen";

function ControlIcon({
  name,
  off = false,
}: {
  name: ControlIconName;
  off?: boolean;
}) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  let content;

  switch (name) {
    case "mic":
      content = (
        <>
          <rect
            x="9"
            y="2"
            width="6"
            height="12"
            rx="3"
          />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
          <path d="M12 19v3M8 22h8" />
        </>
      );
      break;

    case "camera":
      content = (
        <>
          <rect
            x="3"
            y="6"
            width="13"
            height="12"
            rx="2"
          />
          <path d="m16 10 5-3v10l-5-3" />
        </>
      );
      break;

    case "screen":
      content = (
        <>
          <rect
            x="3"
            y="3"
            width="18"
            height="13"
            rx="2"
          />
          <path d="M8 21h8M12 16v5" />
        </>
      );
      break;

    case "people":
      content = (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
      break;

    case "chat":
      content = (
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
      );
      break;

    case "leave":
      content = (
        <>
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </>
      );
      break;
  }

  return (
    <svg {...common}>
      {content}

      {off && (
        <path
          d="M3 3l18 18"
          strokeWidth="2.4"
        />
      )}
    </svg>
  );
}

function ControlContent({
  icon,
  label,
}: {
  icon: ControlIconName;
  label: string;
}) {
  return (
    <span className="flex items-center justify-center gap-1.5">
      <ControlIcon name={icon} />
      <span className="hidden sm:inline">
        {label}
      </span>
    </span>
  );
}

function getMediaErrorMessage(
  error: unknown,
  action: MediaAction
) {
  const name =
    error instanceof Error
      ? error.name
      : "";

  const message =
    error instanceof Error
      ? error.message
      : "";

  if (
    name === "NotAllowedError" ||
    name === "SecurityError"
  ) {
    if (action === "microphone") {
      return "Microphone access was denied. Check your browser and device permissions, then try again.";
    }

    if (action === "camera") {
      return "Camera access was denied. Check your browser and device permissions, then try again.";
    }

    return "Screen sharing was blocked or canceled by the browser.";
  }

  if (name === "NotFoundError") {
    if (action === "microphone") {
      return "No microphone was found on this device.";
    }

    if (action === "camera") {
      return "No camera was found on this device.";
    }

    return "No display was available for screen sharing.";
  }

  if (name === "NotReadableError") {
    if (action === "microphone") {
      return "The microphone is unavailable or being used by another application.";
    }

    if (action === "camera") {
      return "The camera is unavailable or being used by another application.";
    }

    return "The selected display could not be shared.";
  }

  if (message) {
    return message;
  }

  return `Unable to enable ${action}. Please try again.`;
}

function MediaButton({
  icon,
  label,
  enabled,
  busy,
  disabled,
  offIsError = false,
  activeClassName,
  title,
  onClick,
}: {
  icon: ControlIconName;
  label: string;
  enabled: boolean;
  busy: boolean;
  disabled: boolean;
  offIsError?: boolean;
  activeClassName?: string;
  title: string;
  onClick: () => void;
}) {
  const appearance =
    offIsError && !enabled
      ? "bg-red-600 text-white hover:bg-red-500"
      : enabled
        ? activeClassName ??
          "bg-white/10 text-white hover:bg-white/20"
        : "bg-white/10 text-white hover:bg-white/20";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      aria-pressed={enabled}
      title={title}
      className={`flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-lg px-0 text-xs transition disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:px-3 ${appearance}`}
    >
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : (
        <span className="flex items-center justify-center gap-1.5">
          <ControlIcon
            name={icon}
            off={
              offIsError &&
              !enabled
            }
          />

          <span className="hidden sm:inline">
            {label}
          </span>
        </span>
      )}
    </button>
  );
}

function ConferenceWorkspace({
  sessionId,
  title,
  canManageDocuments,
}: Props) {
  const room = useRoomContext();

  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();

  const remoteParticipants =
    useRemoteParticipants({
      updateOnlyOn: [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.ConnectionStateChanged,
      ],
    });

  const [chatOpen, setChatOpen] =
    useState(false);

  const [
    chatUnreadCount,
    setChatUnreadCount,
  ] = useState(0);

  const [
    participantsOpen,
    setParticipantsOpen,
  ] = useState(false);

  const [leaving, setLeaving] =
    useState(false);

  const [mediaError, setMediaError] =
    useState("");

  const [mediaBusy, setMediaBusy] =
    useState<MediaAction | null>(null);

  const [
    readerAvailable,
    setReaderAvailable,
  ] = useState(true);

  const mediaActionLock =
    useRef(false);

  const isOrganizer =
    localParticipant.attributes?.role ===
    "organizer";

  const handleDocumentAvailabilityChange =
    useCallback(
      (available: boolean) => {
        setReaderAvailable(
          available
        );
      },
      []
    );

  const trackSources = useMemo(
    () => [
      {
        source:
          Track.Source.Camera,
        withPlaceholder: true,
      },
      {
        source:
          Track.Source.ScreenShare,
        withPlaceholder: false,
      },
    ],
    []
  );

  const tracks = useTracks(
    trackSources,
    {
      onlySubscribed: false,
    }
  );

  const gridClassName =
    readerAvailable
      ? "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(220px,0.9fr)] lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:grid-rows-1"
      : "grid-cols-1 grid-rows-1";

  useEffect(() => {
    let unlocked = false;
    let pending = false;

    function removeListeners() {
      window.removeEventListener(
        "pointerdown",
        handleUserInteraction,
        true
      );

      window.removeEventListener(
        "keydown",
        handleUserInteraction,
        true
      );
    }

    function attemptAudioUnlock() {
      if (
        unlocked ||
        pending
      ) {
        return;
      }

      pending = true;

      try {
        void room
          .startAudio()
          .then(() => {
            unlocked = true;
            removeListeners();
          })
          .catch(() => {})
          .finally(() => {
            pending = false;
          });
      } catch {
        pending = false;
      }
    }

    function handleUserInteraction() {
      attemptAudioUnlock();
    }

    attemptAudioUnlock();

    window.addEventListener(
      "pointerdown",
      handleUserInteraction,
      true
    );

    window.addEventListener(
      "keydown",
      handleUserInteraction,
      true
    );

    return removeListeners;
  }, [room]);

  const runMediaAction =
    useCallback(
      async (
        action: MediaAction,
        callback: () => Promise<unknown>
      ) => {
        if (
          mediaActionLock.current
        ) {
          return;
        }

        mediaActionLock.current =
          true;

        setMediaBusy(action);
        setMediaError("");

        try {
          await callback();
        } catch (error) {
          console.error(
            `Vaani ${action} error:`,
            error
          );

          setMediaError(
            getMediaErrorMessage(
              error,
              action
            )
          );
        } finally {
          mediaActionLock.current =
            false;

          setMediaBusy(null);
        }
      },
      []
    );

  const toggleMicrophone =
    useCallback(() => {
      void runMediaAction(
        "microphone",
        async () => {
          if (
            !isMicrophoneEnabled &&
            !navigator.mediaDevices
              ?.getUserMedia
          ) {
            throw new Error(
              "This browser does not support microphone access."
            );
          }

          await localParticipant.setMicrophoneEnabled(
            !isMicrophoneEnabled
          );
        }
      );
    }, [
      runMediaAction,
      localParticipant,
      isMicrophoneEnabled,
    ]);

  const toggleCamera =
    useCallback(() => {
      void runMediaAction(
        "camera",
        async () => {
          if (
            !isCameraEnabled &&
            !navigator.mediaDevices
              ?.getUserMedia
          ) {
            throw new Error(
              "This browser does not support camera access."
            );
          }

          await localParticipant.setCameraEnabled(
            !isCameraEnabled
          );
        }
      );
    }, [
      runMediaAction,
      localParticipant,
      isCameraEnabled,
    ]);

  const toggleScreenShare =
    useCallback(() => {
      void runMediaAction(
        "screen",
        async () => {
          if (
            isScreenShareEnabled
          ) {
            await localParticipant.setScreenShareEnabled(
              false
            );

            return;
          }

          if (
            !window.isSecureContext ||
            typeof navigator
              .mediaDevices
              ?.getDisplayMedia !==
              "function"
          ) {
            throw new Error(
              "Screen sharing is not supported by this browser on this device. Use Vaani on a supported desktop browser to present your screen."
            );
          }

          await localParticipant.setScreenShareEnabled(
            true,
            {
              audio: false,
            }
          );
        }
      );
    }, [
      runMediaAction,
      localParticipant,
      isScreenShareEnabled,
    ]);

  async function leaveConference() {
    if (leaving) {
      return;
    }

    setLeaving(true);

    try {
      await room.disconnect();
    } catch (error) {
      console.error(
        "Conference disconnect failed:",
        error
      );
    } finally {
      window.location.replace(
        `/sessions/${sessionId}`
      );
    }
  }

  function toggleChat() {
    setParticipantsOpen(
      false
    );

    setChatOpen(
      (current) => !current
    );
  }

  function toggleParticipants() {
    setChatOpen(false);

    setParticipantsOpen(
      (current) => !current
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#171717] px-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-white">
            {title}
          </h1>

          <p className="text-xs text-white/50">
            {remoteParticipants.length +
              1}{" "}
            participant
            {remoteParticipants.length ===
            0
              ? ""
              : "s"}{" "}
            connected
          </p>
        </div>

        <button
          type="button"
          onClick={
            leaveConference
          }
          disabled={leaving}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-50"
        >
          {leaving
            ? "Leaving..."
            : "Leave conference"}
        </button>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#171717] px-4 py-2">
        <span className="text-xs font-medium text-white/70">
          Session workspace
        </span>

        <PdfUploader
          sessionId={
            sessionId
          }
          canManage={
            canManageDocuments
          }
        />
      </div>

      <div
        className={`grid min-h-0 flex-1 gap-2 p-2 lg:gap-3 lg:p-3 ${gridClassName}`}
      >
        <div
          className={
            readerAvailable
              ? "min-h-0 overflow-hidden"
              : "hidden"
          }
        >
          <SynchronizedReader
            sessionId={
              sessionId
            }
            onDocumentAvailabilityChange={
              handleDocumentAvailabilityChange
            }
          />
        </div>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717]">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <GridLayout
              tracks={
                tracks
              }
              className="h-full min-h-0 w-full"
            >
              <ParticipantTile />
            </GridLayout>
          </div>

          <PersistentChat
            sessionId={
              sessionId
            }
            open={
              chatOpen
            }
            onUnreadChange={
              setChatUnreadCount
            }
          />

          {participantsOpen &&
            isOrganizer && (
              <ModerationPanel
                sessionId={
                  sessionId
                }
                open={
                  participantsOpen
                }
                onClose={() =>
                  setParticipantsOpen(
                    false
                  )
                }
              />
            )}

          <div className="relative z-30 flex h-16 shrink-0 items-center justify-center gap-1.5 border-t border-white/10 bg-[#171717] px-2 sm:gap-2">
            <MediaButton
              icon="mic"
              label="Mic"
              enabled={
                isMicrophoneEnabled
              }
              offIsError
              busy={
                mediaBusy ===
                "microphone"
              }
              disabled={
                mediaBusy !==
                null
              }
              title={
                isMicrophoneEnabled
                  ? "Turn microphone off"
                  : "Turn microphone on"
              }
              onClick={
                toggleMicrophone
              }
            />

            <MediaButton
              icon="camera"
              label="Camera"
              enabled={
                isCameraEnabled
              }
              offIsError
              busy={
                mediaBusy ===
                "camera"
              }
              disabled={
                mediaBusy !==
                null
              }
              title={
                isCameraEnabled
                  ? "Turn camera off"
                  : "Turn camera on"
              }
              onClick={
                toggleCamera
              }
            />

            <MediaButton
              icon="screen"
              label="Present"
              enabled={
                isScreenShareEnabled
              }
              activeClassName="bg-blue-600 text-white hover:bg-blue-500"
              busy={
                mediaBusy ===
                "screen"
              }
              disabled={
                mediaBusy !==
                null
              }
              title={
                isScreenShareEnabled
                  ? "Stop presenting"
                  : "Present screen"
              }
              onClick={
                toggleScreenShare
              }
            />

            {isOrganizer && (
              <button
                type="button"
                onClick={
                  toggleParticipants
                }
                aria-label={`Manage participants (${remoteParticipants.length})`}
                aria-pressed={
                  participantsOpen
                }
                title="Manage participants"
                className={`flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-lg px-0 text-xs transition hover:bg-white/20 sm:w-auto sm:px-3 ${
                  participantsOpen
                    ? "bg-white/20"
                    : "bg-white/10"
                }`}
              >
                <ControlContent
                  icon="people"
                  label={`Manage (${remoteParticipants.length})`}
                />
              </button>
            )}

            <button
              type="button"
              onClick={
                toggleChat
              }
              aria-label={
                chatUnreadCount >
                0
                  ? `Chat, ${chatUnreadCount} unread messages`
                  : "Toggle chat"
              }
              aria-pressed={
                chatOpen
              }
              title="Chat"
              className={`relative flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-lg px-0 text-xs transition hover:bg-white/20 sm:w-auto sm:px-3 ${
                chatOpen
                  ? "bg-white/20"
                  : "bg-white/10"
              }`}
            >
              <ControlContent
                icon="chat"
                label="Chat"
              />

              {chatUnreadCount >
                0 &&
                !chatOpen && (
                  <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold leading-4 text-white">
                    {chatUnreadCount >
                    99
                      ? "99+"
                      : chatUnreadCount}
                  </span>
                )}
            </button>

            <button
              type="button"
              onClick={
                leaveConference
              }
              disabled={
                leaving
              }
              aria-label="Leave conference"
              title="Leave conference"
              className="flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 px-0 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50 sm:w-auto sm:px-3"
            >
              <ControlContent
                icon="leave"
                label={
                  leaving
                    ? "Leaving..."
                    : "Leave"
                }
              />
            </button>
          </div>

          {mediaError && (
            <div
              role="alert"
              aria-live="assertive"
              className="absolute bottom-[76px] left-2 right-2 z-50 flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-950/95 px-3 py-3 text-xs leading-relaxed text-red-100 shadow-xl sm:left-4 sm:right-4"
            >
              <p className="min-w-0 flex-1">
                {mediaError}
              </p>

              <button
                type="button"
                onClick={() =>
                  setMediaError(
                    ""
                  )
                }
                aria-label="Dismiss error"
                className="shrink-0 rounded px-1 text-base leading-none text-red-200 hover:bg-white/10"
              >
                ×
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ConferenceRoom({
  sessionId,
  title,
  canManageDocuments,
}: Props) {
  const [
    credentials,
    setCredentials,
  ] = useState<Credentials | null>(
    null
  );

  const [error, setError] =
    useState("");

  const [removed, setRemoved] =
    useState(false);

  useEffect(() => {
    if (!removed) {
      return;
    }

    const timeout =
      window.setTimeout(() => {
        window.location.replace(
          `/sessions/${sessionId}`
        );
      }, 1600);

    return () =>
      window.clearTimeout(
        timeout
      );
  }, [
    removed,
    sessionId,
  ]);

  useEffect(() => {
    const controller =
      new AbortController();

    async function connect() {
      try {
        const response =
          await fetch(
            "/api/livekit/token",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                {
                  sessionId,
                }
              ),
              signal:
                controller.signal,
              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to join conference."
          );
        }

        if (
          typeof data.serverUrl !==
            "string" ||
          typeof data.participantToken !==
            "string"
        ) {
          throw new Error(
            "Invalid conference credentials."
          );
        }

        setCredentials({
          serverUrl:
            data.serverUrl,
          participantToken:
            data.participantToken,
        });
      } catch (
        err
      ) {
        if (
          err instanceof Error &&
          err.name ===
            "AbortError"
        ) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to connect to conference."
        );
      }
    }

    void connect();

    return () =>
      controller.abort();
  }, [sessionId]);

  if (removed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111111] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171717] p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-300">
            <span className="text-xl">
              ×
            </span>
          </div>

          <h1 className="mt-4 text-lg font-semibold">
            You were removed from the conference
          </h1>

          <p className="mt-2 text-sm text-white/50">
            The organizer removed you from this session.
          </p>

          <p className="mt-4 text-xs text-white/35">
            Returning to the session page...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111111] px-5 text-white">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">
            Unable to join conference
          </h1>

          <p className="mt-3 text-sm text-white/60">
            {error}
          </p>

          <Link
            href={`/sessions/${sessionId}`}
            className="mt-6 inline-block rounded-lg bg-white/10 px-5 py-3 text-sm transition hover:bg-white/20"
          >
            Back to session
          </Link>
        </div>
      </main>
    );
  }

  if (!credentials) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111111] text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />

          <p className="mt-4 text-sm text-white/60">
            Connecting to {title}...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen h-[100dvh] flex-col overflow-hidden bg-[#111111] text-white">
      <LiveKitRoom
        serverUrl={
          credentials.serverUrl
        }
        token={
          credentials.participantToken
        }
        connect
        audio={false}
        video={false}
        options={{
          adaptiveStream:
            true,
          dynacast:
            true,
        }}
        onDisconnected={(
          reason
        ) => {
          if (
            reason ===
            DisconnectReason.PARTICIPANT_REMOVED
          ) {
            setRemoved(
              true
            );
          }
        }}
        onError={(
          liveKitError
        ) => {
          console.error(
            "LiveKit room error:",
            liveKitError
          );

          setError(
            liveKitError.message
          );
        }}
        data-lk-theme="default"
        style={{
          flex: "1 1 0%",
          minHeight:
            0,
          width:
            "100%",
          display:
            "flex",
          flexDirection:
            "column",
        }}
      >
        <ConferenceWorkspace
          sessionId={
            sessionId
          }
          title={
            title
          }
          canManageDocuments={
            canManageDocuments
          }
        />

        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}
