'use server'
import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'

async function adminClient(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:isAdmin}=await supabase.rpc('is_platform_admin')
  if(!isAdmin)redirect('/dashboard')
  return supabase
}

export async function saveExamPreset(bundleId:string,presetId:string,fd:FormData){
  const supabase=await adminClient()
  const{error}=await supabase.rpc('admin_upsert_bundle_exam_preset',{
    p_bundle_id:bundleId,p_preset_id:presetId||null,p_slug:String(fd.get('slug')??''),p_title:String(fd.get('title')??''),
    p_description:String(fd.get('description')??''),p_provider_label:String(fd.get('provider_label')??''),p_mode_label:String(fd.get('mode_label')??'Exam simulation'),
    p_question_count:Number(fd.get('question_count')||100),p_duration_minutes:Number(fd.get('duration_minutes')||0),
    p_passing_score_percent:Number(fd.get('passing_score_percent')||70),p_readiness_target_percent:Number(fd.get('readiness_target_percent')||70),
    p_is_free_preview:fd.get('is_free_preview')==='on',p_position:Number(fd.get('position')||0),p_active:fd.get('active')==='on'
  })
  if(error)redirect(`/admin/exam-presets?bundle=${bundleId}&error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/exam-presets');revalidatePath('/practice-exams');revalidatePath(`/practice-library/bundles/${bundleId}`)
  redirect(`/admin/exam-presets?bundle=${bundleId}&message=${encodeURIComponent('Exam preset saved.')}`)
}
