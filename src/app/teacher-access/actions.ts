'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createTeacherInvite(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data,error}=await supabase.rpc('create_teacher_invite')
  if(error)redirect('/teacher-access?error='+encodeURIComponent(error.message))
  revalidatePath('/teacher-access')
  redirect('/teacher-access?invite='+encodeURIComponent(String(data)))
}
