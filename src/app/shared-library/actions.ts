'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function approvedTeacherClient(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  return supabase
}

export async function importCollection(collectionId:string){
  const supabase=await approvedTeacherClient()
  const{data,error}=await supabase.rpc('import_shared_collection',{p_collection_id:collectionId})
  if(error)redirect('/shared-library?error='+encodeURIComponent(error.message))
  revalidatePath('/question-bank');revalidatePath('/shared-library');revalidatePath('/dashboard')
  redirect('/shared-library?message='+encodeURIComponent(`${Number(data??0)} question${Number(data??0)===1?'':'s'} added to your bank. Existing matches were left unchanged.`))
}

async function refreshCollection(collectionId:string,returnTo:string){
  const supabase=await approvedTeacherClient()
  const{data:added,error:importError}=await supabase.rpc('import_shared_collection',{p_collection_id:collectionId})
  if(importError)redirect(`${returnTo}?error=`+encodeURIComponent(importError.message))
  const{data:updated,error:refreshError}=await supabase.rpc('refresh_my_shared_bank_questions',{p_collection_id:collectionId})
  if(refreshError)redirect(`${returnTo}?error=`+encodeURIComponent(refreshError.message))
  revalidatePath('/question-bank');revalidatePath('/shared-library');revalidatePath(`/shared-library/${collectionId}`);revalidatePath('/tests/new')
  const addCount=Number(added??0),updateCount=Number(updated??0)
  const message=addCount||updateCount
    ?`${addCount?`${addCount} new question${addCount===1?'':'s'} added. `:''}${updateCount?`${updateCount} existing question${updateCount===1?'':'s'} refreshed.`:''}`.trim()
    :'Your bank is already up to date.'
  redirect(`${returnTo}?message=`+encodeURIComponent(message))
}

export async function refreshCollectionFromLibrary(collectionId:string){
  await refreshCollection(collectionId,'/shared-library')
}

export async function refreshCollectionFromDetail(collectionId:string){
  await refreshCollection(collectionId,`/shared-library/${collectionId}`)
}
