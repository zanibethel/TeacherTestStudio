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

export async function setTestStatus(testId:string,status:'draft'|'published'|'archived'){const{supabase}=await approvedTeacher();const{error}=await supabase.from('tests').update({status,updated_at:new Date().toISOString()}).eq('id',testId);if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`);revalidatePath(`/tests/${testId}`);revalidatePath('/dashboard')}

export async function saveDeliveryControls(testId:string,fd:FormData){
  const{supabase}=await approvedTeacher();const assignmentMode=String(fd.get('assignment_mode')||'link')
  const payload={assignment_mode:assignmentMode,allow_save_resume:fd.get('allow_save_resume')==='on',randomize_choices:fd.get('randomize_choices')==='on',strict_mode:fd.get('strict_mode')==='on',integrity_action:String(fd.get('integrity_action')||'flag'),integrity_limit:Number(fd.get('integrity_limit')||3),review_mode:String(fd.get('review_mode')||'immediate'),updated_at:new Date().toISOString()}
  const{error}=await supabase.from('tests').update(payload).eq('id',testId);if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`)
  const studentIds=fd.getAll('student_ids').map(String);const{error:delError}=await supabase.from('test_assignments').delete().eq('test_id',testId);if(delError)redirect(`/tests/${testId}?error=${encodeURIComponent(delError.message)}`)
  if(assignmentMode==='assigned'&&studentIds.length){const{error:insError}=await supabase.from('test_assignments').insert(studentIds.map(student_id=>({test_id:testId,student_id})));if(insError)redirect(`/tests/${testId}?error=${encodeURIComponent(insError.message)}`)}
  revalidatePath(`/tests/${testId}`);revalidatePath('/dashboard')
}

export async function createShareOffer(testId:string,fd:FormData){
  const{supabase,user,proActive}=await approvedTeacher();const{data:test}=await supabase.from('tests').select('id,teacher_id').eq('id',testId).single();if(!test||test.teacher_id!==user.id)redirect('/dashboard')
  const environment=String(fd.get('delivery_mode')||'standard');const baseMode=environment==='restricted'?'restricted':'standard';const paid=fd.get('paid_access')==='on';if(paid&&!proActive)redirect(`/tests/${testId}?error=${encodeURIComponent('Teacher Pro is required to create paid practice passes.')}`);const deliveryMode=paid?'paid_pass':baseMode
  const unlimited=fd.get('unlimited_attempts_until_due')==='on'&&!paid
  const attemptsRaw=Math.max(1,Math.min(100,Number(fd.get('max_attempts')||1)))
  const dueRaw=String(fd.get('due_at')||'').trim();const dueAt=dueRaw?new Date(dueRaw):null
  if(unlimited&&!dueAt)redirect(`/tests/${testId}?error=${encodeURIComponent('Unlimited attempts require a due date and time.')}`)
  if(dueAt&&Number.isNaN(dueAt.getTime()))redirect(`/tests/${testId}?error=${encodeURIComponent('Enter a valid due date and time.')}`)
  if(dueAt&&dueAt.getTime()<=Date.now())redirect(`/tests/${testId}?error=${encodeURIComponent('Due date must be in the future.')}`)
  const requireFocused=fd.get('require_focused_retake_before_full')==='on'
  const focusedPercent=Math.max(10,Math.min(100,Number(fd.get('focused_retake_percent')||50)))
  const focusedMinScore=Math.max(0,Math.min(100,Number(fd.get('focused_retake_min_score')||0)))
  const focusedHints=fd.get('focused_retake_hints')==='on'
  const durationRaw=Math.max(1,Math.min(365,Number(fd.get('access_duration_days')||14)));const priceRaw=Number(fd.get('price_dollars')||0);if(paid&&priceRaw<=0)redirect(`/tests/${testId}?error=${encodeURIComponent('Enter a price for the paid practice pass.')}`)
  const audienceRaw=String(fd.get('audience_mode')||'link');const audienceMode=['link','students','groups'].includes(audienceRaw)?audienceRaw:'link';const rosterIds=fd.getAll('roster_ids').map(String);const groupIds=fd.getAll('group_ids').map(String)
  if(audienceMode==='students'&&!rosterIds.length)redirect(`/tests/${testId}?error=${encodeURIComponent('Select at least one roster student for this share.')}`);if(audienceMode==='groups'&&!groupIds.length)redirect(`/tests/${testId}?error=${encodeURIComponent('Select at least one group for this share.')}`)
  const expiresRaw=String(fd.get('link_expires_at')||'').trim();const guide=fd.get('study_guide_enabled')==='on'||paid;const focused=fd.get('focused_retake_enabled')==='on'||requireFocused||paid;const randomized=paid||unlimited||attemptsRaw>1
  const experienceName=String(fd.get('experience_name')||'Custom').trim().slice(0,80)||'Custom'
  const payload={test_id:testId,teacher_id:user.id,label:String(fd.get('label')||'').trim()||null,experience_name:experienceName,delivery_mode:deliveryMode,restricted_mode:baseMode==='restricted',access_mode:paid?'practice_pass':'classroom',payment_mode:paid?'paid':'free',max_attempts:paid?null:(unlimited?null:attemptsRaw),unlimited_attempts_until_due:unlimited,due_at:dueAt?dueAt.toISOString():null,require_focused_retake_before_full:requireFocused,focused_retake_percent:focusedPercent,focused_retake_min_score:focusedMinScore,focused_retake_hints:focusedHints,access_duration_days:paid?durationRaw:null,study_guide_enabled:guide,focused_retake_enabled:focused,randomized_retest_enabled:randomized,link_expires_at:expiresRaw?new Date(expiresRaw).toISOString():null,price_cents:paid?Math.round(priceRaw*100):null,audience_mode:audienceMode}
  const{data:share,error}=await supabase.from('test_shares').insert(payload).select('id').single();if(error||!share)redirect(`/tests/${testId}?error=${encodeURIComponent(error?.message||'Could not create share')}`)
  if(audienceMode==='students'){const{data:owned}=await supabase.from('teacher_student_roster').select('id').eq('teacher_id',user.id).in('id',rosterIds);const rows=(owned??[]).map((r:any)=>({share_id:share.id,roster_id:r.id}));if(rows.length){const{error:e}=await supabase.from('test_share_roster_targets').insert(rows);if(e)redirect(`/tests/${testId}?error=${encodeURIComponent(e.message)}`)}}
  if(audienceMode==='groups'){const{data:owned}=await supabase.from('teacher_groups').select('id').eq('teacher_id',user.id).in('id',groupIds);const rows=(owned??[]).map((g:any)=>({share_id:share.id,group_id:g.id}));if(rows.length){const{error:e}=await supabase.from('test_share_group_targets').insert(rows);if(e)redirect(`/tests/${testId}?error=${encodeURIComponent(e.message)}`)}}

  const savePresetName=String(fd.get('save_preset_name')||'').trim().slice(0,80)
  if(savePresetName){
    const presetSettings={deliveryMode:baseMode,maxAttempts:attemptsRaw,unlimited,requireFocused,focusedPercent,focusedMinScore,focusedHints,studyGuide:guide,focusedRetake:focused,paidAccess:paid,accessDuration:durationRaw,price:paid?String(priceRaw):''}
    const{error:presetError}=await supabase.from('teacher_share_experience_presets').upsert({teacher_id:user.id,name:savePresetName,settings:presetSettings,updated_at:new Date().toISOString()},{onConflict:'teacher_id,name'})
    if(presetError)redirect(`/tests/${testId}?error=${encodeURIComponent(`Share created, but preset could not be saved: ${presetError.message}`)}`)
  }
  revalidatePath(`/tests/${testId}`);revalidatePath('/reports')
}

export async function setShareActive(testId:string,shareId:string,active:boolean){const{supabase}=await approvedTeacher();const{error}=await supabase.from('test_shares').update({active,updated_at:new Date().toISOString()}).eq('id',shareId).eq('test_id',testId);if(error)redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`);revalidatePath(`/tests/${testId}`);revalidatePath('/reports')}
