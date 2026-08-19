'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function saveTestEdit(testId:string,fd:FormData){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:test}=await supabase.from('tests').select('id,teacher_id,title').eq('id',testId).single();if(!test||test.teacher_id!==user.id)redirect('/dashboard')
  const title=String(fd.get('title')||'').trim(),description=String(fd.get('description')||''),randomize=fd.get('randomize')==='on',duration=Number(fd.get('duration_minutes')||0),singlePage=fd.get('single_page')==='on',passingScore=Number(fd.get('passing_score')||70),examPreset=String(fd.get('exam_preset')||'custom'),assessmentType=String(fd.get('assessment_type')||'custom'),chapterLabel=String(fd.get('chapter_label')||'')
  const questionCount=Number(fd.get('question_count')||0);const questions=[] as any[]
  for(let qi=0;qi<questionCount;qi++){
    const choiceCount=Number(fd.get(`q_${qi}_choice_count`)||0);const choices=[] as string[]
    for(let ci=0;ci<choiceCount;ci++)choices.push(String(fd.get(`q_${qi}_choice_${ci}`)||''))
    questions.push({prompt:String(fd.get(`q_${qi}_prompt`)||''),choices,correctIndex:Number(fd.get(`q_${qi}_correct`)||0),contentArea:String(fd.get(`q_${qi}_area`)||''),sourceType:'teacher'})
  }
  const{count}=await supabase.from('attempts').select('*',{count:'exact',head:true}).eq('test_id',testId).not('submitted_at','is',null)
  if((count??0)>0){
    const revisedTitle=title===test.title?`${title} — Revised`:title
    const{data:newId,error}=await supabase.rpc('create_test_with_questions_v3',{p_title:revisedTitle,p_description:description,p_randomize:randomize,p_duration_minutes:duration,p_one_question_per_page:singlePage,p_passing_score:passingScore,p_exam_preset:examPreset,p_assessment_type:assessmentType,p_chapter_label:chapterLabel,p_questions:questions})
    if(error)redirect(`/tests/${testId}/edit?error=${encodeURIComponent(error.message)}`)
    redirect(`/tests/${newId}/edit?message=${encodeURIComponent('A revised draft was created so the original student reports stay intact.')}`)
  }
  const{error}=await supabase.rpc('update_test_with_questions_v1',{p_test_id:testId,p_title:title,p_description:description,p_randomize:randomize,p_duration_minutes:duration,p_one_question_per_page:singlePage,p_passing_score:passingScore,p_exam_preset:examPreset,p_assessment_type:assessmentType,p_chapter_label:chapterLabel,p_questions:questions})
  if(error)redirect(`/tests/${testId}/edit?error=${encodeURIComponent(error.message)}`)
  redirect(`/tests/${testId}/edit?message=${encodeURIComponent('Test updated.')}`)
}
