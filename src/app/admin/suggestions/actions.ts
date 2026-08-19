'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateSuggestion(id:string,fd:FormData){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{error}=await supabase.rpc('admin_update_content_suggestion',{
    p_id:id,
    p_status:String(fd.get('status')??'new'),
    p_admin_note:String(fd.get('admin_note')??'')
  })
  if(error)redirect(`/admin/suggestions?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/suggestions')
  redirect('/admin/suggestions?message=Suggestion%20updated.')
}
