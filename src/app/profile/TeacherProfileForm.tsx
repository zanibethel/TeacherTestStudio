'use client'

import {useState} from 'react'
import {saveTeacherProfile} from './actions'

export default function TeacherProfileForm({displayName:initialName,organization:initialOrg,title:initialTitle}:{displayName:string;organization:string;title:string}){
  const[displayName,setDisplayName]=useState(initialName)
  const[organization,setOrganization]=useState(initialOrg)
  const[title,setTitle]=useState(initialTitle)
  const secondary=[organization.trim(),title.trim()].filter(Boolean).join(' ')
  const displayLine=[displayName.trim()||'Teacher',secondary].filter(Boolean).join(' — ')

  return <>
    <section className="card"><span className="eyebrow">LIVE STUDENT PREVIEW</span><h2 style={{marginBottom:6}}>{displayName.trim()||'Teacher'}</h2>{secondary&&<p className="muted" style={{margin:'0 0 8px'}}>{secondary}</p>}<p style={{marginBottom:0}}><b>Card display:</b> {displayLine}</p></section>
    <form action={saveTeacherProfile} className="card stack"><h2>Teacher identity</h2><div><label>Display name</label><input name="display_name" required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Mrs. Perez"/><p className="muted">Use the name students normally know you by.</p></div><div><label>School / organization</label><input name="organization" value={organization} onChange={e=>setOrganization(e.target.value)} placeholder="Monterey High School"/></div><div><label>Teaching title</label><input name="title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Cosmetology Instructor"/></div><button>Save profile</button></form>
  </>
}
