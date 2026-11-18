"use client";

import { useEffect, useState } from "react";
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
  useParticipants,
} from "@livekit/components-react";
import { DisconnectReason, Track } from "livekit-client";
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

function ConferenceWorkspace({
  sessionId,
  title,
  canManageDocuments,
}: Props) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [mediaError, setMediaError] = useState("");

  const isOrganizer =
    localParticipant.attributes?.role === "organizer";

  const remoteParticipants = participants.filter(
    (participant) => !participant.isLocal
  );

  const tracks = useTracks(
    [
      {
        source: Track.Source.Camera,
        withPlaceholder: true,
      },
      {
        source: Track.Source.ScreenShare,
        withPlaceholder: false,
      },
    ],
    {
      onlySubscribed: false,
    }
  );

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

    return () => {
      removeListeners();
    };
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

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(240px,0.9fr)] gap-2 p-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:grid-rows-1 lg:gap-3 lg:p-3">
        <section className="min-h-0 overflow-hidden rounded-xl border border-white/10 bg-[#171717]">
          <SynchronizedReader sessionId={sessionId} />
        </section>

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
            <div className="absolute inset-x-3 bottom-[80px] top-3 z-40 flex min-h-0 overflow-hidden rounded-xl border border-white/10 bg-[#202020] shadow-2xl">
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

          <div className="relative z-30 flex h-[68px] shrink-0 flex-nowrap items-center justify-start gap-2 overflow-x-auto border-t border-white/10 bg-[#171717] px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={true}
              onDeviceError={handleMediaError}
              onChange={() => setMediaError("")}
              className="!min-h-10 !shrink-0 !rounded-lg !px-3 !py-2"
            >
              Mic
            </TrackToggle>

            <TrackToggle
              source={Track.Source.Camera}
              showIcon={true}
              onDeviceError={handleMediaError}
              onChange={() => setMediaError("")}
              className="!min-h-10 !shrink-0 !rounded-lg !px-3 !py-2"
            >
              Camera
            </TrackToggle>

            <TrackToggle
              source={Track.Source.ScreenShare}
              captureOptions={{
                audio: true,
                selfBrowserSurface: "include",
              }}
              showIcon={true}
              onDeviceError={handleMediaError}
              onChange={() => setMediaError("")}
              className="!min-h-10 !shrink-0 !rounded-lg !px-3 !py-2"
            >
              Share screen
            </TrackToggle>

            {isOrganizer && (
              <button
                type="button"
                onClick={toggleParticipants}
                aria-pressed={participantsOpen}
                className={`lk-button min-h-10 shrink-0 rounded-lg px-3 py-2 ${
                  participantsOpen ? "bg-white/20" : ""
                }`}
              >
                Manage ({remoteParticipants.length})
              </button>
            )}

            <button
              type="button"
              onClick={toggleChat}
              aria-pressed={chatOpen}
              className={`lk-button min-h-10 shrink-0 rounded-lg px-3 py-2 ${
                chatOpen ? "bg-white/20" : ""
              }`}
            >
              Chat
            </button>

            <button
              type="button"
              onClick={leaveConference}
              disabled={leaving}
              className="min-h-10 shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
            >
              {leaving ? "Leaving..." : "Leave"}
            </button>
          </div>

          {mediaError && (
            <div className="absolute bottom-[68px] left-3 right-3 z-50 rounded-lg border border-red-400/20 bg-red-950/90 px-3 py-2 text-xs text-red-200 shadow-lg">
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
