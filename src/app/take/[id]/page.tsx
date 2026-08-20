import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitTest, saveProgress, logIntegrity } from './actions'
import ExamRunner from './ExamRunner'

function shuffled<T>(items:T[]){return [...items].sort(()=>Math.random()-0.5)}

export default async function TakeTest({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string;fresh?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='student')redirect('/dashboard')
  const{data:attemptId,error:startError}=await supabase.rpc('start_test_attempt',{p_test_id:id})
  if(startError||!attemptId)return <main className="narrow"><h1>Test unavailable</h1><p className="bad">{startError?.message||'This test could not be opened.'}</p><a className="button" href="/dashboard">Back to dashboard</a></main>
  const{data:test,error:contentError}=await supabase.rpc('get_attempt_test_content',{p_attempt_id:attemptId})
  if(contentError||!test)return <main className="narrow"><h1>Test unavailable</h1><p className="bad">{contentError?.message||'This attempt could not be loaded.'}</p><a className="button" href="/dashboard">Back to dashboard</a></main>
  const{data:teacher}=await supabase.rpc('get_teacher_public_profile',{p_teacher_id:test.teacher_id})
  const fresh=query.fresh==='1'&&Boolean(test.randomized_retest_enabled)
  const questions=(test.questions??[]).map((q:any)=>({...q,choices:(test.randomize_choices||fresh)?shuffled(q.choices??[]):[...(q.choices??[])].sort((a:any,b:any)=>a.position-b.position)}))
  const initialAnswers=(test.initial_answers??{}) as Record<string,string>
  return <>{query.error&&<p className="bad">{query.error}</p>}{teacher?.display_line&&<p className="muted" style={{textAlign:'center',margin:'8px 16px 0'}}>Teacher: <b>{teacher.display_line}</b></p>}{fresh&&<p className="good">Fresh full retest · a new question set was generated from the teacher&apos;s approved pool.</p>}<ExamRunner attemptId={test.attempt_id} attemptNumber={test.attempt_number} testId={test.test_id} title={test.title} description={test.description} questions={questions as any} deadlineAt={test.deadline_at} oneQuestionPerPage={test.one_question_per_page??true} passingScore={test.passing_score_percent??70} allowSaveResume={test.allow_save_resume??false} strictMode={test.strict_mode??false} integrityAction={test.integrity_action??'flag'} integrityLimit={test.integrity_limit??3} initialAnswers={initialAnswers} action={submitTest.bind(null,test.attempt_id,test.test_id)} saveAction={saveProgress.bind(null,test.attempt_id)} integrityActionCall={logIntegrity.bind(null,test.attempt_id)}/></>
}
