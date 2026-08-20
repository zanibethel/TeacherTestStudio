'use client'

import Link from 'next/link'
import {useMemo,useState} from 'react'

type BankQuestion={
  id:string
  prompt:string
  choices:string[]
  correct_index:number
  content_area:string|null
  subject_category:string|null
  chapter_number:number|null
  chapter_title:string|null
  focused_retake_hint:string|null
}

function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function groupLabel(q:BankQuestion){
  const subject=(q.subject_category||q.content_area||'Uncategorized').trim()||'Uncategorized'
  const chapter=q.chapter_number?`Chapter ${q.chapter_number}${q.chapter_title?` — ${q.chapter_title}`:''}`:q.chapter_title||''
  return chapter?`${subject} · ${chapter}`:subject
}

export default function SimpleTestBuilder({action,bankQuestions}:{action:(formData:FormData)=>void;bankQuestions:BankQuestion[]}){
  const[selected,setSelected]=useState<Set<string>>(()=>new Set())
  const[search,setSearch]=useState('')
  const needle=normalize(search)
  const visible=useMemo(()=>bankQuestions.filter(q=>!needle||normalize(`${q.prompt} ${q.subject_category||''} ${q.content_area||''} ${q.chapter_title||''} ${q.chapter_number||''}`).includes(needle)),[bankQuestions,needle])
  const groups=useMemo(()=>{
    const map=new Map<string,BankQuestion[]>()
    for(const q of visible){const key=groupLabel(q);map.set(key,[...(map.get(key)||[]),q])}
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}))
  },[visible])
  const chosen=useMemo(()=>bankQuestions.filter(q=>selected.has(q.id)),[bankQuestions,selected])
  const payload=useMemo(()=>JSON.stringify(chosen.map(q=>({
    prompt:q.prompt,
    choices:q.choices,
    correctIndex:q.correct_index,
    contentArea:q.subject_category||q.content_area||'',
    subjectCategory:q.subject_category||q.content_area||'',
    chapterNumber:q.chapter_number,
    chapterTitle:q.chapter_title||'',
    focusedRetakeHint:q.focused_retake_hint||'',
    sourceType:'copied',
  }))),[chosen])

  function toggle(id:string){setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next})}
  function toggleGroup(items:BankQuestion[]){setSelected(current=>{const next=new Set(current);const all=items.every(q=>next.has(q.id));for(const q of items){if(all)next.delete(q.id);else next.add(q.id)}return next})}

  return <form action={action} className="stack">
    <section className="card stack">
      <div><h2 style={{margin:'0 0 4px'}}>Test details</h2></div>
      <div><label>Test title</label><input name="title" required maxLength={160} placeholder="Chapter 4 exam"/></div>
      <div><label>Description <span className="muted">(optional)</span></label><textarea name="description" rows={3} placeholder="What this test covers"/></div>
      <input type="hidden" name="assessment_type" value="custom"/>
      <input type="hidden" name="exam_preset" value="custom"/>
      <input type="hidden" name="duration_minutes" value="0"/>
      <input type="hidden" name="passing_score" value="70"/>
      <input type="hidden" name="single_page" value="on"/>
      <input type="hidden" name="questions_per_attempt" value={chosen.length}/>
      <input type="hidden" name="questions" value={payload}/>
    </section>

    <section className="card stack">
      <div className="row between" style={{alignItems:'flex-start',gap:12,flexWrap:'wrap'}}><div><span className="eyebrow">QUESTION BANK</span><h2 style={{margin:'5px 0 4px'}}>Choose questions</h2><p className="muted" style={{margin:0}}>Select the questions that belong in this test.</p></div><span className="pill">{chosen.length} selected</span></div>
      <div className="row" style={{gap:8,flexWrap:'wrap'}}><input style={{flex:'1 1 260px'}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions, subject, or chapter"/><Link className="secondary button" href="/question-bank">Manage question bank</Link></div>
      {!bankQuestions.length?<div className="empty-state"><h3>Your question bank is empty</h3><p className="muted">Add questions first, then come back to build the test.</p><Link className="button" href="/question-bank">Add questions</Link></div>:groups.length===0?<p className="muted">No questions match that search.</p>:<div className="stack" style={{gap:8}}>{groups.map(([label,items])=>{const selectedCount=items.filter(q=>selected.has(q.id)).length;const all=selectedCount===items.length;return <details className="card" style={{margin:0,padding:12}} key={label} open={Boolean(search)}><summary style={{cursor:'pointer'}}><span className="row between" style={{display:'inline-flex',width:'calc(100% - 20px)',gap:8}}><b>{label}</b><span className="muted">{selectedCount}/{items.length}</span></span></summary><div style={{marginTop:10}}><label className="check"><input type="checkbox" checked={all} ref={el=>{if(el)el.indeterminate=selectedCount>0&&!all}} onChange={()=>toggleGroup(items)}/><b>Select all in this section</b></label>{items.map(q=><label className="check" key={q.id} style={{alignItems:'flex-start',padding:'9px 0',borderTop:'1px solid #eef0f5'}}><input type="checkbox" checked={selected.has(q.id)} onChange={()=>toggle(q.id)}/><span><b style={{display:'block'}}>{q.prompt}</b><small className="muted">{q.choices.length} choices</small></span></label>)}</div></details>})}</div>}
    </section>

    {chosen.length>0&&<details className="card"><summary><b>Selected questions ({chosen.length})</b></summary><div style={{marginTop:10}}>{chosen.map((q,index)=><div className="question-summary" key={q.id}><b>{index+1}. {q.prompt}</b><button type="button" className="ghost" onClick={()=>toggle(q.id)}>Remove</button></div>)}</div></details>}

    <section className="card"><button style={{width:'100%'}} disabled={!chosen.length}>Save test</button>{!chosen.length&&<p className="muted" style={{textAlign:'center',marginBottom:0}}>Select at least one Question Bank question to save this test.</p>}</section>
  </form>
}
