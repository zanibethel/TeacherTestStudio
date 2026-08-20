import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function GoToTest({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  if (!code) redirect('/dashboard?error=Enter+a+test+code')
  const supabase = await createClient()
  const { data: testId, error } = await supabase.rpc('resolve_test_code',{p_code:code.trim().toUpperCase()})
  if (error || !testId) redirect('/dashboard?error=' + encodeURIComponent('No available test found for that code'))
  redirect(`/take/${testId}`)
}
