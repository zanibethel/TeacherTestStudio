import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitTest, saveProgress, logIntegrity } from './actions'
import ExamRunner from './ExamRunner'

function shuffled<T>(items:T[]){return [...items].sort(()=>Math.random()-0.5)}

export default async function TakeTest({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string;fresh?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='student')redirect('/dashboard')
  const{data:test}=await supabase.from('tests').select('id,title,description,status,randomize_questions,randomize_choices,randomized_retest_enabled,duration_minutes,one_question_per_page,passing_score_percent,allow_save_resume,strict_mode,integrity_action,integrity_limit,questions(id,prompt,position,choices(id,label,position))').eq('id',id).eq('status','published').single();if(!test)notFound()
  const{data:attemptId,error:startError}=await supabase.rpc('start_test_attempt',{p_test_id:id});if(startError)return <main><h1>{test.title}</h1><p className="bad">{startError.message}</p><a className="button" href="/dashboard">Back to dashboard</a></main>
  const{data:attempt}=await supabase.from('attempts').select('id,deadline_at,attempt_number,responses(question_id,choice_id)').eq('id',attemptId).single();if(!attempt)notFound()
  const initialAnswers:Record<string,string>={};for(const r of(attempt.responses??[]) as any[])if(r.choice_id)initialAnswers[r.question_id]=r.choice_id
  const ordered=[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position)
  const fresh=query.fresh==='1'&&Boolean(test.randomized_retest_enabled)
  const questions=((test.randomize_questions||fresh)?shuffled(ordered):ordered).map((q:any)=>({...q,choices:(test.randomize_choices||fresh)?shuffled(q.choices??[]):[...(q.choices??[])].sort((a:any,b:any)=>a.position-b.position)}))
  return <>{query.error&&<p className="bad">{query.error}</p>}{fresh&&<p className="good">Fresh randomized retest · question and answer order reshuffled</p>}<ExamRunner attemptId={attempt.id} attemptNumber={attempt.attempt_number} testId={test.id} title={test.title} description={test.description} questions={questions as any} deadlineAt={attempt.deadline_at} oneQuestionPerPage={test.one_question_per_page??true} passingScore={test.passing_score_percent??70} allowSaveResume={test.allow_save_resume??false} strictMode={test.strict_mode??false} integrityAction={test.integrity_action??'flag'} integrityLimit={test.integrity_limit??3} initialAnswers={initialAnswers} action={submitTest.bind(null,attempt.id,id)} saveAction={saveProgress.bind(null,attempt.id)} integrityActionCall={logIntegrity.bind(null,attempt.id)}/></>
}
