'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function approvedTeacher(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved,teacher_plan,teacher_plan_expires_at').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const proActive=profile.teacher_plan==='pro'&&(!profile.teacher_plan_expires_at||new Date(profile.teacher_plan_expires_at).getTime()>Date.now())
  return{supabase,user,proActive}
}

export async function setTestStatus(testId:string,status:'draft'|'published'|'archived'){
  const{supabase}=await approvedTeacher();const{error}=await supabase.from('tests').update({status,updated_at:new Date().toISOString()}).eq('id',testId)
  if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`);revalidatePath(`/tests/${testId}`);revalidatePath('/dashboard')
}

export async function saveDeliveryControls(testId:string,fd:FormData){
  const{supabase}=await approvedTeacher();const assignmentMode=String(fd.get('assignment_mode')||'link'),available=String(fd.get('available_from')||'').trim(),due=String(fd.get('due_at')||'').trim()
  const payload={assignment_mode:assignmentMode,max_attempts:Math.max(1,Number(fd.get('max_attempts')||1)),allow_save_resume:fd.get('allow_save_resume')==='on',randomize_choices:fd.get('randomize_choices')==='on',study_guide_enabled:fd.get('study_guide_enabled')==='on',strict_mode:fd.get('strict_mode')==='on',integrity_action:String(fd.get('integrity_action')||'flag'),integrity_limit:Number(fd.get('integrity_limit')||3),review_mode:String(fd.get('review_mode')||'immediate'),available_from:available?new Date(available).toISOString():null,due_at:due?new Date(due).toISOString():null,updated_at:new Date().toISOString()}
  const{error}=await supabase.from('tests').update(payload).eq('id',testId);if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`)
  const studentIds=fd.getAll('student_ids').map(String);const{error:delError}=await supabase.from('test_assignments').delete().eq('test_id',testId);if(delError)redirect(`/tests/${testId}?error=${encodeURIComponent(delError.message)}`)
  if(assignmentMode==='assigned'&&studentIds.length){const{error:insError}=await supabase.from('test_assignments').insert(studentIds.map(student_id=>({test_id:testId,student_id})));if(insError)redirect(`/tests/${testId}?error=${encodeURIComponent(insError.message)}`)}
  revalidatePath(`/tests/${testId}`);revalidatePath('/dashboard')
}

export async function createShareOffer(testId:string,fd:FormData){
  const{supabase,user,proActive}=await approvedTeacher();const{data:test}=await supabase.from('tests').select('id,teacher_id').eq('id',testId).single();if(!test||test.teacher_id!==user.id)redirect('/dashboard')
  const requested=String(fd.get('delivery_mode')||'standard');const deliveryMode=['standard','restricted','study','paid_pass'].includes(requested)?requested:'standard'
  const paid=deliveryMode==='paid_pass';if(paid&&!proActive)redirect(`/tests/${testId}?error=${encodeURIComponent('Teacher Pro is required to create paid practice passes.')}`)
  const attemptsRaw=Math.max(1,Math.min(5,Number(fd.get('max_attempts')||1)));const maxAttempts=paid?null:attemptsRaw
  const durationRaw=Math.max(1,Math.min(365,Number(fd.get('access_duration_days')||14)));const priceRaw=Number(fd.get('price_dollars')||0)
  if(paid&&priceRaw<=0)redirect(`/tests/${testId}?error=${encodeURIComponent('Enter a price for the paid practice pass.')}`)
  const expiresRaw=String(fd.get('link_expires_at')||'').trim()
  const payload={
    test_id:testId,teacher_id:user.id,label:String(fd.get('label')||'').trim()||null,
    delivery_mode:deliveryMode,restricted_mode:deliveryMode==='restricted',
    access_mode:paid?'practice_pass':'classroom',payment_mode:paid?'paid':'free',max_attempts:maxAttempts,
    access_duration_days:paid?durationRaw:null,
    study_guide_enabled:deliveryMode==='study'||paid,
    link_expires_at:expiresRaw?new Date(expiresRaw).toISOString():null,
    price_cents:paid?Math.round(priceRaw*100):null,
  }
  const{error}=await supabase.from('test_shares').insert(payload);if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(`/tests/${testId}`)
}

export async function setShareActive(testId:string,shareId:string,active:boolean){
  const{supabase}=await approvedTeacher();const{error}=await supabase.from('test_shares').update({active,updated_at:new Date().toISOString()}).eq('id',shareId).eq('test_id',testId)
  if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`);revalidatePath(`/tests/${testId}`)
}
