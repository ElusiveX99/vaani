"use client";

import { useEffect, useState } from "react";

const options = [["","Does not repeat"],["DAILY","Every day"],["WEEKLY","Every week"],["BIWEEKLY","Every two weeks"],["EVERY_3_WEEKS","Every three weeks"],["EVERY_4_WEEKS","Every four weeks"],["MONTHLY","Every month"]] as const;

export default function RecurrenceFields({ initialRule = "", initialUntil = "" }: { initialRule?: string; initialUntil?: string }) {
  const [rule, setRule] = useState(initialRule);
  const [until, setUntil] = useState(initialUntil);
  useEffect(() => { if (!rule) setUntil(""); }, [rule]);
  return <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
    <div><label htmlFor="recurrence_rule" className="field-label mb-2">Repeat</label>
      <select id="recurrence_rule" name="recurrence_rule" value={rule} onChange={e => setRule(e.target.value)} className="field-input">
        {options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    {rule && <div><label htmlFor="recurrence_until_local" className="field-label mb-2">Repeat until</label>
      <input id="recurrence_until_local" name="recurrence_until_local" type="date" value={until} onChange={e => setUntil(e.target.value)} className="field-input" />
    </div>}
  </div>;
}
