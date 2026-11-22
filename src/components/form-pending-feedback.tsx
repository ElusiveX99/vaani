"use client";

import { useEffect } from "react";

export default function FormPendingFeedback() {
  useEffect(() => {
    function handleSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.submitting === "true") {
        if (form instanceof HTMLFormElement) event.preventDefault();
        return;
      }
      const submitter = (event as SubmitEvent).submitter;
      if (!(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement)) return;
      form.dataset.submitting = "true";
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
