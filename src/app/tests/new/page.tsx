import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TestBuilder from './TestBuilder'
import { createTest } from './actions'

export default async function NewTest({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'teacher') redirect('/dashboard')
  const query = await searchParams
  return <main><Link href="/dashboard">← Dashboard</Link><h1>Create a test</h1><p className="muted">Build a reusable question set, choose the answer key, and publish when you are ready.</p>{query.error && <p className="bad">{query.error}</p>}<TestBuilder action={createTest} /></main>
}
