import Link from 'next/link'
import { notFound,redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitFocusPractice } from '../actions'

export default async function FocusPractice({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:session}=await supabase.from('practice_sessions').select('id,title,status,score_percent,correct_count,question_count,selected_areas,source_attempt_id').eq('id',id).single();if(!session)notFound()
  if(session.status==='submitted')return <main className="narrow"><Link href={session.source_attempt_id?`/attempts/${session.source_attempt_id}`:'/dashboard'}>← Back to study guide</Link><h1>{session.title}</h1><section className="score-card"><span className="score">{session.score_percent}%</span><div><b>{session.correct_count} of {session.question_count} correct</b><p className="muted">Focused practice: {(session.selected_areas??[]).join(', ')}</p></div></section><p>You can return to your study guide, change the selected focus areas, and generate another randomized mini-test.</p></main>
  const{data:rows,error}=await supabase.rpc('get_practice_session',{p_session_id:id});if(error||!rows?.length)notFound()
  return <main><Link href={session.source_attempt_id?`/attempts/${session.source_attempt_id}`:'/dashboard'}>← Study guide</Link><h1>{session.title}</h1><p className="muted">Randomized focused practice · {(session.selected_areas??[]).join(', ')}</p>{query.error&&<p className="bad">{query.error}</p>}<form action={submitFocusPractice.bind(null,id)} className="stack">{rows.map((q:any)=><section className="card" key={q.question_id}><b>{q.question_position}. {q.prompt}</b><p className="muted">{q.content_area}</p><div className="stack">{(Array.isArray(q.choices)?q.choices:[]).map((choice:string,i:number)=><label className="check" key={i}><input required type="radio" name={`q_${q.question_id}`} value={i}/>{choice}</label>)}</div></section>)}<button>Submit focused practice</button></form></main>
}
