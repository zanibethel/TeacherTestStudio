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
  const { data: bank } = await supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,source_type,focused_retake_hint').order('updated_at',{ascending:false}).limit(1000)
  const query = await searchParams
  return <main><Link href="/dashboard">← Dashboard</Link><div className="row between"><div><h1>Create a test</h1><p className="muted">Build from your saved question bank, import a file, or write new questions.</p></div><Link className="secondary button" href="/question-bank">Question bank</Link></div>{query.error && <p className="bad">{query.error}</p>}<TestBuilder action={createTest} bankQuestions={(bank ?? []) as any} /></main>
}
