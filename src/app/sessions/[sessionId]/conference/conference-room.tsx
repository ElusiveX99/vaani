"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  TrackToggle,
  Chat,
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

function ControlIcon({
  name,
}: {
  name: ControlIconName;
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

  switch (name) {
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
          <path d="M12 19v3M8 22h8" />
        </svg>
      );

    case "camera":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
        </svg>
      );

    case "screen":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 16v5M8 9l3-3 3 3M11 6v6" />
        </svg>
      );

    case "people":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case "chat":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
        </svg>
      );

    case "leave":
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
      );
  }
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
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function ConferenceWorkspace({
  sessionId,
  title,
  canManageDocuments,
}: Props) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const remoteParticipants = useRemoteParticipants({
    updateOnlyOn: [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ConnectionStateChanged,
    ],
  });

  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [readerAvailable, setReaderAvailable] = useState(true);

  const isOrganizer =
    localParticipant.attributes?.role === "organizer";

  const handleDocumentAvailabilityChange = useCallback(
    (available: boolean) => {
      setReaderAvailable(available);
    },
    []
  );

  // Keep the track-source array stable between renders.
  const trackSources = useMemo(
    () => [
      {
        source: Track.Source.Camera,
        withPlaceholder: true,
      },
      {
        source: Track.Source.ScreenShare,
        withPlaceholder: false,
      },
    ],
    []
  );

  const tracks = useTracks(trackSources, {
    onlySubscribed: false,
  });

  const gridClassName = readerAvailable
    ? "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(240px,0.9fr)] lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:grid-rows-1"
    : "grid-cols-1 grid-rows-1 lg:grid-cols-1 lg:grid-rows-1";

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
      if (unlocked || pending) return;

      pending = true;

      try {
        const result = room.startAudio();

        void result
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

  async function leaveConference() {
    if (leaving) return;

    setLeaving(true);

    try {
      await room.disconnect();
    } catch (error) {
      console.error("Conference disconnect failed:", error);
    } finally {
      window.location.replace(`/sessions/${sessionId}`);
    }
  }

  function toggleChat() {
    setParticipantsOpen(false);
    setChatOpen((current) => !current);
    setMediaError("");
  }

  function toggleParticipants() {
    setChatOpen(false);
    setParticipantsOpen((current) => !current);
    setMediaError("");
  }

  function handleMediaError(error: Error) {
    console.error("LiveKit media error:", error);

    setMediaError(
      error.message || "Unable to access this device."
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
            {remoteParticipants.length + 1} participant
            {remoteParticipants.length === 0 ? "" : "s"} connected
          </p>
        </div>

        <button
          type="button"
          onClick={leaveConference}
          disabled={leaving}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-50"
        >
          {leaving ? "Leaving..." : "Leave conference"}
        </button>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#171717] px-4 py-2">
        <span className="text-xs font-medium text-white/70">
          Session workspace
        </span>

        <PdfUploader
          sessionId={sessionId}
          canManage={canManageDocuments}
        />
      </div>

      <div
        className={`grid min-h-0 flex-1 gap-2 p-2 lg:gap-3 lg:p-3 ${gridClassName}`}
      >
        {/* Keep this component mounted so it can detect newly uploaded PDFs. */}
        <div
          className={
            readerAvailable
              ? "min-h-0 overflow-hidden"
              : "hidden"
          }
        >
          <SynchronizedReader
            sessionId={sessionId}
            onDocumentAvailabilityChange={
              handleDocumentAvailabilityChange
            }
          />
        </div>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717]">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <GridLayout
              tracks={tracks}
              className="h-full min-h-0 w-full"
            >
              <ParticipantTile />
            </GridLayout>
          </div>

          {chatOpen && (
            <div className="absolute inset-x-3 bottom-[76px] top-3 z-40 flex min-h-0 overflow-hidden rounded-xl border border-white/10 bg-[#202020] shadow-2xl">
              <Chat className="h-full min-h-0 w-full" />
            </div>
          )}

          {participantsOpen && isOrganizer && (
            <ModerationPanel
              sessionId={sessionId}
              open={participantsOpen}
              onClose={() => setParticipantsOpen(false)}
            />
          )}

          <div className="relative z-30 flex h-16 shrink-0 items-center justify-center gap-1.5 border-t border-white/10 bg-[#171717] px-2 sm:gap-2">
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={false}
              onDeviceError={handleMediaError}
              onChange={() => setMediaError("")}
              aria-label="Toggle microphone"
              title="Microphone"
              className="lk-button !flex !h-10 !w-10 !min-h-10 !shrink-0 !items-center !justify-center !rounded-lg !p-0 !text-xs sm:!w-auto sm:!px-3"
            >
              <ControlContent icon="mic" label="Mic" />
            </TrackToggle>

            <TrackToggle
              source={Track.Source.Camera}
              showIcon={false}
              onDeviceError={handleMediaError}
              onChange={() => setMediaError("")}
              aria-label="Toggle camera"
              title="Camera"
              className="lk-button !flex !h-10 !w-10 !min-h-10 !shrink-0 !items-center !justify-center !rounded-lg !p-0 !text-xs sm:!w-auto sm:!px-3"
            >
              <ControlContent icon="camera" label="Camera" />
            </TrackToggle>

            <TrackToggle
              source={Track.Source.ScreenShare}
              captureOptions={{
                audio: true,
                selfBrowserSurface: "include",
              }}
              showIcon={false}
              onDeviceError={handleMediaError}
              onChange={() => setMediaError("")}
              aria-label="Share screen"
              title="Share screen"
              className="lk-button !flex !h-10 !w-10 !min-h-10 !shrink-0 !items-center !justify-center !rounded-lg !p-0 !text-xs sm:!w-auto sm:!px-3"
            >
              <ControlContent icon="screen" label="Share" />
            </TrackToggle>

            {isOrganizer && (
              <button
                type="button"
                onClick={toggleParticipants}
                aria-label={`Manage participants (${remoteParticipants.length})`}
                aria-pressed={participantsOpen}
                title="Manage participants"
                className={`lk-button !flex !h-10 !w-10 !min-h-10 !shrink-0 !items-center !justify-center !rounded-lg !p-0 !text-xs sm:!w-auto sm:!px-3 ${
                  participantsOpen ? "bg-white/20" : ""
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
              onClick={toggleChat}
              aria-label="Toggle chat"
              aria-pressed={chatOpen}
              title="Chat"
              className={`lk-button !flex !h-10 !w-10 !min-h-10 !shrink-0 !items-center !justify-center !rounded-lg !p-0 !text-xs sm:!w-auto sm:!px-3 ${
                chatOpen ? "bg-white/20" : ""
              }`}
            >
              <ControlContent icon="chat" label="Chat" />
            </button>

            <button
              type="button"
              onClick={leaveConference}
              disabled={leaving}
              aria-label="Leave conference"
              title="Leave conference"
              className="!flex !h-10 !w-10 !min-h-10 !shrink-0 !items-center !justify-center rounded-lg bg-red-600 !p-0 !text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50 sm:!w-auto sm:!px-3"
            >
              <ControlContent
                icon="leave"
                label={leaving ? "Leaving..." : "Leave"}
              />
            </button>
          </div>

          {mediaError && (
            <div className="absolute bottom-[64px] left-3 right-3 z-50 rounded-lg border border-red-400/20 bg-red-950/90 px-3 py-2 text-xs text-red-200 shadow-lg">
              {mediaError}
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
  const [credentials, setCredentials] =
    useState<Credentials | null>(null);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (!removed) return;

    const timeout = window.setTimeout(() => {
      window.location.replace(`/sessions/${sessionId}`);
    }, 1600);

    return () => window.clearTimeout(timeout);
  }, [removed, sessionId]);

  useEffect(() => {
    const controller = new AbortController();

    async function connect() {
      try {
        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
          signal: controller.signal,
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to join conference."
          );
        }

        if (
          typeof data.serverUrl !== "string" ||
          typeof data.participantToken !== "string"
        ) {
          throw new Error("Invalid conference credentials.");
        }

        setCredentials({
          serverUrl: data.serverUrl,
          participantToken: data.participantToken,
        });
      } catch (err) {
        if (
          err instanceof Error &&
          err.name === "AbortError"
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

    return () => controller.abort();
  }, [sessionId]);

  if (removed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111111] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171717] p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-300">
            <span className="text-xl">×</span>
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
    <main className="flex h-dvh flex-col overflow-hidden bg-[#111111] text-white">
      <LiveKitRoom
        serverUrl={credentials.serverUrl}
        token={credentials.participantToken}
        connect={true}
        audio={false}
        video={false}
        onDisconnected={(reason) => {
          if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
            setRemoved(true);
          }
        }}
        onError={(liveKitError) =>
          setError(liveKitError.message)
        }
        data-lk-theme="default"
        style={{
          flex: "1 1 0%",
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ConferenceWorkspace
          sessionId={sessionId}
          title={title}
          canManageDocuments={canManageDocuments}
        />

        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}
