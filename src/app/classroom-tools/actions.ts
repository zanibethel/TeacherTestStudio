'use server'

import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'

export async function startLocalClassroomExam(bundleId:string,presetId:string,fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const studentName=String(fd.get('student_name')??'').trim()
  const{data,error}=await supabase.rpc('create_teacher_local_exam_session',{
    p_bundle_id:bundleId,
    p_preset_id:presetId,
    p_student_name:studentName
  })
  if(error)redirect(`/classroom-tools?bundle=${encodeURIComponent(bundleId)}&preset=${encodeURIComponent(presetId)}&error=${encodeURIComponent(error.message)}#local-start`)
  redirect(`/classroom-tools/local/${data}`)
}

export async function submitLocalClassroomExam(sessionId:string,fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const answers:Record<string,number>={}
  for(const[key,value]of fd.entries()){
    if(!key.startsWith('q_'))continue
    const raw=String(value).trim()
    if(raw!=='')answers[key.slice(2)]=Number(raw)
  }
  const{error}=await supabase.rpc('submit_practice_session',{
    p_session_id:sessionId,
    p_answers:answers
  })
  if(error)redirect(`/classroom-tools/local/${sessionId}?error=${encodeURIComponent(error.message)}`)
  redirect(`/classroom-tools/local/${sessionId}`)
}
