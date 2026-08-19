'use client'

import Link from 'next/link'
import {useMemo,useState} from 'react'
import styles from './reports.module.css'

type Attempt={id:string;attemptNumber:number;submittedAt:string|null;score:number|null;correct:number|null;total:number|null;integrity:number;autoSubmitted:boolean}
type StudentResult={key:string;label:string;accessed:boolean;completed:boolean;best:number|null;attempts:Attempt[]}
type Report={id:string;testId:string;testTitle:string;label:string;experienceName:string|null;createdAt:string;dueAt:string|null;active:boolean;deliveryMode:string;audienceMode:string;maxAttempts:number;unlimited:boolean;focusedRequired:boolean;focusedPercent:number;focusedMin:number;focusedHints:boolean;studyGuide:boolean;randomizedRetest:boolean;restricted:boolean;linkExpiresAt:string|null;groupIds:string[];groupNames:string[];studentRefs:string[];studentLabels:string[];students:StudentResult[]}
type Option={value:string;label:string}

const norm=(v:string)=>v.toLowerCase().replace(/\s+/g,' ').trim()
const fmt=(v:string|null)=>v?new Date(v).toLocaleString():'None'

export default function ReportsBrowser({reports,tests,groups,students}:{reports:Report[];tests:Option[];groups:Option[];students:Option[]}){
 const[q,setQ]=useState('');const[test,setTest]=useState('');const[assignment,setAssignment]=useState('');const[group,setGroup]=useState('');const[student,setStudent]=useState('')
 const assignments=useMemo(()=>reports.map(r=>({value:r.id,label:`${r.label} — ${r.testTitle}`})),[reports])
 const filtered=useMemo(()=>{const needle=norm(q);return reports.filter(r=>{
   const search=norm([r.testTitle,r.label,r.experienceName||'',...r.groupNames,...r.studentLabels].join(' '))
   return(!needle||search.includes(needle))&&(!test||r.testId===test)&&(!assignment||r.id===assignment)&&(!group||r.groupIds.includes(group))&&(!student||r.studentRefs.includes(student))
 })},[reports,q,test,assignment,group,student])
 const hasFilters=Boolean(q||test||assignment||group||student)
 function clear(){setQ('');setTest('');setAssignment('');setGroup('');setStudent('')}
 return <>
  <section className={`card ${styles.tools}`}>
   <div className={styles.searchRow}><div><label>Search reports</label><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search test, assignment, group, student, or preset"/></div>{hasFilters&&<button type="button" className="secondary" onClick={clear}>Clear</button>}</div>
   <div className={styles.filters}>
    <div><label>Test</label><select value={test} onChange={e=>setTest(e.target.value)}><option value="">All tests</option>{tests.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
    <div><label>Assignment</label><select value={assignment} onChange={e=>setAssignment(e.target.value)}><option value="">All assignments</option>{assignments.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
    <div><label>Group</label><select value={group} onChange={e=>setGroup(e.target.value)}><option value="">All groups</option>{groups.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
    <div><label>Student</label><select value={student} onChange={e=>setStudent(e.target.value)}><option value="">All students</option>{students.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
   </div>
   <p className="muted">{filtered.length} assignment report{filtered.length===1?'':'s'} · newest shared first</p>
  </section>
  {!filtered.length?<section className="card"><b>No matching reports</b><p className="muted">Try clearing a filter or using a broader search.</p></section>:filtered.map(r=>{
   const accessed=r.students.filter(s=>s.accessed).length,completed=r.students.filter(s=>s.completed).length
   const mode=r.deliveryMode==='paid_pass'?'Paid practice access':r.deliveryMode==='restricted'?'Restricted Test Mode':'Standard test'
   const experience=r.experienceName||mode
   const attempts=r.unlimited?'Unlimited until due date':`${r.maxAttempts} full attempt${r.maxAttempts===1?'':'s'}`
   const focus=r.focusedRequired?`Required · ${r.focusedPercent}% size · ${r.focusedMin}% to proceed`:r.studyGuide?'Optional learning path':'Not required'
   return <details className={`card ${styles.report}`} key={r.id}>
    <summary>
     <div className={styles.heading}><div><span className="eyebrow">{r.label}</span><h2>{r.testTitle}</h2><div className={styles.preset}><span>Preset</span><b>{experience}</b></div></div><span className="pill">{r.active?'Active':'Disabled'}</span></div>
     <div className={styles.stats}><div><span>Assigned</span><b>{new Date(r.createdAt).toLocaleDateString()}</b></div><div><span>Due</span><b>{r.dueAt?new Date(r.dueAt).toLocaleDateString():'No due date'}</b></div><div className={styles.accessStat}><span>Accessed</span><b>{accessed}</b></div><div className={styles.completeStat}><span>Taken</span><b>{completed}</b></div></div>
     <div className={styles.quickRow}><span className="muted">{r.groupNames.length?`Group${r.groupNames.length===1?'':'s'}: ${r.groupNames.join(', ')}`:'Open assignment'}</span><b className={styles.viewGrades}>View grades ▾</b></div>
    </summary>
    <div className={styles.body}>
     <div className={styles.resultsHeader}><div><h3>Student grades</h3><p className="muted">{completed} taken · {accessed} accessed</p></div><Link href={`/tests/${r.testId}`}>Open test →</Link></div>
     {!r.students.length?<p className="muted">No targeted or accessing students yet.</p>:r.students.map(s=><div className={styles.student} key={s.key}><div className="row between"><div><b>{s.label}</b><p className="muted">{s.completed?`${s.attempts.filter(a=>a.submittedAt).length} completed attempt${s.attempts.filter(a=>a.submittedAt).length===1?'':'s'}`:s.accessed?'Accessed · not complete':'Assigned · not started'}</p></div>{s.best!==null&&<b className={styles.grade}>Highest {s.best}%</b>}</div>{s.attempts.filter(a=>a.submittedAt).map(a=><div className="result-row" key={a.id}><div><b>Attempt {a.attemptNumber}</b><p className="muted">{fmt(a.submittedAt)}{a.autoSubmitted?' · Auto-submitted':''}</p></div><div><b>{a.score}%</b><p className="muted">{a.correct}/{a.total} correct</p></div><Link href={`/attempts/${a.id}`}>Details</Link></div>)}</div>)}
     <details className={styles.parameters}>
      <summary><b>Parameters</b><span className="muted">View settings used for this share</span></summary>
      <div className={styles.parameterGrid}><p><b>Preset:</b> {experience}</p><p><b>Audience:</b> {r.audienceMode==='groups'?'Specific groups':r.audienceMode==='students'?'Specific roster students':'Anyone with link'}</p><p><b>Assigned:</b> {fmt(r.createdAt)}</p><p><b>Due:</b> {fmt(r.dueAt)}</p><p><b>Full attempts:</b> {attempts}</p><p><b>Focused retake:</b> {focus}</p><p><b>Focused hints:</b> {r.focusedHints?'On':'Off'}</p><p><b>Study guide:</b> {r.studyGuide?'On':'Off'}</p><p><b>Fresh full retest:</b> {r.randomizedRetest?'On when another attempt is allowed':'Off'}</p><p><b>Integrity monitoring:</b> {r.restricted?'On':'Off'}</p><p><b>Link expiration:</b> {fmt(r.linkExpiresAt)}</p></div>
     </details>
    </div>
   </details>
  })}
 </>
}
