"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = { tone: "error" | "success" | "info"; children: ReactNode; className?: string };
const active = new Set<string>();

export default function InlineFeedback({ tone, children }: Props) {
  const message = typeof children === "string" ? children : "";
  const key = tone + ":" + message;
  const [visible, setVisible] = useState(false);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const offset = useRef(0);
  useEffect(() => { setViewport(document.getElementById("vaani-toast-viewport")); }, []);
  useEffect(() => {
    if (!message || active.has(key)) return;
    active.add(key); setVisible(true);
    const timer = window.setTimeout(() => { active.delete(key); setVisible(false); }, tone === "error" ? 5600 : 4200);
    return () => { window.clearTimeout(timer); active.delete(key); };
  }, [key, message, tone]);
  if (!visible || !viewport) return null;
  const dismiss = () => { active.delete(key); setVisible(false); };
  return createPortal(
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      data-toast={tone}
      className="vaani-toast"
      style={{ transform: `translate3d(${offset.current}px,0,0)` }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        offset.current = 0;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
          offset.current = dx;
          event.currentTarget.style.transform = `translate3d(${dx}px,0,0)`;
        }
      }}
      onPointerUp={(event) => {
        const start = pointerStart.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        pointerStart.current = null;
        if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.25) dismiss();
        else { offset.current = 0; event.currentTarget.style.transform = ""; }
      }}
      onPointerCancel={() => { pointerStart.current = null; offset.current = 0; }}
    >
      <span className="vaani-toast-dot" aria-hidden="true" />
      <p className="min-w-0 flex-1">{message}</p>
      <button type="button" onClick={dismiss} className="vaani-toast-close" aria-label="Dismiss notification">×</button>
    </div>, viewport
  );
}
