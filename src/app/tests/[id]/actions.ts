'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function setTestStatus(testId:string,status:'draft'|'published'|'archived'){
  const supabase=await createClient();const{error}=await supabase.from('tests').update({status,updated_at:new Date().toISOString()}).eq('id',testId)
  if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`);revalidatePath(`/tests/${testId}`);revalidatePath('/dashboard')
}

export async function saveDeliveryControls(testId:string,fd:FormData){
  const supabase=await createClient()
  const assignmentMode=String(fd.get('assignment_mode')||'link')
  const available=String(fd.get('available_from')||'').trim()
  const due=String(fd.get('due_at')||'').trim()
  const payload={
    assignment_mode:assignmentMode,
    max_attempts:Number(fd.get('max_attempts')||1),
    allow_save_resume:fd.get('allow_save_resume')==='on',
    randomize_choices:fd.get('randomize_choices')==='on',
    strict_mode:fd.get('strict_mode')==='on',
    integrity_action:String(fd.get('integrity_action')||'flag'),
    integrity_limit:Number(fd.get('integrity_limit')||3),
    review_mode:String(fd.get('review_mode')||'immediate'),
    available_from:available?new Date(available).toISOString():null,
    due_at:due?new Date(due).toISOString():null,
    updated_at:new Date().toISOString(),
  }
  const{error}=await supabase.from('tests').update(payload).eq('id',testId)
  if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`)
  const studentIds=fd.getAll('student_ids').map(String)
  const{error:delError}=await supabase.from('test_assignments').delete().eq('test_id',testId)
  if(delError)redirect(`/tests/${testId}?error=${encodeURIComponent(delError.message)}`)
  if(assignmentMode==='assigned'&&studentIds.length){const{error:insError}=await supabase.from('test_assignments').insert(studentIds.map(student_id=>({test_id:testId,student_id})));if(insError)redirect(`/tests/${testId}?error=${encodeURIComponent(insError.message)}`)}
  revalidatePath(`/tests/${testId}`);revalidatePath('/dashboard')
}
