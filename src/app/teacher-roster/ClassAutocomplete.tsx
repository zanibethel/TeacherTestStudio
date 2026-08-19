'use client'

import { useMemo, useState } from 'react'

type GroupOption={id:string;name:string}

type Props={
  groups:GroupOption[]
  name?:string
  inputId?:string
  label?:string
  placeholder?:string
  initialValue?:string
  helperMode?:'create'|'add'
}

export default function ClassAutocomplete({
  groups,
  name='class_name',
  inputId='roster-class',
  label='Class',
  placeholder='Example: 2nd Period or 9:05 AM',
  initialValue='',
  helperMode='create'
}:Props){
  const[value,setValue]=useState(initialValue)
  const normalized=value.trim().toLowerCase()
  const matches=useMemo(()=>{
    if(!normalized)return groups.slice(0,6)
    return groups.filter(g=>g.name.toLowerCase().includes(normalized)).slice(0,6)
  },[groups,normalized])
  const exact=groups.find(g=>g.name.trim().toLowerCase()===normalized)
  const listId=`${inputId}-suggestions`

  return <div className="class-autocomplete">
    <label htmlFor={inputId}>{label} <span className="muted">(optional)</span></label>
    <input
      id={inputId}
      name={name}
      value={value}
      onChange={e=>setValue(e.target.value)}
      autoComplete="off"
      placeholder={placeholder}
      aria-autocomplete="list"
      aria-controls={listId}
    />
    {value.trim()&&matches.length>0&&<div id={listId} className="class-suggestions" role="listbox">
      {matches.map(group=><button key={group.id} type="button" className="class-suggestion" onClick={()=>setValue(group.name)}>{group.name}</button>)}
    </div>}
    {value.trim()&&exact&&<p className="muted class-help">Will use existing class <b>{exact.name}</b>.</p>}
    {value.trim()&&!exact&&<p className="muted class-help">No exact match yet. CramLoop will {helperMode==='add'?'create this class and add the student to it':'create the class automatically'}.</p>}
  </div>
}
