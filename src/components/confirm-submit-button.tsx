"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  message: string;
  className?: string;
  children: ReactNode;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
};

export default function ConfirmSubmitButton({
  message,
  className,
  children,
  formAction,
  name,
  value,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      formAction={formAction}
      name={name}
      value={value}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
