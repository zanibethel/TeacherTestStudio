import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { selectPracticeBundle, startBundlePractice } from '../../actions'

export default async function PracticeBundleDetail({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string;selected?:string}>}){
  const{id}=await params;const query=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='student')redirect('/dashboard')
  const{data:bundle,error}=await supabase.rpc('get_practice_bundle_detail',{p_bundle_id:id});if(error||!bundle?.id)notFound()
  const activePass=['paid','comped'].includes(bundle.entitlement_status??'')&&(!bundle.entitlement_expires_at||new Date(bundle.entitlement_expires_at).getTime()>Date.now())
  const resources=Array.isArray(bundle.resources)?bundle.resources:[]
  return <main>
    <Link href="/practice-library">← Practice library</Link>
    <div className="row between"><div><h1>{bundle.title}</h1><p className="muted">{bundle.subject}</p></div><span className="pill">{activePass?'Pass active':bundle.price_cents!=null?'Pass available':'Preview available'}</span></div>
    {query.error&&<p className="bad">{query.error}</p>}{query.selected&&<p className="good">Bundle selected. Checkout will activate your timed pass once payments are connected.</p>}
    <section className="card"><p>{bundle.description}</p><p><b>{bundle.pass_duration_days}-day access</b> · {resources.length} included resource{resources.length===1?'':'s'}</p>{activePass&&bundle.entitlement_expires_at&&<p className="good"><b>Active through {new Date(bundle.entitlement_expires_at).toLocaleString()}</b></p>}
      {!activePass&&<>{bundle.price_cents!=null?<><p><b>${(bundle.price_cents/100).toFixed(2)}</b> for this bundle only.</p><form action={selectPracticeBundle.bind(null,id)}><button>Buy {bundle.pass_duration_days}-day pass</button></form><p className="muted">Checkout is the next commerce step; selecting the bundle now creates a pending entitlement without unlocking paid resources.</p></>:<><p><b>Launch price coming soon.</b></p><form action={selectPracticeBundle.bind(null,id)}><button className="secondary">Choose this bundle</button></form><p className="muted">You can choose the bundle now and use its free previews. Full access will unlock when pricing and checkout are enabled.</p></>}</>}
    </section>
    <h2>Included practice</h2>
    {resources.map((r:any)=>{const unlocked=activePass||r.is_free_preview;return <section className="card" key={r.id}><div className="row between"><div><b>{r.title}</b><p className="muted">{String(r.collection_type).replaceAll('_',' ')}{r.is_free_preview?' · Free preview':''}</p></div><span className="pill">{unlocked?'Available':'Pass required'}</span></div><p>{r.description}</p>{unlocked?<form action={startBundlePractice.bind(null,id,r.id)} className="row"><label>Questions <select name="question_count" defaultValue="10"><option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30">30</option></select></label><button>Start randomized practice</button></form>:<p className="muted">This resource unlocks with the active bundle pass.</p>}</section>})}
  </main>
}
