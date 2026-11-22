"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
};

const errors: Record<string, string> = {
  invalid_input: "Check the title, description, and instructions.",
  invalid_access: "Select a valid access setting.",
  invalid_options: "Check the duration, time zone, and participant limit.",
  invalid_schedule: "Choose a start time in the future.",
  create_failed: "The gathering could not be saved. Please try again.",
};

export default function CreateSessionForm({ action, error }: Props) {
  const submittedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimeZone) setTimeZone(browserTimeZone);
    const form = formRef.current;
    if (!form) return;
    const key = "vaani:create-gathering-form";
    if (error) {
      try {
        const saved = sessionStorage.getItem(key);
        if (saved) {
          const values = JSON.parse(saved) as Record<string, string>;
          for (const [name, value] of Object.entries(values)) {
            const field = form.elements.namedItem(name);
            if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = value === "true";
            else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.value = value;
          }
        }
      } catch { /* Keep the form usable if browser storage is unavailable. */ }
    } else {
      sessionStorage.removeItem(key);
    }
  }, [error]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (submittedRef.current) {
      event.preventDefault();
      return;
    }

    const form = event.currentTarget;
    const values: Record<string, string> = {};
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name) continue;
      values[element.name] = element instanceof HTMLInputElement && element.type === "checkbox" ? String(element.checked) : element.value;
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name) values[submitter.name] = submitter.value;
    try { sessionStorage.setItem("vaani:create-gathering-form", JSON.stringify(values)); } catch { /* Storage may be unavailable. */ }
    const localDate = String(new FormData(form).get("scheduled_start_local") ?? "");
    const scheduledField = form.elements.namedItem("scheduled_start_at") as HTMLInputElement | null;
    const recurrenceLocal = String(new FormData(form).get("recurrence_until_local") ?? "");
    const recurrenceField = form.elements.namedItem("recurrence_until") as HTMLInputElement | null;
    if (recurrenceField) recurrenceField.value = recurrenceLocal ? new Date(`${recurrenceLocal}T23:59:59`).toISOString() : "";

    if (scheduledField) {
      scheduledField.value = localDate ? new Date(localDate).toISOString() : "";
    }

    submittedRef.current = true;
    setSubmitting(true);
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-8">
      {error && errors[error] && (
        <p role="alert" className="rounded-xl border border-red-200 bg-[#fbefed] p-4 text-sm text-red-800">
          {errors[error]}
        </p>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Gathering details</h2>
        </div>
        <div>
          <label htmlFor="title" className="field-label mb-2">Gathering title</label>
          <input id="title" name="title" required maxLength={120} placeholder="For example, Shree Hit Chaturasi Ji Gaayan" className="field-input" />
        </div>
        <div>
          <label htmlFor="description" className="field-label mb-2">Description</label>
          <textarea id="description" name="description" maxLength={2000} rows={3} placeholder="A little about this gathering" className="field-input min-h-24 resize-y" />
        </div>
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-7">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Schedule</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="scheduled_start_local" className="field-label mb-2">Start date and time</label>
            <input id="scheduled_start_local" name="scheduled_start_local" type="datetime-local" className="field-input" />
            <input type="hidden" name="scheduled_start_at" />
          </div>
          <div>
            <label htmlFor="duration_minutes" className="field-label mb-2">Expected duration</label>
            <select id="duration_minutes" name="duration_minutes" defaultValue="" className="field-input">
              <option value="">Not specified</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1 hour 30 minutes</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
              <option value="240">4 hours</option>
            </select>
          </div>
        </div>
        <input type="hidden" name="time_zone" value={timeZone} />
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-7">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Access and participation</h2>
        </div>
        <div>
          <label htmlFor="access_type" className="field-label mb-2">Who can join?</label>
          <select id="access_type" name="access_type" defaultValue="community" className="field-input">
            <option value="community">All Vaani members</option>
            <option value="invitation_only">Invite-only</option>
            <option value="link">Anyone with an invitation link</option>
          </select>
        </div>
        <div>
          <label htmlFor="participant_limit" className="field-label mb-2">Participant limit</label>
          <input id="participant_limit" name="participant_limit" type="number" min="2" max="500" placeholder="No limit" className="field-input" />
        </div>
        <label className="flex items-start gap-3 text-sm text-[var(--ink)]">
          <input type="checkbox" name="waiting_room_enabled" className="mt-1 size-4 accent-[var(--plum)]" />
          <span><strong className="block">Use a waiting room</strong><span className="text-[var(--muted)]">Participants wait for approval before entering.</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm text-[var(--ink)]">
          <input type="checkbox" name="allow_participant_invites" className="mt-1 size-4 accent-[var(--plum)]" />
          <span><strong className="block">Allow participants to invite others</strong><span className="text-[var(--muted)]">Participants can invite others when the organizer allows it.</span></span>
        </label>
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-7">
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="recurrence_rule" className="field-label mb-2">Repeat</label><select id="recurrence_rule" name="recurrence_rule" defaultValue="" className="field-input"><option value="">Does not repeat</option><option value="DAILY">Every day</option><option value="WEEKLY">Every week</option><option value="BIWEEKLY">Every two weeks</option><option value="EVERY_3_WEEKS">Every three weeks</option><option value="EVERY_4_WEEKS">Every four weeks</option><option value="MONTHLY">Every month</option></select></div><div><label htmlFor="recurrence_until_local" className="field-label mb-2">Repeat until</label><input id="recurrence_until_local" name="recurrence_until_local" type="date" className="field-input"/></div></div>
        <input type="hidden" name="recurrence_until"/>
      </section>
      <section className="space-y-3 border-t border-[var(--line)] pt-7">
        <div>
          <label htmlFor="instructions" className="field-label mb-2">Instructions for participants</label>
          <textarea id="instructions" name="instructions" maxLength={2000} rows={3} placeholder="Anything participants should know before joining" className="field-input min-h-24 resize-y" />
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="submit" name="intent" value="draft" disabled={submitting} className="button-secondary">
            Save as draft
          </button>
          <button type="submit" name="intent" value="publish" disabled={submitting} className="button-primary">
            {submitting ? "Saving..." : "Schedule gathering"}
          </button>
        </div>
      </section>
    </form>
  );
}
