"use client";

import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string; disabled?: boolean };
type Props = { id: string; name: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; options: Option[]; required?: boolean; placeholder?: string; className?: string; disabled?: boolean };
export default function CustomSelect({ id, name, value, defaultValue = "", onChange, options, required, placeholder = "Select an option", className = "field-input", disabled }: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === (value ?? internal));
  const current = value ?? internal;
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function choose(next: string) { if (value === undefined) setInternal(next); onChange?.(next); setOpen(false); }
  return <div ref={root} className="vaani-select" data-open={open}>
    <input type="hidden" name={name} value={current} required={required} />
    <button id={id} type="button" className={className + " vaani-select-trigger"} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((state) => !state)}>
      <span className={selected ? "" : "vaani-select-placeholder"}>{selected?.label || placeholder}</span><span className="vaani-select-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div id={listId} role="listbox" aria-labelledby={id} className="vaani-select-menu">
      {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={current === option.value} disabled={option.disabled} className="vaani-select-option" onClick={() => choose(option.value)}>{option.label}{current === option.value && <span aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}
