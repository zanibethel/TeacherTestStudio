import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AttemptReview({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:attempt}=await supabase.from('attempts').select('id,student_id,score_percent,correct_count,total_questions,submitted_at,test_id,attempt_number,integrity_violation_count,focus_loss_count,fullscreen_exit_count,auto_submitted,tests(title,teacher_id,review_mode,due_at),student:profiles!attempts_student_id_fkey(full_name),responses(id,is_correct,choice_id,questions(prompt,position,choices(id,label,position))),attempt_integrity_events(event_type,created_at)').eq('id',id).single()
  if(!attempt)notFound()
  const test=Array.isArray(attempt.tests)?attempt.tests[0]:attempt.tests;const student=Array.isArray(attempt.student)?attempt.student[0]:attempt.student
  const isStudent=attempt.student_id===user.id;const isTeacher=test?.teacher_id===user.id;if(!isStudent&&!isTeacher)notFound()
  const duePassed=Boolean(test?.due_at)&&Date.now()>=new Date(test!.due_at as string).getTime()
  const reviewAllowed=isTeacher||test?.review_mode==='immediate'||(test?.review_mode==='after_due'&&duePassed)
  const responses=[...(attempt.responses??[])].sort((a:any,b:any)=>a.questions?.position-b.questions?.position)
  const events=[...(attempt.attempt_integrity_events??[])].sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at)))
  return <main>
    <Link href={isStudent?'/dashboard':`/tests/${attempt.test_id}`}>← Back</Link><h1>{test?.title}</h1>
    <section className="score-card"><span className="score">{attempt.score_percent}%</span><div><b>{attempt.correct_count} of {attempt.total_questions} correct</b><p className="muted">{student?.full_name||'Student'} · Attempt {attempt.attempt_number} · {attempt.submitted_at?new Date(attempt.submitted_at).toLocaleString():''}{attempt.auto_submitted?' · Auto-submitted':''}</p></div></section>
    {isTeacher&&<section className="card"><h2>Testing integrity</h2><p><b>{attempt.integrity_violation_count}</b> event(s) recorded · {attempt.focus_loss_count} tab/app focus loss · {attempt.fullscreen_exit_count} fullscreen exit</p>{events.length===0?<p className="muted">No integrity events recorded.</p>:events.map((e:any)=><p className="muted" key={`${e.event_type}-${e.created_at}`}>{new Date(e.created_at).toLocaleTimeString()} — {String(e.event_type).replaceAll('_',' ')}</p>)}</section>}
    {!reviewAllowed?<section className="card"><h2>Answer review is not available yet</h2><p className="muted">Your teacher has chosen to release question-by-question review {test?.review_mode==='after_due'?'after the test due date.':'only when enabled.'}</p></section>:<><h2>Review</h2>{responses.map((r:any)=>{const choices=r.questions?.choices??[];const selected=choices.find((c:any)=>c.id===r.choice_id);return <section className={`card review ${r.is_correct?'correct':'incorrect'}`} key={r.id}><div className="row between"><b>{r.questions?.position}. {r.questions?.prompt}</b><span className={r.is_correct?'good':'bad'}>{r.is_correct?'Correct':'Incorrect'}</span></div><p>Your answer: <b>{selected?.label||'No answer'}</b></p></section>})}</>}
  </main>
}
