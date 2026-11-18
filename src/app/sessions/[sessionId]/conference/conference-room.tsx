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
} from "@livekit/components-react";
import { Track } from "livekit-client";
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

  const [chatOpen, setChatOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Handle browser autoplay restrictions without displaying
  // a separate Enable audio button.
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
          .catch(() => {
            // Browser autoplay restrictions may require
            // another user interaction.
          })
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

    // First attempt: works automatically when the browser
    // already permits audio playback.
    attemptAudioUnlock();

    // Fallback: retry on the user's first interaction.
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#171717] px-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-white">
            {title}
          </h1>

          <p className="text-xs text-white/50">
            Vaani Conference
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
              className="h-full w-full"
            >
              <ParticipantTile />
            </GridLayout>
          </div>

          {chatOpen && (
            <div className="absolute inset-x-3 bottom-[76px] top-3 z-40 overflow-hidden rounded-xl border border-white/10 bg-[#202020] shadow-2xl">
              <Chat />
            </div>
          )}

          <ModerationPanel sessionId={sessionId} />

          <div className="relative z-30 flex min-h-[68px] shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-[#171717] px-3 py-3">
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={true}
              className="!min-h-10 !rounded-lg !px-3 !py-2"
            >
              Mic
            </TrackToggle>

            <TrackToggle
              source={Track.Source.Camera}
              showIcon={true}
              className="!min-h-10 !rounded-lg !px-3 !py-2"
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
              className="!min-h-10 !rounded-lg !px-3 !py-2"
            >
              Share screen
            </TrackToggle>

            <button
              type="button"
              onClick={() => setChatOpen((current) => !current)}
              aria-pressed={chatOpen}
              className={`lk-button min-h-10 rounded-lg px-3 py-2 ${
                chatOpen ? "bg-white/20" : ""
              }`}
            >
              Chat
            </button>

            <button
              type="button"
              onClick={leaveConference}
              disabled={leaving}
              className="min-h-10 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
            >
              {leaving ? "Leaving..." : "Leave"}
            </button>
          </div>
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
