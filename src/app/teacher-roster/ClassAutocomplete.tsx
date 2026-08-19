'use client'

import { useMemo, useState } from 'react'

type GroupOption={id:string;name:string}

export default function ClassAutocomplete({groups}:{groups:GroupOption[]}){
  const[value,setValue]=useState('')
  const normalized=value.trim().toLowerCase()
  const matches=useMemo(()=>{
    if(!normalized)return groups.slice(0,6)
    return groups.filter(g=>g.name.toLowerCase().includes(normalized)).slice(0,6)
  },[groups,normalized])
  const exact=groups.find(g=>g.name.trim().toLowerCase()===normalized)

  return <div className="class-autocomplete">
    <label htmlFor="roster-class">Class <span className="muted">(optional)</span></label>
    <input
      id="roster-class"
      name="class_name"
      value={value}
      onChange={e=>setValue(e.target.value)}
      autoComplete="off"
      placeholder="Example: 2nd Period or 9:05 AM"
      aria-autocomplete="list"
      aria-controls="class-suggestions"
    />
    {value.trim()&&matches.length>0&&<div id="class-suggestions" className="class-suggestions" role="listbox">
      {matches.map(group=><button key={group.id} type="button" className="class-suggestion" onClick={()=>setValue(group.name)}>{group.name}</button>)}
    </div>}
    {value.trim()&&exact&&<p className="muted class-help">Will add this student to existing class <b>{exact.name}</b>.</p>}
    {value.trim()&&!exact&&<p className="muted class-help">No exact match yet. If you keep this value, CramLoop will create the class automatically.</p>}
  </div>
}
