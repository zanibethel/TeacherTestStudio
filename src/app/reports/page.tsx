import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'

export default async function ReportsIndex(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:tests}=await supabase.from('tests').select('id,title,status,updated_at,attempts(count)').eq('teacher_id',user.id).order('updated_at',{ascending:false})
  return <main>
    <div className="row between"><div><Link href="/dashboard">← My tests</Link><h1>Reports</h1><p className="muted">Open a test to review student scores, highest grades, and individual attempt details.</p></div></div>
    {!tests?.length?<section className="card"><p className="muted">No tests available yet.</p></section>:tests.map((t:any)=><Link className="card card-link result-row" href={`/tests/${t.id}/reports`} key={t.id}><div><b>{t.title}</b><p className="muted">Edited {new Date(t.updated_at).toLocaleDateString()} · {t.attempts?.[0]?.count??0} attempt(s)</p></div><div className="row"><span className="pill">{t.status}</span><strong>Open report →</strong></div></Link>)}
  </main>
}
