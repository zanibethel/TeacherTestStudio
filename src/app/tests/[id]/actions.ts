'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function approvedTeacher(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  return{supabase,user}
}

export async function setTestStatus(testId:string,status:'draft'|'published'|'archived'){
  const{supabase}=await approvedTeacher();const{error}=await supabase.from('tests').update({status,updated_at:new Date().toISOString()}).eq('id',testId)
  if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`);revalidatePath(`/tests/${testId}`);revalidatePath('/dashboard')
}

export async function saveDeliveryControls(testId:string,fd:FormData){
  const{supabase}=await approvedTeacher()
  const assignmentMode=String(fd.get('assignment_mode')||'link')
  const available=String(fd.get('available_from')||'').trim()
  const due=String(fd.get('due_at')||'').trim()
  const payload={
    assignment_mode:assignmentMode,
    max_attempts:Math.max(1,Number(fd.get('max_attempts')||1)),
    allow_save_resume:fd.get('allow_save_resume')==='on',
    randomize_choices:fd.get('randomize_choices')==='on',
    study_guide_enabled:fd.get('study_guide_enabled')==='on',
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

export async function createShareOffer(testId:string,fd:FormData){
  const{supabase,user}=await approvedTeacher()
  const{data:test}=await supabase.from('tests').select('id,teacher_id').eq('id',testId).single()
  if(!test||test.teacher_id!==user.id)redirect('/dashboard')
  const accessMode=String(fd.get('access_mode')||'classroom')==='practice_pass'?'practice_pass':'classroom'
  const paymentMode=String(fd.get('payment_mode')||'free')==='paid'?'paid':'free'
  const unlimited=fd.get('unlimited_attempts')==='on'
  const maxAttempts=unlimited?null:Math.max(1,Math.min(100,Number(fd.get('max_attempts')||1)))
  const durationRaw=Number(fd.get('access_duration_days')||0)
  const durationDays=accessMode==='practice_pass'&&durationRaw>0?Math.max(1,Math.min(365,durationRaw)):null
  const expiresRaw=String(fd.get('link_expires_at')||'').trim()
  const priceRaw=Number(fd.get('price_dollars')||0)
  if(paymentMode==='paid'&&accessMode!=='practice_pass')redirect(`/tests/${testId}?error=${encodeURIComponent('Paid access is available for practice-pass shares.')}`)
  if(paymentMode==='paid'&&priceRaw<=0)redirect(`/tests/${testId}?error=${encodeURIComponent('Enter a price for a paid practice pass.')}`)
  const payload={
    test_id:testId,teacher_id:user.id,label:String(fd.get('label')||'').trim()||null,
    access_mode:accessMode,payment_mode:paymentMode,max_attempts:maxAttempts,
    access_duration_days:durationDays,study_guide_enabled:fd.get('study_guide_enabled')==='on',
    link_expires_at:expiresRaw?new Date(expiresRaw).toISOString():null,
    price_cents:paymentMode==='paid'?Math.round(priceRaw*100):null,
  }
  const{error}=await supabase.from('test_shares').insert(payload)
  if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(`/tests/${testId}`)
}

export async function setShareActive(testId:string,shareId:string,active:boolean){
  const{supabase}=await approvedTeacher()
  const{error}=await supabase.from('test_shares').update({active,updated_at:new Date().toISOString()}).eq('id',shareId).eq('test_id',testId)
  if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(`/tests/${testId}`)
}
