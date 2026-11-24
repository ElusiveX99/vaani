"use client";

import { useState } from "react";

export default function CopyInviteLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copy() {
    setCopied(false);
    setCopyError(false);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        field.style.pointerEvents = "none";
        document.body.appendChild(field);
        field.select();
        const succeeded = document.execCommand("copy");
        field.remove();
        if (!succeeded) throw new Error("Clipboard unavailable");
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Vaani gathering invitation",
          text: "You're invited to join a gathering on Vaani.",
          url: value,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="button-primary min-w-28">
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={share} className="button-secondary">
          Share
        </button>
      </div>
      {copyError && (
        <p role="status" className="text-xs text-[var(--muted)]">
          Copy wasn&apos;t available. Select the link text to copy it manually.
        </p>
      )}
    </div>
  );
}
