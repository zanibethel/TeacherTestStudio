'use client'
import { ChangeEvent, useMemo, useState } from 'react'

type DraftQuestion = { prompt: string; choices: string[]; correctIndex: number; contentArea: string }
type ImportSummary = { added: number; duplicates: number; errors: string[] }

const PSI_AREAS = [
  'Licensing & Texas Rules',
  'Safety, Sanitation & Infection Control',
  'Hair & Scalp Care',
  'Haircutting & Styling',
  'Chemical Texture Services',
  'Haircoloring & Lightening',
  'Skin Care',
  'Nail Care',
]

const CHOICE_HEADERS = ['Choice A','Choice B','Choice C','Choice D','Choice E','Choice F']

function normalizeQuestion(value:string){
  return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()
}

function parseCsv(text:string){
  const rows:string[][]=[]
  let row:string[]=[]
  let cell=''
  let quoted=false
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(ch==='"'){
      if(quoted && text[i+1]==='"'){cell+='"';i++} else quoted=!quoted
    }else if(ch===',' && !quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r') && !quoted){
      if(ch==='\r'&&text[i+1]==='\n')i++
      row.push(cell);cell=''
      if(row.some(x=>x.trim()))rows.push(row)
      row=[]
    }else cell+=ch
  }
  row.push(cell)
  if(row.some(x=>x.trim()))rows.push(row)
  return rows
}

export default function TestBuilder({ action }: { action: (formData: FormData) => void }) {
  const [questions, setQuestions] = useState<DraftQuestion[]>([{ prompt: '', choices: ['', '', '', ''], correctIndex: 0, contentArea: PSI_AREAS[1] }])
  const [assessmentType, setAssessmentType] = useState<'psi_practice'|'chapter_exam'|'custom'>('psi_practice')
  const [preset, setPreset] = useState('tdlr_operator_written')
  const [duration, setDuration] = useState(120)
  const [passingScore, setPassingScore] = useState(70)
  const [singlePage, setSinglePage] = useState(true)
  const [randomize, setRandomize] = useState(true)
  const [importSummary,setImportSummary]=useState<ImportSummary|null>(null)
  const payload = useMemo(() => JSON.stringify(questions), [questions])

  function applyType(value: 'psi_practice'|'chapter_exam'|'custom') {
    setAssessmentType(value)
    if (value === 'psi_practice') {
      setPreset('tdlr_operator_written'); setDuration(120); setPassingScore(70); setSinglePage(true); setRandomize(true)
    } else if (value === 'chapter_exam') {
      setPreset('custom'); setDuration(45); setPassingScore(70); setSinglePage(true); setRandomize(false)
    } else setPreset('custom')
  }
  function updateQuestion(index:number, patch:Partial<DraftQuestion>){setQuestions(c=>c.map((q,i)=>i===index?{...q,...patch}:q))}
  function updateChoice(qi:number,ci:number,value:string){setQuestions(c=>c.map((q,i)=>i===qi?{...q,choices:q.choices.map((x,j)=>j===ci?value:x)}:q))}
  function addQuestion(){setQuestions(c=>[...c,{prompt:'',choices:['','','',''],correctIndex:0,contentArea:assessmentType==='psi_practice'?PSI_AREAS[1]:''}])}
  function removeQuestion(index:number){setQuestions(c=>c.length===1?c:c.filter((_,i)=>i!==index))}
  function addChoice(qi:number){setQuestions(c=>c.map((q,i)=>i===qi&&q.choices.length<6?{...q,choices:[...q.choices,'']}:q))}
  function removeChoice(qi:number,ci:number){setQuestions(c=>c.map((q,i)=>{if(i!==qi||q.choices.length<=2)return q;const choices=q.choices.filter((_,j)=>j!==ci);const correctIndex=q.correctIndex===ci?0:q.correctIndex>ci?q.correctIndex-1:q.correctIndex;return{...q,choices,correctIndex}}))}

  async function importCsv(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0]
    if(!file)return
    const text=await file.text()
    const rows=parseCsv(text)
    if(rows.length<2){setImportSummary({added:0,duplicates:0,errors:['The file has no question rows.']});event.target.value='';return}
    const headers=rows[0].map(h=>h.trim().toLowerCase())
    const idx=(name:string)=>headers.indexOf(name.toLowerCase())
    const qIndex=idx('Question')
    const correctCol=idx('Correct Answer')
    const areaCol=idx('Content Area')
    const choiceCols=CHOICE_HEADERS.map(idx)
    const missing:string[]=[]
    if(qIndex<0)missing.push('Question')
    if(correctCol<0)missing.push('Correct Answer')
    if(choiceCols[0]<0)missing.push('Choice A')
    if(choiceCols[1]<0)missing.push('Choice B')
    if(missing.length){setImportSummary({added:0,duplicates:0,errors:[`Missing required column${missing.length>1?'s':''}: ${missing.join(', ')}`]});event.target.value='';return}

    const existing=new Set(questions.map(q=>normalizeQuestion(q.prompt)).filter(Boolean))
    const imported:DraftQuestion[]=[]
    const errors:string[]=[]
    let duplicates=0

    rows.slice(1).forEach((row,rowOffset)=>{
      const rowNumber=rowOffset+2
      const prompt=(row[qIndex]??'').trim()
      if(!prompt)return
      if(prompt.toUpperCase().startsWith('EXAMPLE'))return
      const normalized=normalizeQuestion(prompt)
      if(existing.has(normalized)){duplicates++;return}

      const rawChoices=choiceCols.map(col=>col>=0?(row[col]??'').trim():'')
      const choices=rawChoices.filter(Boolean)
      if(choices.length<2){errors.push(`Row ${rowNumber}: at least two answer choices are required.`);return}

      const answer=(row[correctCol]??'').trim()
      let rawCorrect=-1
      if(/^[A-F]$/i.test(answer))rawCorrect=answer.toUpperCase().charCodeAt(0)-65
      else if(/^[1-6]$/.test(answer))rawCorrect=Number(answer)-1
      else rawCorrect=rawChoices.findIndex(c=>c.toLowerCase()===answer.toLowerCase())
      if(rawCorrect<0||!rawChoices[rawCorrect]){errors.push(`Row ${rowNumber}: Correct Answer must be A-F, 1-6, or match an answer choice.`);return}
      const correctIndex=rawChoices.slice(0,rawCorrect).filter(Boolean).length
      const contentArea=areaCol>=0?(row[areaCol]??'').trim():''
      imported.push({prompt,choices,correctIndex,contentArea:contentArea||(assessmentType==='psi_practice'?PSI_AREAS[1]:'')})
      existing.add(normalized)
    })

    if(imported.length){
      setQuestions(current=>{
        const onlyBlank=current.length===1&&!current[0].prompt.trim()&&current[0].choices.every(c=>!c.trim())
        return onlyBlank?imported:[...current,...imported]
      })
    }
    setImportSummary({added:imported.length,duplicates,errors})
    event.target.value=''
  }

  return <form action={action} className="stack">
    <section className="card">
      <h2>What are you building?</h2>
      <div className="mode-grid">
        <button type="button" className={assessmentType==='psi_practice'?'mode-card active':'mode-card'} onClick={()=>applyType('psi_practice')}><b>PSI Practice Exam</b><span>State-board-style practice with exam timer, randomized questions, content-area tags, and one question per screen.</span></button>
        <button type="button" className={assessmentType==='chapter_exam'?'mode-card active':'mode-card'} onClick={()=>applyType('chapter_exam')}><b>Chapter Exam</b><span>Build any chapter, unit, or classroom assessment with your own timing and settings.</span></button>
        <button type="button" className={assessmentType==='custom'?'mode-card active':'mode-card'} onClick={()=>applyType('custom')}><b>Custom Test</b><span>Start from scratch and control every delivery option.</span></button>
      </div>
      <input type="hidden" name="assessment_type" value={assessmentType}/>
      <input type="hidden" name="exam_preset" value={preset}/>

      {assessmentType==='psi_practice' && <div className="notice"><b>Texas Cosmetology Operator practice mode</b><p className="muted">Use original practice questions and tag each by content area. The delivery experience is designed to feel like a licensing exam; official PSI/TDLR details can be updated as their current bulletin changes.</p></div>}
      {assessmentType==='chapter_exam' && <div><label>Chapter / unit / topic</label><input name="chapter_label" placeholder="Example: Chapter 5 — Infection Control" /></div>}

      <label>Test title</label><input name="title" required placeholder={assessmentType==='psi_practice'?'Texas Cosmetology Operator Practice Exam':'Chapter Exam'} />
      <label>Description</label><textarea name="description" rows={3} placeholder="Instructions or topic summary" />
      <div className="settings-grid">
        <div><label>Timer (minutes)</label><input name="duration_minutes" type="number" min="0" max="600" value={duration} onChange={e=>setDuration(Number(e.target.value))}/></div>
        <div><label>Passing score (%)</label><input name="passing_score" type="number" min="0" max="100" value={passingScore} onChange={e=>setPassingScore(Number(e.target.value))}/></div>
      </div>
      <label className="check"><input name="single_page" type="checkbox" checked={singlePage} onChange={e=>setSinglePage(e.target.checked)} /> Show one question per page</label>
      <label className="check"><input name="randomize" type="checkbox" checked={randomize} onChange={e=>setRandomize(e.target.checked)} /> Randomize question order for each student</label>
    </section>

    <details className="card" open>
      <summary><b>Import multiple questions</b></summary>
      <p className="muted">Best for chapter tests or large PSI practice banks. Fill in the template in Excel, Numbers, or Google Sheets, save/export it as a CSV file, then upload it here.</p>
      <ol>
        <li><a href="/templates/question-import-template.csv" download><b>Download the question import template</b></a>.</li>
        <li>Enter one question per row. Keep the header row unchanged.</li>
        <li>Fill at least Choice A and Choice B. Choice C-F are optional.</li>
        <li>For <b>Correct Answer</b>, enter A-F, 1-6, or the exact answer text.</li>
        <li><b>Content Area</b> is optional, but recommended for PSI practice tests and chapter reporting.</li>
        <li>Delete the example row, export/save as <b>CSV</b>, then choose the file below.</li>
      </ol>
      <label className="button-like secondary" htmlFor="question-import">Choose CSV file</label>
      <input id="question-import" type="file" accept=".csv,text/csv" onChange={importCsv} style={{display:'none'}}/>
      {importSummary&&<div className="notice" style={{marginTop:14}}><b>Import check</b><p>{importSummary.added} question{importSummary.added===1?'':'s'} added. {importSummary.duplicates} exact duplicate{importSummary.duplicates===1?'':'s'} skipped.</p>{importSummary.errors.length>0&&<><p className="bad"><b>{importSummary.errors.length} row{importSummary.errors.length===1?'':'s'} need attention:</b></p><ul>{importSummary.errors.slice(0,8).map((error,i)=><li key={i}>{error}</li>)}</ul>{importSummary.errors.length>8&&<p className="muted">Plus {importSummary.errors.length-8} more.</p>}</>}</div>}
    </details>

    {questions.map((q,qi)=><section className="card" key={qi}><div className="row between"><h2>Question {qi+1}</h2><button className="ghost danger" type="button" onClick={()=>removeQuestion(qi)} disabled={questions.length===1}>Remove</button></div>
      {assessmentType==='psi_practice' ? <><label>PSI content area</label><select value={q.contentArea} onChange={e=>updateQuestion(qi,{contentArea:e.target.value})}>{PSI_AREAS.map(area=><option key={area}>{area}</option>)}</select></> : <><label>Question topic <span className="muted">(optional)</span></label><input value={q.contentArea} onChange={e=>updateQuestion(qi,{contentArea:e.target.value})} placeholder="Example: Disinfection"/></>}
      <textarea required rows={3} value={q.prompt} onChange={e=>updateQuestion(qi,{prompt:e.target.value})} placeholder="Type the question"/><p className="muted">Select the circle beside the correct answer.</p>{q.choices.map((choice,ci)=><div className="choice-editor" key={ci}><input aria-label={`Mark answer ${ci+1} correct`} type="radio" name={`correct-${qi}`} checked={q.correctIndex===ci} onChange={()=>updateQuestion(qi,{correctIndex:ci})}/><input required value={choice} onChange={e=>updateChoice(qi,ci,e.target.value)} placeholder={`Answer choice ${ci+1}`}/><button className="ghost" type="button" onClick={()=>removeChoice(qi,ci)} disabled={q.choices.length<=2}>×</button></div>)}<button className="secondary" type="button" onClick={()=>addChoice(qi)} disabled={q.choices.length>=6}>+ Answer choice</button></section>)}
    <input type="hidden" name="questions" value={payload}/>
    <div className="row"><button className="secondary" type="button" onClick={addQuestion}>+ Add question</button><button type="submit">Save test</button></div>
  </form>
}
