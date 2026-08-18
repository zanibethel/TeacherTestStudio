import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { setTestStatus } from './actions'

export default async function TestDetail({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ error?: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: test } = await supabase.from('tests').select('id,title,description,status,share_code,randomize_questions,teacher_id,questions(id,prompt,position,choices(id,label,position)),attempts(id,score_percent,correct_count,total_questions,submitted_at,student_id,student:profiles!attempts_student_id_fkey(full_name))').eq('id', id).single()
  if (!test || test.teacher_id !== user.id) notFound()
  const query = await searchParams
  const questions = [...(test.questions ?? [])].sort((a: any,b: any) => a.position-b.position)
  const attempts = [...(test.attempts ?? [])].sort((a: any,b: any) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between"><div><h1>{test.title}</h1><p className="muted">{test.description || 'No description'}</p></div><span className="pill">{test.status}</span></div>
    {query.error && <p className="bad">{query.error}</p>}
    <section className="card"><h2>Deployment</h2><p>Student code: <b className="code">{test.share_code}</b></p><p>Question order: <b>{test.randomize_questions ? 'Randomized' : 'Fixed'}</b></p><form action={setTestStatus.bind(null,id,test.status === 'published' ? 'draft' : 'published')}><button>{test.status === 'published' ? 'Unpublish test' : 'Publish test'}</button></form></section>
    <section className="card"><h2>Questions ({questions.length})</h2>{questions.map((q:any) => <div className="question-summary" key={q.id}><b>{q.position}. {q.prompt}</b><p className="muted">{q.choices?.length ?? 0} choices</p></div>)}</section>
    <section className="card"><h2>Student results ({attempts.length})</h2>{attempts.length === 0 ? <p className="muted">No submissions yet.</p> : attempts.map((a:any) => <div className="result-row" key={a.id}><div><b>{a.student?.full_name || 'Student'}</b><p className="muted">{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : 'In progress'}</p></div><div><b>{a.score_percent}%</b><p className="muted">{a.correct_count}/{a.total_questions} correct</p></div><Link href={`/attempts/${a.id}`}>Review</Link></div>)}</section>
  </main>
}
