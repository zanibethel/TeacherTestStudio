import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function GoToTest({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  if (!code) redirect('/dashboard?error=Enter+a+test+code')
  const supabase = await createClient()
  const { data: test } = await supabase.from('tests').select('id').eq('share_code', code.trim().toUpperCase()).eq('status','published').maybeSingle()
  if (!test) redirect('/dashboard?error=' + encodeURIComponent('No published test found for that code'))
  redirect(`/take/${test.id}`)
}
