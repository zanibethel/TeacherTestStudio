'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function submitTest(testId: string, formData: FormData) {
  const answers: Record<string,string> = {}
  for (const [key,value] of formData.entries()) if (key.startsWith('q_')) answers[key.slice(2)] = String(value)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_test_attempt', { p_test_id: testId, p_answers: answers })
  if (error) redirect(`/take/${testId}?error=${encodeURIComponent(error.message)}`)
  redirect(`/attempts/${data}`)
}
