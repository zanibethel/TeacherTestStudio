import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitTest } from './actions'
import ExamRunner from './ExamRunner'

function shuffled<T>(items: T[]) { return [...items].sort(() => Math.random() - 0.5) }

export default async function TakeTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id',user.id).single()
  if (profile?.role !== 'student') redirect('/dashboard')
  const { data: test } = await supabase.from('tests').select('id,title,description,status,randomize_questions,duration_minutes,one_question_per_page,passing_score_percent,questions(id,prompt,position,choices(id,label,position))').eq('id',id).eq('status','published').single()
  if (!test) notFound()
  const ordered = [...(test.questions ?? [])].sort((a:any,b:any)=>a.position-b.position)
  const questions = test.randomize_questions ? shuffled(ordered) : ordered
  return <ExamRunner
    testId={test.id}
    title={test.title}
    description={test.description}
    questions={questions as any}
    durationMinutes={test.duration_minutes ?? 0}
    oneQuestionPerPage={test.one_question_per_page ?? true}
    passingScore={test.passing_score_percent ?? 70}
    action={submitTest.bind(null,id)}
  />
}
