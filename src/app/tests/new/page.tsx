import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TestBuilder from './TestBuilder'
import { createTest } from './actions'

function normalizeQuestion(value:string){return value.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}

export default async function NewTest({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'teacher') redirect('/dashboard')

  const [{ data: bankRaw }, { data: previousRaw }] = await Promise.all([
    supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,source_type,focused_retake_hint,imported_collection_id').order('updated_at',{ascending:false}).limit(1000),
    supabase.from('tests').select('id,title,updated_at,questions(id,prompt,position,content_area,focused_retake_hint,choices(id,label,position),question_answers(choice_id))').eq('teacher_id',user.id).order('updated_at',{ascending:false}).limit(50),
  ])

  const collectionIds=[...new Set((bankRaw??[]).map((q:any)=>q.imported_collection_id).filter(Boolean))]
  const { data: collections }=collectionIds.length
    ? await supabase.from('shared_collections').select('id,title').in('id',collectionIds)
    : { data: [] as any[] }
  const collectionTitle=new Map((collections??[]).map((c:any)=>[c.id,c.title]))

  const bank=(bankRaw??[]).map((q:any)=>({
    ...q,
    bundle_title:q.imported_collection_id?collectionTitle.get(q.imported_collection_id)||'Imported resource':'My custom questions',
  }))
  const bankByPrompt=new Map(bank.map((q:any)=>[normalizeQuestion(q.prompt),q]))

  const previousTests=(previousRaw??[]).map((test:any)=>({
    id:test.id,
    title:test.title,
    updated_at:test.updated_at,
    questions:[...(test.questions??[])].sort((a:any,b:any)=>a.position-b.position).map((q:any)=>{
      const choices=[...(q.choices??[])].sort((a:any,b:any)=>a.position-b.position)
      const answer=Array.isArray(q.question_answers)?q.question_answers[0]:q.question_answers
      const correctIndex=Math.max(0,choices.findIndex((c:any)=>c.id===answer?.choice_id))
      const bankMatch=bankByPrompt.get(normalizeQuestion(q.prompt)) as any
      return {
        id:q.id,
        prompt:q.prompt,
        choices:choices.map((c:any)=>c.label),
        correct_index:correctIndex,
        content_area:q.content_area,
        focused_retake_hint:q.focused_retake_hint,
        bank_id:bankMatch?.id??null,
      }
    }),
  })).filter((t:any)=>t.questions.length)

  const query = await searchParams
  return <main><Link href="/dashboard">← Dashboard</Link><div className="row between"><div><h1>Create a test</h1><p className="muted">Build from your saved question bank, previous tests, an import, or new questions.</p></div><Link className="secondary button" href="/question-bank">Question bank</Link></div>{query.error && <p className="bad">{query.error}</p>}<TestBuilder action={createTest} bankQuestions={bank as any} previousTests={previousTests as any} /></main>
}
