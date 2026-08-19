'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function addStudentEmail(fd:FormData){
  const supabase=await createClient()
  const email=String(fd.get('email')||'').trim().toLowerCase()
  const{error}=await supabase.rpc('add_teacher_student_email',{p_email:email})
  if(error)redirect(`/teacher-roster?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/teacher-roster')
  redirect('/teacher-roster?message='+encodeURIComponent('Student email added to your roster.'))
}

export async function removeStudent(rosterId:string){
  const supabase=await createClient()
  const{error}=await supabase.rpc('remove_teacher_student_roster',{p_roster_id:rosterId})
  if(error)redirect(`/teacher-roster?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/teacher-roster')
}
