import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PracticeLibrary(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
  const{data:bundles}=await supabase.rpc('get_practice_bundle_catalog')
  const{data:freeResources}=await supabase.from('shared_collections').select('id,title,description,subject,collection_type,access_type,price_cents,catalog_scope').eq('active',true).eq('student_available',true).eq('catalog_scope','platform').eq('access_type','free').order('subject').order('title')
  return <main>
    <Link href="/dashboard">← Dashboard</Link><h1>Practice library</h1>
    <p className="muted">Browse platform-created exam-prep bundles and free practice resources. A pass unlocks only the bundle you choose; it does not unlock unrelated subjects or private teacher-created tests.</p>

    <h2>Practice pass bundles</h2>
    {!(bundles??[]).length?<section className="card"><p className="muted">No practice bundles are available yet.</p></section>:(bundles??[]).map((b:any)=>{const active=['paid','comped'].includes(b.entitlement_status??'')&&(!b.entitlement_expires_at||new Date(b.entitlement_expires_at).getTime()>Date.now());return <Link className="card card-link" href={`/practice-library/bundles/${b.bundle_id}`} key={b.bundle_id}><div className="row between"><div><h3>{b.title}</h3><p className="muted">{b.subject} · {b.resource_count} included resource{b.resource_count===1?'':'s'}</p></div><span className="pill">{active?'Pass active':b.price_cents!=null?'Pass available':'Preview available'}</span></div><p>{b.description}</p><p><b>{b.pass_duration_days}-day pass</b>{b.price_cents!=null?` · $${(b.price_cents/100).toFixed(2)}`:' · launch price coming soon'}{b.free_preview_enabled?' · free previews included':''}</p>{active&&b.entitlement_expires_at&&<p className="good">Active through {new Date(b.entitlement_expires_at).toLocaleString()}</p>}<strong>View bundle →</strong></Link>})}

    <h2>Free practice</h2>
    {!(freeResources??[]).length?<section className="card"><p className="muted">Free standalone practice resources will appear here as we add them.</p></section>:(freeResources??[]).map((r:any)=><section className="card" key={r.id}><div className="row between"><div><b>{r.title}</b><p className="muted">{r.subject} · {String(r.collection_type).replaceAll('_',' ')}</p></div><span className="pill">Free</span></div><p>{r.description}</p></section>)}

    <section className="card"><h2>Teacher-created practice stays private</h2><p className="muted">Individual teachers can create classroom, study, restricted, and paid practice shares, but those do not appear in the public platform catalog. Students reach those only through the teacher's specific link or assignment.</p>{profile?.role==='teacher'&&<Link href="/shared-library">Open teacher resource library →</Link>}</section>
  </main>
}
