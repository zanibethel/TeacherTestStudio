import Link from 'next/link'
import { notFound,redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitFocusPractice } from '../actions'

const hintByArea:Record<string,string>={
  'Licensing & Texas Rules':'Focus on the current rule, license scope, or regulator requirement that directly applies.',
  'Safety, Sanitation & Infection Control':'Separate cleaning, disinfection, single-use handling, and exposure-control steps before choosing.',
  'Hair & Scalp Care':'Think about structure, condition, contraindications, and the safest service decision for the hair or scalp.',
  'Haircutting & Styling':'Picture the guideline, elevation, overdirection, tool safety, or shape the technique is designed to create.',
  'Chemical Texture Services':'Check compatibility, processing sequence, strand condition, and where chemical overlap could cause damage.',
  'Haircoloring & Lightening':'Work through level, tone, underlying pigment, developer, and safety testing before selecting the answer.',
  'Skin Care':'Start with skin condition, contraindications, sanitation, and the safest product or service sequence.',
  'Nail Care':'Think through nail condition, infection signs, sanitation, and safe preparation before choosing.'
}
function one<T>(value:T|T[]|null|undefined):T|undefined{return Array.isArray(value)?value[0]:value??undefined}

export default async function FocusPractice({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:session}=await supabase.from('practice_sessions').select('id,title,status,score_percent,correct_count,question_count,selected_areas,source_attempt_id').eq('id',id).single();if(!session)notFound()
  let showHints=false,minScore=0,required=false
  if(session.source_attempt_id){const{data:source}=await supabase.from('attempts').select('tests(focused_retake_hints,focused_retake_min_score,require_focused_retake_before_full)').eq('id',session.source_attempt_id).single();const test=one((source as any)?.tests);showHints=Boolean(test?.focused_retake_hints);minScore=Number(test?.focused_retake_min_score??0);required=Boolean(test?.require_focused_retake_before_full)}
  if(session.status==='submitted')return <main className="narrow"><Link href={session.source_attempt_id?`/attempts/${session.source_attempt_id}`:'/dashboard'}>← Back to study guide</Link><h1>{session.title}</h1><section className="score-card"><span className="score">{session.score_percent}%</span><div><b>{session.correct_count} of {session.question_count} correct</b><p className="muted">Focused practice: {(session.selected_areas??[]).join(', ')}</p></div></section>{required?<p className={Number(session.score_percent??0)>=minScore?'good':'bad'}>{minScore===0?'Focused retest completed. Your next full attempt is unlocked.':Number(session.score_percent??0)>=minScore?`Required ${minScore}% reached. Your next full attempt is unlocked.`:`You need ${minScore}% to unlock the next full attempt. Review the weak areas and try another focused retest.`}</p>:<p>You can return to your study guide, change the selected focus areas, and generate another randomized mini-test.</p>}</main>
  const{data:rows,error}=await supabase.rpc('get_practice_session',{p_session_id:id});if(error||!rows?.length)notFound()
  return <main><Link href={session.source_attempt_id?`/attempts/${session.source_attempt_id}`:'/dashboard'}>← Study guide</Link><h1>{session.title}</h1><p className="muted">Focused retest · {session.question_count} questions · {(session.selected_areas??[]).join(', ')}{required?` · ${minScore}% required to unlock full retest`:''}</p>{query.error&&<p className="bad">{query.error}</p>}<form action={submitFocusPractice.bind(null,id)} className="stack">{rows.map((q:any)=><section className="card" key={q.question_id}><b>{q.question_position}. {q.prompt}</b><p className="muted">{q.content_area}</p>{showHints&&<div className="notice"><b>Hint</b><p className="muted">{hintByArea[q.content_area]||`Think about the core rule, concept, or safest procedure for ${q.content_area||'this topic'} before choosing.`}</p></div>}<div className="stack">{(Array.isArray(q.choices)?q.choices:[]).map((choice:string,i:number)=><label className="check" key={i}><input required type="radio" name={`q_${q.question_id}`} value={i}/>{choice}</label>)}</div></section>)}<button>Submit focused retest</button></form></main>
}
