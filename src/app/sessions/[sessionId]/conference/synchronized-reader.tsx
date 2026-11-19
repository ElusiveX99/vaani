"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { createClient } from "@/lib/supabase/client";

const PdfReader = dynamic(
  () => import("./pdf-reader"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-white/50">
        Loading PDF reader...
      </div>
    ),
  }
);

type Props = {
  sessionId: string;
  onDocumentAvailabilityChange: (
    available: boolean
  ) => void;
};

type ReaderDocument = {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

type ReaderData = {
  canControl: boolean;
  canRequestControl: boolean;
  canReclaimControl: boolean;
  document: ReaderDocument | null;
  readerState: {
    current_document_id?: string | null;
    current_page?: number;
    current_offset?: number;
    controller_user_id?: string | null;
    controller_expires_at?: string | null;
    controller_epoch?: number;
    updated_at?: string | null;
  } | null;
};

type SyncStatus =
  | "idle"
  | "local"
  | "syncing"
  | "synced"
  | "error";

const URL_REFRESH_INTERVAL =
  5.5 * 60 * 60 * 1000;

const PAGE_SAVE_DELAY = 300;

const SynchronizedReader = memo(
  function SynchronizedReader({
    sessionId,
    onDocumentAvailabilityChange,
  }: Props) {
    const [data, setData] =
      useState<ReaderData | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [currentOffset, setCurrentOffset] = useState(0);
    const [controlMessage, setControlMessage] = useState("");

    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();

    const [syncStatus, setSyncStatus] =
      useState<SyncStatus>("idle");

    const dataRef = useRef<ReaderData | null>(null);

    const pageRef = useRef(1);
    const offsetRef = useRef(0);
    const lastSavedPage = useRef(1);
    const lastSavedOffset = useRef(0);
    const controllerUserIdRef = useRef<string | null>(null);
    const controllerEpochRef = useRef(0);
    const lastBroadcastAt = useRef(0);
    const broadcastSequence = useRef(0);
    const lastRemoteSequence = useRef(0);
    const claimInFlight = useRef(false);

    const saveTimer =
      useRef<ReturnType<typeof setTimeout> | null>(
        null
      );

    const saveQueue = useRef<Promise<void>>(
      Promise.resolve()
    );

    const documentGeneration = useRef(0);
    const loadRequestId = useRef(0);
    const lastUrlRefreshAt = useRef(0);

    const loadReaderState = useCallback(
      async (
        preserveLocalPage = false,
        refreshUrl = false
      ) => {
        const requestId =
          ++loadRequestId.current;

        try {
          const response = await fetch(
            `/api/sessions/${sessionId}/reader`,
            {
              cache: "no-store",
              credentials: "same-origin",
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.error ||
                "Unable to load the reader."
            );
          }

          if (
            requestId !== loadRequestId.current
          ) {
            return;
          }

          const receivedData =
            result as ReaderData;

          const previousData = dataRef.current;

          const previousDocument =
            previousData?.document ?? null;

          const receivedDocument =
            receivedData.document ?? null;

          const previousDocumentId =
            previousDocument?.id ?? null;

          const nextDocumentId =
            receivedDocument?.id ?? null;

          const documentChanged =
            previousDocumentId !== nextDocumentId;

          if (documentChanged) {
            documentGeneration.current += 1;

            if (saveTimer.current) {
              clearTimeout(saveTimer.current);
              saveTimer.current = null;
            }
          }

          const effectiveDocument =
            receivedDocument &&
            previousDocument &&
            previousDocument.id ===
              receivedDocument.id &&
            !refreshUrl
              ? {
                  ...receivedDocument,
                  url: previousDocument.url,
                }
              : receivedDocument;

          const readerData: ReaderData = {
            ...receivedData,
            document: effectiveDocument,
          };

          const rawServerPage =
            readerData.readerState?.current_page;

          const serverPage =
            typeof rawServerPage === "number" &&
            Number.isSafeInteger(rawServerPage) &&
            rawServerPage >= 1
              ? rawServerPage
              : 1;

          const rawServerOffset =
            readerData.readerState?.current_offset;

          const serverOffset =
            typeof rawServerOffset === "number" &&
            Number.isFinite(rawServerOffset)
              ? Math.min(1, Math.max(0, rawServerOffset))
              : 0;

          const keepLocalPage =
            preserveLocalPage &&
            !documentChanged &&
            (pageRef.current !== lastSavedPage.current ||
              offsetRef.current !== lastSavedOffset.current);

          const nextPage = keepLocalPage
            ? pageRef.current
            : serverPage;

          const nextOffset = keepLocalPage
            ? offsetRef.current
            : serverOffset;

          const controllerId =
            readerData.readerState?.controller_user_id ?? null;
          const controllerEpoch =
            readerData.readerState?.controller_epoch ?? 0;

          if (controllerEpochRef.current !== controllerEpoch) {
            lastRemoteSequence.current = 0;
          }
          controllerUserIdRef.current = controllerId;
          controllerEpochRef.current = controllerEpoch;
          dataRef.current = readerData;
          pageRef.current = nextPage;
          offsetRef.current = nextOffset;
          lastSavedPage.current = serverPage;
          lastSavedOffset.current = serverOffset;

          if (
            refreshUrl ||
            lastUrlRefreshAt.current === 0
          ) {
            lastUrlRefreshAt.current = Date.now();
          }

          onDocumentAvailabilityChange(
            Boolean(effectiveDocument)
          );

          setData(readerData);
          setCurrentPage(nextPage);
          setCurrentOffset(nextOffset);

          setSyncStatus(
            keepLocalPage
              ? readerData.canControl
                ? "syncing"
                : "local"
              : "synced"
          );

          setError("");
        } catch (err) {
          if (
            requestId !== loadRequestId.current
          ) {
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the reader."
          );
        } finally {
          if (
            requestId === loadRequestId.current
          ) {
            setLoading(false);
          }
        }
      },
      [
        sessionId,
        onDocumentAvailabilityChange,
      ]
    );

    useEffect(() => {
      let active = true;

      const supabase = createClient();

      void loadReaderState();

      const handleReaderRefresh = () => {
        if (active) {
          void loadReaderState(false, false);
        }
      };

      const refreshUrlIfNeeded = () => {
        if (
          !active ||
          document.visibilityState !== "visible" ||
          Date.now() - lastUrlRefreshAt.current <
            URL_REFRESH_INTERVAL
        ) {
          return;
        }

        void loadReaderState(true, true);
      };

      window.addEventListener(
        "vaani:reader-refresh",
        handleReaderRefresh
      );

      document.addEventListener(
        "visibilitychange",
        refreshUrlIfNeeded
      );

      const refreshInterval =
        window.setInterval(
          refreshUrlIfNeeded,
          60 * 1000
        );

      const membershipChannel = supabase
        .channel(`reader-membership-${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_members",
            filter: `session_id=eq.${sessionId}`,
          },
          () => {
            if (active) void loadReaderState(true, false);
          }
        )
        .subscribe();

      const channel = supabase
        .channel(`reader-state-${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "session_reader_state",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            if (!active) return;

            const newState = payload.new as {
              current_document_id?: string | null;
              current_page?: number;
              current_offset?: number;
              controller_user_id?: string | null;
              controller_expires_at?: string | null;
              controller_epoch?: number;
              updated_at?: string | null;
            };

            const currentDocumentId =
              dataRef.current?.document?.id ?? null;

            if (
              newState.current_document_id !==
              currentDocumentId
            ) {
              void loadReaderState(false, false);
              return;
            }

            const remotePage =
              newState.current_page;

            if (
              typeof remotePage !== "number" ||
              !Number.isSafeInteger(remotePage) ||
              remotePage < 1
            ) {
              return;
            }

            const remoteOffset =
              typeof newState.current_offset === "number"
                ? Math.min(1, Math.max(0, newState.current_offset))
                : 0;

            const controllerId = newState.controller_user_id ?? null;
            const controllerEpoch = newState.controller_epoch ?? 0;
            const controllerChanged =
              controllerId !== controllerUserIdRef.current ||
              controllerEpoch !== controllerEpochRef.current;

            const controllerHasPendingChange =
              !controllerChanged &&
              dataRef.current?.canControl === true &&
              (pageRef.current !== lastSavedPage.current ||
                offsetRef.current !== lastSavedOffset.current);

            if (controllerHasPendingChange) return;

            if (controllerEpochRef.current !== controllerEpoch) {
              lastRemoteSequence.current = 0;
            }
            const leaseActive =
              Boolean(newState.controller_expires_at) &&
              new Date(newState.controller_expires_at as string).getTime() > Date.now();

            const nextData = dataRef.current
              ? {
                  ...dataRef.current,
                  canControl:
                    controllerId === localParticipant.identity && leaseActive,
                  readerState: {
                    ...dataRef.current.readerState,
                    ...newState,
                  },
                }
              : null;

            controllerUserIdRef.current = controllerId;
            controllerEpochRef.current = controllerEpoch;

            if (nextData) {
              dataRef.current = nextData;
              setData(nextData);
            }

            pageRef.current = remotePage;
            offsetRef.current = remoteOffset;
            lastSavedPage.current = remotePage;
            lastSavedOffset.current = remoteOffset;

            setCurrentPage(remotePage);
            setCurrentOffset(remoteOffset);
            setSyncStatus("synced");
            setError("");
          }
        )
        .subscribe();

      return () => {
        active = false;

        window.removeEventListener(
          "vaani:reader-refresh",
          handleReaderRefresh
        );

        document.removeEventListener(
          "visibilitychange",
          refreshUrlIfNeeded
        );

        window.clearInterval(refreshInterval);

        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }

        documentGeneration.current += 1;
        loadRequestId.current += 1;

        void supabase.removeChannel(channel);
        void supabase.removeChannel(membershipChannel);
      };
    }, [sessionId, loadReaderState]);

    // Persist only the active reader controller's position.
    useEffect(() => {
      const documentId = data?.document?.id;

      if (!data?.canControl || !documentId) {
        return;
      }

      const pageToSave = currentPage;
      const offsetToSave = currentOffset;
      const controllerEpoch = controllerEpochRef.current;
      const generation =
        documentGeneration.current;

      pageRef.current = pageToSave;

      if (
        pageToSave === lastSavedPage.current &&
        offsetToSave === lastSavedOffset.current
      ) {
        return;
      }

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }

      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;

        setSyncStatus("syncing");

        saveQueue.current = saveQueue.current
          .catch(() => {})
          .then(async () => {
            if (
              generation !==
                documentGeneration.current ||
              dataRef.current?.document?.id !==
                documentId
            ) {
              return;
            }

            const response = await fetch(
              `/api/sessions/${sessionId}/reader`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "same-origin",
                cache: "no-store",
                body: JSON.stringify({
                  documentId,
                  expectedDocumentId: documentId,
                  currentPage: pageToSave,
                  currentOffset: offsetToSave,
                  controllerEpoch,
                }),
              }
            );

            const result = await response.json();

            if (!response.ok) {
              throw new Error(
                result.error ||
                  "Unable to synchronize the page."
              );
            }

            if (
              generation !==
              documentGeneration.current
            ) {
              return;
            }

            lastSavedPage.current = pageToSave;
            lastSavedOffset.current = offsetToSave;

            if (
              pageRef.current === pageToSave &&
              offsetRef.current === offsetToSave
            ) {
              setSyncStatus("synced");
              setError("");
            }
          })
          .catch((err: unknown) => {
            if (
              generation !==
              documentGeneration.current
            ) {
              return;
            }

            setSyncStatus("error");

            setError(
              err instanceof Error
                ? err.message
                : "Unable to synchronize the page."
            );
          });
      }, PAGE_SAVE_DELAY);

      return () => {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
      };
    }, [
      currentPage,
      currentOffset,
      data?.canControl,
      data?.document?.id,
      sessionId,
    ]);

    // Everyone updates their local reading position.
    // Only the controller's position is saved remotely.
    const changePosition = useCallback(
      (page: number, offset: number) => {
        if (!dataRef.current) return;
        if (!Number.isSafeInteger(page) || page < 1) return;

        const safeOffset = Math.min(1, Math.max(0, offset));
        pageRef.current = page;
        offsetRef.current = safeOffset;
        setCurrentPage(page);
        setCurrentOffset(safeOffset);
        setError("");

        if (dataRef.current.canControl) {
          const now = Date.now();
          if (now - lastBroadcastAt.current >= 50) {
            lastBroadcastAt.current = now;
            const documentId = dataRef.current.document?.id;
            if (documentId) {
              const packet = {
                type: "vaani-reader-position",
                sessionId,
                documentId,
                senderId: localParticipant.identity,
                epoch: controllerEpochRef.current,
                sequence: Date.now() * 1000 + (++broadcastSequence.current % 1000),
                page,
                offset: safeOffset,
              };

              void room.localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify(packet)),
                { reliable: false, topic: "vaani-reader-position" }
              ).catch((publishError) => {
                console.error("Reader position broadcast failed:", publishError);
              });
            }
          }
        }

        setSyncStatus(dataRef.current.canControl ? "syncing" : "local");
      },
      [room, sessionId, localParticipant.identity]
    );

    const changePage = useCallback(
      (page: number) => changePosition(page, offsetRef.current),
      [changePosition]
    );

    const claimReaderControl = useCallback(async () => {
      if (claimInFlight.current) return;
      claimInFlight.current = true;
      setControlMessage("");

      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/reader/control`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({ action: "claim" }),
          }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to claim reader control.");
        }

        if (!result.granted) {
          setControlMessage("Another assigned member currently controls the shared reader.");
          return;
        }

        setControlMessage("You now control the shared reader.");
        await loadReaderState(true, false);
      } catch (err) {
        setControlMessage(
          err instanceof Error ? err.message : "Unable to claim reader control."
        );
      } finally {
        claimInFlight.current = false;
      }
    }, [sessionId, loadReaderState]);

    // Automatically acquire an unclaimed or expired reader.
    useEffect(() => {
      if (!data?.canRequestControl || data.canControl) return;

      const controllerId = data.readerState?.controller_user_id ?? null;
      const expiry = data.readerState?.controller_expires_at
        ? new Date(data.readerState.controller_expires_at).getTime()
        : 0;

      if (!controllerId || expiry <= Date.now()) {
        void claimReaderControl();
      }
    }, [
      data?.canRequestControl,
      data?.canControl,
      data?.readerState?.controller_user_id,
      data?.readerState?.controller_expires_at,
      claimReaderControl,
    ]);

    // Renew the controller lease before it expires. If the lease was
    // lost, reload the authoritative state instead of continuing to publish.
    useEffect(() => {
      if (!data?.canControl) return;

      const renew = async () => {
        try {
          const response = await fetch(
            `/api/sessions/${sessionId}/reader/control`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              cache: "no-store",
              body: JSON.stringify({ action: "claim" }),
            }
          );
          const result = await response.json();

          if (!response.ok || !result.granted) {
            await loadReaderState(true, false);
            return;
          }

          const nextData = dataRef.current;
          if (!nextData) return;

          const nextReaderState = {
            ...nextData.readerState,
            controller_user_id: result.active_controller_id,
            controller_expires_at: result.lease_expires_at,
            controller_epoch: result.epoch,
          };

          const updated = { ...nextData, readerState: nextReaderState };
          dataRef.current = updated;
          controllerUserIdRef.current = result.active_controller_id;
          controllerEpochRef.current = result.epoch;
          setData(updated);
        } catch {
          // A later heartbeat or Realtime state update will reconcile the lease.
        }
      };

      const timer = window.setInterval(() => void renew(), 7000);
      return () => window.clearInterval(timer);
    }, [data?.canControl, sessionId, loadReaderState]);

    // Release cleanly on unmount; an interrupted connection is recovered
    // automatically when the short lease expires.
    useEffect(() => {
      if (!data?.canControl) return;
      return () => {
        void fetch(`/api/sessions/${sessionId}/reader/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          keepalive: true,
          body: JSON.stringify({ action: "release" }),
        }).catch(() => {});
      };
    }, [data?.canControl, sessionId]);

    // Apply high-frequency LiveKit positions from the current controller.
    useEffect(() => {
      const handleData = (
        payload: Uint8Array,
        _participant?: unknown,
        _kind?: unknown,
        topic?: string
      ) => {
        if (topic !== "vaani-reader-position" || dataRef.current?.canControl) return;

        const leaseExpiry = dataRef.current?.readerState?.controller_expires_at;
        if (
          !leaseExpiry ||
          new Date(leaseExpiry).getTime() <= Date.now()
        ) return;

        try {
          const packet = JSON.parse(new TextDecoder().decode(payload)) as {
            type?: string;
            sessionId?: string;
            documentId?: string;
            senderId?: string;
            epoch?: number;
            sequence?: number;
            page?: number;
            offset?: number;
          };

          if (
            packet.type !== "vaani-reader-position" ||
            packet.sessionId !== sessionId ||
            packet.documentId !== dataRef.current?.document?.id ||
            packet.senderId !== controllerUserIdRef.current ||
            packet.epoch !== controllerEpochRef.current ||
            typeof packet.sequence !== "number" ||
            packet.sequence <= lastRemoteSequence.current ||
            !Number.isSafeInteger(packet.page) ||
            typeof packet.page !== "number" ||
            packet.page < 1 ||
            typeof packet.offset !== "number" ||
            !Number.isFinite(packet.offset)
          ) return;

          const offset = Math.min(1, Math.max(0, packet.offset));
          lastRemoteSequence.current = packet.sequence;
          pageRef.current = packet.page;
          offsetRef.current = offset;
          setCurrentPage(packet.page);
          setCurrentOffset(offset);
          setSyncStatus("synced");
        } catch {
          // Ignore malformed or stale data packets.
        }
      };

      room.on(RoomEvent.DataReceived, handleData);
      return () => {
        room.off(RoomEvent.DataReceived, handleData);
      };
    }, [room, sessionId]);

    if (loading) {
      return (
        <section className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-[#1b1b1b] text-sm text-white/50">
          Loading Vaani Reader...
        </section>
      );
    }

    if (error && !data) {
      return (
        <section className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] p-6 text-center text-white">
          <p className="text-sm text-red-300">
            {error}
          </p>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              void loadReaderState();
            }}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          >
            Retry
          </button>
        </section>
      );
    }

    if (!data?.document) {
      return null;
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between gap-2 px-1">
          <p className="truncate text-xs text-white/60">
            {data.document.title}
          </p>

          <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-white/40">
            {syncStatus === "syncing" &&
              "Syncing..."}
            {syncStatus === "synced" &&
              "Synchronized"}
            {syncStatus === "local" &&
              "Local reading position"}
            {syncStatus === "error" &&
              "Sync failed"}
          </span>
          {data.canRequestControl && !data.canControl && (
            <button
              type="button"
              onClick={() => void claimReaderControl()}
              className="shrink-0 rounded-md bg-white/10 px-2.5 py-1.5 text-[10px] font-medium text-white/80 hover:bg-white/20"
            >
              {data.canReclaimControl
                ? "Take control"
                : "Request control"}
            </button>
          )}
          </div>
        </div>

        {controlMessage && (
          <p className="shrink-0 text-xs text-white/55" role="status">
            {controlMessage}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="shrink-0 text-xs text-red-300"
          >
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1">
          <PdfReader
            key={data.document.id}
            documentUrl={data.document.url}
            currentPage={currentPage}
            currentOffset={currentOffset}
            canControl={data.canControl}
            onPageChange={changePage}
            onPositionChange={changePosition}
          />
        </div>
      </div>
    );
  }
);

export default SynchronizedReader;
