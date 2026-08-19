'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function saveTeacherProfile(fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const displayName=String(fd.get('display_name')||'').trim()
  const organization=String(fd.get('organization')||'').trim()
  const title=String(fd.get('title')||'').trim()
  if(!displayName)redirect('/profile?error='+encodeURIComponent('Enter the name students should see.'))
  const{error}=await supabase.rpc('update_my_teacher_profile',{p_display_name:displayName,p_organization:organization,p_title:title})
  if(error)redirect('/profile?error='+encodeURIComponent(error.message))
  revalidatePath('/profile');revalidatePath('/dashboard');revalidatePath('/find-teacher')
  redirect('/profile?saved=1')
}
