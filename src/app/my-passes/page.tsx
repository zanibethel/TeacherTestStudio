import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function remaining(expiresAt:string|null){
  if(!expiresAt)return 'No expiration'
  const ms=new Date(expiresAt).getTime()-Date.now()
  if(ms<=0)return 'Expired'
  const hours=Math.ceil(ms/3600000)
  if(hours<48)return `${hours} hour${hours===1?'':'s'} remaining`
  const days=Math.ceil(hours/24)
  return `${days} day${days===1?'':'s'} remaining`
}

export default async function MyPasses(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
  if(profile?.role!=='student')redirect('/dashboard')
  const{data:passes,error}=await supabase.rpc('get_student_practice_passes')
  const rows=passes??[]
  const active=rows.filter((p:any)=>p.access_state==='active')
  const pending=rows.filter((p:any)=>p.access_state==='pending')
  const past=rows.filter((p:any)=>['expired','revoked'].includes(p.access_state))

  const PassCard=({p}:{p:any})=><section className="card">
    <div className="row between"><div><h3>{p.title}</h3><p className="muted">{p.category||p.subject}{p.option_label?` · ${p.option_label}`:''}</p></div><span className="pill">{String(p.access_state).replaceAll('_',' ')}</span></div>
    {p.access_state==='active'&&<p className="good"><b>{remaining(p.expires_at)}</b>{p.expires_at?` · ends ${new Date(p.expires_at).toLocaleString()}`:''}</p>}
    {p.access_state==='pending'&&<p className="muted">You selected {p.option_label||'an access option'}. Checkout will activate the timer once payments are connected.</p>}
    <div className="grid three pass-stats">
      <div><span className="muted">Latest</span><b>{p.latest_score!=null?`${Number(p.latest_score).toFixed(0)}%`:'—'}</b></div>
      <div><span className="muted">Best</span><b>{p.best_score!=null?`${Number(p.best_score).toFixed(0)}%`:'—'}</b></div>
      <div><span className="muted">Completed</span><b>{p.completed_sessions??0}</b></div>
    </div>
    <div className="row"><Link className="button" href={`/practice-library/bundles/${p.bundle_id}`}>{p.access_state==='active'?'Continue practice':p.access_state==='pending'?'View selection':'View bundle'}</Link></div>
  </section>

  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <h1>My passes</h1>
    <p className="muted">Your cram sessions and practice passes in one place. Active access shows the exact time remaining.</p>
    {error&&<p className="bad">{error.message}</p>}
    {!rows.length&&<section className="card"><h2>No passes yet</h2><p className="muted">Try a free practice preview or choose a timed cram session when you need full access.</p><Link className="button" href="/practice-library">Browse practice bundles</Link></section>}
    {active.length>0&&<><h2>Active now</h2>{active.map((p:any)=><PassCard key={p.entitlement_id} p={p}/>)}</>}
    {pending.length>0&&<><h2>Selected</h2>{pending.map((p:any)=><PassCard key={p.entitlement_id} p={p}/>)}</>}
    {past.length>0&&<><h2>Past passes</h2>{past.map((p:any)=><PassCard key={p.entitlement_id} p={p}/>)}</>}
  </main>
}
