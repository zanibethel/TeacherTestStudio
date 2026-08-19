'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type RosterRow={id:string;student_email:string;student_id:string|null}
type GroupRow={id:string;name:string;member_count:number}
type AudienceMode='link'|'students'|'groups'

const cardStyle={border:'1px solid #dbe3f4',borderRadius:14,background:'#fff',overflow:'hidden'} as const
const summaryStyle={cursor:'pointer',listStyle:'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'15px 16px'} as const
const bodyStyle={borderTop:'1px solid #eef0f4',padding:'12px 16px 16px'} as const

export default function AudiencePicker({roster,groups}:{roster:RosterRow[];groups:GroupRow[]}){
  const defaultMode:AudienceMode=groups.length?'groups':roster.length?'students':'link'
  const[audienceMode,setAudienceMode]=useState<AudienceMode>(defaultMode)
  const[selectedRoster,setSelectedRoster]=useState<Set<string>>(()=>new Set())
  const[selectedGroups,setSelectedGroups]=useState<Set<string>>(()=>new Set())
  const allRoster=roster.length>0&&selectedRoster.size===roster.length
  const allGroups=groups.length>0&&selectedGroups.size===groups.length
  const rosterLabel=useMemo(()=>`${roster.length} student${roster.length===1?'':'s'} available`,[roster.length])
  const groupLabel=useMemo(()=>`${groups.length} class${groups.length===1?'':'es'} available`,[groups.length])

  function toggleRoster(id:string){setAudienceMode('students');setSelectedRoster(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}
  function toggleGroup(id:string){setAudienceMode('groups');setSelectedGroups(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}
  function toggleAllRoster(){setAudienceMode('students');setSelectedRoster(allRoster?new Set():new Set(roster.map(r=>r.id)))}
  function toggleAllGroups(){setAudienceMode('groups');setSelectedGroups(allGroups?new Set():new Set(groups.map(g=>g.id)))}

  const selectedSummary=audienceMode==='groups'
    ? selectedGroups.size?`${selectedGroups.size} class${selectedGroups.size===1?'':'es'} selected`:'Choose at least one class'
    : audienceMode==='students'
      ? selectedRoster.size?`${selectedRoster.size} student${selectedRoster.size===1?'':'s'} selected`:'Choose at least one student'
      : 'Anyone with the link can open it'

  return <section className="notice" style={{marginTop:0}}>
    <span className="eyebrow">STEP 1</span>
    <h3 style={{margin:'4px 0'}}>Who gets this assignment?</h3>
    <p className="muted" style={{marginTop:0}}>For normal classroom work, choose a class or specific students. Use an open link only when you intentionally want broader access.</p>
    <label>Audience</label>
    <select name="audience_mode" value={audienceMode} onChange={e=>setAudienceMode(e.target.value as AudienceMode)}>
      <option value="groups">Class / group</option>
      <option value="students">Specific students</option>
      <option value="link">Anyone with this share link</option>
    </select>
    <p className="muted" style={{marginTop:6}}><b>{selectedSummary}</b></p>

    {audienceMode==='groups'&&<details open style={{...cardStyle,borderColor:'#818cf8',background:'#f8faff'}}>
      <summary style={summaryStyle}><span style={{display:'flex',flexDirection:'column',gap:3}}><b>Choose class</b><small className="muted">{groupLabel}{selectedGroups.size?` · ${selectedGroups.size} selected`:''}</small></span><span aria-hidden>▾</span></summary>
      <div style={bodyStyle}>
        {!groups.length?<><p className="muted">No classes yet.</p><Link href="/teacher-groups">Create a class →</Link></>:<>
          <label className="check" style={{padding:'8px 0 12px',borderBottom:'1px solid #eef0f4'}}><input type="checkbox" checked={allGroups} ref={el=>{if(el)el.indeterminate=selectedGroups.size>0&&!allGroups}} onChange={toggleAllGroups}/><b>Select all classes</b></label>
          <div>{groups.map(g=><label className="check" style={{padding:'11px 0',borderBottom:'1px solid #f1f5f9',alignItems:'flex-start'}} key={g.id}><input type="checkbox" name="group_ids" value={g.id} checked={selectedGroups.has(g.id)} onChange={()=>toggleGroup(g.id)}/><span style={{display:'flex',flexDirection:'column',gap:2}}><b>{g.name}</b><small className="muted">{g.member_count} student{g.member_count===1?'':'s'}</small></span></label>)}</div>
          <div style={{marginTop:12}}><Link href="/teacher-groups">Manage classes →</Link></div>
        </>}
      </div>
    </details>}

    {audienceMode==='students'&&<details open style={{...cardStyle,borderColor:'#818cf8',background:'#f8faff'}}>
      <summary style={summaryStyle}><span style={{display:'flex',flexDirection:'column',gap:3}}><b>Choose students</b><small className="muted">{rosterLabel}{selectedRoster.size?` · ${selectedRoster.size} selected`:''}</small></span><span aria-hidden>▾</span></summary>
      <div style={bodyStyle}>
        {!roster.length?<><p className="muted">No roster students yet.</p><Link href="/teacher-roster">Add students →</Link></>:<>
          <label className="check" style={{padding:'8px 0 12px',borderBottom:'1px solid #eef0f4'}}><input type="checkbox" checked={allRoster} ref={el=>{if(el)el.indeterminate=selectedRoster.size>0&&!allRoster}} onChange={toggleAllRoster}/><b>Select all students</b></label>
          <div>{roster.map(r=><label className="check" style={{padding:'11px 0',borderBottom:'1px solid #f1f5f9',alignItems:'flex-start'}} key={r.id}><input type="checkbox" name="roster_ids" value={r.id} checked={selectedRoster.has(r.id)} onChange={()=>toggleRoster(r.id)}/><span style={{display:'flex',flexDirection:'column',gap:2,overflowWrap:'anywhere'}}><b>{r.student_email}</b>{!r.student_id&&<small className="muted">Not signed up yet</small>}</span></label>)}</div>
          <div style={{marginTop:12}}><Link href="/teacher-roster">Manage student roster →</Link></div>
        </>}
      </div>
    </details>}
  </section>
}
