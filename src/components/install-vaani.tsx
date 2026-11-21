"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallVaani() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const userAgent = navigator.userAgent;
    const isAppleMobile = /iPhone|iPad|iPod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setHelpOpen(false);

    function handleBeforeInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      setHelpOpen((open) => !open);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch (error) {
      console.error("Vaani installation prompt failed:", error);
      setHelpOpen(true);
    } finally {
      setInstallPrompt(null);
    }
  }

  if (installed) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleInstall}
        aria-expanded={helpOpen}
        aria-haspopup="dialog"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--plum)] transition hover:border-[var(--rose)] sm:px-3"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12m-4-4 4 4 4-4" />
          <path d="M5 16v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
        </svg>
        <span className="hidden sm:inline">Install Vaani</span>
        <span className="sm:hidden">Install</span>
      </button>

      {helpOpen && (
        <div
          role="dialog"
          aria-label="Install Vaani"
          className="absolute right-0 top-full z-50 mt-2 w-[min(88vw,21rem)] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--plum)]">Add Vaani to your home screen</p>
            <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close install instructions" className="rounded px-1 text-lg leading-none text-[var(--muted)]">×</button>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Open Vaani in your browser's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            On iPhone or iPad, open Vaani in Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.
          </p>
          <p className="mt-3 text-[11px] leading-4 text-[var(--muted)]">
            The installed shortcut opens Vaani in an app-like window. A browser is still used underneath for calls and updates.
          </p>
        </div>
      )}
    </div>
  );
}
