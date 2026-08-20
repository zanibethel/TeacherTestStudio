'use client'
import {ChangeEvent,useMemo,useState} from 'react'

type DraftQuestion={prompt:string;choices:string[];correctIndex:number;contentArea:string;subjectCategory:string;chapterNumber:number|null;chapterTitle:string;focusedRetakeHint:string;sourceType?:string}
type BankQuestion={id:string;prompt:string;choices:string[];correct_index:number;content_area:string|null;subject_category:string|null;chapter_number:number|null;chapter_title:string|null;source_type:string;focused_retake_hint:string|null;imported_collection_id?:string|null;bundle_title?:string|null;source_bucket_key?:string;source_bucket_title?:string}
type PreviousQuestion={id:string;prompt:string;choices:string[];correct_index:number;content_area:string|null;subject_category:string|null;chapter_number:number|null;chapter_title:string|null;focused_retake_hint:string|null;bank_id:string|null}
type PreviousTest={id:string;title:string;updated_at:string;assessment_type?:string|null;chapter_label?:string|null;questions:PreviousQuestion[]}
type ImportSummary={added:number;duplicates:number;errors:string[]}
type SourceBucket={key:string;title:string;kind:'custom'|'bundle'|'collection';bundleId:string|null;collectionIds:string[];questionCount:number}
type BundlePreset={preset_id:string;preset_title:string;bundle_id:string;bundle_title:string;question_count:number;collection_ids:string[];weights:Record<string,number>;subject_mappings:Record<string,string>}
type MixPreset={id:string;name:string;subject_weights:Record<string,number>}
type SavePresetResult={ok:boolean;error?:string;preset?:MixPreset}

const CHOICE_HEADERS=['Choice A','Choice B','Choice C','Choice D','Choice E','Choice F']
function normalize(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function subjectOf(q:{subject_category?:string|null;content_area?:string|null}){return (q.subject_category||q.content_area||'General / untagged').trim()}
function sourceOf(q:BankQuestion){return q.source_bucket_key||'custom'}
function chapterKey(q:{chapter_number?:number|null;chapter_title?:string|null}){return q.chapter_number?`n:${q.chapter_number}|${q.chapter_title||''}`:q.chapter_title?`t:${q.chapter_title}`:'none'}
function chapterText(q:{chapter_number?:number|null;chapter_title?:string|null}){if(q.chapter_number)return `Chapter ${q.chapter_number}${q.chapter_title?` — ${q.chapter_title}`:''}`;return q.chapter_title||'No chapter'}
function blankQuestion(chapterNumber:number|null=null,chapterTitle='',subject=''):DraftQuestion{return{prompt:'',choices:['','','',''],correctIndex:0,contentArea:subject,subjectCategory:subject,chapterNumber,chapterTitle,focusedRetakeHint:''}}
function balancedWeights(labels:string[]){if(!labels.length)return{} as Record<string,number>;const base=Math.floor(100/labels.length);let remainder=100-base*labels.length;return Object.fromEntries(labels.map(label=>[label,base+(remainder-->0?1:0)])) as Record<string,number>}
function allocateCounts(labels:string[],weights:Record<string,number>,count:number){const rows=labels.map(label=>{const exact=count*(Number(weights[label])||0)/100;return{label,count:Math.floor(exact),fraction:exact-Math.floor(exact)}});let assigned=rows.reduce((sum,row)=>sum+row.count,0);for(const row of [...rows].sort((a,b)=>b.fraction-a.fraction)){if(assigned>=count)break;row.count++;assigned++}return Object.fromEntries(rows.map(row=>[row.label,row.count])) as Record<string,number>}
function parseCsv(text:string){const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>x.trim()))rows.push(row);row=[]}else cell+=ch}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows}

export default function ClassroomTestBuilder({action,saveMixPresetAction,bankQuestions=[],previousTests=[],sourceBuckets=[],bundlePresets=[],initialMixPresets=[]}:{action:(formData:FormData)=>void;saveMixPresetAction?:(name:string,weights:Record<string,number>)=>Promise<SavePresetResult>;bankQuestions?:BankQuestion[];previousTests?:PreviousTest[];sourceBuckets?:SourceBucket[];bundlePresets?:BundlePreset[];initialMixPresets?:MixPreset[]}){
 const[assessmentType,setAssessmentType]=useState<'chapter_exam'|'custom'>('chapter_exam')
 const[questions,setQuestions]=useState<DraftQuestion[]>([blankQuestion()])
 const[chapterLabel,setChapterLabel]=useState('')
 const[duration,setDuration]=useState(45)
 const[passingScore,setPassingScore]=useState(70)
 const[singlePage,setSinglePage]=useState(true)
 const[randomize,setRandomize]=useState(false)
 const[questionsPerAttempt,setQuestionsPerAttempt]=useState('')
 const[sourceSearch,setSourceSearch]=useState('')
 const[autoCount,setAutoCount]=useState(20)
 const[selectedSources,setSelectedSources]=useState<Set<string>>(()=>new Set(sourceBuckets.map(source=>source.key)))
 const[selectedChapters,setSelectedChapters]=useState<Set<string>>(()=>new Set())
 const[sourceMode,setSourceMode]=useState<'balanced'|'custom'>('balanced')
 const[sourceWeights,setSourceWeights]=useState<Record<string,number>>({})
 const[subjectMode,setSubjectMode]=useState<string>('balanced')
 const[subjectWeights,setSubjectWeights]=useState<Record<string,number>>({})
 const[mixPresets,setMixPresets]=useState<MixPreset[]>(initialMixPresets)
 const[presetName,setPresetName]=useState('')
 const[presetMessage,setPresetMessage]=useState('')
 const[blueprintError,setBlueprintError]=useState('')
 const[buildSummary,setBuildSummary]=useState('')
 const[importSummary,setImportSummary]=useState<ImportSummary|null>(null)

 const payload=useMemo(()=>JSON.stringify(questions.filter(q=>q.prompt.trim())),[questions])
 const selectedPrompts=useMemo(()=>new Set(questions.map(q=>normalize(q.prompt)).filter(Boolean)),[questions])
 const pool=useMemo(()=>questions.filter(q=>q.prompt.trim()),[questions])
 const requestedCount=questionsPerAttempt?Number(questionsPerAttempt):pool.length
 const countInvalid=pool.length>0&&(requestedCount<1||requestedCount>pool.length)
 const bankById=useMemo(()=>new Map(bankQuestions.map(q=>[q.id,q])),[bankQuestions])
 const sourceBucketMap=useMemo(()=>new Map(sourceBuckets.map(source=>[source.key,source])),[sourceBuckets])
 const needle=normalize(sourceSearch)
 const visibleBank=useMemo(()=>bankQuestions.filter(q=>!needle||normalize(`${q.prompt} ${chapterText(q)} ${subjectOf(q)} ${q.source_bucket_title??q.bundle_title??''}`).includes(needle)),[bankQuestions,needle])
 const visiblePrevious=useMemo(()=>previousTests.map(t=>({...t,questions:t.questions.filter(q=>!needle||normalize(`${t.title} ${t.chapter_label??''} ${q.prompt} ${chapterText(q)} ${subjectOf(q)}`).includes(needle))})).filter(t=>t.questions.length),[previousTests,needle])
 const allPrevious=useMemo(()=>previousTests.flatMap(t=>t.questions),[previousTests])

 const sourceFilteredBank=useMemo(()=>bankQuestions.filter(q=>selectedSources.has(sourceOf(q))),[bankQuestions,selectedSources])
 const chapterOptions=useMemo(()=>{const map=new Map<string,string>();for(const q of sourceFilteredBank){const key=chapterKey(q);if(key!=='none')map.set(key,chapterText(q))}return[...map.entries()].sort((a,b)=>a[1].localeCompare(b[1],undefined,{numeric:true}))},[sourceFilteredBank])
 const chapterFilteredBank=useMemo(()=>sourceFilteredBank.filter(q=>selectedChapters.size===0||selectedChapters.has(chapterKey(q))),[sourceFilteredBank,selectedChapters])
 const subjectCategories=useMemo(()=>[...new Set(chapterFilteredBank.map(subjectOf))].sort(),[chapterFilteredBank])
 const selectedSourceKeys=useMemo(()=>sourceBuckets.map(source=>source.key).filter(key=>selectedSources.has(key)),[sourceBuckets,selectedSources])
 const effectiveSourceWeights=useMemo(()=>sourceMode==='balanced'?balancedWeights(selectedSourceKeys):Object.fromEntries(selectedSourceKeys.map(key=>[key,Number(sourceWeights[key])||0])),[sourceMode,selectedSourceKeys,sourceWeights])
 const sourceTotal=selectedSourceKeys.reduce((sum,key)=>sum+(effectiveSourceWeights[key]||0),0)
 const availableBundlePresets=useMemo(()=>bundlePresets.filter(preset=>selectedSources.has(`bundle:${preset.bundle_id}`)),[bundlePresets,selectedSources])

 function bundleWeightsForSubjects(preset:BundlePreset){
  const result:Record<string,number>={}
  for(const [domain,domainWeightRaw] of Object.entries(preset.weights||{})){
   const domainWeight=Number(domainWeightRaw)||0
   const matches=subjectCategories.filter(subject=>(preset.subject_mappings||{})[subject]===domain||subject===domain)
   if(!matches.length)continue
   const split=balancedWeights(matches)
   for(const subject of matches)result[subject]=(result[subject]||0)+domainWeight*(split[subject]||0)/100
  }
  const rounded:Record<string,number>={};let used=0
  const rows=Object.entries(result).map(([subject,value])=>({subject,floor:Math.floor(value),fraction:value-Math.floor(value)}))
  for(const row of rows){rounded[row.subject]=row.floor;used+=row.floor}
  const intended=Math.round(Object.values(result).reduce((sum,value)=>sum+value,0))
  for(const row of [...rows].sort((a,b)=>b.fraction-a.fraction)){if(used>=intended)break;rounded[row.subject]++;used++}
  return rounded
 }

 const effectiveSubjectWeights=useMemo(()=>{
  if(subjectMode==='balanced')return balancedWeights(subjectCategories)
  if(subjectMode.startsWith('bundle:')){const preset=bundlePresets.find(item=>`bundle:${item.preset_id}`===subjectMode);return preset?bundleWeightsForSubjects(preset):{}}
  if(subjectMode.startsWith('saved:')){const preset=mixPresets.find(item=>`saved:${item.id}`===subjectMode);return Object.fromEntries(subjectCategories.map(subject=>[subject,Number(preset?.subject_weights?.[subject])||0]))}
  return Object.fromEntries(subjectCategories.map(subject=>[subject,Number(subjectWeights[subject])||0]))
 },[subjectMode,subjectCategories,bundlePresets,mixPresets,subjectWeights])
 const subjectTotal=subjectCategories.reduce((sum,subject)=>sum+(effectiveSubjectWeights[subject]||0),0)

 function draftFromBank(q:BankQuestion):DraftQuestion{const subject=subjectOf(q);return{prompt:q.prompt,choices:[...q.choices],correctIndex:q.correct_index,contentArea:subject,subjectCategory:subject,chapterNumber:q.chapter_number??null,chapterTitle:q.chapter_title??'',focusedRetakeHint:q.focused_retake_hint??'',sourceType:'copied'}}
 function draftFromPrevious(q:PreviousQuestion):DraftQuestion{const match=q.bank_id?bankById.get(q.bank_id):undefined;if(match)return draftFromBank(match);const subject=subjectOf(q);return{prompt:q.prompt,choices:[...q.choices],correctIndex:q.correct_index,contentArea:subject,subjectCategory:subject,chapterNumber:q.chapter_number??null,chapterTitle:q.chapter_title??'',focusedRetakeHint:q.focused_retake_hint??'',sourceType:'previous_test'}}
 function uniqueBank(items:BankQuestion[]){const seen=new Set<string>();return items.filter(q=>{const key=normalize(q.prompt);if(!key||seen.has(key))return false;seen.add(key);return true})}
 function uniqueDrafts(items:DraftQuestion[]){const seen=new Set<string>();return items.filter(q=>{const key=normalize(q.prompt);if(!key||seen.has(key))return false;seen.add(key);return true})}
 function addDrafts(items:DraftQuestion[]){setQuestions(current=>{const existing=new Set(current.map(q=>normalize(q.prompt)).filter(Boolean));const additions=uniqueDrafts(items).filter(q=>!existing.has(normalize(q.prompt)));const blank=current.length===1&&!current[0].prompt.trim()&&current[0].choices.every(x=>!x.trim());return additions.length?[...(blank?[]:current),...additions]:current})}
 function replaceDrafts(items:DraftQuestion[]){const next=uniqueDrafts(items);setQuestions(next.length?next:[blankQuestion()]);setQuestionsPerAttempt('')}
 function removePrompts(prompts:string[]){const keys=new Set(prompts.map(normalize));setQuestions(current=>{const next=current.filter(q=>!keys.has(normalize(q.prompt)));return next.length?next:[blankQuestion()]})}
 function toggleBank(items:BankQuestion[]){const all=items.length>0&&items.every(q=>selectedPrompts.has(normalize(q.prompt)));if(all)removePrompts(items.map(q=>q.prompt));else addDrafts(items.map(draftFromBank))}
 function togglePrevious(items:PreviousQuestion[]){const all=items.length>0&&items.every(q=>selectedPrompts.has(normalize(q.prompt)));if(all)removePrompts(items.map(q=>q.prompt));else addDrafts(items.map(draftFromPrevious))}
 function toggleSource(key:string){setSelectedSources(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next});setBlueprintError('');setBuildSummary('')}
 function toggleChapter(key:string){setSelectedChapters(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next});setBlueprintError('');setBuildSummary('')}
 function changeSourceWeight(key:string,value:number){setSourceWeights({...effectiveSourceWeights,[key]:value});setSourceMode('custom');setBlueprintError('')}
 function changeSubjectWeight(subject:string,value:number){setSubjectWeights({...effectiveSubjectWeights,[subject]:value});setSubjectMode('custom');setBlueprintError('');setPresetMessage('')}
 function chooseSubjectMode(value:string){setSubjectMode(value);setBlueprintError('');setPresetMessage('')}

 async function saveCurrentPreset(){
  setPresetMessage('')
  if(!saveMixPresetAction)return
  if(Math.round(subjectTotal)!==100){setPresetMessage('Subject percentages must total 100% before saving.');return}
  const result=await saveMixPresetAction(presetName,effectiveSubjectWeights)
  if(!result.ok||!result.preset){setPresetMessage(result.error||'Could not save preset.');return}
  setMixPresets(current=>[result.preset!,...current.filter(item=>item.id!==result.preset!.id)])
  setPresetName('');setSubjectMode(`saved:${result.preset.id}`);setPresetMessage('Preset saved.')
 }

 function buildSmart(){
  setBlueprintError('');setBuildSummary('')
  const candidates=uniqueBank(chapterFilteredBank)
  if(!selectedSourceKeys.length){setBlueprintError('Select at least one question source.');return}
  if(!candidates.length){setBlueprintError('No question-bank questions match the selected sources and chapters.');return}
  if(Math.round(sourceTotal)!==100){setBlueprintError(`Source percentages must total 100%. Current total: ${sourceTotal}%.`);return}
  if(Math.round(subjectTotal)!==100){setBlueprintError(`Subject percentages must total 100%. Current total: ${subjectTotal}%. Adjust a slider to switch to Custom.`);return}
  const count=Math.max(1,Math.min(autoCount||20,candidates.length))
  const sourceTargets=allocateCounts(selectedSourceKeys,effectiveSourceWeights,count)
  const subjectTargets=allocateCounts(subjectCategories,effectiveSubjectWeights,count)
  const sourceUsed:Record<string,number>={};const subjectUsed:Record<string,number>={};const used=new Set<string>();const chosen:BankQuestion[]=[]
  while(chosen.length<count){
   const available=candidates.filter(q=>!used.has(normalize(q.prompt)))
   if(!available.length)break
   let bestScore=-Infinity;let best:BankQuestion[]=[]
   for(const q of available){const source=sourceOf(q),subject=subjectOf(q);const sourceNeed=(sourceTargets[source]||0)-(sourceUsed[source]||0);const subjectNeed=(subjectTargets[subject]||0)-(subjectUsed[subject]||0);const score=(sourceNeed>0?100+sourceNeed:sourceNeed)+(subjectNeed>0?100+subjectNeed:subjectNeed)+Math.random();if(score>bestScore+.25){bestScore=score;best=[q]}else if(Math.abs(score-bestScore)<=.25)best.push(q)}
   const picked=best[Math.floor(Math.random()*best.length)]||available[0];const key=normalize(picked.prompt);used.add(key);chosen.push(picked);const source=sourceOf(picked),subject=subjectOf(picked);sourceUsed[source]=(sourceUsed[source]||0)+1;subjectUsed[subject]=(subjectUsed[subject]||0)+1
  }
  replaceDrafts(chosen.map(draftFromBank))
  const chapterNames=chapterOptions.filter(([key])=>selectedChapters.has(key)).map(([,label])=>label)
  setAssessmentType('chapter_exam');setChapterLabel(chapterNames.length?chapterNames.join(', '):'Mixed chapters');setRandomize(true)
  const sourceSummary=selectedSourceKeys.map(key=>`${sourceBucketMap.get(key)?.title||key} ${sourceUsed[key]||0}`).join(' · ')
  setBuildSummary(`Built ${chosen.length} questions. ${sourceSummary}`)
 }

 function updateQuestion(index:number,patch:Partial<DraftQuestion>){setQuestions(c=>c.map((q,i)=>i===index?{...q,...patch}:q))}
 function updateChoice(qi:number,ci:number,value:string){setQuestions(c=>c.map((q,i)=>i===qi?{...q,choices:q.choices.map((x,j)=>j===ci?value:x)}:q))}
 function addQuestion(){const firstKey=[...selectedChapters][0];const match=firstKey?bankQuestions.find(q=>chapterKey(q)===firstKey):undefined;setQuestions(c=>[...c,blankQuestion(match?.chapter_number??null,match?.chapter_title??'','')])}
 function removeQuestion(index:number){setQuestions(c=>{const next=c.filter((_,i)=>i!==index);return next.length?next:[blankQuestion()]})}
 function addChoice(qi:number){setQuestions(c=>c.map((q,i)=>i===qi&&q.choices.length<6?{...q,choices:[...q.choices,'']}:q))}
 function removeChoice(qi:number,ci:number){setQuestions(c=>c.map((q,i)=>{if(i!==qi||q.choices.length<=2)return q;const choices=q.choices.filter((_,j)=>j!==ci);const correctIndex=q.correctIndex===ci?0:q.correctIndex>ci?q.correctIndex-1:q.correctIndex;return{...q,choices,correctIndex}}))}

 async function importCsv(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file)return;const rows=parseCsv(await file.text());if(rows.length<2){setImportSummary({added:0,duplicates:0,errors:['The file has no question rows.']});event.target.value='';return}const headers=rows[0].map(h=>h.trim().toLowerCase());const idx=(name:string)=>headers.indexOf(name.toLowerCase());const qIndex=idx('Question'),correctCol=idx('Correct Answer'),subjectCol=idx('Subject Category'),legacyAreaCol=idx('Content Area'),chapterNumberCol=idx('Chapter Number'),chapterTitleCol=idx('Chapter Title'),choiceCols=CHOICE_HEADERS.map(idx);const missing=[] as string[];if(qIndex<0)missing.push('Question');if(correctCol<0)missing.push('Correct Answer');if(choiceCols[0]<0)missing.push('Choice A');if(choiceCols[1]<0)missing.push('Choice B');if(missing.length){setImportSummary({added:0,duplicates:0,errors:[`Missing required columns: ${missing.join(', ')}`]});event.target.value='';return}const existing=new Set([...questions.map(q=>normalize(q.prompt)),...bankQuestions.map(q=>normalize(q.prompt))].filter(Boolean));const imported:DraftQuestion[]=[];const errors:string[]=[];let duplicates=0;rows.slice(1).forEach((row,rowOffset)=>{const prompt=(row[qIndex]??'').trim();if(!prompt||prompt.toUpperCase().startsWith('EXAMPLE'))return;const key=normalize(prompt);if(existing.has(key)){duplicates++;return}const rawChoices=choiceCols.map(col=>col>=0?(row[col]??'').trim():'');const choices=rawChoices.filter(Boolean);if(choices.length<2){errors.push(`Row ${rowOffset+2}: at least two answer choices are required.`);return}const answer=(row[correctCol]??'').trim();let rawCorrect=-1;if(/^[A-F]$/i.test(answer))rawCorrect=answer.toUpperCase().charCodeAt(0)-65;else if(/^[1-6]$/.test(answer))rawCorrect=Number(answer)-1;else rawCorrect=rawChoices.findIndex(c=>c.toLowerCase()===answer.toLowerCase());if(rawCorrect<0||!rawChoices[rawCorrect]){errors.push(`Row ${rowOffset+2}: invalid Correct Answer.`);return}const chapterRaw=chapterNumberCol>=0?(row[chapterNumberCol]??'').trim():'';const chapterNumber=chapterRaw?Number(chapterRaw):null;if(chapterNumber!==null&&(!Number.isInteger(chapterNumber)||chapterNumber<1)){errors.push(`Row ${rowOffset+2}: Chapter Number must be a positive whole number.`);return}const subject=(subjectCol>=0?(row[subjectCol]??'').trim():'')||(legacyAreaCol>=0?(row[legacyAreaCol]??'').trim():'');const chapterTitle=chapterTitleCol>=0?(row[chapterTitleCol]??'').trim():'';imported.push({prompt,choices,correctIndex:rawChoices.slice(0,rawCorrect).filter(Boolean).length,contentArea:subject,subjectCategory:subject,chapterNumber,chapterTitle,focusedRetakeHint:'',sourceType:'import'});existing.add(key)});addDrafts(imported);setImportSummary({added:imported.length,duplicates,errors});event.target.value=''}

 const bankGroups=useMemo(()=>{const map=new Map<string,BankQuestion[]>();for(const q of visibleBank){const key=`${q.source_bucket_title||q.bundle_title||'Saved questions'} · ${chapterText(q)} · ${subjectOf(q)}`;map.set(key,[...(map.get(key)||[]),q])}return[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}))},[visibleBank])
 const presetWarning=subjectMode.startsWith('bundle:')&&Math.round(subjectTotal)!==100

 return <form action={action} className="stack">
  <section className="card"><h2>What are you building?</h2><div className="mode-grid"><button type="button" className={assessmentType==='chapter_exam'?'mode-card active':'mode-card'} onClick={()=>{setAssessmentType('chapter_exam');setDuration(45)}}><b>Chapter / Smart Exam</b><span>Choose source banks, chapters, and weighting.</span></button><button type="button" className={assessmentType==='custom'?'mode-card active':'mode-card'} onClick={()=>setAssessmentType('custom')}><b>Custom Test</b><span>Mix any saved, imported, previous, or new questions.</span></button></div><input type="hidden" name="assessment_type" value={assessmentType}/><input type="hidden" name="exam_preset" value="custom"/><label>Test title</label><input name="title" required placeholder={chapterLabel?`${chapterLabel} Exam`:'Chapter Exam'}/><input type="hidden" name="chapter_label" value={chapterLabel}/><label>Summary / description</label><textarea name="description" rows={3}/><div className="settings-grid"><div><label>Timer (minutes)</label><input name="duration_minutes" type="number" min="0" max="600" value={duration} onChange={e=>setDuration(Number(e.target.value))}/></div><div><label>Passing score (%)</label><input name="passing_score" type="number" min="0" max="100" value={passingScore} onChange={e=>setPassingScore(Number(e.target.value))}/></div></div><label className="check"><input name="single_page" type="checkbox" checked={singlePage} onChange={e=>setSinglePage(e.target.checked)}/> Show one question per page</label><label className="check"><input name="randomize" type="checkbox" checked={randomize} onChange={e=>setRandomize(e.target.checked)}/> Randomize question order</label><p className="muted">Assignment rules, attempts, due dates, and focused remediation are configured when you share the test.</p></section>

  {assessmentType==='chapter_exam'&&<section className="card smart-builder-v2">
   <div className="row between" style={{alignItems:'flex-start',gap:12,flexWrap:'wrap'}}><div><h2 style={{marginBottom:4}}>Smart test blueprint</h2><p className="muted" style={{marginTop:0}}>CramLoop filters in this order: selected sources → selected chapters → source mix → subject mix.</p></div><span className="pill">{chapterFilteredBank.length} eligible questions</span></div>

   <div className="smart-step"><div className="row between"><div><b>1. Question sources</b><p className="muted field-help">Choose exactly which banks/resources CramLoop is allowed to pull from.</p></div><span className="pill">{selectedSourceKeys.length} selected</span></div><div className="source-choice-grid">{sourceBuckets.map(source=><label className="check source-choice" key={source.key}><input type="checkbox" checked={selectedSources.has(source.key)} onChange={()=>toggleSource(source.key)}/><span><b>{source.title}</b><small>{source.questionCount} questions · {source.kind==='bundle'?'Bundle bank':source.kind==='custom'?'Teacher bank':'Imported bank'}</small></span></label>)}</div></div>

   {selectedSourceKeys.length>1&&<div className="smart-step"><div className="row between" style={{alignItems:'center',gap:10,flexWrap:'wrap'}}><div><b>2. Source / bucket mix</b><p className="muted field-help">Control how much of the test comes from each selected bank.</p></div><div className="segmented"><button type="button" className={sourceMode==='balanced'?'active':''} onClick={()=>{setSourceMode('balanced');setBlueprintError('')}}>Balanced</button><button type="button" className={sourceMode==='custom'?'active':''} onClick={()=>{setSourceWeights(effectiveSourceWeights);setSourceMode('custom')}}>Custom</button></div></div><div className="slider-list">{selectedSourceKeys.map(key=><label className="slider-row" key={key}><span>{sourceBucketMap.get(key)?.title||key}</span><input type="range" min="0" max="100" step="1" value={effectiveSourceWeights[key]||0} onChange={e=>changeSourceWeight(key,Number(e.target.value))}/><b>{Math.round(effectiveSourceWeights[key]||0)}%</b></label>)}</div><p className={Math.round(sourceTotal)===100?'good':'bad'}>Source total: {Math.round(sourceTotal)}% / 100%</p></div>}

   <div className="smart-step"><div className="row between"><div><b>{selectedSourceKeys.length>1?'3':'2'}. Chapters</b><p className="muted field-help">Choose one or several chapters. Leave all unchecked to use every chapter in the selected sources.</p></div><span className="pill">{selectedChapters.size?`${selectedChapters.size} selected`:'All chapters'}</span></div>{chapterOptions.length?<div className="chapter-chip-grid">{chapterOptions.map(([key,label])=><label className="check chapter-chip" key={key}><input type="checkbox" checked={selectedChapters.has(key)} onChange={()=>toggleChapter(key)}/><span><b>{label}</b><small>{sourceFilteredBank.filter(q=>chapterKey(q)===key).length} available</small></span></label>)}</div>:<p className="muted">No chapter tags exist in the selected sources yet.</p>}</div>

   <div className="smart-step"><label>Questions to build</label><input type="number" min="1" max="200" value={autoCount} onChange={e=>setAutoCount(Math.max(1,Number(e.target.value)||1))}/></div>

   {subjectCategories.length>0&&<div className="smart-step"><div className="row between" style={{alignItems:'flex-start',gap:10,flexWrap:'wrap'}}><div><b>{selectedSourceKeys.length>1?'4':'3'}. Subject mix</b><p className="muted field-help">Presets load starting percentages. Moving any slider switches immediately to Custom.</p></div><span className="pill">{subjectMode==='balanced'?'Balanced':subjectMode==='custom'?'Custom':subjectMode.startsWith('bundle:')?'Bundle preset':'Saved preset'}</span></div><label>Weight preset</label><select value={subjectMode} onChange={e=>chooseSubjectMode(e.target.value)}><option value="balanced">Balanced evenly</option><option value="custom">Custom</option>{availableBundlePresets.length>0&&<optgroup label="Bundle provided">{availableBundlePresets.map(preset=><option key={preset.preset_id} value={`bundle:${preset.preset_id}`}>{preset.bundle_title} — {preset.preset_title}</option>)}</optgroup>}{mixPresets.length>0&&<optgroup label="My saved presets">{mixPresets.map(preset=><option key={preset.id} value={`saved:${preset.id}`}>{preset.name}</option>)}</optgroup>}</select>{presetWarning&&<p className="bad notice">This bundle preset includes subjects outside the current chapter/source filters, so its visible weights do not total 100%. Move any slider to customize the filtered version.</p>}<div className="slider-list">{subjectCategories.map(subject=><label className="slider-row" key={subject}><span>{subject}</span><input type="range" min="0" max="100" step="1" value={Math.round(effectiveSubjectWeights[subject]||0)} onChange={e=>changeSubjectWeight(subject,Number(e.target.value))}/><b>{Math.round(effectiveSubjectWeights[subject]||0)}%</b></label>)}</div><p className={Math.round(subjectTotal)===100?'good':'bad'}>Subject total: {Math.round(subjectTotal)}% / 100%</p>{subjectMode==='custom'&&saveMixPresetAction&&<div className="save-mix-row"><input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Name this mix"/><button type="button" className="secondary" onClick={saveCurrentPreset} disabled={!presetName.trim()||Math.round(subjectTotal)!==100}>Save mix preset</button></div>}{presetMessage&&<p className={presetMessage==='Preset saved.'?'good':'bad'}>{presetMessage}</p>}</div>}

   {blueprintError&&<p className="bad notice">{blueprintError}</p>}{buildSummary&&<p className="good notice">{buildSummary}</p>}<button type="button" onClick={buildSmart} disabled={!chapterFilteredBank.length}>Build smart test</button><p className="muted field-help">CramLoop tries to satisfy both source and subject targets simultaneously, deduplicates repeated wording, then uses the closest available inventory when an exact intersection is not possible.</p>
  </section>}

  <section className="card pool-builder"><div className="row between"><div><h2>Question pool</h2><p className="muted">Review the smart selection or manually choose from your saved sources.</p></div><span className="pill">{pool.length} selected</span></div><label>Questions per attempt</label><input name="questions_per_attempt" type="number" min="1" max={Math.max(1,pool.length)} value={questionsPerAttempt} onChange={e=>setQuestionsPerAttempt(e.target.value)} placeholder={pool.length?`All ${pool.length} selected`:'Select questions first'}/><p className="muted field-help">Leave blank to use the entire selected pool. Set a smaller number for a fresh randomized subset on each attempt.</p>{countInvalid&&<p className="bad">Choose a count from 1 to {pool.length}.</p>}<label>Search saved sources</label><input value={sourceSearch} onChange={e=>setSourceSearch(e.target.value)} placeholder="Search source, chapter, subject, question, or prior test"/>
   <details className="bank-picker" open><summary><b>Question Bank ({bankQuestions.length})</b></summary>{bankGroups.length===0?<p className="muted">No matching saved questions.</p>:bankGroups.map(([group,items])=>{const selected=items.filter(q=>selectedPrompts.has(normalize(q.prompt))).length;const all=selected===items.length;return <details className="bank-section" key={group} open={Boolean(sourceSearch)}><summary><span><b>{group}</b> <span className="muted">{selected}/{items.length} selected</span></span></summary><label className="check section-select"><input type="checkbox" checked={all} ref={el=>{if(el)el.indeterminate=selected>0&&!all}} onChange={()=>toggleBank(items)}/><b>Select all</b></label>{items.map(item=><label className="check bank-question-check" key={item.id}><input type="checkbox" checked={selectedPrompts.has(normalize(item.prompt))} onChange={()=>toggleBank([item])}/><span>{item.prompt}<small>{chapterText(item)} · {subjectOf(item)} · {item.source_bucket_title||item.bundle_title||'Saved question'}</small></span></label>)}</details>})}</details>
   <details className="bank-picker"><summary><b>Previous Tests ({previousTests.length})</b></summary>{visiblePrevious.length===0?<p className="muted">{previousTests.length?'No previous tests match this search.':'Your previous tests will appear here.'}</p>:visiblePrevious.map(test=>{const selected=test.questions.filter(q=>selectedPrompts.has(normalize(q.prompt))).length;const all=selected===test.questions.length;return <details className="bank-section" key={test.id}><summary><span><b>{test.title}</b> <span className="muted">{test.chapter_label?`${test.chapter_label} · `:''}{selected}/{test.questions.length} selected</span></span></summary><label className="check section-select"><input type="checkbox" checked={all} ref={el=>{if(el)el.indeterminate=selected>0&&!all}} onChange={()=>togglePrevious(test.questions)}/><b>Select all from this test</b></label>{test.questions.map(item=><label className="check bank-question-check" key={item.id}><input type="checkbox" checked={selectedPrompts.has(normalize(item.prompt))} onChange={()=>togglePrevious([item])}/><span>{item.prompt}<small>{chapterText(item)} · {subjectOf(item)}</small></span></label>)}</details>})}</details>
  </section>

  <details className="card"><summary><b>Import multiple questions</b></summary><p className="muted">The template supports Chapter Number, Chapter Title, and Subject Category so imports are immediately reusable by smart-test filters.</p><ol><li><a href="/templates/question-import-template.csv" download><b>Download the question import template</b></a>.</li><li>Keep the header row unchanged.</li><li>Chapter fields are optional; Subject Category is recommended.</li><li>Enter A-F, 1-6, or exact answer text in Correct Answer.</li></ol><label className="button-like secondary" htmlFor="classroom-question-import">Choose CSV file</label><input id="classroom-question-import" type="file" accept=".csv,text/csv" onChange={importCsv} style={{display:'none'}}/>{importSummary&&<div className="notice" style={{marginTop:14}}><b>Import check</b><p>{importSummary.added} added · {importSummary.duplicates} exact duplicates skipped.</p>{importSummary.errors.map((x,i)=><p className="bad" key={i}>{x}</p>)}</div>}</details>

  <details className="card" open={pool.length>0}><summary><b>Edit selected questions ({pool.length})</b></summary>{questions.map((q,qi)=><section className="question-summary" key={`${normalize(q.prompt)}-${qi}`}><div className="row between"><h3>Question {qi+1}</h3><button className="ghost danger" type="button" onClick={()=>removeQuestion(qi)}>Remove</button></div><div className="settings-grid"><div><label>Chapter number <span className="muted">(optional)</span></label><input type="number" min="1" step="1" value={q.chapterNumber??''} onChange={e=>updateQuestion(qi,{chapterNumber:e.target.value?Number(e.target.value):null})} placeholder="1"/></div><div><label>Chapter title <span className="muted">(optional)</span></label><input value={q.chapterTitle} onChange={e=>updateQuestion(qi,{chapterTitle:e.target.value})} placeholder="Infection Control"/></div></div><label>Subject category</label><input value={q.subjectCategory} onChange={e=>updateQuestion(qi,{subjectCategory:e.target.value,contentArea:e.target.value})} placeholder="Safety & sanitation"/><textarea required rows={3} value={q.prompt} onChange={e=>updateQuestion(qi,{prompt:e.target.value})} placeholder="Type the question"/><label>Focused retake hint <span className="muted">(optional)</span></label><textarea rows={2} value={q.focusedRetakeHint} onChange={e=>updateQuestion(qi,{focusedRetakeHint:e.target.value})} placeholder="Teach the idea without giving away the answer."/><p className="muted">Select the circle beside the correct answer.</p>{q.choices.map((choice,ci)=><div className="choice-editor" key={ci}><input type="radio" name={`correct-${qi}`} checked={q.correctIndex===ci} onChange={()=>updateQuestion(qi,{correctIndex:ci})}/><input required value={choice} onChange={e=>updateChoice(qi,ci,e.target.value)} placeholder={`Answer choice ${ci+1}`}/><button className="ghost" type="button" onClick={()=>removeChoice(qi,ci)} disabled={q.choices.length<=2}>×</button></div>)}<button className="secondary" type="button" onClick={()=>addChoice(qi)} disabled={q.choices.length>=6}>+ Answer choice</button></section>)}<button className="secondary" type="button" onClick={addQuestion}>+ Write a new question</button></details>
  <input type="hidden" name="questions" value={payload}/><div className="row"><button type="submit" disabled={!pool.length||countInvalid}>Save test</button><span className="muted">Pool {pool.length} · Attempt {pool.length?requestedCount:0}</span></div>
  <style jsx global>{`.smart-builder-v2 .smart-step{padding:16px 0;border-top:1px solid #edf0f5}.source-choice-grid,.chapter-chip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-top:10px}.source-choice,.chapter-chip{padding:10px 12px;border:1px solid #e4e7ef;border-radius:12px;background:#fff}.source-choice span,.chapter-chip span{display:block}.source-choice small,.chapter-chip small{display:block;color:#64748b;margin-top:2px}.segmented{display:flex;gap:4px;padding:3px;background:#eef2ff;border-radius:10px}.segmented button{padding:7px 10px;background:transparent;color:#4338ca;box-shadow:none}.segmented button.active{background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.12)}.slider-list{display:grid;gap:12px;margin-top:12px}.slider-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(160px,2fr) 48px;gap:12px;align-items:center}.slider-row input[type=range]{width:100%;margin:0;accent-color:#4f46e5}.slider-row b{text-align:right;font-variant-numeric:tabular-nums}.save-mix-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-top:12px}.save-mix-row input{margin:0}@media(max-width:700px){.slider-row{grid-template-columns:1fr 52px;gap:5px 8px}.slider-row span{grid-column:1/-1}.slider-row input[type=range]{grid-column:1}.slider-row b{grid-column:2}.save-mix-row{grid-template-columns:1fr}.save-mix-row button{width:100%}.source-choice-grid,.chapter-chip-grid{grid-template-columns:1fr}}`}</style>
 </form>
}
