'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

type Choice = { id: string; label: string; position: number }
type Question = { id: string; prompt: string; position: number; choices: Choice[] }

type Props = {
  testId: string
  title: string
  description: string | null
  questions: Question[]
  durationMinutes: number
  oneQuestionPerPage: boolean
  passingScore: number
  action: (formData: FormData) => void
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`
}

export default function ExamRunner({ testId, title, description, questions, durationMinutes, oneQuestionPerPage, passingScore, action }: Props) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [remaining, setRemaining] = useState(durationMinutes * 60)
  const formRef = useRef<HTMLFormElement>(null)
  const submitted = useRef(false)
  const storageKey = `teacher-test-studio:${testId}:started-at`
  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers])

  useEffect(() => {
    if (durationMinutes <= 0) return
    let startedAt = Number(sessionStorage.getItem(storageKey) || 0)
    if (!startedAt) {
      startedAt = Date.now()
      sessionStorage.setItem(storageKey, String(startedAt))
    }
    const tick = () => {
      const left = Math.max(0, durationMinutes * 60 - Math.floor((Date.now() - startedAt) / 1000))
      setRemaining(left)
      if (left === 0 && !submitted.current) {
        submitted.current = true
        formRef.current?.requestSubmit()
      }
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [durationMinutes, storageKey])

  function choose(questionId: string, choiceId: string) {
    setAnswers(a => ({ ...a, [questionId]: choiceId }))
  }

  const question = questions[current]
  const warning = durationMinutes > 0 && remaining <= 300

  return <main className="exam-shell">
    <header className="exam-header">
      <div><p className="eyebrow">Practice examination</p><h1>{title}</h1></div>
      <div className={`timer ${warning ? 'timer-warning' : ''}`}><span>Time remaining</span><b>{durationMinutes > 0 ? formatTime(remaining) : 'Untimed'}</b></div>
    </header>
    {description && <p className="muted">{description}</p>}
    <div className="exam-meta"><span>{answeredCount} of {questions.length} answered</span><span>Passing target: {passingScore}%</span></div>

    <form ref={formRef} action={action} onSubmit={() => { submitted.current = true; sessionStorage.removeItem(storageKey) }}>
      {questions.map(q => <input key={q.id} type="hidden" name={`q_${q.id}`} value={answers[q.id] ?? ''} />)}

      {oneQuestionPerPage ? <>
        <section className="card exam-question">
          <p className="question-progress">Question {current + 1} of {questions.length}</p>
          <h2>{question.prompt}</h2>
          {[...(question.choices ?? [])].sort((a,b)=>a.position-b.position).map(c => <label className={`answer ${answers[question.id] === c.id ? 'answer-selected' : ''}`} key={c.id}>
            <input type="radio" name={`visible_${question.id}`} checked={answers[question.id] === c.id} onChange={() => choose(question.id,c.id)} />
            <span>{c.label}</span>
          </label>)}
        </section>
        <div className="exam-nav">
          <button className="secondary" type="button" onClick={()=>setCurrent(i=>Math.max(0,i-1))} disabled={current===0}>Previous</button>
          <div className="question-dots" aria-label="Question navigation">{questions.map((q,i)=><button type="button" key={q.id} className={`question-dot ${i===current?'current':''} ${answers[q.id]?'answered':''}`} onClick={()=>setCurrent(i)}>{i+1}</button>)}</div>
          {current < questions.length - 1 ? <button type="button" onClick={()=>setCurrent(i=>Math.min(questions.length-1,i+1))}>Next</button> : <button type="submit">Submit exam</button>}
        </div>
      </> : <>{questions.map((q,index)=><section className="card exam-question" key={q.id}><p className="question-progress">Question {index+1} of {questions.length}</p><h2>{q.prompt}</h2>{[...(q.choices??[])].sort((a,b)=>a.position-b.position).map(c=><label className={`answer ${answers[q.id]===c.id?'answer-selected':''}`} key={c.id}><input type="radio" name={`visible_${q.id}`} checked={answers[q.id]===c.id} onChange={()=>choose(q.id,c.id)}/><span>{c.label}</span></label>)}</section>)}<button type="submit">Submit exam</button></>}
    </form>
  </main>
}
