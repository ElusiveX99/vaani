"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SCROLL_KEY = "vaani:pending-form-scroll";

export default function FormPendingFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (!raw) return;
    sessionStorage.removeItem(SCROLL_KEY);
    try {
      const saved = JSON.parse(raw) as { y: number; path: string; focusId?: string; focusName?: string };
      if (saved.path !== window.location.pathname) return;
      requestAnimationFrame(() => {
        window.scrollTo(0, saved.y);
        const target = saved.focusId
          ? document.getElementById(saved.focusId)
          : saved.focusName
            ? document.querySelector<HTMLElement>(`[name="${CSS.escape(saved.focusName)}"]`)
            : null;
        target?.focus({ preventScroll: true });
      });
    } catch {
      sessionStorage.removeItem(SCROLL_KEY);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.submitting === "true") {
        event.preventDefault();
        return;
      }
      const submitter = (event as SubmitEvent).submitter;
      if (!(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement)) return;

      const active = document.activeElement;
      const focusId = active instanceof HTMLElement ? active.id : "";
      const focusName = active instanceof HTMLElement && active !== document.body ? active.getAttribute("name") || "" : "";
      try {
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
          y: window.scrollY,
          path: window.location.pathname,
          focusId,
          focusName,
        }));
      } catch { /* Scroll restoration is progressive enhancement. */ }

      form.dataset.submitting = "true";
      form.setAttribute("aria-busy", "true");
      submitter.dataset.submitting = "true";
      submitter.setAttribute("aria-disabled", "true");

      if (submitter instanceof HTMLButtonElement) {
        submitter.dataset.originalLabel = submitter.textContent || "Submit";
        submitter.textContent = submitter.dataset.pendingLabel || "Working…";
      } else {
        submitter.dataset.originalLabel = submitter.value;
        submitter.value = submitter.dataset.pendingLabel || "Working…";
      }

      for (const control of Array.from(form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button[type="submit"],button:not([type]),input[type="submit"]'))) {
        if (control !== submitter) control.disabled = true;
      }
    }
    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, []);
  return null;
}
