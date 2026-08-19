'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type BankQuestion={
  id:string
  prompt:string
  choices:string[]
  correct_index:number
  content_area:string|null
  source_type:string
  shared_question_id:string|null
  imported_collection_id:string|null
}

function normalize(value:string){return value.toLowerCase().replace(/\s+/g,' ').trim()}

export default function QuestionBankBrowser({questions,areas,deleteAction}:{questions:BankQuestion[];areas:string[];deleteAction:(id:string)=>Promise<void>|void}){
  const[search,setSearch]=useState('')
  const[area,setArea]=useState('')
  const filtered=useMemo(()=>{
    const needle=normalize(search)
    return questions.filter(q=>{
      if(area&&q.content_area!==area)return false
      if(!needle)return true
      return normalize(`${q.prompt} ${q.content_area??''} ${q.source_type??''}`).includes(needle)
    })
  },[questions,search,area])

  return <>
    <section className="card bank-live-filter">
      <div className="settings-grid">
        <div><label htmlFor="bank-search">Search questions</label><input id="bank-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Start typing question wording or topic" autoComplete="off"/></div>
        <div><label htmlFor="bank-area">Content area</label><select id="bank-area" value={area} onChange={e=>setArea(e.target.value)}><option value="">All topics</option>{areas.map(item=><option key={item} value={item}>{item}</option>)}</select></div>
      </div>
      <div className="row between"><p className="muted bank-filter-count">{filtered.length} of {questions.length} questions shown</p>{(search||area)&&<button className="ghost" type="button" onClick={()=>{setSearch('');setArea('')}}>Clear filters</button>}</div>
    </section>
    {!filtered.length?<section className="card"><p className="muted">No saved questions match those filters.</p></section>:filtered.map(q=>{const choices=Array.isArray(q.choices)?q.choices:[];return <section className="card bank-question-card" key={q.id}><div className="row between"><div><b>{q.prompt}</b><p className="muted">{q.content_area||'No topic'} · {q.shared_question_id?'Copied from shared library':q.source_type}</p></div><div className="row"><Link className="secondary button" href={`/question-bank/${q.id}/edit`}>Edit my copy</Link><form action={deleteAction.bind(null,q.id)}><button className="ghost danger">Remove</button></form></div></div><ol type="A">{choices.map((choice:string,i:number)=><li key={i}><span className={i===q.correct_index?'good':''}>{choice}{i===q.correct_index?' ✓':''}</span></li>)}</ol></section>})}
  </>
}
