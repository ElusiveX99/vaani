import type { ReactNode } from "react";

type Props = {
  tone: "error" | "success" | "info";
  children: ReactNode;
  className?: string;
};

const paths = {
  error: <><path d="M12 8v4m0 4h.01" /><circle cx="12" cy="12" r="9" /></>,
  success: <><path d="m7 12 3 3 7-7" /><circle cx="12" cy="12" r="9" /></>,
  info: <><path d="M12 11v5m0-8h.01" /><circle cx="12" cy="12" r="9" /></>,
};

export default function InlineFeedback({ tone, children, className = "" }: Props) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      data-feedback={tone}
      className={`v-feedback flex items-start gap-2 text-sm leading-relaxed ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0">
        {paths[tone]}
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
