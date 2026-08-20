'use client'

import {useMemo,useState} from 'react'

type QuestionMeta={chapter_number:number|null;chapter_title:string|null;subject_category:string|null;content_area:string|null;source_bucket_key?:string}
type SourceBucket={key:string;title:string;collection_ids:string[];questionCount:number}
type Blueprint={id?:string;name?:string;description?:string|null;chapter_filters?:Array<{chapter_number:number|null;chapter_title:string}>;source_filters?:Array<{key:string;title:string;collection_ids:string[]}>;subject_weights?:Record<string,number>;source_weights?:Record<string,number>;question_count?:number;duration_minutes?:number;passing_score_percent?:number;randomize_questions?:boolean;one_question_per_page?:boolean}

function chapterKey(q:{chapter_number?:number|null;chapter_title?:string|null}){return q.chapter_number?`n:${q.chapter_number}|${q.chapter_title||''}`:q.chapter_title?`t:${q.chapter_title}`:'none'}
function chapterText(q:{chapter_number?:number|null;chapter_title?:string|null}){if(q.chapter_number)return `Chapter ${q.chapter_number}${q.chapter_title?` — ${q.chapter_title}`:''}`;return q.chapter_title||'No chapter'}
function subjectOf(q:QuestionMeta){return (q.subject_category||q.content_area||'General / untagged').trim()}
function balanced(labels:string[]){if(!labels.length)return{} as Record<string,number>;const base=Math.floor(100/labels.length);let remainder=100-base*labels.length;return Object.fromEntries(labels.map(label=>[label,base+(remainder-->0?1:0)])) as Record<string,number>}

export default function BlueprintEditor({action,questions,sourceBuckets=[],initial}:{action:(formData:FormData)=>void;questions:QuestionMeta[];sourceBuckets?:SourceBucket[];initial?:Blueprint}){
  const initialSourceKeys=useMemo(()=>{if(initial?.id&&Array.isArray(initial.source_filters)&&initial.source_filters.length)return new Set(initial.source_filters.map(s=>s.key));return new Set(sourceBuckets.map(s=>s.key))},[initial,sourceBuckets])
  const[selectedSources,setSelectedSources]=useState<Set<string>>(initialSourceKeys)
  const[sourceMode,setSourceMode]=useState<'balanced'|'custom'>(()=>Object.keys(initial?.source_weights||{}).length?'custom':'balanced')
  const[sourceWeights,setSourceWeights]=useState<Record<string,number>>(initial?.source_weights||{})
  const sourceMap=useMemo(()=>new Map(sourceBuckets.map(s=>[s.key,s])),[sourceBuckets])
  const selectedSourceKeys=sourceBuckets.map(s=>s.key).filter(key=>selectedSources.has(key))
  const effectiveSourceWeights=sourceMode==='balanced'?balanced(selectedSourceKeys):Object.fromEntries(selectedSourceKeys.map(key=>[key,Number(sourceWeights[key])||0]))
  const sourceTotal=selectedSourceKeys.reduce((sum,key)=>sum+(effectiveSourceWeights[key]||0),0)
  const sourceQuestions=useMemo(()=>questions.filter(q=>selectedSources.has(q.source_bucket_key||'custom')),[questions,selectedSources])

  const chapterMap=useMemo(()=>{const map=new Map<string,{chapter_number:number|null;chapter_title:string;label:string}>();for(const q of sourceQuestions){const key=chapterKey(q);if(key==='none')continue;map.set(key,{chapter_number:q.chapter_number??null,chapter_title:q.chapter_title||'',label:chapterText(q)})}return map},[sourceQuestions])
  const chapterOptions=useMemo(()=>[...chapterMap.entries()].sort((a,b)=>a[1].label.localeCompare(b[1].label,undefined,{numeric:true})),[chapterMap])
  const initialKeys=useMemo(()=>new Set((initial?.chapter_filters||[]).map(f=>f.chapter_number?`n:${f.chapter_number}|${f.chapter_title||''}`:f.chapter_title?`t:${f.chapter_title}`:'none').filter(k=>k!=='none')),[initial])
  const[selected,setSelected]=useState<Set<string>>(initialKeys)
  const[subjectMode,setSubjectMode]=useState<'balanced'|'custom'>(()=>Object.keys(initial?.subject_weights||{}).length?'custom':'balanced')
  const[weights,setWeights]=useState<Record<string,number>>(initial?.subject_weights||{})
  const relevantQuestions=useMemo(()=>sourceQuestions.filter(q=>selected.size===0||selected.has(chapterKey(q))),[sourceQuestions,selected])
  const subjects=useMemo(()=>[...new Set(relevantQuestions.map(subjectOf))].sort(),[relevantQuestions])
  const effectiveSubjectWeights=subjectMode==='balanced'?balanced(subjects):Object.fromEntries(subjects.map(s=>[s,Number(weights[s])||0]))
  const total=subjects.reduce((sum,s)=>sum+(effectiveSubjectWeights[s]||0),0)

  const chapterFilters=[...selected].map(key=>chapterMap.get(key)).filter(Boolean).map(x=>({chapter_number:x!.chapter_number,chapter_title:x!.chapter_title}))
  const sourceFilters=selectedSourceKeys.map(key=>sourceMap.get(key)).filter(Boolean).map(s=>({key:s!.key,title:s!.title,collection_ids:s!.collection_ids}))
  const storedSourceWeights=sourceMode==='custom'?effectiveSourceWeights:{}
  const storedSubjectWeights=subjectMode==='custom'?effectiveSubjectWeights:{}
  const invalidSource=!selectedSourceKeys.length||Math.round(sourceTotal)!==100
  const invalidSubject=!subjects.length||Math.round(total)!==100

  function toggleSource(key:string){setSelectedSources(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next});setSelected(new Set())}
  function changeSource(key:string,value:number){setSourceWeights({...effectiveSourceWeights,[key]:value});setSourceMode('custom')}
  function toggle(key:string){setSelected(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next})}
  function changeSubject(subject:string,value:number){setWeights({...effectiveSubjectWeights,[subject]:value});setSubjectMode('custom')}

  return <form action={action} className="stack">
    {initial?.id&&<input type="hidden" name="id" value={initial.id}/>}<input type="hidden" name="chapter_filters" value={JSON.stringify(chapterFilters)}/><input type="hidden" name="source_filters" value={JSON.stringify(sourceFilters)}/><input type="hidden" name="source_weights" value={JSON.stringify(storedSourceWeights)}/><input type="hidden" name="subject_weights" value={JSON.stringify(storedSubjectWeights)}/>
    <section className="card"><h2>{initial?.id?'Edit blueprint':'New smart-test blueprint'}</h2><p className="muted">Save source banks, chapters, and weighting rules — not a frozen set of questions.</p><label>Blueprint name</label><input name="name" required defaultValue={initial?.name||''} placeholder="Example: Chapter 6 Final Review"/><label>Description <span className="muted">(optional)</span></label><textarea name="description" rows={2} defaultValue={initial?.description||''}/><div className="settings-grid"><div><label>Questions</label><input name="question_count" type="number" min="1" max="200" defaultValue={initial?.question_count??40}/></div><div><label>Timer (minutes)</label><input name="duration_minutes" type="number" min="0" max="600" defaultValue={initial?.duration_minutes??45}/></div><div><label>Passing score (%)</label><input name="passing_score_percent" type="number" min="0" max="100" defaultValue={initial?.passing_score_percent??70}/></div></div><label className="check"><input name="randomize_questions" type="checkbox" defaultChecked={initial?.randomize_questions??true}/> Randomize generated question order</label><label className="check"><input name="one_question_per_page" type="checkbox" defaultChecked={initial?.one_question_per_page??true}/> One question per page</label></section>

    <section className="card"><div className="row between"><div><h2>Question sources</h2><p className="muted">Choose the exact banks/resources this blueprint can use.</p></div><span className="pill">{selectedSourceKeys.length} selected</span></div><div className="blueprint-sources">{sourceBuckets.map(source=><label className="check blueprint-check" key={source.key}><input type="checkbox" checked={selectedSources.has(source.key)} onChange={()=>toggleSource(source.key)}/><span><b>{source.title}</b><small>{source.questionCount} questions</small></span></label>)}</div>{selectedSourceKeys.length>1&&<><div className="row between mix-head"><b>Source mix</b><div className="segmented"><button type="button" className={sourceMode==='balanced'?'active':''} onClick={()=>setSourceMode('balanced')}>Balanced</button><button type="button" className={sourceMode==='custom'?'active':''} onClick={()=>{setSourceWeights(effectiveSourceWeights);setSourceMode('custom')}}>Custom</button></div></div><div className="blueprint-sliders">{selectedSourceKeys.map(key=><label className="slider-row" key={key}><span>{sourceMap.get(key)?.title||key}</span><input type="range" min="0" max="100" step="1" value={effectiveSourceWeights[key]||0} onChange={e=>changeSource(key,Number(e.target.value))}/><b>{Math.round(effectiveSourceWeights[key]||0)}%</b></label>)}</div><p className={Math.round(sourceTotal)===100?'good':'bad'}>Source total: {Math.round(sourceTotal)}% / 100%</p></>}</section>

    <section className="card"><div className="row between"><div><h2>Chapter filter</h2><p className="muted">Choose one or several chapters from the selected sources. Leave all unchecked for every chapter.</p></div><span className="pill">{selected.size?`${selected.size} selected`:'All chapters'}</span></div>{chapterOptions.length?<div className="blueprint-chapters">{chapterOptions.map(([key,item])=><label className="check blueprint-check" key={key}><input type="checkbox" checked={selected.has(key)} onChange={()=>toggle(key)}/><span><b>{item.label}</b><small>{sourceQuestions.filter(q=>chapterKey(q)===key).length} available</small></span></label>)}</div>:<p className="muted">No chapter metadata exists in the selected sources yet.</p>}</section>

    <section className="card"><div className="row between mix-head"><div><h2>Subject mix</h2><p className="muted">Balanced is automatic. Move any slider and this switches to Custom.</p></div><div className="segmented"><button type="button" className={subjectMode==='balanced'?'active':''} onClick={()=>setSubjectMode('balanced')}>Balanced</button><button type="button" className={subjectMode==='custom'?'active':''} onClick={()=>{setWeights(effectiveSubjectWeights);setSubjectMode('custom')}}>Custom</button></div></div>{subjects.length?<div className="blueprint-sliders">{subjects.map(subject=><label className="slider-row" key={subject}><span>{subject}</span><input type="range" min="0" max="100" step="1" value={effectiveSubjectWeights[subject]||0} onChange={e=>changeSubject(subject,Number(e.target.value))}/><b>{Math.round(effectiveSubjectWeights[subject]||0)}%</b></label>)}</div>:<p className="muted">No subject categories match the selected sources and chapters.</p>}<p className={Math.round(total)===100?'good':'bad'}>Subject total: {Math.round(total)}% / 100%</p></section>

    <button type="submit" disabled={invalidSource||invalidSubject}>{initial?.id?'Save changes':'Save blueprint'}</button>
    <style jsx global>{`.blueprint-sources,.blueprint-chapters{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.blueprint-check{padding:10px 12px;border:1px solid #e4e7ef;border-radius:10px;background:#fff}.blueprint-check span{display:block}.blueprint-check small{display:block;color:#64748b;margin-top:2px}.mix-head{align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}.segmented{display:flex;gap:4px;padding:3px;background:#eef2ff;border-radius:10px}.segmented button{padding:7px 10px;background:transparent;color:#4338ca;box-shadow:none}.segmented button.active{background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.12)}.blueprint-sliders{display:grid;gap:12px;margin-top:12px}.slider-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(160px,2fr) 48px;gap:12px;align-items:center}.slider-row input[type=range]{width:100%;margin:0;accent-color:#4f46e5}.slider-row b{text-align:right;font-variant-numeric:tabular-nums}@media(max-width:640px){.slider-row{grid-template-columns:1fr 52px;gap:5px 8px}.slider-row span{grid-column:1/-1}.slider-row input[type=range]{grid-column:1}.slider-row b{grid-column:2}}`}</style>
  </form>
}
