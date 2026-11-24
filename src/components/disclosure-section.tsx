"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  summary?: string;
  className?: string;
  contentClassName?: string;
  headingLevel?: 2 | 3;
};

export default function DisclosureSection({
  title,
  children,
  defaultOpen = false,
  summary,
  className = "",
  contentClassName = "",
  headingLevel = 2,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <section className={className}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <Heading className="text-lg font-semibold text-[var(--ink)]">{title}</Heading>
          {!open && summary && (
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{summary}</p>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div id={contentId} hidden={!open} className={contentClassName}>
        {children}
      </div>
    </section>
  );
}
