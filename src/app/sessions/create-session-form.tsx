"use client";

import { useRef, useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

export default function CreateSessionForm({ action }: Props) {
  const submittedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (submittedRef.current) {
      event.preventDefault();
      return;
    }

    submittedRef.current = true;
    setSubmitting(true);
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-medium">
          Session title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="Enter a session title"
          className="w-full rounded-lg border border-stone-300 px-4 py-3 outline-none focus:border-emerald-700"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          maxLength={2000}
          rows={3}
          placeholder="What will this session be about?"
          className="w-full resize-y rounded-lg border border-stone-300 px-4 py-3 outline-none focus:border-emerald-700"
        />
      </div>

      <div>
        <label htmlFor="access_type" className="mb-2 block text-sm font-medium">
          Who can join?
        </label>
        <select
          id="access_type"
          name="access_type"
          defaultValue="community"
          className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 outline-none focus:border-emerald-700"
        >
          <option value="community">All Vaani members</option>
          <option value="invitation_only">Invitation only</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-stone-900 px-6 py-3 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? "Creating..." : "Create session"}
      </button>
    </form>
  );
}
