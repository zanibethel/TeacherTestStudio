import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { importCollection } from './actions'

export default async function SharedLibrary({searchParams}:{searchParams:Promise<{q?:string;subject?:string;error?:string;message?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const query=await searchParams
  let request=supabase.from('shared_collections').select('id,title,description,subject,collection_type,student_available,shared_collection_questions(count)').eq('active',true).order('title')
  if(query.q?.trim())request=request.ilike('title',`%${query.q.trim()}%`)
  if(query.subject?.trim())request=request.eq('subject',query.subject.trim())
  const{data:collections,error}=await request
  const{data:subjects}=await supabase.from('shared_collections').select('subject').eq('active',true)
  const subjectList=[...new Set((subjects??[]).map((x:any)=>x.subject).filter(Boolean))].sort()
  return <main>
    <div className="row between"><div><Link href="/dashboard">← Dashboard</Link><h1>Shared resource library</h1><p className="muted">Browse curated question collections and practice packs. Importing creates your own editable copy; the shared original never changes.</p></div><Link className="secondary button" href="/question-bank">My question bank</Link></div>
    {query.error&&<p className="bad">{query.error}</p>}{query.message&&<p className="good">{query.message}</p>}{error&&<p className="bad">{error.message}</p>}
    <form className="card" method="get"><div className="settings-grid"><div><label>Search resources</label><input name="q" defaultValue={query.q??''} placeholder="haircoloring, sanitation..."/></div><div><label>Subject</label><select name="subject" defaultValue={query.subject??''}><option value="">All subjects</option>{subjectList.map(subject=><option key={subject} value={subject}>{subject}</option>)}</select></div></div><button>Filter library</button></form>
    <p className="muted">{collections?.length??0} resource{collections?.length===1?'':'s'} available</p>
    {!collections?.length?<section className="card"><p className="muted">No shared resources match this filter yet.</p></section>:(collections??[]).map((c:any)=>{const count=c.shared_collection_questions?.[0]?.count??0;return <section className="card" key={c.id}><div className="row between"><div><h2>{c.title}</h2><p className="muted">{c.subject} · {String(c.collection_type).replaceAll('_',' ')} · {count} questions</p></div>{c.student_available&&<span className="pill">Practice-ready</span>}</div><p>{c.description||'Shared teacher resource.'}</p><p className="muted">Importing copies these questions into your personal bank. You can then edit wording, choices, answers, topics, and explanations without affecting this shared version.</p><form action={importCollection.bind(null,c.id)}><button>Add to my bank</button></form></section>})}
  </main>
}
