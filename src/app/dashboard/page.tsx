import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id',user.id).single()
  const query = await searchParams

  if(profile?.role==='teacher'){
    const {data:tests}=await supabase.from('tests').select('id,title,status,share_code,created_at,randomize_questions,attempts(count)').order('created_at',{ascending:false})
    return <main><div className="row between"><div><h1>Teacher dashboard</h1><p className="muted">Welcome, {profile.full_name||user.email}</p></div><form action="/auth/signout" method="post"><button className="ghost">Sign out</button></form></div><Link className="button" href="/tests/new">+ Create a test</Link><h2>Your test library</h2>{!tests?.length?<div className="card"><p className="muted">No tests yet. Create your first reusable test.</p></div>:tests.map((t:any)=><Link className="card card-link" key={t.id} href={`/tests/${t.id}`}><div className="row between"><h3>{t.title}</h3><span className="pill">{t.status}</span></div><p>Student code: <b className="code">{t.share_code}</b></p><p className="muted">{t.randomize_questions?'Randomized questions · ':''}{t.attempts?.[0]?.count??0} attempt(s)</p></Link>)}</main>
  }

  const {data:attempts}=await supabase.from('attempts').select('id,score_percent,submitted_at,tests(title)').order('submitted_at',{ascending:false})
  return <main><div className="row between"><div><h1>Student dashboard</h1><p className="muted">Welcome, {profile?.full_name||user.email}</p></div><form action="/auth/signout" method="post"><button className="ghost">Sign out</button></form></div>{query.error&&<p className="bad">{query.error}</p>}<form action="/take/go" method="get" className="card"><h2>Take a test</h2><label>Enter teacher&apos;s test code</label><input name="code" required autoCapitalize="characters" placeholder="AB12CD34"/><button>Open test</button></form><h2>Previous attempts</h2>{!attempts?.length?<div className="card"><p className="muted">You have not submitted a test yet.</p></div>:attempts.map((a:any)=><Link className="card card-link result-row" key={a.id} href={`/attempts/${a.id}`}><div><b>{a.tests?.title}</b><p className="muted">{a.submitted_at?new Date(a.submitted_at).toLocaleString():''}</p></div><strong>{a.score_percent}%</strong></Link>)}</main>
}
