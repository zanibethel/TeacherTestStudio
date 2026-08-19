'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function copyTest(testId:string){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:test,error:testError}=await supabase.from('tests').select('id,teacher_id,title,description,randomize_questions,duration_minutes,one_question_per_page,passing_score_percent,exam_preset,assessment_type,chapter_label,max_attempts,allow_save_resume,randomize_choices,study_guide_enabled,strict_mode,integrity_action,integrity_limit,review_mode').eq('id',testId).single()
  if(testError||!test||test.teacher_id!==user.id)redirect('/dashboard?error='+encodeURIComponent('Test not found.'))
  const{data:questions}=await supabase.from('questions').select('id,prompt,position,content_area').eq('test_id',testId).order('position')
  const qIds=(questions??[]).map((q:any)=>q.id)
  const{data:choices}=qIds.length?await supabase.from('choices').select('id,question_id,label,position').in('question_id',qIds).order('position'):{data:[] as any[]}
  const{data:answers}=qIds.length?await supabase.from('question_answers').select('question_id,choice_id').in('question_id',qIds):{data:[] as any[]}
  const answerMap=new Map((answers??[]).map((a:any)=>[a.question_id,a.choice_id]))
  const payload=(questions??[]).map((q:any)=>{const qc=(choices??[]).filter((c:any)=>c.question_id===q.id).sort((a:any,b:any)=>a.position-b.position);const correctId=answerMap.get(q.id);return{prompt:q.prompt,choices:qc.map((c:any)=>c.label),correctIndex:Math.max(0,qc.findIndex((c:any)=>c.id===correctId)),contentArea:q.content_area??'',sourceType:'copied'}})
  const{data:newId,error}=await supabase.rpc('create_test_with_questions_v3',{p_title:`${test.title} (Copy)`,p_description:test.description??'',p_randomize:test.randomize_questions,p_duration_minutes:test.duration_minutes,p_one_question_per_page:test.one_question_per_page,p_passing_score:test.passing_score_percent,p_exam_preset:test.exam_preset,p_assessment_type:test.assessment_type,p_chapter_label:test.chapter_label??'',p_questions:payload})
  if(error)redirect('/dashboard?error='+encodeURIComponent(error.message))
  await supabase.from('tests').update({max_attempts:test.max_attempts,allow_save_resume:test.allow_save_resume,randomize_choices:test.randomize_choices,study_guide_enabled:test.study_guide_enabled,strict_mode:test.strict_mode,integrity_action:test.integrity_action,integrity_limit:test.integrity_limit,review_mode:test.review_mode,status:'draft',available_from:null,due_at:null}).eq('id',newId)
  redirect(`/tests/${newId}/edit`)
}
