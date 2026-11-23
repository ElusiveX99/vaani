"use client";
import { useMemo, useState } from "react";
type Props = { id:string; name:string; defaultValue?:string; required?:boolean; min?:string; className?:string; onChange?:(value:string)=>void; dateOnly?:boolean };
const pad=(v:number)=>String(v).padStart(2,"0");
function parse(value:string){const [date="",time="09:00"]=value.split("T");const [y,m,d]=date.split("-").map(Number);const [h,mi]=time.split(":").map(Number);return {year:y||new Date().getFullYear(),month:(m||new Date().getMonth()+1)-1,day:d||new Date().getDate(),hour:h??9,minute:mi??0};}
function formatted(v:ReturnType<typeof parse>){return `${v.year}-${pad(v.month+1)}-${pad(v.day)}T${pad(v.hour)}:${pad(v.minute)}`;}
export default function DateTimePicker({id,name,defaultValue="",required,min,className="field-input",onChange,dateOnly=false}:Props){
 const initial=useMemo(()=>parse(defaultValue||""),[defaultValue]);
 const [parts,setParts]=useState(initial),[open,setOpen]=useState(false),[view,setView]=useState({year:initial.year,month:initial.month}),[timeOpen,setTimeOpen]=useState(false);
 const full=formatted(parts),value=dateOnly?full.slice(0,10):full;
 const first=new Date(view.year,view.month,1).getDay(),count=new Date(view.year,view.month+1,0).getDate();
 const minParts=min?parse(min):null;
 const disabled=(day:number)=>!!minParts&&new Date(view.year,view.month,day)<new Date(minParts.year,minParts.month,minParts.day);
 const month=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(new Date(view.year,view.month,1));
 function update(next:typeof parts){setParts(next);onChange?.(dateOnly?formatted(next).slice(0,10):formatted(next));}
 function shift(delta:number){const d=new Date(view.year,view.month+delta,1);setView({year:d.getFullYear(),month:d.getMonth()});}
 return <div className="vaani-date-field"><input type="hidden" name={name} value={value} required={required}/>
 <button id={id} type="button" className={className+" vaani-date-trigger"} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setView({year:parts.year,month:parts.month});setOpen(v=>!v);}}>
 <span>{new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(parts.year,parts.month,parts.day))}{!dateOnly&&` · ${pad(parts.hour)}:${pad(parts.minute)}`}</span><span aria-hidden="true">▦</span></button>
 {open&&<div className="vaani-calendar" role="dialog" aria-label="Choose date"><div className="vaani-calendar-head"><button type="button" aria-label="Previous month" onClick={()=>shift(-1)}>‹</button><strong>{month}</strong><button type="button" aria-label="Next month" onClick={()=>shift(1)}>›</button></div>
 <div className="vaani-calendar-grid">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><span key={d} className="vaani-calendar-weekday">{d}</span>)}{Array.from({length:first},(_,i)=><span key={"blank"+i}/>)}{Array.from({length:count},(_,i)=>{const day=i+1,active=parts.year===view.year&&parts.month===view.month&&parts.day===day;return <button key={day} type="button" disabled={disabled(day)} aria-pressed={active} className="vaani-calendar-day" data-selected={active} onClick={()=>update({...parts,year:view.year,month:view.month,day})}>{day}</button>;})}</div>
 {!dateOnly&&<><div className="vaani-calendar-time"><span>Time</span><button type="button" className="vaani-calendar-time-value" aria-expanded={timeOpen} onClick={()=>setTimeOpen(v=>!v)}>{pad(parts.hour)}:{pad(parts.minute)} ⌄</button></div>{timeOpen&&<div className="vaani-time-options"><label>Hour<select aria-label="Hour" value={parts.hour} onChange={e=>update({...parts,hour:Number(e.target.value)})}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{pad(h)}</option>)}</select></label><label>Minute<select aria-label="Minute" value={parts.minute} onChange={e=>update({...parts,minute:Number(e.target.value)})}>{[0,15,30,45].map(m=><option key={m} value={m}>{pad(m)}</option>)}</select></label></div>}</>}
 <div className="vaani-calendar-actions"><button type="button" className="button-secondary" onClick={()=>setOpen(false)}>Cancel</button><button type="button" className="button-primary" onClick={()=>setOpen(false)}>Done</button></div></div>}</div>;
}