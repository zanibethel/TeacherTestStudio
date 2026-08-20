'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function saveTestEdit(testId:string,fd:FormData){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:test}=await supabase.from('tests').select('id,teacher_id,title,questions_per_attempt,require_focused_retake_before_full,focused_retake_percent,focused_retake_min_score,focused_retake_hints,unlimited_attempts_until_due,max_attempts,due_at').eq('id',testId).single();if(!test||test.teacher_id!==user.id)redirect('/dashboard')
  const title=String(fd.get('title')||'').trim(),description=String(fd.get('description')||''),randomize=fd.get('randomize')==='on',duration=Number(fd.get('duration_minutes')||0),singlePage=fd.get('single_page')==='on',passingScore=Number(fd.get('passing_score')||70),examPreset=String(fd.get('exam_preset')||'custom'),assessmentType=String(fd.get('assessment_type')||'custom'),chapterLabel=String(fd.get('chapter_label')||'')
  const questionCount=Number(fd.get('question_count')||0);const questions=[] as any[]
  for(let qi=0;qi<questionCount;qi++){
    const choices=fd.getAll(`q_${qi}_choices`).map(x=>String(x).trim()).filter(Boolean)
    questions.push({
      prompt:String(fd.get(`q_${qi}_prompt`)||'').trim(),choices,correctIndex:Number(fd.get(`q_${qi}_correct`)||0),
      contentArea:String(fd.get(`q_${qi}_subject`)||'').trim(),subjectCategory:String(fd.get(`q_${qi}_subject`)||'').trim(),
      chapterNumber:String(fd.get(`q_${qi}_chapter_number`)||'').trim()?Number(fd.get(`q_${qi}_chapter_number`)):null,
      chapterTitle:String(fd.get(`q_${qi}_chapter_title`)||'').trim(),focusedRetakeHint:String(fd.get(`q_${qi}_hint`)||'').trim(),
      explanation:String(fd.get(`q_${qi}_explanation`)||'').trim(),sourceType:'teacher'
    })
  }
  const{count}=await supabase.from('attempts').select('*',{count:'exact',head:true}).eq('test_id',testId).not('submitted_at','is',null)
  if((count??0)>0){
    const revisedTitle=title===test.title?`${title} — Revised`:title
    const dueAt=test.due_at&&new Date(test.due_at).getTime()>Date.now()?test.due_at:null
    const{data:newId,error}=await supabase.rpc('create_test_with_questions_v6',{
      p_title:revisedTitle,p_description:description,p_randomize:randomize,p_duration_minutes:duration,p_one_question_per_page:singlePage,p_passing_score:passingScore,p_exam_preset:examPreset,p_assessment_type:assessmentType,p_chapter_label:chapterLabel,p_questions:questions,
      p_questions_per_attempt:Math.min(Number(test.questions_per_attempt)||questions.length,questions.length),p_require_focused_retake_before_full:Boolean(test.require_focused_retake_before_full),p_focused_retake_percent:Number(test.focused_retake_percent)||50,p_focused_retake_min_score:Number(test.focused_retake_min_score)||0,p_focused_retake_hints:test.focused_retake_hints!==false,p_unlimited_attempts_until_due:Boolean(test.unlimited_attempts_until_due)&&Boolean(dueAt),p_max_attempts:Number(test.max_attempts)||1,p_due_at:dueAt
    })
    if(error)redirect(`/tests/${testId}/edit?error=${encodeURIComponent(error.message)}`)
    redirect(`/tests/${newId}/edit?message=${encodeURIComponent('A revised draft was created so the original student reports stay intact.')}`)
  }
  const{error}=await supabase.rpc('update_test_with_questions_v2',{p_test_id:testId,p_title:title,p_description:description,p_randomize:randomize,p_duration_minutes:duration,p_one_question_per_page:singlePage,p_passing_score:passingScore,p_exam_preset:examPreset,p_assessment_type:assessmentType,p_chapter_label:chapterLabel,p_questions:questions})
  if(error)redirect(`/tests/${testId}/edit?error=${encodeURIComponent(error.message)}`)
  redirect(`/tests/${testId}/edit?message=${encodeURIComponent('Test updated.')}`)
}
