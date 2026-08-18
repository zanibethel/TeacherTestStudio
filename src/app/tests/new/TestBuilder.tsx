'use client'
import { useMemo, useState } from 'react'

type DraftQuestion = { prompt: string; choices: string[]; correctIndex: number }

export default function TestBuilder({ action }: { action: (formData: FormData) => void }) {
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { prompt: '', choices: ['', '', '', ''], correctIndex: 0 },
  ])
  const payload = useMemo(() => JSON.stringify(questions), [questions])

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...patch } : question))
  }
  function updateChoice(qIndex: number, cIndex: number, value: string) {
    setQuestions((current) => current.map((question, i) => i === qIndex
      ? { ...question, choices: question.choices.map((choice, j) => j === cIndex ? value : choice) }
      : question))
  }
  function addQuestion() { setQuestions((current) => [...current, { prompt: '', choices: ['', '', '', ''], correctIndex: 0 }]) }
  function removeQuestion(index: number) { setQuestions((current) => current.length === 1 ? current : current.filter((_, i) => i !== index)) }
  function addChoice(qIndex: number) { setQuestions((current) => current.map((question, i) => i === qIndex && question.choices.length < 6 ? { ...question, choices: [...question.choices, ''] } : question)) }
  function removeChoice(qIndex: number, cIndex: number) {
    setQuestions((current) => current.map((question, i) => {
      if (i !== qIndex || question.choices.length <= 2) return question
      const choices = question.choices.filter((_, j) => j !== cIndex)
      const correctIndex = question.correctIndex === cIndex ? 0 : question.correctIndex > cIndex ? question.correctIndex - 1 : question.correctIndex
      return { ...question, choices, correctIndex }
    }))
  }

  return <form action={action} className="stack">
    <section className="card"><label>Test title</label><input name="title" required placeholder="Unit 3 Review" /><label>Description</label><textarea name="description" rows={3} placeholder="Optional instructions or topic summary" /><label className="check"><input name="randomize" type="checkbox" /> Randomize question order for each student</label></section>
    {questions.map((question, qIndex) => <section className="card" key={qIndex}><div className="row between"><h2>Question {qIndex + 1}</h2><button className="ghost danger" type="button" onClick={() => removeQuestion(qIndex)} disabled={questions.length === 1}>Remove</button></div><textarea required rows={3} value={question.prompt} onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })} placeholder="Type the question" /><p className="muted">Select the circle beside the correct answer.</p>{question.choices.map((choice, cIndex) => <div className="choice-editor" key={cIndex}><input aria-label={`Mark answer ${cIndex + 1} correct`} type="radio" name={`correct-${qIndex}`} checked={question.correctIndex === cIndex} onChange={() => updateQuestion(qIndex, { correctIndex: cIndex })} /><input required value={choice} onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)} placeholder={`Answer choice ${cIndex + 1}`} /><button className="ghost" type="button" onClick={() => removeChoice(qIndex, cIndex)} disabled={question.choices.length <= 2}>×</button></div>)}<button className="secondary" type="button" onClick={() => addChoice(qIndex)} disabled={question.choices.length >= 6}>+ Answer choice</button></section>)}
    <input type="hidden" name="questions" value={payload} /><div className="row"><button className="secondary" type="button" onClick={addQuestion}>+ Add question</button><button type="submit">Save test</button></div>
  </form>
}
