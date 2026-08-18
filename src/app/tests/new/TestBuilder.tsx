'use client'
import { useMemo, useState } from 'react'

type DraftQuestion = { prompt: string; choices: string[]; correctIndex: number }

export default function TestBuilder({ action }: { action: (formData: FormData) => void }) {
  const [questions, setQuestions] = useState<DraftQuestion[]>([{ prompt: '', choices: ['', '', '', ''], correctIndex: 0 }])
  const [preset, setPreset] = useState('tdlr_operator_written')
  const [duration, setDuration] = useState(120)
  const [passingScore, setPassingScore] = useState(70)
  const [singlePage, setSinglePage] = useState(true)
  const [randomize, setRandomize] = useState(true)
  const payload = useMemo(() => JSON.stringify(questions), [questions])

  function applyPreset(value: string) {
    setPreset(value)
    if (value === 'tdlr_operator_written') {
      setDuration(120)
      setPassingScore(70)
      setSinglePage(true)
      setRandomize(true)
    }
  }
  function updateQuestion(index: number, patch: Partial<DraftQuestion>) { setQuestions(c => c.map((q,i)=>i===index?{...q,...patch}:q)) }
  function updateChoice(qi:number, ci:number, value:string){setQuestions(c=>c.map((q,i)=>i===qi?{...q,choices:q.choices.map((x,j)=>j===ci?value:x)}:q))}
  function addQuestion(){setQuestions(c=>[...c,{prompt:'',choices:['','','',''],correctIndex:0}])}
  function removeQuestion(index:number){setQuestions(c=>c.length===1?c:c.filter((_,i)=>i!==index))}
  function addChoice(qi:number){setQuestions(c=>c.map((q,i)=>i===qi&&q.choices.length<6?{...q,choices:[...q.choices,'']}:q))}
  function removeChoice(qi:number,ci:number){setQuestions(c=>c.map((q,i)=>{if(i!==qi||q.choices.length<=2)return q;const choices=q.choices.filter((_,j)=>j!==ci);const correctIndex=q.correctIndex===ci?0:q.correctIndex>ci?q.correctIndex-1:q.correctIndex;return{...q,choices,correctIndex}}))}

  return <form action={action} className="stack">
    <section className="card">
      <label>Exam format</label>
      <select name="exam_preset" value={preset} onChange={e=>applyPreset(e.target.value)}>
        <option value="tdlr_operator_written">Texas Cosmetology Operator — state-board style</option>
        <option value="custom">Custom classroom test</option>
      </select>
      {preset==='tdlr_operator_written' && <p className="muted">Practice preset: one question at a time, 120-minute timer, 70% passing target. Questions should be original practice questions aligned to the current TDLR/PSI content outline.</p>}
      <label>Test title</label><input name="title" required placeholder="Texas Cosmetology Operator Practice Exam" />
      <label>Description</label><textarea name="description" rows={3} placeholder="Instructions or topic summary" />
      <div className="settings-grid">
        <div><label>Timer (minutes)</label><input name="duration_minutes" type="number" min="0" max="600" value={duration} onChange={e=>setDuration(Number(e.target.value))}/></div>
        <div><label>Passing score (%)</label><input name="passing_score" type="number" min="0" max="100" value={passingScore} onChange={e=>setPassingScore(Number(e.target.value))}/></div>
      </div>
      <label className="check"><input name="single_page" type="checkbox" checked={singlePage} onChange={e=>setSinglePage(e.target.checked)} /> Show one question per page</label>
      <label className="check"><input name="randomize" type="checkbox" checked={randomize} onChange={e=>setRandomize(e.target.checked)} /> Randomize question order for each student</label>
    </section>
    {questions.map((q,qi)=><section className="card" key={qi}><div className="row between"><h2>Question {qi+1}</h2><button className="ghost danger" type="button" onClick={()=>removeQuestion(qi)} disabled={questions.length===1}>Remove</button></div><textarea required rows={3} value={q.prompt} onChange={e=>updateQuestion(qi,{prompt:e.target.value})} placeholder="Type the question"/><p className="muted">Select the circle beside the correct answer.</p>{q.choices.map((choice,ci)=><div className="choice-editor" key={ci}><input aria-label={`Mark answer ${ci+1} correct`} type="radio" name={`correct-${qi}`} checked={q.correctIndex===ci} onChange={()=>updateQuestion(qi,{correctIndex:ci})}/><input required value={choice} onChange={e=>updateChoice(qi,ci,e.target.value)} placeholder={`Answer choice ${ci+1}`}/><button className="ghost" type="button" onClick={()=>removeChoice(qi,ci)} disabled={q.choices.length<=2}>×</button></div>)}<button className="secondary" type="button" onClick={()=>addChoice(qi)} disabled={q.choices.length>=6}>+ Answer choice</button></section>)}
    <input type="hidden" name="questions" value={payload}/>
    <div className="row"><button className="secondary" type="button" onClick={addQuestion}>+ Add question</button><button type="submit">Save test</button></div>
  </form>
}
