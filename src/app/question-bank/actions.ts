'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function normalize(value:string){return value.trim().toLowerCase().replace(/\s+/g,' ')}

export async function deleteBankQuestion(id:string){
  const supabase=await createClient()
  const{error}=await supabase.from('question_bank').delete().eq('id',id)
  if(error)redirect('/question-bank?error='+encodeURIComponent(error.message))
  revalidatePath('/question-bank');revalidatePath('/tests/new')
}

export async function refreshSharedBankQuestions(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data,error}=await supabase.rpc('refresh_my_shared_bank_questions')
  if(error)redirect('/question-bank?error='+encodeURIComponent(error.message))
  revalidatePath('/question-bank');revalidatePath('/tests/new')
  redirect('/question-bank?refreshed='+encodeURIComponent(String(data??0)))
}

export async function updateBankQuestion(id:string,fd:FormData){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const prompt=String(fd.get('prompt')||'').trim()
  const subjectCategory=String(fd.get('subject_category')||'').trim()
  const chapterNumberRaw=String(fd.get('chapter_number')||'').trim()
  const chapterNumber=chapterNumberRaw?Number(chapterNumberRaw):null
  const chapterTitle=String(fd.get('chapter_title')||'').trim()
  const explanation=String(fd.get('explanation')||'').trim()
  const focusedHint=String(fd.get('focused_retake_hint')||'').trim()
  const choices=fd.getAll('choices').map(x=>String(x).trim()).filter(Boolean)
  const correctIndex=Number(fd.get('correct_index')||0)
  if(!prompt||choices.length<2||correctIndex<0||correctIndex>=choices.length)redirect(`/question-bank/${id}/edit?error=`+encodeURIComponent('Enter a question, at least two choices, and a valid correct answer.'))
  if(chapterNumber!==null&&(!Number.isInteger(chapterNumber)||chapterNumber<1))redirect(`/question-bank/${id}/edit?error=`+encodeURIComponent('Chapter number must be a positive whole number.'))
  const{error}=await supabase.from('question_bank').update({
    prompt,normalized_prompt:normalize(prompt),choices,correct_index:correctIndex,
    content_area:subjectCategory||null,subject_category:subjectCategory||null,
    chapter_number:chapterNumber,chapter_title:chapterTitle||null,
    explanation:explanation||null,focused_retake_hint:focusedHint||null,updated_at:new Date().toISOString()
  }).eq('id',id).eq('teacher_id',user.id)
  if(error)redirect(`/question-bank/${id}/edit?error=`+encodeURIComponent(error.message))
  revalidatePath('/question-bank');revalidatePath('/tests/new');redirect('/question-bank')
}
