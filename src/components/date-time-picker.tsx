"use client";

import { useMemo, useState } from "react";

type Props = {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  min?: string;
  className?: string;
  onChange?: (value: string) => void;
  dateOnly?: boolean;
};

type DateParts = { year: number; month: number; day: number; hour: number; minute: number };
const pad = (value: number) => String(value).padStart(2, "0");

function parse(value: string): DateParts {
  const [datePart = "", timePart = "09:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const now = new Date();
  return {
    year: year || now.getFullYear(),
    month: month ? month - 1 : now.getMonth(),
    day: day || now.getDate(),
    hour: Number.isFinite(hour) ? hour : 9,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function serialize(value: DateParts) {
  return `${value.year}-${pad(value.month + 1)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}`;
}

function Icon({ name }: { name: "previous" | "next" | "calendar" | "clock" | "up" | "down" }) {
  const paths = {
    previous: <path d="m12.5 5-5 5 5 5" />,
    next: <path d="m7.5 5 5 5-5 5" />,
    calendar: <><rect x="3.5" y="5" width="13" height="12" rx="2" /><path d="M6.5 3.5v3M13.5 3.5v3M3.5 8.5h13" /></>,
    clock: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.7 1.7" /></>,
    up: <path d="m5 12.5 5-5 5 5" />,
    down: <path d="m5 7.5 5 5 5-5" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="vaani-picker-icon">
    <g stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</g>
  </svg>;
}

export default function DateTimePicker({
  id, name, defaultValue = "", required, min, className = "field-input", onChange, dateOnly = false,
}: Props) {
  const initial = useMemo(() => parse(defaultValue), [defaultValue]);
  const [parts, setParts] = useState<DateParts>(initial);
  const [hasSelection, setHasSelection] = useState(Boolean(defaultValue));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const [hourDraft, setHourDraft] = useState(pad(initial.hour));
  const [minuteDraft, setMinuteDraft] = useState(pad(initial.minute));

  const serialized = serialize(parts);
  const value = hasSelection ? (dateOnly ? serialized.slice(0, 10) : serialized) : "";
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const minParts = min ? parse(min) : null;
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
    .format(new Date(view.year, view.month, 1));

  function emit(next: DateParts) {
    setParts(next);
    setHasSelection(true);
    setHourDraft(pad(next.hour));
    setMinuteDraft(pad(next.minute));
    onChange?.(dateOnly ? serialize(next).slice(0, 10) : serialize(next));
  }

  function changeMonth(delta: number) {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  }

  function isDisabled(day: number) {
    if (!minParts) return false;
    const candidate = new Date(view.year, view.month, day);
    const earliest = new Date(minParts.year, minParts.month, minParts.day);
    return candidate < earliest;
  }

  function commitTime(kind: "hour" | "minute", raw: string) {
    const parsed = Number(raw);
    const max = kind === "hour" ? 23 : 59;
    if (!Number.isFinite(parsed) || raw.trim() === "") {
      setHourDraft(pad(parts.hour));
      setMinuteDraft(pad(parts.minute));
      return;
    }
    const bounded = Math.max(0, Math.min(max, Math.trunc(parsed)));
    emit({ ...parts, [kind]: bounded });
  }

  function stepTime(kind: "hour" | "minute", amount: number) {
    const max = kind === "hour" ? 23 : 59;
    const current = parts[kind];
    const next = (current + amount + max + 1) % (max + 1);
    emit({ ...parts, [kind]: next });
  }

  return (
    <div className="vaani-date-field">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        id={id}
        type="button"
        className={className + " vaani-date-trigger"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id + "-calendar"}
        onClick={() => {
          setView({ year: parts.year, month: parts.month });
          setOpen((current) => !current);
        }}
      >
        <span className={hasSelection ? "" : "vaani-date-placeholder"}>
          {!hasSelection
            ? "Choose date"
            : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
                .format(new Date(parts.year, parts.month, parts.day))}
          {hasSelection && !dateOnly && ` · ${pad(parts.hour)}:${pad(parts.minute)}`}
        </span>
        <Icon name="calendar" />
      </button>

      {open && (
        <div id={id + "-calendar"} className="vaani-calendar" role="dialog" aria-label="Choose date and time">
          <div className="vaani-calendar-head">
            <button type="button" className="vaani-calendar-nav" aria-label="Previous month" onClick={() => changeMonth(-1)}>
              <Icon name="previous" />
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" className="vaani-calendar-nav" aria-label="Next month" onClick={() => changeMonth(1)}>
              <Icon name="next" />
            </button>
          </div>

          <div className="vaani-calendar-grid" role="group" aria-label="Calendar dates">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day} className="vaani-calendar-weekday">{day}</span>
            ))}
            {Array.from({ length: firstWeekday }, (_, index) => <span key={"blank-" + index} aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const selected = hasSelection && parts.year === view.year && parts.month === view.month && parts.day === day;
              const today = new Date();
              const isToday = today.getFullYear() === view.year && today.getMonth() === view.month && today.getDate() === day;
              return (
                <button
                  key={day}
                  type="button"
                  className="vaani-calendar-day"
                  data-selected={selected}
                  data-today={isToday}
                  disabled={isDisabled(day)}
                  aria-pressed={selected}
                  aria-label={new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(new Date(view.year, view.month, day))}
                  onClick={() => emit({ ...parts, year: view.year, month: view.month, day })}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {!dateOnly && (
            <div className="vaani-calendar-time">
              <div className="vaani-calendar-time-heading">
                <Icon name="clock" />
                <span>Time</span>
                <span className="vaani-calendar-time-zone">24-hour</span>
              </div>
              <div className="vaani-time-control">
                <div className="vaani-time-unit">
                  <button type="button" aria-label="Increase hour" onClick={() => stepTime("hour", 1)}><Icon name="up" /></button>
                  <input
                    aria-label="Hour"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    value={hourDraft}
                    onChange={(event) => setHourDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
                    onBlur={() => commitTime("hour", hourDraft)}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  />
                  <button type="button" aria-label="Decrease hour" onClick={() => stepTime("hour", -1)}><Icon name="down" /></button>
                </div>
                <span className="vaani-time-separator">:</span>
                <div className="vaani-time-unit">
                  <button type="button" aria-label="Increase minute" onClick={() => stepTime("minute", 1)}><Icon name="up" /></button>
                  <input
                    aria-label="Minute"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    value={minuteDraft}
                    onChange={(event) => setMinuteDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
                    onBlur={() => commitTime("minute", minuteDraft)}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  />
                  <button type="button" aria-label="Decrease minute" onClick={() => stepTime("minute", -1)}><Icon name="down" /></button>
                </div>
              </div>
            </div>
          )}

          <div className="vaani-calendar-actions">
            <button type="button" className="button-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="button-primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
