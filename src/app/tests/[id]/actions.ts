'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function setTestStatus(testId: string, status: 'draft' | 'published' | 'archived') {
  const supabase = await createClient()
  const { error } = await supabase.from('tests').update({ status, updated_at: new Date().toISOString() }).eq('id', testId)
  if (error) redirect(`/tests/${testId}?error=${encodeURIComponent(error.message)}`)
  revalidatePath(`/tests/${testId}`)
  revalidatePath('/dashboard')
}
