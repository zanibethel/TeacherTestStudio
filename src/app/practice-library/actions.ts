'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function selectPracticeBundleOption(bundleId:string,optionId:string){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{error}=await supabase.rpc('select_practice_bundle_option',{p_bundle_id:bundleId,p_option_id:optionId})
  if(error)redirect(`/practice-library/bundles/${bundleId}?error=${encodeURIComponent(error.message)}`)
  redirect(`/practice-library/bundles/${bundleId}?selected=1`)
}

export async function startBundlePractice(bundleId:string,collectionId:string,fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const count=Math.max(5,Math.min(30,Number(fd.get('question_count')||10)))
  const{data,error}=await supabase.rpc('create_bundle_practice_session',{p_bundle_id:bundleId,p_collection_id:collectionId,p_question_count:count})
  if(error)redirect(`/practice-library/bundles/${bundleId}?error=${encodeURIComponent(error.message)}`)
  redirect(`/practice/${data}`)
}

export async function startBundleExamPreset(bundleId:string,presetId:string){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data,error}=await supabase.rpc('create_bundle_exam_preset_session',{p_bundle_id:bundleId,p_preset_id:presetId})
  if(error)redirect(`/practice-library/bundles/${bundleId}?error=${encodeURIComponent(error.message)}`)
  redirect(`/practice/${data}`)
}

export async function submitBundleReview(bundleId:string,fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const rating=Number(fd.get('rating')||0)
  const comment=String(fd.get('comment')??'').trim()
  const{error}=await supabase.rpc('submit_practice_bundle_review',{p_bundle_id:bundleId,p_rating:rating,p_comment:comment||null})
  if(error)redirect(`/practice-library/bundles/${bundleId}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(`/practice-library/bundles/${bundleId}`)
  redirect(`/practice-library/bundles/${bundleId}?reviewed=1`)
}
