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
  const selectedVisible=filtered.filter(q=>selected.has(q.id)).length

  return <>
    <section className="bank-tree-toolbar">
      <input className="bank-tree-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions, topics, or bundles…" autoComplete="off"/>
      <div className="bank-tree-status"><span>{filtered.length} of {questions.length} questions</span>{selected.size>0&&<span> · {selected.size} selected</span>}{search&&<button className="bank-clear-search" type="button" onClick={()=>setSearch('')}>Clear</button>}</div>
    </section>

    {!filtered.length?<section className="card"><p className="muted">No saved questions match your search.</p></section>:<div className="bank-tree">
      {groups.map(bundle=>{
        const bundleIds=bundle.sections.flatMap(section=>section.questions.map(q=>q.id))
        const bundleSelected=bundleIds.filter(id=>selected.has(id)).length
        const bundleAll=bundleIds.length>0&&bundleSelected===bundleIds.length
        return <details className="bank-bundle" key={bundle.title} open={Boolean(needle)}>
          <summary className="bank-bundle-summary">
            <div className="bank-tree-title"><b>{bundle.title}</b><span>{bundleIds.length} questions · {bundle.sections.length} sections</span></div>
            <SelectionBox checked={bundleAll} indeterminate={bundleSelected>0&&!bundleAll} onChange={checked=>setMany(bundleIds,checked)} label="All"/>
          </summary>
          <div className="bank-section-list">
            {bundle.sections.map(section=>{
              const sectionIds=section.questions.map(q=>q.id)
              const sectionSelected=sectionIds.filter(id=>selected.has(id)).length
              const sectionAll=sectionIds.length>0&&sectionSelected===sectionIds.length
              return <details className="bank-section" key={section.title} open={Boolean(needle)}>
                <summary className="bank-section-summary">
                  <div className="bank-tree-title"><b>{section.title}</b><span>{section.questions.length}</span></div>
                  <SelectionBox checked={sectionAll} indeterminate={sectionSelected>0&&!sectionAll} onChange={checked=>setMany(sectionIds,checked)} label="All"/>
                </summary>
                <div className="bank-question-list">
                  {section.questions.map(q=>{const choices=Array.isArray(q.choices)?q.choices:[];return <div className="bank-question-row" key={q.id}>
                    <label className="bank-question-select"><input type="checkbox" checked={selected.has(q.id)} onChange={e=>setMany([q.id],e.target.checked)}/><span>{q.prompt}</span></label>
                    <div className="bank-question-actions"><details><summary>Preview</summary><ol type="A">{choices.map((choice:string,i:number)=><li key={i}><span className={i===q.correct_index?'good':''}>{choice}{i===q.correct_index?' ✓':''}</span></li>)}</ol></details><Link href={`/question-bank/${q.id}/edit`}>Edit</Link><form action={deleteAction.bind(null,q.id)}><button className="bank-text-button danger">Remove</button></form></div>
                  </div>})}
                </div>
              </details>
            })}
          </div>
        </details>
      })}
    </div>}

    {selected.size>0&&<div className="bank-selection-bar"><span><b>{selected.size} selected</b>{needle&&<span className="muted"> · {selectedVisible} visible</span>}</span><button className="ghost" type="button" onClick={()=>setSelected(new Set())}>Clear selection</button></div>}

    <style jsx global>{`
      .bank-tree-toolbar{position:sticky;top:8px;z-index:10;background:#f6f7fb;padding:8px 0 10px;margin:14px 0 6px}
      .bank-tree-search{margin:0;padding:11px 13px;background:#fff}
      .bank-tree-status{display:flex;align-items:center;gap:4px;min-height:26px;margin-top:5px;color:#64748b;font-size:12px}
      .bank-clear-search{margin-left:auto;background:transparent;color:#4338ca;padding:3px 6px;font-size:12px}
      .bank-tree{display:flex;flex-direction:column;gap:9px}
      .bank-bundle,.bank-section{background:#fff;border:1px solid #e4e7ef;border-radius:13px;overflow:hidden}
      .bank-bundle-summary,.bank-section-summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;padding:13px 14px}
      .bank-bundle-summary::-webkit-details-marker,.bank-section-summary::-webkit-details-marker{display:none}
      .bank-bundle-summary:before,.bank-section-summary:before{content:'›';font-size:20px;color:#64748b;transition:.15s;flex:0 0 auto}
      .bank-bundle[open]>.bank-bundle-summary:before,.bank-section[open]>.bank-section-summary:before{transform:rotate(90deg)}
      .bank-bundle-summary{background:#fff}
      .bank-section-list{padding:0 10px 10px;background:#f8fafc;border-top:1px solid #eef0f4}
      .bank-section{margin-top:9px;box-shadow:none;border-radius:10px}
      .bank-section-summary{padding:10px 12px}
      .bank-tree-title{min-width:0;flex:1;display:flex;align-items:baseline;gap:8px}
      .bank-tree-title b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bank-tree-title span{color:#64748b;font-size:11px;white-space:nowrap}
      .bank-tree-check{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#475569;flex:0 0 auto;cursor:pointer}
      .bank-tree-check input,.bank-question-select input{width:auto;margin:0;accent-color:#4338ca}
      .bank-question-list{border-top:1px solid #eef0f4}
      .bank-question-row{padding:9px 11px;border-bottom:1px solid #f0f2f6}
      .bank-question-row:last-child{border-bottom:0}
      .bank-question-select{display:grid;grid-template-columns:18px 1fr;gap:8px;align-items:start;font-size:13px;font-weight:550;line-height:1.35;cursor:pointer}
      .bank-question-select input{margin-top:2px}
      .bank-question-actions{display:flex;align-items:flex-start;gap:10px;margin:5px 0 0 26px;font-size:11px}
      .bank-question-actions a,.bank-question-actions summary,.bank-text-button{color:#4338ca;font-size:11px;font-weight:700;cursor:pointer}
      .bank-question-actions details>summary{list-style:none}
      .bank-question-actions details>summary::-webkit-details-marker{display:none}
      .bank-question-actions ol{margin:7px 0 5px;padding:8px 8px 8px 28px;background:#f8fafc;border-radius:8px;color:#475569;font-size:12px;line-height:1.55}
      .bank-question-actions form{margin:0}
      .bank-text-button{padding:0;background:transparent;border:0}
      .bank-text-button.danger{color:#b91c1c}
      .bank-selection-bar{position:sticky;bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#111827;color:#fff;border-radius:12px;padding:10px 12px;margin-top:12px;box-shadow:0 12px 30px #11182733;font-size:13px}
      .bank-selection-bar .muted{color:#cbd5e1}
      .bank-selection-bar button{padding:7px 10px;background:#fff;color:#172033}
      @media(max-width:640px){
        .bank-tree-toolbar{top:4px}
        .bank-bundle-summary,.bank-section-summary{padding:11px 10px;gap:7px}
        .bank-tree-title{display:block}
        .bank-tree-title b,.bank-tree-title span{display:block}
        .bank-tree-title b{font-size:13px;white-space:normal}
        .bank-tree-check span{display:none}
        .bank-question-row{padding:9px}
        .bank-question-actions{margin-left:26px;gap:9px}
        .bank-selection-bar{bottom:8px}
      }
    `}</style>
  </>
}
