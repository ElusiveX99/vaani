"use client";

import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type Props = { tone: "error" | "success" | "info"; children: ReactNode; className?: string };

function getToastViewport() {
  return document.getElementById("vaani-toast-viewport");
}

function subscribeToToastViewport(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getServerToastViewport() {
  return null;
}

export default function InlineFeedback({ tone, children }: Props) {
  const message = typeof children === "string" ? children : "";
  const key = tone + ":" + message;
  const [visibleKey, setVisibleKey] = useState<string | null>(null);
  const viewport = useSyncExternalStore(
    subscribeToToastViewport,
    getToastViewport,
    getServerToastViewport
  );
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!message) return;

    const showTimer = window.setTimeout(() => setVisibleKey(key), 0);
    const hideTimer = window.setTimeout(
      () => setVisibleKey((current) => (current === key ? null : current)),
      tone === "error" ? 5600 : 4200
    );

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [key, message, tone]);

  const visible = Boolean(message) && visibleKey === key;
  if (!visible || !viewport) return null;

  const dismiss = () => setVisibleKey(null);

  return createPortal(
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      data-toast={tone}
      className="vaani-toast"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        pointerStart.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
          event.currentTarget.style.transform = `translate3d(${dx}px,0,0)`;
        }
      }}
      onPointerUp={(event) => {
        const start = pointerStart.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        pointerStart.current = null;
        if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.25) {
          dismiss();
        } else {
          event.currentTarget.style.transform = "";
        }
      }}
      onPointerCancel={(event) => {
        pointerStart.current = null;
        event.currentTarget.style.transform = "";
      }}
    >
      <span className="vaani-toast-dot" aria-hidden="true" />
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        className="vaani-toast-close"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>,
    viewport
  );
}
