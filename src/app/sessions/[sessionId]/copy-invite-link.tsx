"use client";

import { useState } from "react";

export default function CopyInviteLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const input = document.getElementById("generated-invite-link");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    }
  }
  return <button type="button" onClick={copy} className="button-primary min-w-28">{copied ? "Copied" : "Copy link"}</button>;
}
