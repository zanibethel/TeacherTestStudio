import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {startBundleExamPreset} from '../practice-library/actions'

export default async function PracticeExams({searchParams}:{searchParams:Promise<{error?:string}>}){
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
  if(profile?.role!=='student')redirect('/dashboard')
  const{data,error}=await supabase.rpc('get_practice_exam_preset_catalog')
  const presets=Array.isArray(data)?data:[]
  return <main>
    <Link href="/practice-library">← Practice library</Link>
    <div className="row between" style={{alignItems:'flex-start'}}><div><span className="eyebrow">BUNDLE EXAM PRESETS</span><h1>Licensing & certification exam simulations</h1><p className="muted">Exam presets belong to CramLoop practice bundles. They use that bundle&apos;s question bank, timing, scoring target, and exam-domain blueprint—not a teacher-owned test.</p></div><span className="pill">{presets.length} available preset{presets.length===1?'':'s'}</span></div>
    {(query.error||error)&&<p className="bad">{query.error||error?.message}</p>}
    {!presets.length?<section className="card"><h2>No exam presets published yet</h2><p className="muted">As new CramLoop bundles are released, their licensing or certification exam simulations will appear here automatically.</p></section>:presets.map((p:any)=><section className="card" key={p.id}>
      <div className="row between" style={{alignItems:'flex-start'}}><div><div className="row" style={{gap:8,flexWrap:'wrap'}}>{p.provider_label&&<span className="pill">{p.provider_label}</span>}{p.verified&&<span className="pill">CramLoop Verified bundle</span>}</div><h2 style={{marginBottom:4}}>{p.title}</h2><p className="muted" style={{marginTop:0}}>Included with <Link href={`/practice-library/bundles/${p.bundle_id}`}>{p.bundle_title}</Link>{p.jurisdiction?` · ${p.jurisdiction}`:''}</p></div><span className="pill">{p.available?'Available':'Bundle access required'}</span></div>
      <p>{p.description}</p>
      <div className="grid three pass-stats"><div><span className="muted">Questions</span><b>{p.question_count}</b></div><div><span className="muted">Time</span><b>{p.duration_minutes?`${p.duration_minutes} min`:'Untimed'}</b></div><div><span className="muted">Target</span><b>{p.passing_score_percent}%</b></div></div>
      <p className="muted">{p.mode_label||'Exam simulation'} · randomized from the bundle&apos;s approved question pool. This is practice content, not an official exam.</p>
      <div className="row" style={{flexWrap:'wrap'}}>{p.available?<form action={startBundleExamPreset.bind(null,p.bundle_id,p.id)}><button type="submit">Start {p.title}</button></form>:<Link className="button" href={`/practice-library/bundles/${p.bundle_id}`}>View bundle access</Link>}<Link className="secondary button" href={`/practice-library/bundles/${p.bundle_id}`}>Bundle details</Link></div>
    </section>)}
  </main>
}
