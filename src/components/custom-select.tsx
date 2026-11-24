"use client";

import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string; disabled?: boolean };
type Props = { id: string; name: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; options: Option[]; required?: boolean; placeholder?: string; className?: string; disabled?: boolean };

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function CheckIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0"><path d="m4.5 10.2 3.6 3.6 7.4-7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function CustomSelect({ id, name, value, defaultValue = "", onChange, options, required, placeholder = "Select an option", className = "field-input", disabled }: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === (value ?? internal));
  const current = value ?? internal;
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function choose(next: string) { if (value === undefined) setInternal(next); onChange?.(next); setOpen(false); trigger.current?.focus(); }
  function moveSelection(direction: number) {
    const enabled = options.filter(option => !option.disabled);
    const index = enabled.findIndex(option => option.value === current);
    const next = enabled[Math.max(0, Math.min(enabled.length - 1, index + direction))];
    if (next) choose(next.value);
  }
  return <div ref={root} className="vaani-select" data-open={open}>
    <input type="hidden" name={name} value={current} required={required} />
    <button ref={trigger} id={id} type="button" className={className + " vaani-select-trigger"} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(state => !state)} onKeyDown={event => {
      if (event.key === "ArrowDown") { event.preventDefault(); if (!open) setOpen(true); else moveSelection(1); }
      if (event.key === "ArrowUp") { event.preventDefault(); if (!open) setOpen(true); else moveSelection(-1); }
      if (event.key === "Escape") setOpen(false);
    }}>
      <span className={selected ? "" : "vaani-select-placeholder"}>{selected?.label || placeholder}</span><ChevronIcon />
    </button>
    {open && <div id={listId} role="listbox" aria-labelledby={id} className="vaani-select-menu">
      {options.map(option => <button key={option.value} type="button" role="option" aria-selected={current === option.value} disabled={option.disabled} className="vaani-select-option" onClick={() => choose(option.value)}><span>{option.label}</span>{current === option.value && <CheckIcon />}</button>)}
    </div>}
  </div>;
}
