'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function selectPracticeBundle(bundleId:string){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{error}=await supabase.rpc('select_practice_bundle',{p_bundle_id:bundleId})
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
