import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signup, signInWithGoogle } from '@/app/login/actions'

export default async function StudentSignup({searchParams}:{searchParams:Promise<{error?:string;q?:string;teacher?:string;next?:string}>}){
  const query=await searchParams
  const q=String(query.q||'').trim()
  const next=query.next?.startsWith('/')&&!query.next.startsWith('//')?query.next:'/dashboard'
  const passwordSignupDisabled=String(process.env.CRAMLOOP_STUDENT_PASSWORD_SIGNUP_DISABLED||'').toLowerCase()==='true'
  const managedDomains=String(process.env.CRAMLOOP_GOOGLE_STUDENT_DOMAINS||'').split(',').map(v=>v.trim()).filter(Boolean)
  const supabase=await createClient()
  const{data:teachers}=await supabase.rpc('search_approved_teachers',{p_query:q})
  const selected=(teachers??[]).find((t:any)=>String(t.teacher_id)===String(query.teacher||''))

  return <main className="narrow"><Link href="/login">← Sign in</Link><h1>Create student account</h1><p className="muted">Use your school-managed Google Workspace account when your school requires managed sign-in. No separate CramLoop password is needed.</p>{query.error&&<p className="bad notice">{query.error}</p>}
    <form action={signInWithGoogle} className="card stack"><input type="hidden" name="next" value={next}/><button type="submit">Continue with Google</button>{managedDomains.length>0&&<p className="muted" style={{margin:0}}>Approved school domains: {managedDomains.join(', ')}</p>}</form>
    {!passwordSignupDisabled&&<form action={signup} className="card stack">
      <input type="hidden" name="role" value="student"/><input type="hidden" name="next" value={next}/><input type="hidden" name="requested_teacher_id" value={selected?.teacher_id||''}/>
      <h2>Standard account</h2><label>Email</label><input name="email" type="email" required autoComplete="email"/><label>Password</label><input name="password" type="password" required minLength={6} autoComplete="new-password"/>
      <h2>Your name</h2><label>Name</label><input name="full_name" required autoComplete="name" placeholder="Your name"/>
      <h2>Connect with your teacher <span className="muted">(optional)</span></h2>
      {selected?<section className="notice"><span className="eyebrow">SELECTED TEACHER</span><h3 style={{margin:'6px 0 2px'}}>{selected.display_name||selected.full_name}</h3><p className="muted" style={{margin:0}}>{[selected.organization,selected.title].filter(Boolean).join(' ')}</p><Link href={`/signup/student?q=${encodeURIComponent(q)}&next=${encodeURIComponent(next)}`}>Choose a different teacher</Link></section>:<><p className="muted">Search by teacher name, school, or teaching title. You can also skip this and connect later.</p>{q&&<div className="stack">{(teachers??[]).length?(teachers??[]).map((t:any)=><Link className="card card-link" key={t.teacher_id} href={`/signup/student?q=${encodeURIComponent(q)}&teacher=${t.teacher_id}&next=${encodeURIComponent(next)}`}><b>{t.display_name||t.full_name}</b><span className="muted">{[t.organization,t.title].filter(Boolean).join(' ')||'Approved teacher'}</span></Link>):<p className="muted">No approved teachers matched that search.</p>}</div>}</>}
      <button>Create student account</button>
    </form>}
    {passwordSignupDisabled&&<section className="notice"><b>School-managed sign-in is enabled</b><p className="muted">Student password signup is disabled for this deployment. Students must use an approved Google Workspace account.</p></section>}
    {!selected&&!passwordSignupDisabled&&<form className="card" method="get"><input type="hidden" name="next" value={next}/><label>Find teacher</label><input name="q" defaultValue={q} placeholder="Mrs. Perez, Monterey, Cosmetology"/><button className="secondary">Search teachers</button></form>}
  </main>
}
