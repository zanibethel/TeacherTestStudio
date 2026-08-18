import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitTest } from './actions'

function shuffled<T>(items: T[]) { return [...items].sort(() => Math.random() - 0.5) }

export default async function TakeTest({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ error?: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id',user.id).single()
  if (profile?.role !== 'student') redirect('/dashboard')
  const { data: test } = await supabase.from('tests').select('id,title,description,status,randomize_questions,questions(id,prompt,position,choices(id,label,position))').eq('id',id).eq('status','published').single()
  if (!test) notFound()
  const query = await searchParams
  const ordered = [...(test.questions ?? [])].sort((a:any,b:any)=>a.position-b.position)
  const questions = test.randomize_questions ? shuffled(ordered) : ordered
  return <main><Link href="/dashboard">← Dashboard</Link><h1>{test.title}</h1><p className="muted">{test.description}</p>{query.error && <p className="bad">{query.error}</p>}<form action={submitTest.bind(null,id)}>{questions.map((q:any,index:number)=><section className="card" key={q.id}><h2>{index+1}. {q.prompt}</h2>{[...(q.choices??[])].sort((a:any,b:any)=>a.position-b.position).map((c:any)=><label className="answer" key={c.id}><input required type="radio" name={`q_${q.id}`} value={c.id}/><span>{c.label}</span></label>)}</section>)}<button type="submit">Submit test</button></form></main>
}
