'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function adminClient(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:isAdmin}=await supabase.rpc('is_platform_admin')
  if(!isAdmin)redirect('/dashboard')
  return supabase
}

export async function createBundle(fd:FormData){
  const supabase=await adminClient()
  const{data,error}=await supabase.rpc('admin_create_practice_bundle',{
    p_slug:String(fd.get('slug')??''),p_title:String(fd.get('title')??''),p_subject:String(fd.get('subject')??''),p_category:String(fd.get('category')??'')
  })
  if(error)redirect(`/admin/bundles?error=${encodeURIComponent(error.message)}`)
  redirect(`/admin/bundles?message=${encodeURIComponent('Draft bundle created.')}&bundle=${data}`)
}

export async function saveBundle(bundleId:string,fd:FormData){
  const supabase=await adminClient()
  const currentAsOf=String(fd.get('current_as_of')??'').trim()
  const{error}=await supabase.rpc('admin_update_practice_bundle',{
    p_bundle_id:bundleId,
    p_title:String(fd.get('title')??''),p_description:String(fd.get('description')??''),p_subject:String(fd.get('subject')??''),
    p_category:String(fd.get('category')??''),p_subcategory:String(fd.get('subcategory')??''),p_jurisdiction:String(fd.get('jurisdiction')??''),p_language:String(fd.get('language')??'English'),
    p_featured:fd.get('featured')==='on',p_sort_priority:Number(fd.get('sort_priority')||0),p_publication_status:String(fd.get('publication_status')??'draft'),p_content_version:String(fd.get('content_version')??'1.0'),
    p_verified:fd.get('verified')==='on',p_current_as_of:currentAsOf||null,p_alignment_note:String(fd.get('alignment_note')??'')
  })
  if(error)redirect(`/admin/bundles?error=${encodeURIComponent(error.message)}&bundle=${bundleId}`)
  revalidatePath('/admin/bundles');revalidatePath('/practice-library');revalidatePath(`/practice-library/bundles/${bundleId}`)
  redirect(`/admin/bundles?message=${encodeURIComponent('Bundle saved.')}&bundle=${bundleId}`)
}

export async function saveAccessOption(bundleId:string,optionId:string,fd:FormData){
  const supabase=await adminClient()
  const raw=String(fd.get('price_cents')??'').trim()
  const{error}=await supabase.rpc('admin_upsert_bundle_access_option',{
    p_bundle_id:bundleId,p_option_id:optionId||null,p_label:String(fd.get('label')??''),p_duration_hours:Number(fd.get('duration_hours')||24),
    p_price_cents:raw===''?null:Number(raw),p_badge:String(fd.get('badge')??''),p_position:Number(fd.get('position')||0),p_active:fd.get('active')==='on'
  })
  if(error)redirect(`/admin/bundles?error=${encodeURIComponent(error.message)}&bundle=${bundleId}`)
  revalidatePath('/admin/bundles');revalidatePath(`/practice-library/bundles/${bundleId}`)
  redirect(`/admin/bundles?message=${encodeURIComponent('Access option saved.')}&bundle=${bundleId}`)
}

export async function saveBundleResource(bundleId:string,collectionId:string,fd:FormData){
  const supabase=await adminClient()
  const{error}=await supabase.rpc('admin_set_bundle_collection',{
    p_bundle_id:bundleId,p_collection_id:collectionId,p_position:Number(fd.get('position')||0),p_is_free_preview:fd.get('is_free_preview')==='on',p_attached:fd.get('attached')==='on'
  })
  if(error)redirect(`/admin/bundles?error=${encodeURIComponent(error.message)}&bundle=${bundleId}`)
  revalidatePath('/admin/bundles');revalidatePath('/practice-library');revalidatePath(`/practice-library/bundles/${bundleId}`)
  redirect(`/admin/bundles?message=${encodeURIComponent('Bundle resource updated.')}&bundle=${bundleId}`)
}
