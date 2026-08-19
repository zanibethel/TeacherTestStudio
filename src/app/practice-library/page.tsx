import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PracticeLibrary({searchParams}:{searchParams:Promise<{resource?:string}>}){
 const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
 const{data:resources}=await supabase.from('shared_collections').select('id,title,description,subject,collection_type,student_available,access_type,price_cents,catalog_scope').eq('active',true).eq('student_available',true).eq('catalog_scope','platform').order('subject').order('title')
 const selected=(resources??[]).find((r:any)=>r.id===query.resource)
 return <main><Link href="/dashboard">← Dashboard</Link><h1>Practice library</h1><p className="muted">Browse platform practice resources for free. A paid or teacher-issued pass unlocks only the specific exam/resource it was purchased or issued for; it does not unlock the entire catalog.</p>
 {selected&&<section className="card"><span className="pill">Recommended for you</span><h2>{selected.title}</h2><p>{selected.description}</p><p className="muted">{selected.subject} · {String(selected.collection_type).replaceAll('_',' ')}</p><p><b>{selected.access_type==='free'?'Free practice resource':selected.access_type==='paid'?`Pass available${selected.price_cents?` · $${(selected.price_cents/100).toFixed(2)}`:''}`:'Available with a qualifying pass'}</b></p></section>}
 <h2>Platform practice catalog</h2>{!(resources??[]).length?<section className="card"><p className="muted">No platform practice resources are available yet.</p></section>:(resources??[]).map((r:any)=><section className="card" key={r.id}><div className="row between"><div><b>{r.title}</b><p className="muted">{r.subject} · {String(r.collection_type).replaceAll('_',' ')}</p></div><span className="pill">{r.access_type==='free'?'Free':r.access_type==='paid'?'Paid pass':'Pass only'}</span></div><p>{r.description}</p>{r.access_type==='paid'&&<p><b>{r.price_cents?`$${(r.price_cents/100).toFixed(2)}`:'Price coming soon'}</b> · Access applies only to this resource/pass.</p>}{profile?.role==='teacher'&&<Link href="/shared-library">Open teacher resource library →</Link>}</section>)}
 <section className="card"><h2>Teacher-created practice is private</h2><p className="muted">Practice exams made by individual teachers do not appear in this platform catalog. Students reach those only through that teacher's assigned or purchased share link.</p></section></main>
}
