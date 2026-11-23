"use client";

import type { ReactNode, MouseEvent } from "react";
import { useState } from "react";
import { useVaaniDialog } from "@/components/interaction-provider";

type Props = { message: string; title?: string; className?: string; children: ReactNode; formAction?: (formData: FormData) => void | Promise<void>; name?: string; value?: string };
export default function ConfirmSubmitButton({ message, title, className, children, formAction, name, value }: Props) {
  const { confirm } = useVaaniDialog();
  const [checking, setChecking] = useState(false);
  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (checking) return;
    const button = event.currentTarget;
    const form = button.form;
    setChecking(true);
    try {
      if (await confirm({ title, message, danger: true, confirmLabel: "Yes, continue" })) {
        if (form) form.requestSubmit(button);
      }
    } finally { setChecking(false); }
  }
  return <button type="submit" formAction={formAction} name={name} value={value} className={className} onClick={handleClick} disabled={checking}>{checking ? "Please wait…" : children}</button>;
}
