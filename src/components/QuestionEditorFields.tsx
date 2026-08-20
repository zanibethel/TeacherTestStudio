'use client'

import {useEffect,useMemo,useRef,useState} from 'react'

export type QuestionEditorValue={
  prompt:string
  choices:string[]
  correctIndex:number
  chapterNumber:number|null
  chapterTitle:string
  subjectCategory:string
  focusedRetakeHint:string
  explanation?:string
  contentArea?:string
  sourceType?:string
}

export type ChapterOption={number:number|null;title:string}

type Names={
  prompt?:string
  chapterNumber?:string
  chapterTitle?:string
  subjectCategory?:string
  choices?:string
  correctIndex?:string
  focusedRetakeHint?:string
  explanation?:string
}

type Props={
  value:QuestionEditorValue
  onChange?:(value:QuestionEditorValue)=>void
  chapterOptions?:ChapterOption[]
  subjectOptions?:string[]
  names?:Names
  showExplanation?:boolean
  showRemove?:boolean
  onRemove?:()=>void
  title?:string
}

function chapterDisplay(number:number|null,title:string){
  if(number)return `Chapter ${number}${title?` — ${title}`:''}`
  return title
}

function parseChapter(value:string){
  const trimmed=value.trim()
  if(!trimmed)return{number:null as number|null,title:''}
  const match=trimmed.match(/^chapter\s+(\d+)(?:\s*[—–-]\s*(.*))?$/i)
  if(match)return{number:Number(match[1]),title:(match[2]||'').trim()}
  return{number:null,title:trimmed}
}

function AutoGrowTextarea({value,onChange,...props}:{value:string;onChange:(value:string)=>void}&Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>,'value'|'onChange'>){
  const ref=useRef<HTMLTextAreaElement>(null)
  useEffect(()=>{const el=ref.current;if(!el)return;el.style.height='0px';el.style.height=`${Math.max(el.scrollHeight,44)}px`},[value])
  return <textarea ref={ref} value={value} rows={1} onChange={e=>onChange(e.target.value)} {...props}/>
}

function MetadataSuggest({label,value,options,onChange,placeholder,kind}:{label:string;value:string;options:string[];onChange:(value:string)=>void;placeholder:string;kind:'chapter'|'subject'}){
  const[focused,setFocused]=useState(false)
  const normalized=value.trim().toLowerCase()
  const matches=useMemo(()=>options.filter(option=>!normalized||option.toLowerCase().includes(normalized)).slice(0,7),[options,normalized])
  const exact=options.find(option=>option.trim().toLowerCase()===normalized)
  return <div className="qe-metadata-field">
    <label>{label} <span className="muted">(optional)</span></label>
    <AutoGrowTextarea value={value} onChange={onChange} onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),120)} placeholder={placeholder} autoComplete="off"/>
    {focused&&value.trim()&&matches.length>0&&<div className="qe-suggestions">{matches.map(option=><button type="button" key={option} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(option);setFocused(false)}}>{option}</button>)}</div>}
    {value.trim()&&exact&&<p className="muted qe-help">Will use existing {kind} <b>{exact}</b>.</p>}
    {value.trim()&&!exact&&<p className="muted qe-help">No exact match. CramLoop will save this as a new {kind} option.</p>}
  </div>
}

export default function QuestionEditorFields({value,onChange,chapterOptions=[],subjectOptions=[],names={},showExplanation=true,showRemove=false,onRemove,title}:Props){
  const patch=(next:Partial<QuestionEditorValue>)=>onChange?.({...value,...next})
  const chapterOptionsDisplay=useMemo(()=>[...new Set(chapterOptions.map(option=>chapterDisplay(option.number,option.title)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),[chapterOptions])
  const subjectList=useMemo(()=>[...new Set(subjectOptions.map(x=>x.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),[subjectOptions])
  const currentChapter=chapterDisplay(value.chapterNumber,value.chapterTitle)
  function setChapter(text:string){
    const exact=chapterOptions.find(option=>chapterDisplay(option.number,option.title).toLowerCase()===text.trim().toLowerCase()||option.title.toLowerCase()===text.trim().toLowerCase())
    const parsed=exact?{number:exact.number,title:exact.title}:parseChapter(text)
    patch({chapterNumber:parsed.number,chapterTitle:parsed.title})
  }
  function setSubject(text:string){patch({subjectCategory:text,contentArea:text})}
  function updateChoice(index:number,text:string){patch({choices:value.choices.map((choice,i)=>i===index?text:choice)})}
  function addChoice(){if(value.choices.length<6)patch({choices:[...value.choices,'']})}
  function removeChoice(index:number){
    if(value.choices.length<=2)return
    const choices=value.choices.filter((_,i)=>i!==index)
    const correctIndex=value.correctIndex===index?0:value.correctIndex>index?value.correctIndex-1:value.correctIndex
    patch({choices,correctIndex})
  }

  return <section className="qe-editor">
    {(title||showRemove)&&<div className="row between qe-heading">{title?<h3>{title}</h3>:<span/>}{showRemove&&<button type="button" className="ghost danger" onClick={onRemove}>Remove</button>}</div>}
    <label>Question</label>
    <AutoGrowTextarea name={names.prompt} required value={value.prompt} onChange={text=>patch({prompt:text})} placeholder="Type the question"/>

    <MetadataSuggest label="Chapter" value={currentChapter} options={chapterOptionsDisplay} onChange={setChapter} placeholder="Example: Chapter 4 — Infection Control" kind="chapter"/>
    {names.chapterNumber&&<input type="hidden" name={names.chapterNumber} value={value.chapterNumber??''}/>} 
    {names.chapterTitle&&<input type="hidden" name={names.chapterTitle} value={value.chapterTitle}/>} 

    <MetadataSuggest label="Subject category" value={value.subjectCategory} options={subjectList} onChange={setSubject} placeholder="Example: Safety, Sanitation & Infection Control" kind="subject"/>
    {names.subjectCategory&&<input type="hidden" name={names.subjectCategory} value={value.subjectCategory}/>} 
    <p className="muted qe-meta-note">Chapter and subject are recommended, not required. Leave either blank and the question stays available under Custom · Unassigned.</p>

    <label>Answer choices</label>
    <p className="muted qe-help">Select the circle beside the correct answer.</p>
    <div className="qe-choice-list">{value.choices.map((choice,index)=><div className="qe-choice" key={index}>
      <input type="radio" name={names.correctIndex||`qe-correct-${title||'question'}`} value={index} checked={value.correctIndex===index} onChange={()=>patch({correctIndex:index})}/>
      <AutoGrowTextarea name={names.choices} required value={choice} onChange={text=>updateChoice(index,text)} placeholder={`Answer choice ${index+1}`}/>
      <span className="qe-correct-label">Correct</span>
      <button type="button" className="ghost qe-remove-choice" onClick={()=>removeChoice(index)} disabled={value.choices.length<=2} aria-label={`Remove answer choice ${index+1}`}>×</button>
    </div>)}</div>
    <button type="button" className="secondary qe-add-choice" onClick={addChoice} disabled={value.choices.length>=6}>+ Answer choice</button>

    <label>Focused retake hint <span className="muted">(optional)</span></label>
    <AutoGrowTextarea name={names.focusedRetakeHint} value={value.focusedRetakeHint} onChange={text=>patch({focusedRetakeHint:text})} placeholder="Teach the idea without giving away the answer."/>
    <p className="muted qe-help">Only shown during focused retakes when hints are enabled.</p>

    {showExplanation&&<><label>Explanation / teaching note <span className="muted">(optional)</span></label><AutoGrowTextarea name={names.explanation} value={value.explanation??''} onChange={text=>patch({explanation:text})} placeholder="Why is this answer correct?"/></>}

    <style jsx global>{`
      .qe-editor{display:grid;gap:9px;min-width:0}.qe-heading{align-items:center}.qe-heading h3{margin:0}
      .qe-editor textarea{width:100%;min-height:44px;overflow:hidden;resize:vertical;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;line-height:1.35}
      .qe-metadata-field{position:relative;min-width:0}.qe-metadata-field>label{display:block}.qe-suggestions{position:absolute;z-index:30;left:0;right:0;top:calc(100% - 3px);background:#fff;border:1px solid #d9deea;border-radius:12px;box-shadow:0 14px 34px #0f172a24;padding:5px;display:grid;gap:3px}
      .qe-suggestions button{background:#fff;color:#111827;text-align:left;padding:9px 10px;border-radius:8px;font-weight:650}.qe-suggestions button:hover{background:#eef2ff;color:#4338ca}
      .qe-help{margin:-3px 0 2px;font-size:.88rem}.qe-meta-note{margin:0 0 4px;line-height:1.45}.qe-choice-list{display:grid;gap:10px}
      .qe-choice{display:grid;grid-template-columns:30px minmax(0,1fr) auto 32px;gap:8px;align-items:center;min-width:0}.qe-choice input[type=radio]{width:24px;height:24px;margin:0}.qe-choice textarea{margin:0}.qe-correct-label{font-weight:800;white-space:nowrap}.qe-remove-choice{padding:4px 6px;font-size:1.35rem;line-height:1}.qe-add-choice{justify-self:start}
      @media(max-width:700px){.qe-choice{grid-template-columns:28px minmax(0,1fr) 30px}.qe-correct-label{display:none}.qe-remove-choice{grid-column:3}.qe-editor{gap:10px}}
    `}</style>
  </section>
}
