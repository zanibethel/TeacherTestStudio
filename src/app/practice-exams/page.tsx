import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {startBundleExamPreset} from '../practice-library/actions'

type Preset=Record<string,any>

function chooseMainExam(presets:Preset[]){
  return [...presets].sort((a,b)=>Number(b.question_count||0)-Number(a.question_count||0)||Number(a.position||0)-Number(b.position||0))[0]
}

function isPsiStyle(preset:Preset){
  return /psi/i.test(`${preset.title||''} ${preset.mode_label||''} ${preset.provider_label||''}`)
}

function ExamStats({preset}:{preset:Preset}){
  return <div className="grid three pass-stats">
    <div><span className="muted">Questions</span><b>{preset.question_count}</b></div>
    <div><span className="muted">Time</span><b>{preset.duration_minutes?`${preset.duration_minutes} min`:'Untimed'}</b></div>
    <div><span className="muted">Target</span><b>{preset.passing_score_percent}%</b></div>
  </div>
}

function StartPreset({preset,primary=false}:{preset:Preset;primary?:boolean}){
  const primaryLabel=isPsiStyle(preset)?'Start full PSI-style exam':'Start full practice exam'
  return preset.available?<form action={startBundleExamPreset.bind(null,preset.bundle_id,preset.id)}><button type="submit">{primary?primaryLabel:`Start ${preset.title}`}</button></form>:<Link className="button" href={`/practice-library/bundles/${preset.bundle_id}`}>View bundle access</Link>
}

export default async function PracticeExams({searchParams}:{searchParams:Promise<{error?:string}>}){
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
  if(profile?.role!=='student')redirect('/dashboard')
  const{data,error}=await supabase.rpc('get_practice_exam_preset_catalog')
  const presets:Preset[]=Array.isArray(data)?data:[]
  const bundles=Array.from(presets.reduce((groups:Map<string,Preset[]>,preset:Preset)=>{
    const key=String(preset.bundle_id)
    groups.set(key,[...(groups.get(key)||[]),preset])
    return groups
  },new Map()).entries()).map(([bundleId,bundlePresets])=>{
    const mainExam=chooseMainExam(bundlePresets)
    return {bundleId,mainExam,practiceExams:bundlePresets.filter(p=>p.id!==mainExam.id)}
  })

  return <main>
    <Link href="/practice-library">← Practice library</Link>
    <div className="row between" style={{alignItems:'flex-start'}}><div><span className="eyebrow">PRACTICE BUNDLES</span><h1>Licensing & certification exam prep</h1><p className="muted">Choose one bundle, take its full PSI-style simulation, then use the focused practice exams to strengthen individual areas.</p></div><span className="pill">{bundles.length} bundle{bundles.length===1?'':'s'}</span></div>
    {(query.error||error)&&<p className="bad">{query.error||error?.message}</p>}
    {!bundles.length?<section className="card"><h2>No exam bundles published yet</h2><p className="muted">New CramLoop exam-prep bundles will appear here automatically.</p></section>:bundles.map(({bundleId,mainExam,practiceExams})=><section className="card" key={bundleId} style={{padding:'clamp(20px,4vw,34px)'}}>
      <div className="row between" style={{alignItems:'flex-start',gap:16}}><div><div className="row" style={{gap:8,flexWrap:'wrap'}}>{mainExam.provider_label&&<span className="pill">{mainExam.provider_label}</span>}{mainExam.verified&&<span className="pill">CramLoop Verified</span>}</div><h2 style={{marginBottom:4}}>{mainExam.bundle_title}</h2><p className="muted" style={{marginTop:0}}>{mainExam.jurisdiction||'CramLoop exam preparation'}</p></div><span className="pill">{mainExam.available?'Available':'Access required'}</span></div>

      <section className="question-summary" style={{marginTop:20,padding:'clamp(18px,4vw,28px)',border:'2px solid var(--primary,#4338ca)'}}>
        <span className="eyebrow">{isPsiStyle(mainExam)?'FULL PSI-STYLE EXAM':'FULL PRACTICE EXAM'}</span>
        <h3 style={{fontSize:'clamp(1.45rem,4vw,2rem)',margin:'8px 0'}}>{mainExam.title}</h3>
        <p>{mainExam.description}</p>
        <ExamStats preset={mainExam}/>
        <p className="muted">Randomized from the complete approved bundle question pool. This is original practice content, not an official exam.</p>
        <div className="row" style={{flexWrap:'wrap'}}><StartPreset preset={mainExam} primary/><Link className="secondary button" href={`/practice-library/bundles/${bundleId}`}>View bundle details</Link></div>
      </section>

      {practiceExams.length>0&&<section style={{marginTop:30,paddingTop:24,borderTop:'2px solid var(--border,#e2e8f0)'}}>
        <span className="eyebrow">FOCUSED PRACTICE EXAMS</span>
        <h3 style={{margin:'6px 0'}}>Practice one area at a time</h3>
        <p className="muted">Use these shorter tests before or after the full simulation to target specific skills.</p>
        <div className="stack">{practiceExams.map(p=><section className="question-summary" key={p.id} style={{padding:18}}>
          <div className="row between" style={{alignItems:'flex-start',gap:12}}><div><b>{p.title}</b><p className="muted" style={{margin:'4px 0'}}>{p.description}</p></div><span className="pill">{p.question_count} questions</span></div>
          <div className="row" style={{flexWrap:'wrap',marginTop:12}}><span className="muted">{p.duration_minutes?`${p.duration_minutes} min`:'Untimed'} · {p.passing_score_percent}% target</span><StartPreset preset={p}/></div>
        </section>)}</div>
      </section>}
    </section>)}
  </main>
}
