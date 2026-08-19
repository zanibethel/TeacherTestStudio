import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PracticeLibrary({searchParams}:{searchParams:Promise<{resource?:string}>}){
  const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
  const{data:resources}=await supabase.from('shared_collections').select('id,title,description,subject,collection_type,student_available').eq('active',true).eq('student_available',true).order('title')
  const selected=(resources??[]).find((r:any)=>r.id===query.resource)
  return <main><Link href="/dashboard">← Dashboard</Link><h1>Practice library</h1><p className="muted">Focused practice resources that can be included with teacher shares and student practice passes. The protected answer bank is never exposed here.</p>{selected&&<section className="card"><span className="pill">Recommended for you</span><h2>{selected.title}</h2><p>{selected.description}</p><p className="muted">{selected.subject} · {String(selected.collection_type).replaceAll('_',' ')}</p><p><b>Next step:</b> this resource is ready for the practice-pass system. When resource-to-attempt delivery is enabled, students will be able to launch a randomized focused quiz directly from this card.</p></section>}<h2>Available practice topics</h2>{!(resources??[]).length?<section className="card"><p className="muted">No student practice resources are available yet.</p></section>:(resources??[]).map((r:any)=><section className="card" key={r.id}><div className="row between"><div><b>{r.title}</b><p className="muted">{r.subject} · {String(r.collection_type).replaceAll('_',' ')}</p></div>{profile?.role==='teacher'&&<Link href="/shared-library">Teacher library →</Link>}</div><p>{r.description}</p></section>)}</main>
}
