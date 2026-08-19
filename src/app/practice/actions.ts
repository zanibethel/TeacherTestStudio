'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createFocusPractice(attemptId:string,fd:FormData){
  const supabase=await createClient()
  const areas=fd.getAll('areas').map(String).filter(Boolean)
  const count=Math.max(1,Math.min(200,Number(fd.get('question_count')||10)))
  const{data,error}=await supabase.rpc('create_focus_practice_session',{p_attempt_id:attemptId,p_areas:areas,p_question_count:count})
  if(error)redirect(`/attempts/${attemptId}?practice_error=${encodeURIComponent(error.message)}`)
  redirect(`/practice/${data}`)
}

export async function submitFocusPractice(sessionId:string,fd:FormData){
  const supabase=await createClient()
  const answers:Record<string,number>={}
  for(const [key,value] of fd.entries())if(key.startsWith('q_'))answers[key.slice(2)]=Number(value)
  const{error}=await supabase.rpc('submit_practice_session',{p_session_id:sessionId,p_answers:answers})
  if(error)redirect(`/practice/${sessionId}?error=${encodeURIComponent(error.message)}`)
  redirect(`/practice/${sessionId}`)
}
