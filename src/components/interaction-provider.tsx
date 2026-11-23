"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type DialogKind = "confirm" | "alert" | "prompt";
type DialogOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; placeholder?: string; defaultValue?: string; required?: boolean };
type PendingDialog = DialogOptions & { kind: DialogKind; resolve: (value: boolean | string | null) => void };
type InteractionContextValue = {
  confirm: (options: DialogOptions | string) => Promise<boolean>;
  alert: (options: DialogOptions | string) => Promise<void>;
  prompt: (options: DialogOptions) => Promise<string | null>;
};
const InteractionContext = createContext<InteractionContextValue | null>(null);

export function useVaaniDialog() {
  const context = useContext(InteractionContext);
  if (!context) throw new Error("useVaaniDialog must be used within InteractionProvider");
  return context;
}

export default function InteractionProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const open = useCallback((kind: DialogKind, options: DialogOptions | string) => new Promise<boolean | string | null>((resolve) => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const normalized = typeof options === "string" ? { message: options } : options;
    setPending({ ...normalized, kind, resolve });
  }), []);
  const confirm = useCallback(async (options: DialogOptions | string) => (await open("confirm", options)) === true, [open]);
  const alert = useCallback(async (options: DialogOptions | string) => { await open("alert", options); }, [open]);
  const prompt = useCallback(async (options: DialogOptions) => {
    const value = await open("prompt", options);
    return typeof value === "string" ? value : null;
  }, [open]);
  const finish = useCallback((value: boolean | string | null) => {
    setPending((current) => {
      if (!current) return current;
      current.resolve(value);
      return null;
    });
    requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!pending) return;
    const frame = requestAnimationFrame(() => {
      if (pending.kind === "prompt") inputRef.current?.focus();
      else document.getElementById("vaani-dialog-confirm")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish(null); }
      if (event.key === "Tab") {
        const root = document.getElementById("vaani-dialog-panel");
        const focusable = root?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex="0"]');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown); };
  }, [pending, finish]);

  return <InteractionContext.Provider value={{ confirm, alert, prompt }}>
    {children}
    {pending && <div className="vaani-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && pending.kind !== "confirm") finish(null); }}>
      <section id="vaani-dialog-panel" role={pending.kind === "alert" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="vaani-dialog-title" aria-describedby="vaani-dialog-message" className="vaani-dialog-panel">
        <div className="vaani-dialog-mark" data-danger={pending.danger || false}>{pending.danger ? "!" : "✦"}</div>
        <h2 id="vaani-dialog-title" className="vaani-dialog-title">{pending.title || (pending.kind === "confirm" ? "Are you sure?" : pending.kind === "prompt" ? "Enter a value" : "Notice")}</h2>
        <p id="vaani-dialog-message" className="vaani-dialog-message">{pending.message}</p>
        {pending.kind === "prompt" && <input ref={inputRef} className="field-input mt-4" placeholder={pending.placeholder} defaultValue={pending.defaultValue} onKeyDown={(event) => { if (event.key === "Enter") finish(event.currentTarget.value); }} />}
        <div className="vaani-dialog-actions">
          {pending.kind !== "alert" && <button type="button" className="button-secondary" onClick={() => finish(null)}>{pending.cancelLabel || "Cancel"}</button>}
          <button id="vaani-dialog-confirm" type="button" className={pending.danger ? "button-danger" : "button-primary"} onClick={() => finish(pending.kind === "prompt" ? inputRef.current?.value ?? "" : true)}>{pending.confirmLabel || (pending.kind === "alert" ? "OK" : pending.kind === "prompt" ? "Continue" : "Confirm")}</button>
        </div>
      </section>
    </div>}
  </InteractionContext.Provider>;
}
