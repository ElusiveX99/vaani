"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#171717] px-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">
            {title}
          </h1>

          <p className="text-xs text-white/50">
            Vaani Conference
          </p>
        </div>

        <Link
          href={`/sessions/${sessionId}`}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10"
        >
          Leave conference
        </Link>
      </header>

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
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#171717] px-4 py-2">
            <span className="text-xs font-medium text-white/70">
              Session workspace
            </span>

            <PdfUploader
              sessionId={sessionId}
              canManage={canManageDocuments}
            />
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(220px,0.8fr)] gap-2 overflow-hidden p-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:grid-rows-1 lg:gap-3 lg:p-3">
            <section className="min-h-0 overflow-hidden rounded-xl border border-white/10 bg-[#171717]">
              <SynchronizedReader sessionId={sessionId} />
            </section>

            <section className="relative min-h-0 overflow-hidden rounded-xl border border-white/10 bg-[#171717]">
              <VideoConference />
              <ModerationPanel sessionId={sessionId} />
            </section>
          </div>
        </div>

        <RoomAudioRenderer />
      </LiveKitRoom>
    </main>
  );
}
