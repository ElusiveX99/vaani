"use client";

import { useEffect, useRef, useState } from "react";
import InlineFeedback from "@/components/inline-feedback";
import RecurrenceFields from "@/components/recurrence-fields";
import CustomSelect from "@/components/custom-select";
import DateTimePicker from "@/components/date-time-picker";
import DisclosureSection from "@/components/disclosure-section";

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

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const form = formRef.current;
    if (!form) return;
    const timeZoneField = form.elements.namedItem("time_zone");
    if (browserTimeZone && timeZoneField instanceof HTMLInputElement) {
      timeZoneField.value = browserTimeZone;
    }
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

    submittedRef.current = true;
    setSubmitting(true);
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-8">
      {error && errors[error] && (
        <InlineFeedback tone="error" className="mb-1">
          {errors[error]}
        </InlineFeedback>
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
            <DateTimePicker id="scheduled_start_local" name="scheduled_start_local" className="field-input" />
          </div>
          <div>
            <label htmlFor="duration_minutes" className="field-label mb-2">Expected duration</label>
            <CustomSelect id="duration_minutes" name="duration_minutes" defaultValue="" options={[{value:"",label:"Not specified"},{value:"30",label:"30 minutes"},{value:"45",label:"45 minutes"},{value:"60",label:"1 hour"},{value:"90",label:"1 hour 30 minutes"},{value:"120",label:"2 hours"},{value:"180",label:"3 hours"},{value:"240",label:"4 hours"}]} />
          </div>
        </div>
        <input type="hidden" name="time_zone" defaultValue="Asia/Kolkata" />
      </section>

      <DisclosureSection
        title="Access and participation"
        summary="Who can join, participant limit, and waiting-room settings"
        className="border-t border-[var(--line)] pt-7"
        contentClassName="mt-4 space-y-4"
      >
        <div>
          <label htmlFor="access_type" className="field-label mb-2">Who can join?</label>
          <CustomSelect id="access_type" name="access_type" defaultValue="community" options={[{value:"community",label:"All Vaani members"},{value:"link",label:"Anyone with an invitation link"}]} />
        </div>
        <div>
          <label htmlFor="participant_limit" className="field-label mb-2">Participant limit</label>
          <input id="participant_limit" name="participant_limit" type="number" min="2" max="500" placeholder="No limit" className="field-input" />
        </div>
        <label className="flex items-start gap-3 text-sm text-[var(--ink)]">
          <input type="checkbox" name="waiting_room_enabled" className="mt-1 size-4 accent-[var(--plum)]" />
          <span><strong className="block">Use a waiting room</strong><span className="text-[var(--muted)]">Participants wait for approval before entering.</span></span>
        </label>
      </DisclosureSection>

      <DisclosureSection
        title="Recurrence"
        summary="Set this gathering to repeat on a schedule"
        className="border-t border-[var(--line)] pt-7"
        contentClassName="mt-4"
      >
        <RecurrenceFields />
      </DisclosureSection>
      <DisclosureSection
        title="Participant instructions"
        summary="Optional information participants should know before joining"
        className="border-t border-[var(--line)] pt-7"
        contentClassName="mt-4"
      >
        <label htmlFor="instructions" className="field-label mb-2">Instructions for participants</label>
        <textarea id="instructions" name="instructions" maxLength={2000} rows={3} placeholder="Anything participants should know before joining" className="field-input min-h-24 resize-y" />
      </DisclosureSection>
      <section className="space-y-3 border-t border-[var(--line)] pt-7">
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="submit" name="intent" value="publish" disabled={submitting} className="button-primary">
            {submitting ? "Saving..." : "Schedule gathering"}
          </button>
          <button type="submit" name="intent" value="draft" disabled={submitting} className="button-secondary">
            {submitting ? "Saving..." : "Save as draft"}
          </button>
        </div>
      </section>
    </form>
  );
}
