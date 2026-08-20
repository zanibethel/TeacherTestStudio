import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExamRunner from '@/app/take/[id]/ExamRunner'
import { logIntegrity, saveProgress, submitTest } from '@/app/take/[id]/actions'

function shuffled<T>(items:T[]){return [...items].sort(()=>Math.random()-0.5)}

export default async function SharedTest({params,searchParams}:{params:Promise<{token:string}>,searchParams:Promise<{error?:string;fresh?:string}>}){
  const{token}=await params;const query=await searchParams;const supabase=await createClient();const returnPath=`/share/${encodeURIComponent(token)}`
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect(`/login?message=${encodeURIComponent('Sign in as a student to open this shared test.')}&next=${encodeURIComponent(returnPath)}`)
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
  if(profile?.role!=='student')return <main className="narrow"><Link href="/dashboard">← Dashboard</Link><h1>Student share link</h1><section className="card"><h2>This assignment link is for students</h2><p className="muted">You’re currently signed in with a teacher account, so CramLoop won’t create a student attempt under this account.</p><p>To test the real student flow, open this link in a private/incognito window or sign out and sign in with a student account.</p><div className="row"><Link className="button" href="/auth/signout">Sign out</Link><Link className="button secondary" href="/dashboard">Teacher dashboard</Link></div></section></main>
  const{data:share,error:resolveError}=await supabase.rpc('resolve_test_share',{p_token:token})
  if(resolveError)return <main className="narrow"><h1>Share unavailable</h1><p className="bad">{resolveError.message}</p><Link className="button" href="/dashboard">Back to dashboard</Link></main>
  if(!share?.test_id)notFound()
  if(share.payment_mode==='paid'&&!['paid','comped'].includes(share.entitlement_status??''))return <main className="narrow"><Link href="/dashboard">← Dashboard</Link><h1>{share.title}</h1><section className="card"><h2>Paid practice pass</h2><p>{share.description||'Practice access'}</p><p><b>${((share.price_cents||0)/100).toFixed(2)}</b>{share.access_duration_days?` · ${share.access_duration_days} days`:''}{share.max_attempts==null?' · Unlimited attempts':` · ${share.max_attempts} attempts`}</p><p className="muted">This pass includes study-guide access. Checkout is being connected next; until then the pass remains securely locked unless access is teacher-comped.</p></section></main>
  const{data:attemptId,error:startError}=await supabase.rpc('start_shared_test_attempt',{p_share_token:token})
  if(startError||!attemptId)return <main className="narrow"><h1>{share.title}</h1><p className="bad">{startError?.message||'This assignment could not be opened.'}</p><Link className="button" href="/dashboard">Back to dashboard</Link></main>
  const{data:test,error:contentError}=await supabase.rpc('get_attempt_test_content',{p_attempt_id:attemptId})
  if(contentError||!test)return <main className="narrow"><h1>{share.title}</h1><p className="bad">{contentError?.message||'This attempt could not be loaded.'}</p><Link className="button" href="/dashboard">Back to dashboard</Link></main>
  const{data:teacher}=await supabase.rpc('get_teacher_public_profile',{p_teacher_id:test.teacher_id})
  const fresh=query.fresh==='1'&&Boolean(share.randomized_retest_enabled)
  const questions=(test.questions??[]).map((q:any)=>({...q,choices:(test.randomize_choices||fresh)?shuffled(q.choices??[]):[...(q.choices??[])].sort((a:any,b:any)=>a.position-b.position)}))
  const restricted=Boolean(share.restricted_mode)||Boolean(test.strict_mode)
  const initialAnswers=(test.initial_answers??{}) as Record<string,string>
  return <>{query.error&&<p className="bad">{query.error}</p>}{teacher?.display_line&&<p className="muted" style={{textAlign:'center',margin:'8px 16px 0'}}>Teacher: <b>{teacher.display_line}</b></p>}{fresh&&<p className="good">Fresh full retest · a new question set was generated from the teacher&apos;s approved pool.</p>}<ExamRunner attemptId={test.attempt_id} attemptNumber={test.attempt_number} testId={test.test_id} title={test.title} description={test.description} questions={questions as any} deadlineAt={test.deadline_at} oneQuestionPerPage={test.one_question_per_page??true} passingScore={test.passing_score_percent??70} allowSaveResume={test.allow_save_resume??false} strictMode={restricted} integrityAction={test.integrity_action??'flag'} integrityLimit={test.integrity_limit??3} initialAnswers={initialAnswers} action={submitTest.bind(null,test.attempt_id,test.test_id)} saveAction={saveProgress.bind(null,test.attempt_id)} integrityActionCall={logIntegrity.bind(null,test.attempt_id)}/></>
}
