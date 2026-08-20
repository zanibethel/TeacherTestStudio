import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {submitFocusPractice} from '../actions'
import FocusPracticeRunner from './FocusPracticeRunner'

export default async function FocusPractice({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
  const{id}=await params
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')

  const{data:session}=await supabase.from('practice_sessions').select('id,title,status,score_percent,correct_count,question_count,selected_areas,source_attempt_id,source_share_id,source_bundle_id,source_exam_preset_id,session_kind,duration_minutes,passing_score_percent,deadline_at,student_id').eq('id',id).single()
  if(!session||session.student_id!==user.id)notFound()

  const{data:metaRows}=await supabase.rpc('get_practice_session_meta',{p_session_id:id})
  const meta=metaRows?.[0]
  const required=Boolean(meta?.required)
  const minScore=Number(meta?.min_score??0)
  const showHints=Boolean(meta?.show_hints)
  const isExam=session.session_kind==='exam_preset'
  const freshHref=meta?.share_token?`/share/${meta.share_token}?fresh=1`:meta?.test_id?`/take/${meta.test_id}?fresh=1`:null
  const backHref=session.source_bundle_id?`/practice-library/bundles/${session.source_bundle_id}`:session.source_attempt_id?`/attempts/${session.source_attempt_id}`:'/dashboard'

  if(session.status==='submitted'){
    const passedGate=!required||Number(session.score_percent??0)>=minScore
    const passedExam=isExam&&Number(session.score_percent??0)>=Number(session.passing_score_percent??70)
    if(isExam)return <main className="narrow">
      <Link href={backHref}>← Back to bundle</Link>
      <span className="eyebrow">BUNDLE EXAM PRESET</span><h1>{session.title}</h1>
      <section className="score-card"><span className="score">{session.score_percent}%</span><div><b>{session.correct_count} of {session.question_count} correct</b><p className="muted">Licensing exam simulation · target {session.passing_score_percent??70}%</p></div></section>
      <section className="card"><h2>{passedExam?'Target reached':'Keep cramming'}</h2><p className={passedExam?'good':'bad'}>{passedExam?'You reached this preset’s practice target. Review your bundle readiness and weak topics before deciding what to practice next.':`This preset uses a ${session.passing_score_percent??70}% practice target. Use your bundle readiness and weak-topic recommendations before another simulation.`}</p><div className="row" style={{flexWrap:'wrap'}}><Link className="button" href={backHref}>Back to bundle</Link><Link className="secondary button" href="/practice-exams">More exam presets</Link></div></section>
      <p className="muted">CramLoop exam presets use original practice content and are not official licensing or certification exams.</p>
    </main>
    return <main className="narrow">
      <Link href={backHref}>← Back to study guide</Link>
      <h1>{session.title}</h1>
      <section className="score-card"><span className="score">{session.score_percent}%</span><div><b>{session.correct_count} of {session.question_count} correct</b><p className="muted">Focused retest · {(session.selected_areas??[]).join(', ')}</p></div></section>
      {required?<section className="card"><h2>{passedGate?'Full retest unlocked':'More focused practice required'}</h2><p className={passedGate?'good':'bad'}>{minScore===0?'Focused retest completed. Your next full attempt is unlocked.':passedGate?`You reached the required ${minScore}%. Your next full attempt is unlocked.`:`You need ${minScore}% to unlock the next full attempt.`}</p>{passedGate&&freshHref?<Link className="button" href={freshHref}>Start next full attempt</Link>:<Link className="button secondary" href={backHref}>Review weak areas</Link>}</section>:<section className="card"><h2>Focused practice complete</h2><p className="muted">Return to the study guide to review your weak areas or generate another focused set.</p><Link className="button secondary" href={backHref}>Back to study guide</Link></section>}
    </main>
  }

  const{data:rows,error}=await supabase.rpc('get_practice_session',{p_session_id:id})
  if(error||!rows?.length)notFound()
  const questions=(rows??[]).map((q:any)=>({
    question_id:String(q.question_id),question_position:Number(q.question_position),prompt:String(q.prompt),content_area:q.content_area?String(q.content_area):null,
    choices:Array.isArray(q.choices)?q.choices.map(String):[],focused_retake_hint:q.focused_retake_hint?String(q.focused_retake_hint):null,previous_answer:q.previous_answer?String(q.previous_answer):null
  }))

  return <>
    {query.error&&<main className="narrow"><p className="bad">{query.error}</p></main>}
    <FocusPracticeRunner title={session.title} questions={questions} showHints={isExam?false:showHints} required={isExam?false:required} minScore={isExam?0:minScore} modeLabel={isExam?'Licensing exam simulation':undefined} deadlineAt={isExam?session.deadline_at:null} durationMinutes={isExam?session.duration_minutes:null} passingScore={isExam?session.passing_score_percent:null} action={submitFocusPractice.bind(null,id)}/>
  </>
}
