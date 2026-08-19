import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function monthYear(value:string|null|undefined){if(!value)return null;const d=new Date(`${value}T00:00:00`);return d.toLocaleDateString(undefined,{month:'long',year:'numeric'})}

export default async function PracticeLibrary({searchParams}:{searchParams:Promise<{q?:string;category?:string}>}){
  const query=await searchParams
  const q=String(query.q??'').trim().toLowerCase()
  const category=String(query.category??'').trim()
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
  const{data:bundles}=await supabase.rpc('get_practice_bundle_catalog')
  const bundleRows:any[]=bundles??[]
  const bundleIds=bundleRows.map((b:any)=>b.bundle_id)
  const{data:previewLinks}=bundleIds.length
    ?await supabase.from('practice_bundle_collections').select('bundle_id,collection_id,position').in('bundle_id',bundleIds).eq('is_free_preview',true).order('position')
    :{data:[] as any[]}
  const previewIds=(previewLinks??[]).map((p:any)=>p.collection_id)
  const{data:previewResources}=previewIds.length
    ?await supabase.from('shared_collections').select('id,title,description,subject,collection_type').in('id',previewIds).eq('active',true)
    :{data:[] as any[]}
  const previewById=new Map<string,any>((previewResources??[]).map((r:any)=>[String(r.id),r]))
  const previewsByBundle=new Map<string,any[]>()
  for(const link of previewLinks??[]){
    const resource=previewById.get(String(link.collection_id))
    if(!resource)continue
    const current=previewsByBundle.get(String(link.bundle_id))??[]
    current.push({...resource,position:link.position})
    previewsByBundle.set(String(link.bundle_id),current)
  }
  const categories:string[]=Array.from(new Set<string>(bundleRows.map((b:any)=>String(b.category||'Other')).filter(Boolean))).sort()
  const filtered=bundleRows.filter((b:any)=>{
    const bundleCategory=String(b.category||'Other')
    const matchesCategory=!category||bundleCategory===category
    const haystack=`${b.title} ${b.subject} ${bundleCategory} ${b.description??''}`.toLowerCase()
    return matchesCategory&&(!q||haystack.includes(q))
  })

  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <h1>Practice library</h1>
    <p className="muted">CramLoop platform bundles are curated separately from teacher-created material so students can clearly see what has been reviewed for a specific exam or skill goal.</p>

    <section className="catalog-tools" aria-label="Practice bundle filters">
      <form className="catalog-search" method="get">
        <input name="q" defaultValue={query.q??''} placeholder="Search subjects, exams, or bundles" aria-label="Search practice bundles"/>
        {category&&<input type="hidden" name="category" value={category}/>} 
        <button type="submit">Search</button>
      </form>
      <div className="category-chips">
        <Link className={`category-chip ${!category?'active':''}`} href={q?`/practice-library?q=${encodeURIComponent(q)}`:'/practice-library'}>All</Link>
        {categories.map((c:string)=><Link className={`category-chip ${category===c?'active':''}`} key={c} href={`/practice-library?category=${encodeURIComponent(c)}${q?`&q=${encodeURIComponent(q)}`:''}`}>{c}</Link>)}
      </div>
    </section>

    <div className="row between catalog-heading"><div><h2>Practice bundles</h2><p className="muted">{filtered.length} bundle{filtered.length===1?'':'s'} available</p></div>{(q||category)&&<Link href="/practice-library">Clear filters</Link>}</div>
    {!filtered.length?<section className="card"><h3>No matching bundles</h3><p className="muted">Try a broader search or clear the category filter.</p></section>:<div className="bundle-carousel">
      {filtered.map((b:any)=>{
        const active=['paid','comped'].includes(b.entitlement_status??'')&&(!b.entitlement_expires_at||new Date(b.entitlement_expires_at).getTime()>Date.now())
        const previews=previewsByBundle.get(String(b.bundle_id))??[]
        const currentLabel=monthYear(b.current_as_of)
        return <section className="card bundle-card" key={b.bundle_id}>
          <div className="row between"><div><h3>{b.title}</h3><p className="muted">{b.category||'Other'} · {b.subject} · {b.resource_count} included resource{b.resource_count===1?'':'s'}</p></div><span className="pill">{active?'Access active':b.verified?'CramLoop Verified':'Cram & prep'}</span></div>
          {b.verified&&<div className="question-summary"><b>✓ CramLoop Verified</b><p className="muted">Content version {b.content_version||'1.0'}{currentLabel?` · Current as of ${currentLabel}`:''}</p>{b.alignment_note&&<p className="muted">{b.alignment_note}</p>}</div>}
          <p>{b.description}</p>
          <p><b>24-hour, 3-day, 7-day, or 14-day access</b></p>
          {active&&b.entitlement_expires_at&&<p className="good">Active through {new Date(b.entitlement_expires_at).toLocaleString()}</p>}
          {previews.length>0&&<div className="bundle-previews">
            <div className="row between"><b>Try free before you buy</b><span className="pill">{previews.length} free</span></div>
            {previews.map((r:any)=><div className="preview-row" key={r.id}><div><b>{r.title}</b><p className="muted">{r.description}</p></div><span className="preview-free">Free</span></div>)}
          </div>}
          <Link className="button bundle-cta" href={`/practice-library/bundles/${b.bundle_id}`}>{active?'Continue bundle':'View bundle & start free'} →</Link>
        </section>
      })}
    </div>}

    <section className="card privacy-note"><h2>Teacher-created resources stay separate</h2><p className="muted">Teacher classroom tests and shared teacher resources do not automatically enter this primary catalog. CramLoop Verified status is assigned only after deliberate platform review.</p>{profile?.role==='teacher'&&<Link href="/shared-library">Open teacher resource library →</Link>}</section>
  </main>
}
