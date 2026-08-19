import Link from 'next/link'
import {notFound,redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {submitFocusPractice} from '../actions'
import FocusPracticeRunner from './FocusPracticeRunner'

function one<T>(value:T|T[]|null|undefined):T|undefined{return Array.isArray(value)?value[0]:value??undefined}

export default async function FocusPractice({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:session}=await supabase.from('practice_sessions').select('id,title,status,score_percent,correct_count,question_count,selected_areas,source_attempt_id,source_share_id,student_id').eq('id',id).single();if(!session||session.student_id!==user.id)notFound()

  let showHints=false,minScore=0,required=false,freshHref:string|null=null
  if(session.source_share_id){
    const{data:share}=await supabase.from('test_shares').select('token,focused_retake_hints,focused_retake_min_score,require_focused_retake_before_full').eq('id',session.source_share_id).single()
    showHints=Boolean(share?.focused_retake_hints);minScore=Number(share?.focused_retake_min_score??0);required=Boolean(share?.require_focused_retake_before_full);if(share?.token)freshHref=`/share/${share.token}?fresh=1`
  }else if(session.source_attempt_id){
    const{data:source}=await supabase.from('attempts').select('test_id,tests(focused_retake_hints,focused_retake_min_score,require_focused_retake_before_full)').eq('id',session.source_attempt_id).single();const test=one((source as any)?.tests)
    showHints=Boolean(test?.focused_retake_hints);minScore=Number(test?.focused_retake_min_score??0);required=Boolean(test?.require_focused_retake_before_full);if(source?.test_id)freshHref=`/take/${source.test_id}?fresh=1`
  }

  const backHref=session.source_attempt_id?`/attempts/${session.source_attempt_id}`:'/dashboard'
  if(session.status==='submitted'){
    const passedGate=!required||Number(session.score_percent??0)>=minScore
    return <main className="narrow"><Link href={backHref}>← Back to study guide</Link><h1>{session.title}</h1><section className="score-card"><span className="score">{session.score_percent}%</span><div><b>{session.correct_count} of {session.question_count} correct</b><p className="muted">Focused retest · {(session.selected_areas??[]).join(', ')}</p></div></section>
      {required?<section className="card"><h2>{passedGate?'Full retest unlocked':'More focused practice required'}</h2><p className={passedGate?'good':'bad'}>{minScore===0?'Focused retest completed. Your next full attempt is unlocked.':passedGate?`You reached the required ${minScore}%. Your next full attempt is unlocked.`:`You need ${minScore}% to unlock the next full attempt.`}</p>{passedGate&&freshHref?<Link className="button" href={freshHref}>Start next full attempt</Link>:<Link className="button secondary" href={backHref}>Review weak areas</Link>}</section>:<section className="card"><h2>Focused practice complete</h2><p className="muted">Return to the study guide to review your weak areas or generate another focused set.</p><Link className="button secondary" href={backHref}>Back to study guide</Link></section>}
    </main>
  }

  const{data:rows,error}=await supabase.rpc('get_practice_session',{p_session_id:id});if(error||!rows?.length)notFound()
  const questions=(rows??[]).map((q:any)=>({question_id:String(q.question_id),question_position:Number(q.question_position),prompt:String(q.prompt),content_area:q.content_area?String(q.content_area):null,choices:Array.isArray(q.choices)?q.choices.map(String):[],focused_retake_hint:q.focused_retake_hint?String(q.focused_retake_hint):null}))
  return <>{query.error&&<main className="narrow"><p className="bad">{query.error}</p></main>}<FocusPracticeRunner title={session.title} questions={questions} showHints={showHints} required={required} minScore={minScore} action={submitFocusPractice.bind(null,id)}/></>
}
