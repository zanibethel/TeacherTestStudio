import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExamRunner from '@/app/take/[id]/ExamRunner'
import { logIntegrity, saveProgress, submitTest } from '@/app/take/[id]/actions'

function shuffled<T>(items:T[]){return [...items].sort(()=>Math.random()-0.5)}

export default async function SharedTest({params,searchParams}:{params:Promise<{token:string}>,searchParams:Promise<{error?:string}>}){
  const{token}=await params;const query=await searchParams;const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect(`/login?message=${encodeURIComponent('Sign in as a student to open this shared test.')}`)
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='student')redirect('/dashboard')
  const{data:share,error:resolveError}=await supabase.rpc('resolve_test_share',{p_token:token})
  if(resolveError)return <main className="narrow"><h1>Share unavailable</h1><p className="bad">{resolveError.message}</p><Link className="button" href="/dashboard">Back to dashboard</Link></main>
  if(!share?.test_id)notFound()
  if(share.payment_mode==='paid'&&!['paid','comped'].includes(share.entitlement_status??'')){
    return <main className="narrow"><Link href="/dashboard">← Dashboard</Link><h1>{share.title}</h1><section className="card"><h2>Paid practice pass</h2><p>{share.description||'Practice access'}</p><p><b>${((share.price_cents||0)/100).toFixed(2)}</b>{share.access_duration_days?` · ${share.access_duration_days} days`:''}{share.max_attempts==null?' · Unlimited attempts':` · ${share.max_attempts} attempts`}</p><p className="muted">This pass includes study-guide access. Checkout is being connected next; until then the pass remains securely locked unless access is teacher-comped.</p></section></main>
  }
  const{data:test}=await supabase.from('tests').select('id,title,description,status,randomize_questions,randomize_choices,duration_minutes,one_question_per_page,passing_score_percent,allow_save_resume,strict_mode,integrity_action,integrity_limit,questions(id,prompt,position,choices(id,label,position))').eq('id',share.test_id).eq('status','published').single()
  if(!test)notFound()
  const{data:attemptId,error:startError}=await supabase.rpc('start_shared_test_attempt',{p_share_token:token})
  if(startError)return <main className="narrow"><h1>{test.title}</h1><p className="bad">{startError.message}</p><Link className="button" href="/dashboard">Back to dashboard</Link></main>
  const{data:attempt}=await supabase.from('attempts').select('id,deadline_at,attempt_number,responses(question_id,choice_id)').eq('id',attemptId).single();if(!attempt)notFound()
  const initialAnswers:Record<string,string>={};for(const r of(attempt.responses??[]) as any[])if(r.choice_id)initialAnswers[r.question_id]=r.choice_id
  const ordered=[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position)
  const questions=(test.randomize_questions?shuffled(ordered):ordered).map((q:any)=>({...q,choices:test.randomize_choices?shuffled(q.choices??[]):[...(q.choices??[])].sort((a:any,b:any)=>a.position-b.position)}))
  const restricted=Boolean(share.restricted_mode)||Boolean(test.strict_mode)
  return <>
    {query.error&&<p className="bad">{query.error}</p>}
    <ExamRunner attemptId={attempt.id} attemptNumber={attempt.attempt_number} testId={test.id} title={test.title} description={test.description} questions={questions as any} deadlineAt={attempt.deadline_at} oneQuestionPerPage={test.one_question_per_page??true} passingScore={test.passing_score_percent??70} allowSaveResume={test.allow_save_resume??false} strictMode={restricted} integrityAction={test.integrity_action??'flag'} integrityLimit={test.integrity_limit??3} initialAnswers={initialAnswers} action={submitTest.bind(null,attempt.id,test.id)} saveAction={saveProgress.bind(null,attempt.id)} integrityActionCall={logIntegrity.bind(null,attempt.id)}/>
  </>
}
