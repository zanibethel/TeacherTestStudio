'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function submitTest(attemptId: string, testId: string, formData: FormData) {
  const answers: Record<string,string> = {}
  for (const [key,value] of formData.entries()) if (key.startsWith('q_')) answers[key.slice(2)] = String(value)
  const auto = formData.get('auto_submit') === '1'
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_test_attempt_v2', { p_attempt_id: attemptId, p_answers: answers, p_auto: auto })
  if (error) redirect(`/take/${testId}?error=${encodeURIComponent(error.message)}`)
  redirect(`/attempts/${data}`)
}

export async function saveProgress(attemptId: string, answers: Record<string,string>) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_attempt_answers', { p_attempt_id: attemptId, p_answers: answers })
  if (error) return { ok:false, error:error.message }
  return { ok:true }
}

export async function logIntegrity(attemptId: string, eventType: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('log_attempt_integrity_event', { p_attempt_id: attemptId, p_event_type: eventType })
  if (error) return { ok:false, count:0 }
  return { ok:true, count:Number(data ?? 0) }
}
