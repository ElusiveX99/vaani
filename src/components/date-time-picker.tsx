"use client";
import { useMemo, useState } from "react";

type Props = { id:string; name:string; defaultValue?:string; required?:boolean; min?:string; className?:string; onChange?:(value:string)=>void; dateOnly?:boolean };
const pad=(v:number)=>String(v).padStart(2,"0");
function parse(value:string){const [date="",time="09:00"]=value.split("T");const [y,m,d]=date.split("-").map(Number);const [h,mi]=time.split(":").map(Number);const now=new Date();return {year:y||now.getFullYear(),month:(m||now.getMonth()+1)-1,day:d||now.getDate(),hour:h??9,minute:mi??0};}
function formatted(v:ReturnType<typeof parse>){return `${v.year}-${pad(v.month+1)}-${pad(v.day)}T${pad(v.hour)}:${pad(v.minute)}`;}
function Icon({kind}:{kind:"left"|"right"|"calendar"|"chevron"}) {
 const paths={left:<path d="m12.5 5-5 5 5 5"/>,right:<path d="m7.5 5 5 5-5 5"/>,calendar:<><rect x="3.5" y="5" width="13" height="12" rx="2"/><path d="M6.5 3.5v3M13.5 3.5v3M3.5 8.5h13"/></>,chevron:<path d="m5 7.5 5 5 5-5"/>};
 return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4"><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</g></svg>;
}
export default function DateTimePicker({id,name,defaultValue="",required,min,className="field-input",onChange,dateOnly=false}:Props){
 const initial=useMemo(()=>parse(defaultValue||""),[defaultValue]);
 const [parts,setParts]=useState(initial),[hasSelection,setHasSelection]=useState(Boolean(defaultValue)),[open,setOpen]=useState(false),[view,setView]=useState({year:initial.year,month:initial.month}),[timeOpen,setTimeOpen]=useState(false);
 const full=formatted(parts),value=hasSelection?(dateOnly?full.slice(0,10):full):"";
 const first=new Date(view.year,view.month,1).getDay(),count=new Date(view.year,view.month+1,0).getDate();
 const minParts=min?parse(min):null;
 const disabled=(day:number)=>!!minParts&&new Date(view.year,view.month,day)<new Date(minParts.year,minParts.month,minParts.day);
 const month=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(new Date(view.year,view.month,1));
 function update(next:typeof parts){setParts(next);setHasSelection(true);onChange?.(dateOnly?formatted(next).slice(0,10):formatted(next));}
 function shift(delta:number){const d=new Date(view.year,view.month+delta,1);setView({year:d.getFullYear(),month:d.getMonth()});}
 return <div className="vaani-date-field"><input type="hidden" name={name} value={value} required={required}/>
 <button id={id} type="button" className={className+" vaani-date-trigger"} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setView({year:parts.year,month:parts.month});setOpen(v=>!v);}}>
 <span>{!hasSelection?"Choose date":new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(parts.year,parts.month,parts.day))}{hasSelection&&!dateOnly&&` · ${pad(parts.hour)}:${pad(parts.minute)}`}</span><Icon kind="calendar"/></button>
 {open&&<div className="vaani-calendar" role="dialog" aria-label="Choose date"><div className="vaani-calendar-head"><button type="button" aria-label="Previous month" onClick={()=>shift(-1)}><Icon kind="left"/></button><strong>{month}</strong><button type="button" aria-label="Next month" onClick={()=>shift(1)}><Icon kind="right"/></button></div>
 <div className="vaani-calendar-grid">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><span key={d} className="vaani-calendar-weekday">{d}</span>)}{Array.from({length:first},(_,i)=><span key={"blank"+i}/>)}{Array.from({length:count},(_,i)=>{const day=i+1,active=parts.year===view.year&&parts.month===view.month&&parts.day===day;return <button key={day} type="button" disabled={disabled(day)} aria-pressed={active} className="vaani-calendar-day" data-selected={active} onClick={()=>update({...parts,year:view.year,month:view.month,day})}>{day}</button>;})}</div>
 {!dateOnly&&<><div className="vaani-calendar-time"><span>Time</span><button type="button" className="vaani-calendar-time-value" aria-expanded={timeOpen} onClick={()=>setTimeOpen(v=>!v)}>{pad(parts.hour)}:{pad(parts.minute)}<Icon kind="chevron"/></button></div>{timeOpen&&<div className="vaani-time-options"><label>Hour<div className="vaani-time-scroll">{Array.from({length:24},(_,h)=><button type="button" key={h} aria-pressed={parts.hour===h} data-selected={parts.hour===h} onClick={()=>update({...parts,hour:h})}>{pad(h)}</button>)}</div></label><label>Minute<div className="vaani-time-scroll">{[0,15,30,45].map(m=><button type="button" key={m} aria-pressed={parts.minute===m} data-selected={parts.minute===m} onClick={()=>update({...parts,minute:m})}>{pad(m)}</button>)}</div></label></div>}</>}
 <div className="vaani-calendar-actions"><button type="button" className="button-secondary" onClick={()=>setOpen(false)}>Cancel</button><button type="button" className="button-primary" onClick={()=>setOpen(false)}>Done</button></div></div>}</div>;
}
