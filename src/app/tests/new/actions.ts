'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createTest(formData: FormData) {
  const supabase = await createClient()
  const title = String(formData.get('title') ?? '')
  const description = String(formData.get('description') ?? '')
  const randomize = formData.get('randomize') === 'on'
  let questions: unknown
  try { questions = JSON.parse(String(formData.get('questions') ?? '[]')) } catch { redirect('/tests/new?error=Invalid+question+data') }
  const { data, error } = await supabase.rpc('create_test_with_questions', { p_title: title, p_description: description, p_randomize: randomize, p_questions: questions })
  if (error) redirect('/tests/new?error=' + encodeURIComponent(error.message))
  redirect(`/tests/${data}`)
}
