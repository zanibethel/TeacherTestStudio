import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { selectPracticeBundleOption, startBundlePractice } from '../../actions'

function durationLabel(hours:number){
  if(hours===24)return '24 hours'
  if(hours%24===0)return `${hours/24} days`
  return `${hours} hours`
}

function readinessLabel(score:number|null){
  if(score==null)return 'Not started'
  if(score>=85)return 'Strong readiness'
  if(score>=70)return 'Getting ready'
  return 'Needs focus'
}

export default async function PracticeBundleDetail({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string;selected?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='student')redirect('/dashboard')
  const[{data:bundle,error},{data:readiness}]=await Promise.all([
    supabase.rpc('get_practice_bundle_detail',{p_bundle_id:id}),
    supabase.rpc('get_bundle_readiness',{p_bundle_id:id})
  ]);if(error||!bundle?.id)notFound()
  const activePass=['paid','comped'].includes(bundle.entitlement_status??'')&&(!bundle.entitlement_expires_at||new Date(bundle.entitlement_expires_at).getTime()>Date.now())
  const resources=Array.isArray(bundle.resources)?bundle.resources:[]
  const accessOptions=Array.isArray(bundle.access_options)?bundle.access_options:[]
  const topics=Array.isArray(readiness?.topics)?readiness.topics:[]
  const readinessScore=readiness?.readiness_score==null?null:Number(readiness.readiness_score)
  const recommended=resources.find((r:any)=>r.id===readiness?.recommended_collection_id)
  const recommendedUnlocked=Boolean(recommended&&(activePass||recommended.is_free_preview))
  return <main>
    <Link href="/practice-library">← Practice library</Link>
    <div className="row between"><div><h1>{bundle.title}</h1><p className="muted">{bundle.subject}</p></div><span className="pill">{activePass?'Pass active':'Cram & prep access'}</span></div>
    {query.error&&<p className="bad">{query.error}</p>}{query.selected&&<p className="good">Access option selected. Checkout will activate the timed access window once payments are connected.</p>}

    <section className="card">
      <div className="row between"><div><h2 style={{marginBottom:4}}>Your readiness</h2><p className="muted">Based on your actual CramLoop practice in this bundle. Recent sessions count more heavily.</p></div><span className="pill">{readinessLabel(readinessScore)}</span></div>
      {readinessScore==null?<><p><b>No readiness estimate yet.</b></p><p className="muted">Complete a free preview or practice session and CramLoop will start learning where you are strongest and what needs work.</p></>:<>
        <div className="grid three pass-stats">
          <div><span className="muted">Readiness</span><b>{readinessScore.toFixed(0)}%</b></div>
          <div><span className="muted">Confidence</span><b>{String(readiness.confidence||'low').replaceAll('_',' ')}</b></div>
          <div><span className="muted">Coverage</span><b>{Number(readiness.coverage_percent||0).toFixed(0)}%</b></div>
        </div>
        <p className="muted">{readiness.answered_questions} answered question{Number(readiness.answered_questions)===1?'':'s'} across {readiness.areas_seen} of {readiness.areas_total} topic areas.</p>
        {readiness.weakest_area&&<section className="question-summary"><b>Practice next: {readiness.weakest_area}</b><p className="muted">Current mastery estimate: {Number(readiness.weakest_mastery||0).toFixed(0)}%. CramLoop recommends strengthening this area before another full readiness test.</p>{recommendedUnlocked&&<form action={startBundlePractice.bind(null,id,recommended.id)} className="row"><input type="hidden" name="question_count" value="10"/><button>Practice this area next</button></form>}{recommended&&!recommendedUnlocked&&<p className="muted">{recommended.title} is included with an active cram or prep pass.</p>}</section>}
        {topics.length>0&&<><h3>Topic mastery</h3><div className="stack">{topics.map((t:any)=><div className="row between question-summary" key={t.area}><span><b>{t.area}</b><span className="muted"> · {t.answered} answered</span></span><b>{Number(t.mastery).toFixed(0)}%</b></div>)}</div></>}
      </>}
    </section>

    <section className="card"><p>{bundle.description}</p><p><b>{resources.length} included resource{resources.length===1?'':'s'}</b> · randomized practice · weak-area review · focused mini-tests</p>{activePass&&bundle.entitlement_expires_at&&<p className="good"><b>Active through {new Date(bundle.entitlement_expires_at).toLocaleString()}</b></p>}
      {!activePass&&<><h2>Choose how long you need</h2><p className="muted">Studying at the last minute? Start with a 24-hour cram session. Need more time? Choose a longer prep window. Your clock starts when paid access is activated, not when you browse this page.</p><div className="grid two">{accessOptions.map((option:any)=>{const discounted=option.base_price_cents!=null&&option.price_cents!=null&&Number(option.price_cents)<Number(option.base_price_cents);return <section className="card" key={option.id} style={{margin:0}}><div className="row between"><h3 style={{margin:0}}>{option.label}</h3>{(option.pricing_label||option.badge)&&<span className="pill">{option.pricing_label||option.badge}</span>}</div><p><b>{durationLabel(Number(option.duration_hours))} full access</b></p><p className="muted">Unlimited practice inside this subject bundle during the active window.</p>{option.price_cents!=null?<p className="row">{discounted&&<span className="muted" style={{textDecoration:'line-through'}}>${(option.base_price_cents/100).toFixed(2)}</span>}<b>${(option.price_cents/100).toFixed(2)}</b></p>:<p><b>Launch price coming soon</b></p>}<form action={selectPracticeBundleOption.bind(null,id,option.id)}><button>{option.price_cents!=null?`Choose ${option.label}`:`Try ${option.label}`}</button></form></section>})}</div><p className="muted">Selecting an option currently creates a pending access choice only. Paid resources remain locked until checkout is connected.</p></>}
    </section>
    <h2>Included practice</h2>
    {resources.map((r:any)=>{const unlocked=activePass||r.is_free_preview;return <section className="card" key={r.id}><div className="row between"><div><b>{r.title}</b><p className="muted">{String(r.collection_type).replaceAll('_',' ')}{r.is_free_preview?' · Free preview':''}</p></div><span className="pill">{unlocked?'Available':'Access required'}</span></div><p>{r.description}</p>{unlocked?<form action={startBundlePractice.bind(null,id,r.id)} className="row"><label>Questions <select name="question_count" defaultValue="10"><option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30">30</option></select></label><button>Start randomized practice</button></form>:<p className="muted">This resource unlocks with an active cram or prep window.</p>}</section>})}
  </main>
}
