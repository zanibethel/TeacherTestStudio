'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type RosterRow={id:string;student_email:string;student_id:string|null}
type GroupRow={id:string;name:string;member_count:number}
type AudienceMode='link'|'students'|'groups'

export default function AudiencePicker({roster,groups}:{roster:RosterRow[];groups:GroupRow[]}){
  const[audienceMode,setAudienceMode]=useState<AudienceMode>('link')
  const[selectedRoster,setSelectedRoster]=useState<Set<string>>(()=>new Set())
  const[selectedGroups,setSelectedGroups]=useState<Set<string>>(()=>new Set())
  const allRoster=roster.length>0&&selectedRoster.size===roster.length
  const allGroups=groups.length>0&&selectedGroups.size===groups.length
  const rosterLabel=useMemo(()=>`${roster.length} student${roster.length===1?'':'s'} available`,[roster.length])
  const groupLabel=useMemo(()=>`${groups.length} group${groups.length===1?'':'s'} available`,[groups.length])

  function toggleRoster(id:string){setAudienceMode('students');setSelectedRoster(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}
  function toggleGroup(id:string){setAudienceMode('groups');setSelectedGroups(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}
  function toggleAllRoster(){setAudienceMode('students');setSelectedRoster(allRoster?new Set():new Set(roster.map(r=>r.id)))}
  function toggleAllGroups(){setAudienceMode('groups');setSelectedGroups(allGroups?new Set():new Set(groups.map(g=>g.id)))}

  return <section className="audience-picker">
    <label>Who should receive this share?</label>
    <select name="audience_mode" value={audienceMode} onChange={e=>setAudienceMode(e.target.value as AudienceMode)}>
      <option value="link">Anyone with this share link</option>
      <option value="groups">Specific roster groups</option>
      <option value="students">Specific students from my roster</option>
    </select>

    <div className="audience-card-grid">
      <details className={`audience-card ${audienceMode==='groups'?'audience-card-active':''}`}>
        <summary><span><b>Groups</b><small>{groupLabel}{selectedGroups.size?` · ${selectedGroups.size} selected`:''}</small></span><span aria-hidden>▾</span></summary>
        <div className="audience-card-body">
          {!groups.length?<p className="muted">No groups yet.</p>:<>
            <label className="check audience-select-all"><input type="checkbox" checked={allGroups} ref={el=>{if(el)el.indeterminate=selectedGroups.size>0&&!allGroups}} onChange={toggleAllGroups}/><b>Select all groups</b></label>
            <div className="audience-list">{groups.map(g=><label className="check audience-row" key={g.id}><input type="checkbox" name="group_ids" value={g.id} checked={selectedGroups.has(g.id)} onChange={()=>toggleGroup(g.id)}/><span><b>{g.name}</b><small>{g.member_count} student{g.member_count===1?'':'s'}</small></span></label>)}</div>
          </>}
          <Link href="/teacher-groups">Manage groups →</Link>
        </div>
      </details>

      <details className={`audience-card ${audienceMode==='students'?'audience-card-active':''}`}>
        <summary><span><b>Roster students</b><small>{rosterLabel}{selectedRoster.size?` · ${selectedRoster.size} selected`:''}</small></span><span aria-hidden>▾</span></summary>
        <div className="audience-card-body">
          {!roster.length?<p className="muted">No roster students yet.</p>:<>
            <label className="check audience-select-all"><input type="checkbox" checked={allRoster} ref={el=>{if(el)el.indeterminate=selectedRoster.size>0&&!allRoster}} onChange={toggleAllRoster}/><b>Select all students</b></label>
            <div className="audience-list">{roster.map(r=><label className="check audience-row" key={r.id}><input type="checkbox" name="roster_ids" value={r.id} checked={selectedRoster.has(r.id)} onChange={()=>toggleRoster(r.id)}/><span><b>{r.student_email}</b>{!r.student_id&&<small>Not signed up yet</small>}</span></label>)}</div>
          </>}
          <Link href="/teacher-roster">Manage student roster →</Link>
        </div>
      </details>
    </div>
    <p className="muted field-help">Choose the audience above. Expanding these cards lets you quickly select an entire group or roster list, or pick individuals.</p>
  </section>
}
