'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function deleteBankQuestion(id:string){
  const supabase=await createClient()
  const{error}=await supabase.from('question_bank').delete().eq('id',id)
  if(error)redirect('/question-bank?error='+encodeURIComponent(error.message))
  revalidatePath('/question-bank');revalidatePath('/tests/new')
}
