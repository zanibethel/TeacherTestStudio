'use client'

import Link from 'next/link'
import { useEffect,useMemo,useRef,useState } from 'react'

type BankQuestion={
  id:string
  prompt:string
  choices:string[]
  correct_index:number
  content_area:string|null
  source_type:string
  shared_question_id:string|null
  imported_collection_id:string|null
  collection_title:string|null
  collection_section:string|null
}

type Group={title:string;sections:{title:string;questions:BankQuestion[]}[]}

function normalize(value:string){return value.toLowerCase().replace(/\s+/g,' ').trim()}

function SelectionBox({checked,indeterminate,onChange,label}:{checked:boolean;indeterminate?:boolean;onChange:(checked:boolean)=>void;label:string}){
  const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{if(ref.current)ref.current.indeterminate=Boolean(indeterminate)},[indeterminate])
  return <label className="bank-tree-check" onClick={e=>e.stopPropagation()}><input ref={ref} type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span>{label}</span></label>
}

export default function QuestionBankBrowser({questions,deleteAction}:{questions:BankQuestion[];deleteAction:(id:string)=>Promise<void>|void}){
  const[search,setSearch]=useState('')
  const[selected,setSelected]=useState<Set<string>>(()=>new Set())
  const needle=normalize(search)

  const filtered=useMemo(()=>questions.filter(q=>!needle||normalize(`${q.prompt} ${q.content_area??''} ${q.collection_title??''} ${q.collection_section??''} ${q.source_type??''}`).includes(needle)),[questions,needle])
  const groups=useMemo<Group[]>(()=>{
    const byBundle=new Map<string,Map<string,BankQuestion[]>>()
    for(const q of filtered){
      const bundle=q.collection_title||'My questions'
      const section=q.collection_section||q.content_area||'Uncategorized'
      if(!byBundle.has(bundle))byBundle.set(bundle,new Map())
      const sections=byBundle.get(bundle)!
      if(!sections.has(section))sections.set(section,[])
      sections.get(section)!.push(q)
    }
    return [...byBundle.entries()].map(([title,sections])=>({title,sections:[...sections.entries()].map(([sectionTitle,items])=>({title:sectionTitle,questions:items}))}))
  },[filtered])

  function setMany(ids:string[],checked:boolean){setSelected(current=>{const next=new Set(current);ids.forEach(id=>checked?next.add(id):next.delete(id));return next})}
  function toggleOne(id:string,checked:boolean){setMany([id],checked)}
  const selectedVisible=filtered.filter(q=>selected.has(q.id)).length

  return <>
    <section className="bank-tree-toolbar">
      <input className="bank-tree-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions, topics, bundles, or tests…" autoComplete="off"/>
      <div className="row between bank-tree-status"><span className="muted">{filtered.length} of {questions.length} questions · {selected.size} selected</span>{search&&<button className="ghost compact-button" type="button" onClick={()=>setSearch('')}>Clear</button>}</div>
    </section>

    {!filtered.length?<section className="card"><p className="muted">No saved questions match your search.</p></section>:<div className="bank-tree">
      {groups.map(bundle=>{
        const bundleIds=bundle.sections.flatMap(section=>section.questions.map(q=>q.id))
        const bundleSelected=bundleIds.filter(id=>selected.has(id)).length
        const bundleAll=bundleIds.length>0&&bundleSelected===bundleIds.length
        const bundleSome=bundleSelected>0&&!bundleAll
        return <details className="bank-bundle" key={bundle.title} open={Boolean(needle)}>
          <summary className="bank-bundle-summary">
            <div className="bank-tree-title"><b>{bundle.title}</b><span>{bundleIds.length} questions · {bundle.sections.length} section{bundle.sections.length===1?'':'s'}</span></div>
            <SelectionBox checked={bundleAll} indeterminate={bundleSome} onChange={checked=>setMany(bundleIds,checked)} label="Select all"/>
          </summary>
          <div className="bank-section-list">
            {bundle.sections.map(section=>{
              const sectionIds=section.questions.map(q=>q.id)
              const sectionSelected=sectionIds.filter(id=>selected.has(id)).length
              const sectionAll=sectionIds.length>0&&sectionSelected===sectionIds.length
              const sectionSome=sectionSelected>0&&!sectionAll
              return <details className="bank-section" key={section.title} open={Boolean(needle)}>
                <summary className="bank-section-summary">
                  <div className="bank-tree-title"><b>{section.title}</b><span>{section.questions.length} question{section.questions.length===1?'':'s'}</span></div>
                  <SelectionBox checked={sectionAll} indeterminate={sectionSome} onChange={checked=>setMany(sectionIds,checked)} label="All"/>
                </summary>
                <div className="bank-question-list">
                  {section.questions.map(q=>{const choices=Array.isArray(q.choices)?q.choices:[];return <div className="bank-question-row" key={q.id}>
                    <label className="bank-question-select"><input type="checkbox" checked={selected.has(q.id)} onChange={e=>toggleOne(q.id,e.target.checked)}/><span>{q.prompt}</span></label>
                    <div className="bank-question-actions"><details><summary>Preview</summary><ol type="A">{choices.map((choice:string,i:number)=><li key={i}><span className={i===q.correct_index?'good':''}>{choice}{i===q.correct_index?' ✓':''}</span></li>)}</ol></details><Link href={`/question-bank/${q.id}/edit`}>Edit</Link><form action={deleteAction.bind(null,q.id)}><button className="bank-text-button danger">Remove</button></form></div>
                  </div>})}
                </div>
              </details>
            })}
          </div>
        </details>
      })}
    </div>}

    {selected.size>0&&<div className="bank-selection-bar"><div><b>{selected.size} selected</b>{needle&&<span className="muted"> · {selectedVisible} visible in search</span>}</div><div className="row"><button className="ghost compact-button" type="button" onClick={()=>setSelected(new Set())}>Clear selection</button><Link className="button" href={`/tests/new?selected=${encodeURIComponent([...selected].join(','))}`}>Build test with selected</Link></div></div>}
  </>
}
