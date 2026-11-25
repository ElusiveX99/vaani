"use client";

import { useRef, useState } from "react";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 45 * 1024 * 1024;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

type Props = {
  sessionId: string;
  canManage: boolean;
};

type UploadStage =
  | "idle"
  | "uploading"
  | "saving"
  | "switching";

function isValidPreviousUpload(
  previousUpload: tus.PreviousUpload,
  file: File,
  sessionId: string
): boolean {
  const metadata = previousUpload.metadata;

  if (!metadata) return false;

  if (previousUpload.size !== file.size) return false;

  if (metadata.bucketName !== "session-pdfs") return false;

  if (metadata.contentType !== "application/pdf") return false;

  const prefix = `${sessionId}/`;

  if (!metadata.objectName?.startsWith(prefix)) {
    return false;
  }

  const filename = metadata.objectName.slice(prefix.length);

  // Only accept UUID-based PDF paths belonging directly
  // to this session, not nested or unrelated paths.
  const uuidPdfPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

  return uuidPdfPattern.test(filename);
}

function uploadWithTus(
  file: File,
  sessionId: string,
  accessToken: string,
  onProgress: (percentage: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      reject(new Error("Supabase configuration is missing."));
      return;
    }

    let storagePath = `${sessionId}/${crypto.randomUUID()}.pdf`;

    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,

      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: publishableKey,
        "x-upsert": "false",
      },

      metadata: {
        bucketName: "session-pdfs",
        objectName: storagePath,
        contentType: "application/pdf",
        cacheControl: "3600",
      },

      chunkSize: TUS_CHUNK_SIZE,
      retryDelays: [0, 3000, 5000, 10000, 20000],

      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,

      onError(error) {
        reject(error);
      },

      onProgress(bytesUploaded, bytesTotal) {
        const percentage = Math.round(
          (bytesUploaded / bytesTotal) * 100
        );

        onProgress(percentage);
      },

      onSuccess() {
        onProgress(100);
        resolve(storagePath);
      },
    });

    void (async () => {
      try {
        const previousUploads =
          await upload.findPreviousUploads();

        // Resume only an upload that matches this file and
        // belongs to this exact session and storage bucket.
        const matchingUpload = previousUploads.find(
          (previousUpload) =>
            isValidPreviousUpload(
              previousUpload,
              file,
              sessionId
            )
        );

        if (matchingUpload) {
          const previousObjectName =
            matchingUpload.metadata?.objectName;

          if (!previousObjectName) {
            throw new Error(
              "The previous upload has invalid metadata."
            );
          }

          // Keep the original object path when resuming.
          storagePath = previousObjectName;

          upload.resumeFromPreviousUpload(matchingUpload);
        }

        upload.start();
      } catch (error) {
        reject(error);
      }
    })();
  });
}

export default function PdfUploader({
  sessionId,
  canManage,
}: Props) {
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const busy = stage !== "idle";

  async function upload(file?: File) {
    if (!file || busy) return;

    setMessage("");
    setProgress(0);

    if (
      file.size === 0 ||
      file.size > MAX_FILE_SIZE ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setMessage("Select a PDF file smaller than 45 MB.");
      return;
    }

    setStage("uploading");

    const supabase = createClient();

    let storagePath = "";
    let databaseRecordCreated = false;
    let documentRecordId = "";

    try {
      // Validate the PDF file signature.
      const header = new Uint8Array(
        await file.slice(0, 5).arrayBuffer()
      );

      if (String.fromCharCode(...header) !== "%PDF-") {
        throw new Error("This file is not a valid PDF.");
      }

      // Get the current authenticated Supabase session.
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError) throw authError;

      if (!session?.access_token) {
        throw new Error("Your session expired. Please log in again.");
      }

      // Upload the actual PDF using resumable TUS.
      // The function returns the exact storage path used,
      // including the original path when an upload is resumed.
      storagePath = await uploadWithTus(
        file,
        sessionId,
        session.access_token,
        setProgress
      );

      // Save document metadata.
      setStage("saving");
      setMessage("Saving document information...");

      const title =
        file.name.replace(/\.pdf$/i, "").trim().slice(0, 200) ||
        "Untitled document";

      const { data: document, error: databaseError } =
        await supabase
          .from("session_documents")
          .insert({
            session_id: sessionId,
            title,
            storage_path: storagePath,
            mime_type: "application/pdf",
            size_bytes: file.size,
          })
          .select("id")
          .single();

      if (databaseError) {
        const { error: cleanupError } = await supabase.storage
          .from("session-pdfs")
          .remove([storagePath]);

        if (cleanupError) {
          console.error("PDF cleanup failed:", cleanupError);
        }

        throw databaseError;
      }

      databaseRecordCreated = true;
      documentRecordId = document.id;

      // Update this browser immediately. Realtime delivers the same change
      // to other participants, but the uploader must not depend on its own
      // WebSocket echo to refresh the local library.
      window.dispatchEvent(
        new CustomEvent("vaani:conference-document-mutated", {
          detail: {
            sessionId,
            documentId: document.id,
            stage: "uploaded",
          },
        })
      );

      // Make the newly uploaded PDF the active reader document.
      setStage("switching");
      setMessage("Opening the new document for everyone...");

      const response = await fetch(
        `/api/sessions/${sessionId}/documents`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            documentId: document.id,
          }),
        }
      );

      let result: { error?: string } = {};

      try {
        result = await response.json();
      } catch {
        // Handle unexpected non-JSON server responses below.
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "The PDF uploaded, but the reader could not switch documents."
        );
      }

      // Apply the active-document change to this browser immediately.
      window.dispatchEvent(
        new CustomEvent("vaani:conference-document-mutated", {
          detail: {
            sessionId,
            documentId: document.id,
            stage: "activated",
          },
        })
      );

      setMessage("PDF uploaded and opened successfully.");
    } catch (error) {
      console.error("Vaani PDF upload error:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown upload error.";

      if (databaseRecordCreated) {
        // The PDF and its metadata exist, but activation failed.
        setMessage(
          `PDF uploaded, but could not switch the reader: ${errorMessage}`
        );

        // The metadata row is real even if reader activation failed.
        // Reconcile the library locally and let the reader keep its
        // authoritative server state until a later successful selection.
        window.dispatchEvent(
          new CustomEvent("vaani:conference-document-mutated", {
            detail: {
              sessionId,
              documentId: documentRecordId,
              stage: "uploaded",
            },
          })
        );
      } else {
        setMessage(`PDF upload failed: ${errorMessage}`);
      }
    } finally {
      setStage("idle");
      setProgress(0);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  if (!canManage) return null;

  const stageLabel =
    stage === "uploading"
      ? `Uploading PDF... ${progress}%`
      : stage === "saving"
        ? "Saving document..."
        : stage === "switching"
          ? "Opening document..."
          : message || "Upload a document for everyone";

  return (
    <section className="conference-workspace flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-white">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">Session PDF</p>

        <p
          role="status"
          aria-live="polite"
          className="max-w-full truncate text-[10px] text-white/50"
        >
          {stageLabel}
        </p>

        {stage === "uploading" && (
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label="PDF upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-[#d6b5c5] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="min-h-8 shrink-0 rounded-md bg-[var(--conference-accent)] px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Please wait..." : "Upload PDF"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        disabled={busy}
        className="hidden"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
        }}
      />
    </section>
  );
}
