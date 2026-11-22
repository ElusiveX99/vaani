"use client";

import { ReactNode, useEffect, useState } from "react";

type Props = { tone: "error" | "success" | "info"; children: ReactNode; className?: string };

const active = new Set<string>();

export default function InlineFeedback({ tone, children }: Props) {
  const message = typeof children === "string" ? children : "";
  const key = `${tone}:${message}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message || active.has(key)) return;
    active.add(key);
    setVisible(true);
    const timer = window.setTimeout(() => {
      active.delete(key);
      setVisible(false);
    }, tone === "error" ? 5200 : 3800);
    return () => {
      window.clearTimeout(timer);
      active.delete(key);
    };
  }, [key, message, tone]);

  if (!visible) return null;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      data-toast={tone}
      className="vaani-toast"
    >
      <span className="vaani-toast-dot" aria-hidden="true" />
      <p className="min-w-0 flex-1">{message}</p>
      <button type="button" onClick={() => { active.delete(key); setVisible(false); }} className="vaani-toast-close" aria-label="Dismiss notification">×</button>
    </div>
  );
}
