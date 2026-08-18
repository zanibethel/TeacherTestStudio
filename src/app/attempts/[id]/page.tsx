import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AttemptReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: attempt } = await supabase.from('attempts').select('id,student_id,score_percent,correct_count,total_questions,submitted_at,test_id,tests(title,teacher_id),profiles:student_id(full_name),responses(id,is_correct,choice_id,questions(prompt,position,choices(id,label,position)))').eq('id',id).single()
  if (!attempt) notFound()
  const test = Array.isArray(attempt.tests) ? attempt.tests[0] : attempt.tests
  if (attempt.student_id !== user.id && test?.teacher_id !== user.id) notFound()
  const responses = [...(attempt.responses ?? [])].sort((a:any,b:any)=>a.questions?.position-b.questions?.position)
  return <main><Link href={attempt.student_id === user.id ? '/dashboard' : `/tests/${attempt.test_id}`}>← Back</Link><h1>{test?.title}</h1><section className="score-card"><span className="score">{attempt.score_percent}%</span><div><b>{attempt.correct_count} of {attempt.total_questions} correct</b><p className="muted">{attempt.profiles?.full_name || 'Student'} · {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : ''}</p></div></section><h2>Review</h2>{responses.map((r:any)=>{const choices=r.questions?.choices??[];const selected=choices.find((c:any)=>c.id===r.choice_id);return <section className={`card review ${r.is_correct?'correct':'incorrect'}`} key={r.id}><div className="row between"><b>{r.questions?.position}. {r.questions?.prompt}</b><span className={r.is_correct?'good':'bad'}>{r.is_correct?'Correct':'Incorrect'}</span></div><p>Your answer: <b>{selected?.label || 'No answer'}</b></p></section>})}</main>
}
