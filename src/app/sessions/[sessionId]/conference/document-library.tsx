"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConferenceRealtime } from "./conference-realtime-provider";
import InlineFeedback from "@/components/inline-feedback";
import { useVaaniDialog } from "@/components/interaction-provider";

type DocumentItem = {
  id: string;
  title: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string;
  display_order: number;
};

type Props = {
  sessionId: string;
  canControlReader: boolean;
};

export default function DocumentLibrary({ sessionId, canControlReader }: Props) {
  const { confirm } = useVaaniDialog();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadingRef=useRef(false);

  const load = useCallback(async () => {
    if(loadingRef.current)return;loadingRef.current=true;
    try {
      const response = await fetch(`/api/sessions/${sessionId}/documents`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load documents.");
      setDocuments((result.documents ?? []) as DocumentItem[]);
      setActiveDocumentId(result.activeDocumentId ?? null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load documents.");
    } finally {
      loadingRef.current=false;setLoading(false);
    }
  }, [sessionId]);

  const { event: realtimeEvent, status: realtimeStatus } = useConferenceRealtime();

  useEffect(() => {
    // Initial load and reconnect reconciliation.
    void load();
  }, [load, realtimeStatus === "connected"]);

  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.sessionId !== sessionId) return;
    if (
      realtimeEvent.table === "session_documents" ||
      realtimeEvent.table === "session_reader_state"
    ) {
      void load();
    }
  }, [realtimeEvent, sessionId, load]);
  async function updateActiveDocument(documentId: string | null) {
    setBusyId(documentId ?? "none");
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/documents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ documentId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update the viewer.");
      setActiveDocumentId(documentId);
      setNotice(documentId ? "PDF opened." : "Viewer closed.");
      window.dispatchEvent(new CustomEvent("vaani:reader-refresh"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the viewer.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDocument(document: DocumentItem) {
    if (!(await confirm({ title: "Delete this PDF?", message: `“${document.title}” will be removed from this session. This cannot be undone.`, danger: true, confirmLabel: "Delete PDF" }))) return;
    setBusyId(document.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ documentId: document.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete the PDF.");
      setNotice(result.storageCleanupPending ? "PDF removed from the session. Private storage cleanup is pending." : "PDF deleted.");
      window.dispatchEvent(new CustomEvent("vaani:reader-refresh"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete the PDF.");
    } finally {
      setBusyId(null);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <details className="conference-workspace min-w-0 rounded-xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-semibold">PDF library</span>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/70">
          {documents.length}
        </span>
      </summary>

      <div className="max-h-[60svh] space-y-2 overflow-y-auto border-t border-[var(--conference-line)] p-2.5 sm:max-h-96">
        {loading ? (
          <p className="py-3 text-center text-xs text-white/50">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="py-3 text-center text-xs text-white/50">No PDFs yet.</p>
        ) : (
          documents.map((document) => {
            const isActive = activeDocumentId === document.id;
            const busy = busyId === document.id || (isActive && busyId === "none");
            return (
              <article key={document.id} className="min-w-0 rounded-lg border border-[var(--conference-line)] bg-black/10 p-3">
                <div className="min-w-0">
                  <p className="break-words text-xs font-medium leading-5 text-white [overflow-wrap:anywhere]">
                    {document.title}
                  </p>
                  <p className="mt-1 text-[10px] text-white/45">
                    {formatSize(document.size_bytes)} · {new Date(document.created_at).toLocaleDateString("en-IN")}
                  </p>
                  {isActive && <p className="mt-1 text-[10px] font-medium text-[#c7d8c5]">In viewer</p>}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {canControlReader && (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void updateActiveDocument(isActive ? null : document.id)}
                      className="min-h-8 rounded-md bg-[var(--conference-accent)] px-2.5 py-1.5 text-[10px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
                    >
                      {busy ? "Please wait…" : isActive ? "Close viewer" : "Open"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void deleteDocument(document)}
                    className="min-h-8 rounded-md bg-white/[0.07] px-2.5 py-1.5 text-[10px] font-medium text-white/75 hover:bg-red-500/20 hover:text-red-100 disabled:opacity-40"
                  >
                    {busyId === document.id ? "Please wait…" : "Delete"}
                  </button>
                </div>
              </article>
            );
          })
        )}

        {error && <InlineFeedback tone="error">{error}</InlineFeedback>}
        {notice && <InlineFeedback tone="success">{notice}</InlineFeedback>}
      </div>
    </details>
  );
}