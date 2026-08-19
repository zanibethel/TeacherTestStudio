import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const studyTips:Record<string,string>={
  'Licensing & Texas Rules':'Review current TDLR licensing requirements, exam eligibility, scope, and the Candidate Information Bulletin.',
  'Safety, Sanitation & Infection Control':'Review cleaning vs. disinfection, single-use items, cross-contamination, blood exposure, and manufacturer contact-time directions.',
  'Hair & Scalp Care':'Review hair structure, porosity, elasticity, growth cycles, scalp analysis, and service contraindications.',
  'Haircutting & Styling':'Review elevation, guidelines, overdirection, weight distribution, thermal safety, and finishing techniques.',
  'Chemical Texture Services':'Review disulfide bonds, permanent-wave processing, neutralization, relaxer compatibility, strand tests, and overlap safety.',
  'Haircoloring & Lightening':'Review levels, tones, underlying pigment, developer, strand/patch testing, lightening safety, and color-wheel neutralization.',
  'Skin Care':'Review skin analysis, epidermal layers, cleansing, exfoliation, contraindications, product selection, and facial-service safety.',
  'Nail Care':'Review nail anatomy, sanitation, natural-nail filing, enhancement preparation, infection signs, and safe pedicure practices.',
}
function one<T>(value:T|T[]|null|undefined):T|undefined{return Array.isArray(value)?value[0]:value??undefined}

export default async function AttemptReview({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:attempt}=await supabase.from('attempts').select('id,student_id,score_percent,correct_count,total_questions,submitted_at,test_id,share_id,attempt_number,integrity_violation_count,focus_loss_count,fullscreen_exit_count,auto_submitted,tests(title,teacher_id,review_mode,due_at,study_guide_enabled,passing_score_percent),share:test_shares(study_guide_enabled),student:profiles!attempts_student_id_fkey(full_name),responses(id,is_correct,choice_id,questions(prompt,position,content_area,choices(id,label,position))),attempt_integrity_events(event_type,created_at)').eq('id',id).single()
  if(!attempt)notFound()
  const test=one(attempt.tests);const share=one(attempt.share);const student=one(attempt.student)
  const isStudent=attempt.student_id===user.id;const isTeacher=test?.teacher_id===user.id;if(!isStudent&&!isTeacher)notFound()
  const duePassed=Boolean(test?.due_at)&&Date.now()>=new Date(test!.due_at as string).getTime()
  const reviewAllowed=isTeacher||test?.review_mode==='immediate'||(test?.review_mode==='after_due'&&duePassed)
  const responses=[...(attempt.responses??[])].sort((a:any,b:any)=>Number(one(a.questions)?.position??0)-Number(one(b.questions)?.position??0))
  const events=[...(attempt.attempt_integrity_events??[])].sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at)))
  const passing=Number(test?.passing_score_percent??70);const failed=Number(attempt.score_percent??0)<passing
  const guideEnabled=share?.study_guide_enabled??test?.study_guide_enabled??true
  const areaMap=new Map<string,{total:number;missed:number}>();for(const r of responses){const question=one(r.questions as any);const area=question?.content_area||'General review';const row=areaMap.get(area)||{total:0,missed:0};row.total++;if(!r.is_correct)row.missed++;areaMap.set(area,row)}
  const focus=[...areaMap.entries()].filter(([,v])=>v.missed>0).sort((a,b)=>b[1].missed-a[1].missed)
  return <main>
    <Link href={isStudent?'/dashboard':`/tests/${attempt.test_id}`}>← Back</Link><h1>{test?.title}</h1>
    <section className="score-card"><span className="score">{attempt.score_percent}%</span><div><b>{attempt.correct_count} of {attempt.total_questions} correct</b><p className="muted">{student?.full_name||'Student'} · Attempt {attempt.attempt_number} · {attempt.submitted_at?new Date(attempt.submitted_at).toLocaleString():''}{attempt.auto_submitted?' · Auto-submitted':''}</p></div></section>
    {failed&&guideEnabled&&<section className="card"><h2>Your study guide</h2><p>You scored below the {passing}% target. Focus on these areas before the next attempt.</p>{focus.length===0?<p className="muted">Review the full test content before trying again.</p>:focus.map(([area,v])=><div className="question-summary" key={area}><b>{area}</b><p>Missed {v.missed} of {v.total} question{v.total===1?'':'s'} in this area.</p><p className="muted">{studyTips[area]||`Review the core concepts, vocabulary, safety rules, and procedures for ${area}.`}</p></div>)}</section>}
    {isTeacher&&<section className="card"><h2>Testing integrity</h2><p><b>{attempt.integrity_violation_count}</b> event(s) recorded · {attempt.focus_loss_count} tab/app focus loss · {attempt.fullscreen_exit_count} fullscreen exit</p>{events.length===0?<p className="muted">No integrity events recorded.</p>:events.map((e:any)=><p className="muted" key={`${e.event_type}-${e.created_at}`}>{new Date(e.created_at).toLocaleTimeString()} — {String(e.event_type).replaceAll('_',' ')}</p>)}</section>}
    {!reviewAllowed?<section className="card"><h2>Answer review is not available yet</h2><p className="muted">Your teacher has chosen to release question-by-question review {test?.review_mode==='after_due'?'after the test due date.':'only when enabled.'}</p></section>:<><h2>Review</h2>{responses.map((r:any)=>{const question=one(r.questions as any);const choices=question?.choices??[];const selected=choices.find((c:any)=>c.id===r.choice_id);return <section className={`card review ${r.is_correct?'correct':'incorrect'}`} key={r.id}><div className="row between"><b>{question?.position}. {question?.prompt}</b><span className={r.is_correct?'good':'bad'}>{r.is_correct?'Correct':'Incorrect'}</span></div><p>Your answer: <b>{selected?.label||'No answer'}</b></p></section>})}</>}
  </main>
}
