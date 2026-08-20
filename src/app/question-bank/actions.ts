'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function normalize(value:string){return value.trim().toLowerCase().replace(/\s+/g,' ')}
function questionFromForm(fd:FormData){
  const prompt=String(fd.get('prompt')||'').trim()
  const subjectCategory=String(fd.get('subject_category')||'').trim()
  const chapterNumberRaw=String(fd.get('chapter_number')||'').trim()
  const chapterNumber=chapterNumberRaw?Number(chapterNumberRaw):null
  const chapterTitle=String(fd.get('chapter_title')||'').trim()
  const explanation=String(fd.get('explanation')||'').trim()
  const focusedHint=String(fd.get('focused_retake_hint')||'').trim()
  const choices=fd.getAll('choices').map(x=>String(x).trim()).filter(Boolean)
  const correctIndex=Number(fd.get('correct_index')||0)
  return{prompt,subjectCategory,chapterNumber,chapterTitle,explanation,focusedHint,choices,correctIndex}
}
function validationError(q:ReturnType<typeof questionFromForm>){
  if(!q.prompt||q.choices.length<2||q.correctIndex<0||q.correctIndex>=q.choices.length)return'Enter a question, at least two choices, and a valid correct answer.'
  if(q.chapterNumber!==null&&(!Number.isInteger(q.chapterNumber)||q.chapterNumber<1))return'Chapter number must be a positive whole number.'
  return''
}

export async function createBankQuestion(fd:FormData){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const q=questionFromForm(fd),invalid=validationError(q);if(invalid)redirect('/question-bank/new?error='+encodeURIComponent(invalid))
  const{error}=await supabase.from('question_bank').insert({teacher_id:user.id,prompt:q.prompt,normalized_prompt:normalize(q.prompt),choices:q.choices,correct_index:q.correctIndex,content_area:q.subjectCategory||null,subject_category:q.subjectCategory||null,chapter_number:q.chapterNumber,chapter_title:q.chapterTitle||null,explanation:q.explanation||null,focused_retake_hint:q.focusedHint||null,source_type:'teacher'})
  if(error){const message=error.code==='23505'?'That question already exists in your bank.':error.message;redirect('/question-bank/new?error='+encodeURIComponent(message))}
  revalidatePath('/question-bank');revalidatePath('/tests/new');redirect('/question-bank?added=1')
}

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

export async function bulkUpdateBankQuestionMetadata(fd:FormData){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const ids=[...new Set(fd.getAll('question_ids').map(x=>String(x).trim()).filter(Boolean))]
  if(!ids.length)redirect('/question-bank?error='+encodeURIComponent('Select at least one question.'))
  if(ids.length>1000)redirect('/question-bank?error='+encodeURIComponent('You can update up to 1000 questions at once.'))
  const chapterNumberRaw=String(fd.get('chapter_number')||'').trim(),chapterTitle=String(fd.get('chapter_title')||'').trim(),subjectCategory=String(fd.get('subject_category')||'').trim(),patch:Record<string,unknown>={updated_at:new Date().toISOString()}
  if(chapterNumberRaw){const chapterNumber=Number(chapterNumberRaw);if(!Number.isInteger(chapterNumber)||chapterNumber<1)redirect('/question-bank?error='+encodeURIComponent('Chapter number must be a positive whole number.'));patch.chapter_number=chapterNumber}
  if(chapterTitle)patch.chapter_title=chapterTitle
  if(subjectCategory){patch.subject_category=subjectCategory;patch.content_area=subjectCategory}
  if(Object.keys(patch).length===1)redirect('/question-bank?error='+encodeURIComponent('Enter at least one chapter or subject value to apply.'))
  const{data,error}=await supabase.from('question_bank').update(patch).eq('teacher_id',user.id).in('id',ids).select('id')
  if(error)redirect('/question-bank?error='+encodeURIComponent(error.message))
  revalidatePath('/question-bank');revalidatePath('/tests/new');redirect('/question-bank?bulkUpdated='+encodeURIComponent(String(data?.length??0)))
}

export async function updateBankQuestion(id:string,fd:FormData){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const q=questionFromForm(fd),invalid=validationError(q);if(invalid)redirect(`/question-bank/${id}/edit?error=`+encodeURIComponent(invalid))
  const{error}=await supabase.from('question_bank').update({prompt:q.prompt,normalized_prompt:normalize(q.prompt),choices:q.choices,correct_index:q.correctIndex,content_area:q.subjectCategory||null,subject_category:q.subjectCategory||null,chapter_number:q.chapterNumber,chapter_title:q.chapterTitle||null,explanation:q.explanation||null,focused_retake_hint:q.focusedHint||null,updated_at:new Date().toISOString()}).eq('id',id).eq('teacher_id',user.id)
  if(error)redirect(`/question-bank/${id}/edit?error=`+encodeURIComponent(error.code==='23505'?'That question already exists in your bank.':error.message))
  revalidatePath('/question-bank');revalidatePath('/tests/new');redirect('/question-bank')
}
