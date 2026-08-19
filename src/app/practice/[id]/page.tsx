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

  const{data:session}=await supabase.from('practice_sessions').select('id,title,status,score_percent,correct_count,question_count,selected_areas,source_attempt_id,source_share_id,student_id').eq('id',id).single()
  if(!session||session.student_id!==user.id)notFound()

  const{data:metaRows}=await supabase.rpc('get_practice_session_meta',{p_session_id:id})
  const meta=metaRows?.[0]
  const required=Boolean(meta?.required)
  const minScore=Number(meta?.min_score??0)
  const showHints=Boolean(meta?.show_hints)
  const freshHref=meta?.share_token?`/share/${meta.share_token}?fresh=1`:meta?.test_id?`/take/${meta.test_id}?fresh=1`:null
  const backHref=session.source_attempt_id?`/attempts/${session.source_attempt_id}`:'/dashboard'

  if(session.status==='submitted'){
    const passedGate=!required||Number(session.score_percent??0)>=minScore
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
    question_id:String(q.question_id),
    question_position:Number(q.question_position),
    prompt:String(q.prompt),
    content_area:q.content_area?String(q.content_area):null,
    choices:Array.isArray(q.choices)?q.choices.map(String):[],
    focused_retake_hint:q.focused_retake_hint?String(q.focused_retake_hint):null,
    previous_answer:q.previous_answer?String(q.previous_answer):null
  }))

  return <>
    {query.error&&<main className="narrow"><p className="bad">{query.error}</p></main>}
    <FocusPracticeRunner title={session.title} questions={questions} showHints={showHints} required={required} minScore={minScore} action={submitFocusPractice.bind(null,id)}/>
  </>
}
