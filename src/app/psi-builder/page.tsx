import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PSI_CONTENT_AREAS, PSI_STARTER_BANK } from '@/lib/psiStarterBank'
import { generatePsiPractice, installStarterBank } from './actions'

export default async function PsiBuilder({searchParams}:{searchParams:Promise<{error?:string,message?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='teacher')redirect('/dashboard')
  const{count}=await supabase.from('question_bank').select('*',{count:'exact',head:true}).eq('teacher_id',user.id)
  const query=await searchParams
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between"><div><h1>PSI Practice Generator</h1><p className="muted">Build a balanced Texas cosmetology practice exam in a few clicks.</p></div><Link className="secondary button" href="/question-bank">Question Bank</Link></div>
    {query.error&&<p className="bad">{query.error}</p>}{query.message&&<p className="good">{query.message}</p>}
    <section className="card">
      <h2>Starter catalog</h2>
      <p><b>{PSI_STARTER_BANK.length} original practice questions</b> across {PSI_CONTENT_AREAS.length} content areas are built in.</p>
      <p className="muted">These are original study questions, not actual PSI exam items and not an official TDLR/PSI product. TDLR directs candidates to the current Candidate Information Bulletin for the live exam's exact specifications.</p>
      <div className="row"><span className="pill">Your bank: {count??0}</span><form action={installStarterBank}><button className="secondary">Add all starter questions to my bank</button></form></div>
    </section>
    <form action={generatePsiPractice} className="card stack">
      <div><h2>Generate a practice exam</h2><p className="muted">Questions are deduplicated and distributed across available content areas before the draft is created.</p></div>
      <label>Exam title</label><input name="title" placeholder="Texas Cosmetology Operator Practice Exam"/>
      <label>Question count</label>
      <div className="mode-grid">
        <label className="mode-card"><input type="radio" name="question_count" value="25"/><b>25 questions</b><span>Quick review · 30-minute practice timer</span></label>
        <label className="mode-card active"><input type="radio" name="question_count" value="50" defaultChecked/><b>50 questions</b><span>Study exam · 60-minute practice timer</span></label>
        <label className="mode-card"><input type="radio" name="question_count" value="100"/><b>100 questions</b><span>Full-length practice · 120-minute practice timer</span></label>
      </div>
      <label className="check"><input type="checkbox" name="include_personal" defaultChecked/> Mix in Sara's own question bank when possible</label>
      <div className="notice"><b>Generator defaults</b><p className="muted">One question per screen · randomized question order · randomized answer choices · 70% practice passing target · 3 attempts. Sara can change assignment, retry, review, and Strict Test Mode settings after generation.</p></div>
      <button type="submit">Generate practice exam</button>
    </form>
    <section className="card"><h2>Content areas in the starter catalog</h2><div className="row" style={{flexWrap:'wrap'}}>{PSI_CONTENT_AREAS.map(x=><span className="pill" key={x}>{x}</span>)}</div></section>
  </main>
}
