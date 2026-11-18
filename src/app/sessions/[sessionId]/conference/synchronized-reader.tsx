"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

const PdfReader = dynamic(() => import("./pdf-reader"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-white/50">
      Loading PDF reader...
    </div>
  ),
});

type Props = {
  sessionId: string;
  onDocumentAvailabilityChange: (available: boolean) => void;
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
  document: ReaderDocument | null;
  readerState: {
    current_document_id?: string | null;
    current_page?: number;
    updated_at?: string | null;
  } | null;
};

// Signed URLs last six hours. Refresh with a safety margin,
// not every time the user returns from a browser picker.
const URL_REFRESH_INTERVAL = 5.5 * 60 * 60 * 1000;

const SynchronizedReader = memo(function SynchronizedReader({
  sessionId,
  onDocumentAvailabilityChange,
}: Props) {
  const [data, setData] = useState<ReaderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "synced" | "error"
  >("idle");

  const dataRef = useRef<ReaderData | null>(null);
  const pageRef = useRef(1);
  const lastSavedPage = useRef(1);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const documentGeneration = useRef(0);
  const loadRequestId = useRef(0);
  const lastUrlRefreshAt = useRef(0);

  const loadReaderState = useCallback(
    async (
      preserveLocalPage = false,
      refreshUrl = false
    ) => {
      const requestId = ++loadRequestId.current;

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
            result.error || "Unable to load the reader."
          );
        }

        if (requestId !== loadRequestId.current) {
          return;
        }

        const receivedData = result as ReaderData;
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

        // Keep the existing signed URL when the selected PDF has
        // not changed. A new URL is only needed during an expiry refresh.
        const effectiveDocument =
          receivedDocument &&
          previousDocument &&
          previousDocument.id === receivedDocument.id &&
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

        const serverPage =
          readerData.readerState?.current_page ?? 1;

        const keepLocalPage =
          preserveLocalPage &&
          !documentChanged &&
          pageRef.current !== lastSavedPage.current;

        const nextPage = keepLocalPage
          ? pageRef.current
          : serverPage;

        dataRef.current = readerData;
        pageRef.current = nextPage;
        lastSavedPage.current = serverPage;

        if (refreshUrl || lastUrlRefreshAt.current === 0) {
          lastUrlRefreshAt.current = Date.now();
        }

        onDocumentAvailabilityChange(
          Boolean(effectiveDocument)
        );

        setData(readerData);
        setCurrentPage(nextPage);
        setSyncStatus(
          keepLocalPage ? "syncing" : "synced"
        );
        setError("");
      } catch (err) {
        if (requestId !== loadRequestId.current) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the reader."
        );
      } finally {
        if (requestId === loadRequestId.current) {
          setLoading(false);
        }
      }
    },
    [sessionId, onDocumentAvailabilityChange]
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

    // A screen-share picker can cause visibility changes.
    // Do not reload the PDF for those ordinary changes.
    // Only refresh the signed URL if it is actually near expiry.
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

    const refreshInterval = window.setInterval(
      refreshUrlIfNeeded,
      60 * 1000
    );

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
          };

          const currentDocumentId =
            dataRef.current?.document?.id ?? null;

          if (
            newState.current_document_id !== currentDocumentId
          ) {
            void loadReaderState(false, false);
            return;
          }

          const remotePage = newState.current_page;

          if (
            typeof remotePage !== "number" ||
            !Number.isSafeInteger(remotePage) ||
            remotePage < 1
          ) {
            return;
          }

          // Do not overwrite a controller's unsaved local movement.
          if (pageRef.current !== lastSavedPage.current) {
            return;
          }

          pageRef.current = remotePage;
          lastSavedPage.current = remotePage;

          setCurrentPage(remotePage);
          setSyncStatus("synced");
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
      }

      documentGeneration.current += 1;
      loadRequestId.current += 1;

      void supabase.removeChannel(channel);
    };
  }, [sessionId, loadReaderState]);

  useEffect(() => {
    const documentId = data?.document?.id;

    if (!data?.canControl || !documentId) {
      return;
    }

    const pageToSave = currentPage;
    const generation = documentGeneration.current;

    pageRef.current = pageToSave;

    if (pageToSave === lastSavedPage.current) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      setSyncStatus("syncing");

      saveQueue.current = saveQueue.current
        .then(async () => {
          if (
            generation !== documentGeneration.current ||
            dataRef.current?.document?.id !== documentId
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

          if (generation !== documentGeneration.current) {
            return;
          }

          lastSavedPage.current = pageToSave;

          if (pageRef.current === pageToSave) {
            setSyncStatus("synced");
          }
        })
        .catch((err: unknown) => {
          if (generation !== documentGeneration.current) {
            return;
          }

          setSyncStatus("error");

          setError(
            err instanceof Error
              ? err.message
              : "Unable to synchronize the page."
          );
        });
    }, 350);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [
    currentPage,
    data?.canControl,
    data?.document?.id,
    sessionId,
  ]);

  const changePage = useCallback((page: number) => {
    if (!dataRef.current?.canControl) return;

    if (
      !Number.isSafeInteger(page) ||
      page < 1
    ) {
      return;
    }

    setError("");
    pageRef.current = page;
    setCurrentPage(page);
  }, []);

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
        <p className="text-sm text-red-300">{error}</p>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadReaderState();
          }}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
        >
          Retry
        </button>
      </section>
    );
  }

  // No PDF means no reader UI at all.
  if (!data?.document) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <p className="truncate text-xs text-white/60">
          {data.document.title}
        </p>

        <span className="shrink-0 text-xs text-white/40">
          {syncStatus === "syncing" && "Syncing..."}
          {syncStatus === "synced" && "Synchronized"}
          {syncStatus === "error" && "Sync failed"}
        </span>
      </div>

      {error && (
        <p className="shrink-0 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <PdfReader
          key={data.document.id}
          documentUrl={data.document.url}
          currentPage={currentPage}
          canControl={data.canControl}
          onPageChange={changePage}
        />
      </div>
    </div>
  );
});

export default SynchronizedReader;
