import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function FindTeacher({searchParams}:{searchParams:Promise<{q?:string,teacher?:string}>}){
  const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='student')redirect('/dashboard')
  const q=String(query.q||'').trim();const{data:teachers,error:searchError}=await supabase.rpc('search_approved_teachers',{p_query:q});let selected:any=null
  if(query.teacher){const{data,error}=await supabase.rpc('student_teacher_access',{p_teacher_id:query.teacher});if(!error)selected=data}
  return <main className="narrow"><Link href="/dashboard">← Student dashboard</Link><h1>Find my teacher</h1><p className="muted">Search approved teachers by name. Finding a teacher never exposes their full test library; you only see tests or shares actually assigned to your account or one of your groups.</p>
    <form className="card" method="get"><label>Teacher name</label><input name="q" defaultValue={q} placeholder="Sara Perez" autoComplete="off"/><button>Search teachers</button></form>
    {searchError&&<p className="bad">{searchError.message}</p>}{q&&!(teachers??[]).length&&<section className="card"><p className="muted">No approved teachers matched that name.</p></section>}
    {(teachers??[]).length>0&&<section className="card"><h2>Teachers</h2>{(teachers??[]).map((t:any)=><div className="result-row" key={t.teacher_id}><div><b>{t.full_name}</b><p className="muted">Approved teacher</p></div><Link className="secondary button" href={`/find-teacher?q=${encodeURIComponent(q)}&teacher=${t.teacher_id}`}>Select</Link></div>)}</section>}
    {selected&&<section className="card"><h2>{selected.teacher_name}</h2>{selected.allowed?<><p className="good">Your account is recognized by this teacher.</p>{(selected.tests??[]).length?<><h3>Available to you</h3>{selected.tests.map((t:any)=><Link className="card card-link" key={t.id} href={t.href}><div className="row between"><b>{t.title}</b><span className="pill">{t.access_label}</span></div><p className="muted">{t.due_at?`Due ${new Date(t.due_at).toLocaleString()}`:'No due date'}</p></Link>)}</>:<p className="muted">You are connected to this teacher, but they have not assigned a published test or share to you yet.</p>}</>:<><p className="muted">We found the teacher, but your signed-in account is not registered or assigned by them yet.</p><p>Ask the teacher to add <b>{user.email}</b> to their student roster or assign a test to this account.</p></>}</section>}
    <section className="card"><h2>Looking for independent practice?</h2><p className="muted">You do not need a teacher code to browse platform-created practice bundles and free previews.</p><Link className="button" href="/practice-library">Browse practice passes</Link></section>
  </main>
}
