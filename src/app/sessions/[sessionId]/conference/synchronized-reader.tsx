"use client";

import {
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
};

type ReaderData = {
  canControl: boolean;
  document: {
    id: string;
    title: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  } | null;
  readerState: {
    current_document_id?: string | null;
    documentId?: string | null;
    current_page?: number;
    currentPage?: number;
    updated_at?: string | null;
    updatedAt?: string | null;
  } | null;
};

export default function SynchronizedReader({ sessionId }: Props) {
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const loadReaderState = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/reader`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load the reader.");
      }

      const readerData = result as ReaderData;
      const page =
        readerData.readerState?.current_page ??
        readerData.readerState?.currentPage ??
        1;

      dataRef.current = readerData;
      lastSavedPage.current = page;
      pageRef.current = page;

      setData(readerData);
      setCurrentPage(page);
      setSyncStatus("synced");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the reader."
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void loadReaderState();

    const handleReaderRefresh = () => {
      if (active) void loadReaderState();
    };

    window.addEventListener(
      "vaani:reader-refresh",
      handleReaderRefresh
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
            void loadReaderState();
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

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [sessionId, loadReaderState]);

  useEffect(() => {
    if (!data?.canControl || !data.document) return;

    const pageToSave = currentPage;
    pageRef.current = pageToSave;

    if (pageToSave === lastSavedPage.current) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      setSyncStatus("syncing");

      saveQueue.current = saveQueue.current
        .then(async () => {
          const response = await fetch(
            `/api/sessions/${sessionId}/reader`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                documentId: data.document!.id,
                currentPage: pageToSave,
              }),
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.error || "Unable to synchronize the page."
            );
          }

          lastSavedPage.current = pageToSave;

          if (pageRef.current === pageToSave) {
            setSyncStatus("synced");
          }
        })
        .catch((err: unknown) => {
          setSyncStatus("error");
          setError(
            err instanceof Error
              ? err.message
              : "Unable to synchronize the page."
          );
        });
    }, 500);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [currentPage, data, sessionId]);

  const changePage = useCallback((page: number) => {
    if (!dataRef.current?.canControl) return;
    if (!Number.isSafeInteger(page) || page < 1) return;

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

  if (!data?.document) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-xl border border-white/10 bg-[#1b1b1b] p-6 text-center text-white">
        <h2 className="text-lg font-semibold">Vaani Reader</h2>
        <p className="mt-2 text-sm text-white/50">
          No document is currently selected.
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-300">{error}</p>
        )}
      </section>
    );
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
        <p className="shrink-0 text-xs text-red-300">{error}</p>
      )}

      <div className="min-h-0 flex-1">
        <PdfReader
          documentUrl={data.document.url}
          documentSizeBytes={data.document.sizeBytes}
          currentPage={currentPage}
          canControl={data.canControl}
          onPageChange={changePage}
        />
      </div>
    </div>
  );
}
