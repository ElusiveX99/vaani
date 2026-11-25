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
import DocumentLibrary from "./document-library";
import ModerationPanel from "./moderation-panel";
import PersistentChat from "./persistent-chat";
import SynchronizedReader from "./synchronized-reader";
import ConferenceRealtimeProvider, { useConferenceRealtime } from "./conference-realtime-provider";
import { createClient } from "@/lib/supabase/client";
import ProfileAvatar from "@/components/profile-avatar";
import { getLiveKitUserId } from "@/lib/livekit/identity";

type Props = {
  sessionId: string;
  title: string;
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
      return "Microphone access is blocked. Allow microphone access for Vaani in your browser's site settings, then return and try again.";
    }

    if (action === "camera") {
      return "Camera access is blocked. Allow camera access for Vaani in your browser's site settings, then return and try again.";
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
  onMembershipRevoked,
}: Pick<Props, "sessionId" | "title"> & { onMembershipRevoked: () => void }) {
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
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
      ],
    });

  const [chatOpen, setChatOpen] =
    useState(false);

  const [workspaceOpen, setWorkspaceOpen] =
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

  const localUserId = getLiveKitUserId(localParticipant);
  const [membershipRole, setMembershipRole] = useState("participant");
  const [membershipCanControlReader, setMembershipCanControlReader] = useState(false);
  const [connectionState, setConnectionState] = useState(room.state);
  const [, setAudioStateVersion] = useState(0);

  const updateConnectionState = useCallback(() => {
    setConnectionState(room.state);
  }, [room]);

  const { event: realtimeEvent, status: realtimeStatus } = useConferenceRealtime();

  useEffect(() => {
    if (!localUserId) return;

    let active = true;
    const supabase = createClient();
    const refreshRole = async () => {
      const { data, error } = await supabase
        .from("session_members")
        .select("role, status, can_control_reader")
        .eq("session_id", sessionId)
        .eq("user_id", localUserId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error("Conference permission refresh failed:", error);
        setMembershipRole("participant");
        setMembershipCanControlReader(false);
        return;
      }
      const accepted = data?.status === "accepted";
      if (!accepted) {
        setMembershipRole("participant");
        setMembershipCanControlReader(false);
        room.disconnect();
        onMembershipRevoked();
        return;
      }
      setMembershipRole(data.role);
      setMembershipCanControlReader(
        data.role === "organizer" ||
        data.role === "in_charge" ||
        (data.role === "admin" && data.can_control_reader === true)
      );
    };

    void refreshRole();
    return () => { active = false; };
  }, [sessionId, localUserId, room, onMembershipRevoked, realtimeStatus]);

  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.sessionId !== sessionId) return;
    if (realtimeEvent.table === "session_members") {
      // Membership changes affect authorization; refresh only this user's
      // membership record, never on unrelated chat/PDF/notification events.
      const changedUserId =
        String(realtimeEvent.new.user_id ?? realtimeEvent.old.user_id ?? "");
      if (!changedUserId || changedUserId === localUserId) {
        const supabase = createClient();
        void supabase
          .from("session_members")
          .select("role, status, can_control_reader")
          .eq("session_id", sessionId)
          .eq("user_id", localUserId)
          .maybeSingle()
          .then(({ data, error }: { data: { role: string; status: string; can_control_reader: boolean | null } | null; error: unknown }) => {
            if (error) {
              console.error("Conference membership update failed:", error);
              return;
            }
            if (data?.status !== "accepted") {
              room.disconnect();
              onMembershipRevoked();
              return;
            }
            setMembershipRole(data.role);
            setMembershipCanControlReader(
              data.role === "organizer" ||
              data.role === "in_charge" ||
              (data.role === "admin" && data.can_control_reader === true)
            );
          });
      }
    }
  }, [realtimeEvent, sessionId, localUserId, room, onMembershipRevoked]);
  const isOrganizer = membershipRole === "organizer";
  const canManageParticipants =
    isOrganizer ||
    membershipRole === "in_charge" ||
    membershipRole === "admin";
  const canManageDocuments = canManageParticipants;
  const canControlReader = membershipCanControlReader;

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

  const participantUserKey = [...new Set([localParticipant, ...remoteParticipants]
    .map((participant) => getLiveKitUserId(participant))
    .filter((id): id is string => Boolean(id)))].sort().join("|");
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, { displayName: string; avatarUrl: string | null }>>({});
  useEffect(() => {
    let active = true;
    const ids = participantUserKey ? participantUserKey.split("|") : [];
    if (ids.length === 0) return;
    const supabase = createClient();
    void supabase.from("profiles")
      .select("id, display_name, avatar_url, avatar_path")
      .in("id", ids)
      .then(({ data, error }: { data: Array<{ id: string; display_name: string | null; avatar_url: string | null; avatar_path: string | null }> | null; error: unknown }) => {
      if (!active) return;
      if (error) { console.error("Conference participant profiles could not be loaded:", error); return; }
      const next: Record<string, { displayName: string; avatarUrl: string | null }> = {};
      for (const profile of data ?? []) {
        const avatarUrl = profile.avatar_url || (profile.avatar_path
          ? profile.avatar_path.startsWith("http")
            ? profile.avatar_path
            : supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl
          : null);
        if (profile.display_name?.trim()) next[profile.id] = { displayName: profile.display_name.trim(), avatarUrl };
      }
      setParticipantProfiles(next);
    });
    return () => { active = false; };
  }, [sessionId, participantUserKey]);


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
    <div className="conference-shell flex min-h-0 flex-1 flex-col">
      <header className="conference-toolbar flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-white">
            {title}
          </h1>

          <p className="text-xs text-white/50" role="status" aria-live="polite">
            {remoteParticipants.length + 1} participant{remoteParticipants.length === 0 ? "" : "s"} connected
            {connectionState !== "connected" && <span className="ml-2">{connectionState === "reconnecting" ? "· Reconnecting…" : connectionState === "disconnected" ? "· Connection lost" : "· Connecting…"}</span>}
          </p>
        </div>

          {canManageDocuments && (
            <button
              type="button"
              onClick={() => setWorkspaceOpen((open) => !open)}
              aria-expanded={workspaceOpen}
              aria-controls="conference-workspace-panel"
              className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--conference-line)] bg-white/[0.06] px-3 text-xs font-medium text-white/85 transition hover:bg-white/10"
            >
              <span>Workspace</span>
              <span className="text-white/45">{workspaceOpen ? "Close" : "PDFs"}</span>
            </button>
          )}
        </div>
      </header>

      {workspaceOpen && canManageDocuments && (
        <div
          id="conference-workspace-panel"
          className="absolute right-3 top-[4.5rem] z-50 flex max-h-[min(72svh,38rem)] w-[min(94vw,30rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--conference-line)] bg-[#302a34] p-3 shadow-2xl"
        >
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-white">Session workspace</p>
            <button
              type="button"
              onClick={() => setWorkspaceOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-white/55 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>
          <DocumentLibrary sessionId={sessionId} canControlReader={canControlReader} />
          <PdfUploader sessionId={sessionId} canManage={canManageDocuments} />
        </div>
      )}

      <main
        className={`grid min-h-0 flex-1 gap-2 p-2 lg:gap-3 lg:p-3 ${
          readerAvailable
            ? chatOpen
              ? "grid-cols-1 grid-rows-1 lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)]"
              : "grid-cols-1 grid-rows-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)]"
            : "grid-cols-1 grid-rows-1"
        }`}
      >
        {readerAvailable && (
          <section className={`min-h-0 min-w-0 overflow-hidden rounded-xl border border-[var(--conference-line)] bg-[#211d24] ${chatOpen ? "hidden lg:block" : ""}`}>
            <SynchronizedReader
              sessionId={sessionId}
              onDocumentAvailabilityChange={handleDocumentAvailabilityChange}
            />
          </section>
        )}

        <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--conference-line)] bg-[#211d24]">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="vaani-participant-grid">
              {tracks.map((trackRef) => {
                const participant = trackRef.participant;
                const cameraOff =
                  trackRef.source === Track.Source.Camera &&
                  (!trackRef.publication ||
                    trackRef.publication.isMuted ||
                    !trackRef.publication.track);
                const participantUserId = getLiveKitUserId(participant);
                const profile = participantUserId ? participantProfiles[participantUserId] : undefined;
                const participantName = profile?.displayName || participant.name || "Sakhi";
                const participantAvatar = profile?.avatarUrl || participant.attributes?.avatar_url || null;

                return (
                  <div
                    key={`${participant.identity}-${trackRef.source}`}
                    className={trackRef.source === Track.Source.Camera && participant.isSpeaking ? "vaani-participant-tile relative min-w-0 overflow-hidden rounded-xl bg-[#392f3b] border-2 border-sky-400 shadow-[0_0_0_2px_rgba(56,189,248,0.22),0_0_18px_rgba(56,189,248,0.28)] transition-[border-color,box-shadow] duration-150" : "vaani-participant-tile relative min-w-0 overflow-hidden rounded-xl bg-[#392f3b] border-2 border-transparent transition-[border-color,box-shadow] duration-150"}
                  >
                    <ParticipantTile trackRef={trackRef} />
                    {trackRef.source === Track.Source.Camera && (
                      <div className="absolute bottom-2 right-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white shadow-lg" title={participant.isMicrophoneEnabled ? "Microphone enabled" : "Microphone disabled"} aria-label={participant.isMicrophoneEnabled ? "Microphone enabled" : "Microphone disabled"}>
                        {participant.isMicrophoneEnabled ? <ControlIcon name="mic" /> : <ControlIcon name="mic" off />}
                      </div>
                    )}
                    {cameraOff && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#392f3b] p-2">
                        <ProfileAvatar
                          name={participantName}
                          avatarUrl={participantAvatar}
                          size="xl"
                        />
                        <span className="max-w-[90%] truncate text-xs font-medium text-white/85 sm:text-sm">
                          {participantName}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <PersistentChat
            sessionId={sessionId}
            open={chatOpen}
            onUnreadChange={setChatUnreadCount}
          />

          {participantsOpen && canManageParticipants && (
            <ModerationPanel
              sessionId={sessionId}
              open={participantsOpen}
              localRole={membershipRole}
              onClose={() => setParticipantsOpen(false)}
            />
          )}
        </section>
      </main>

          <div className="relative z-30 flex h-16 shrink-0 items-center justify-center gap-1.5 border-t border-[var(--conference-line)] bg-[#211d24] px-2 sm:gap-2">
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
              activeClassName="bg-[var(--conference-accent)] text-white hover:brightness-110"
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

            {canManageParticipants && (
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
              className={`conference-control relative flex h-9 min-h-9 w-9 shrink-0 items-center justify-center rounded-lg px-0 text-xs transition hover:bg-white/20 sm:h-10 sm:w-auto sm:px-3 ${
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
              className="flex h-9 min-h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#a84f59] px-0 text-xs font-semibold text-white transition hover:bg-[#b75b65] disabled:opacity-50 sm:h-10 sm:w-auto sm:px-3"
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
              className="absolute bottom-[76px] left-2 right-2 z-50 flex items-start gap-3 rounded-lg border border-white/10 bg-[#211d24]/95 px-3 py-3 text-xs leading-relaxed text-white/80 shadow-xl sm:left-4 sm:right-4"
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
                className="shrink-0 rounded px-1 text-base leading-none text-white/45 hover:bg-white/10"
              >
                ×
              </button>
            </div>
          )}
      </div>
    );
}

export default function ConferenceRoom({
  sessionId,
  title,
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

  const handleMembershipRevoked = useCallback(() => setRemoved(true), []);

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
      <main className="flex min-h-screen items-center justify-center bg-[var(--conference-bg)] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-[var(--conference-line)] bg-[#211d24] p-6 text-center shadow-2xl">
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
      <ConferenceRealtimeProvider sessionId={sessionId}>
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
          sessionId={sessionId}
          title={title}
          onMembershipRevoked={handleMembershipRevoked}
        />

        <RoomAudioRenderer />
      </LiveKitRoom>
      </ConferenceRealtimeProvider>
    </main>
  );
}
