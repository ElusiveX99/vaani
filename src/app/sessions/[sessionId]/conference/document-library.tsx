"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DocumentItem = {
  id: string;
  title: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string;
  display_order: number;
};

export default function DocumentLibrary({
  sessionId,
}: { sessionId: string }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/documents`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load the PDF library.");
      setDocuments((result.documents ?? []) as DocumentItem[]);
      setActiveDocumentId(result.activeDocumentId ?? null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the PDF library.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void load();

    const refresh = () => {
      if (active) void load();
    };

    const channel = supabase
      .channel(`session-document-library-${sessionId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "session_documents",
        filter: `session_id=eq.${sessionId}`,
      }, refresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "session_reader_state",
        filter: `session_id=eq.${sessionId}`,
      }, refresh)
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [sessionId, load]);

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
      if (!response.ok) throw new Error(result.error || "Unable to update the reader.");
      setActiveDocumentId(documentId);
      setNotice(documentId ? "Document opened for everyone." : "The shared reader is now hidden.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the reader.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDocument(document: DocumentItem) {
    if (!window.confirm(`Permanently delete "${document.title}" from this session?`)) return;
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
      setNotice("PDF permanently deleted.");
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
    <details className="min-w-0 rounded-lg border border-white/10 bg-[#202020] text-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
        <span className="min-w-0 truncate text-xs font-medium">Session PDF library</span>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/65">{documents.length} files</span>
      </summary>
      <div className="max-h-72 space-y-2 overflow-y-auto border-t border-white/10 p-3">
        {loading ? (
          <p className="py-3 text-center text-xs text-white/45">Loading library...</p>
        ) : documents.length === 0 ? (
          <p className="py-3 text-center text-xs text-white/45">No PDFs uploaded to this session yet.</p>
        ) : (
          documents.map((document) => {
            const isActive = activeDocumentId === document.id;
            const busy = busyId === document.id;
            return (
              <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{document.title}</p>
                  <p className="mt-1 text-[10px] text-white/40">{formatSize(document.size_bytes)} · {new Date(document.created_at).toLocaleDateString()}</p>
                  {isActive && <p className="mt-1 text-[10px] font-medium text-emerald-300">Currently shared</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {isActive ? (
                    <button type="button" disabled={busyId !== null} onClick={() => void updateActiveDocument(null)} className="rounded-md bg-white/10 px-2.5 py-1.5 text-[10px] font-medium hover:bg-white/15 disabled:opacity-40">
                      {busyId === "none" ? "Working..." : "Remove from viewer"}
                    </button>
                  ) : (
                    <button type="button" disabled={busyId !== null} onClick={() => void updateActiveDocument(document.id)} className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-blue-500 disabled:opacity-40">
                      {busy ? "Opening..." : "Open for everyone"}
                    </button>
                  )}
                  <button type="button" disabled={busyId !== null} onClick={() => void deleteDocument(document)} className="rounded-md bg-red-500/10 px-2.5 py-1.5 text-[10px] font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-40">
                    {busy ? "Working..." : "Delete"}
                  </button>
                </div>
              </article>
            );
          })
        )}
        {error && <p role="alert" className="rounded-md bg-red-950/40 px-3 py-2 text-[11px] text-red-200">{error}</p>}
        {notice && <p role="status" className="rounded-md bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-200">{notice}</p>}
      </div>
    </details>
  );
}
