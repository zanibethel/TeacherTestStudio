'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createTeacherInvite(fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const email=String(fd.get('email')||'').trim().toLowerCase()
  if(!email)redirect('/teacher-access?error='+encodeURIComponent('Enter the teacher email this invite is for.'))
  const{data,error}=await supabase.rpc('create_teacher_invite',{p_email:email})
  if(error)redirect('/teacher-access?error='+encodeURIComponent(error.message))
  revalidatePath('/teacher-access')
  redirect('/teacher-access?invite='+encodeURIComponent(String(data))+'&email='+encodeURIComponent(email))
}
