import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { selectPracticeBundleOption, startBundlePractice } from '../../actions'

function durationLabel(hours:number){
  if(hours===24)return '24 hours'
  if(hours%24===0)return `${hours/24} days`
  return `${hours} hours`
}

export default async function PracticeBundleDetail({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string;selected?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='student')redirect('/dashboard')
  const{data:bundle,error}=await supabase.rpc('get_practice_bundle_detail',{p_bundle_id:id});if(error||!bundle?.id)notFound()
  const activePass=['paid','comped'].includes(bundle.entitlement_status??'')&&(!bundle.entitlement_expires_at||new Date(bundle.entitlement_expires_at).getTime()>Date.now())
  const resources=Array.isArray(bundle.resources)?bundle.resources:[]
  const accessOptions=Array.isArray(bundle.access_options)?bundle.access_options:[]
  return <main>
    <Link href="/practice-library">← Practice library</Link>
    <div className="row between"><div><h1>{bundle.title}</h1><p className="muted">{bundle.subject}</p></div><span className="pill">{activePass?'Pass active':'Cram & prep access'}</span></div>
    {query.error&&<p className="bad">{query.error}</p>}{query.selected&&<p className="good">Access option selected. Checkout will activate the timed access window once payments are connected.</p>}
    <section className="card"><p>{bundle.description}</p><p><b>{resources.length} included resource{resources.length===1?'':'s'}</b> · randomized practice · weak-area review · focused mini-tests</p>{activePass&&bundle.entitlement_expires_at&&<p className="good"><b>Active through {new Date(bundle.entitlement_expires_at).toLocaleString()}</b></p>}
      {!activePass&&<><h2>Choose how long you need</h2><p className="muted">Studying at the last minute? Start with a 24-hour cram session. Need more time? Choose a longer prep window. Your clock starts when paid access is activated, not when you browse this page.</p><div className="grid two">{accessOptions.map((option:any)=><section className="card" key={option.id} style={{margin:0}}><div className="row between"><h3 style={{margin:0}}>{option.label}</h3>{option.badge&&<span className="pill">{option.badge}</span>}</div><p><b>{durationLabel(Number(option.duration_hours))} full access</b></p><p className="muted">Unlimited practice inside this subject bundle during the active window.</p>{option.price_cents!=null?<p><b>${(option.price_cents/100).toFixed(2)}</b></p>:<p><b>Launch price coming soon</b></p>}<form action={selectPracticeBundleOption.bind(null,id,option.id)}><button>{option.price_cents!=null?`Choose ${option.label}`:`Try ${option.label}`}</button></form></section>)}</div><p className="muted">Selecting an option currently creates a pending access choice only. Paid resources remain locked until checkout is connected.</p></>}
    </section>
    <h2>Included practice</h2>
    {resources.map((r:any)=>{const unlocked=activePass||r.is_free_preview;return <section className="card" key={r.id}><div className="row between"><div><b>{r.title}</b><p className="muted">{String(r.collection_type).replaceAll('_',' ')}{r.is_free_preview?' · Free preview':''}</p></div><span className="pill">{unlocked?'Available':'Access required'}</span></div><p>{r.description}</p>{unlocked?<form action={startBundlePractice.bind(null,id,r.id)} className="row"><label>Questions <select name="question_count" defaultValue="10"><option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30">30</option></select></label><button>Start randomized practice</button></form>:<p className="muted">This resource unlocks with an active cram or prep window.</p>}</section>})}
  </main>
}
