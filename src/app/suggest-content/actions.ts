'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function submitContentSuggestion(fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const type=String(fd.get('suggestion_type')??'new_bundle')
  const bundleId=String(fd.get('bundle_id')??'').trim()
  const{error}=await supabase.rpc('submit_content_suggestion',{
    p_suggestion_type:type,
    p_bundle_id:bundleId||null,
    p_requested_title:String(fd.get('requested_title')??''),
    p_category:String(fd.get('category')??''),
    p_jurisdiction:String(fd.get('jurisdiction')??''),
    p_reason:String(fd.get('reason')??''),
    p_reference_url:String(fd.get('reference_url')??'')
  })
  if(error)redirect(`/suggest-content?type=${encodeURIComponent(type)}${bundleId?`&bundle=${encodeURIComponent(bundleId)}`:''}&error=${encodeURIComponent(error.message)}`)
  redirect('/suggest-content?submitted=1')
}
