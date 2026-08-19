import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function statusLabel(status:string){
  if(status==='needs_attention')return 'Needs attention'
  if(status==='review_requested')return 'Review requested'
  if(status==='review_due')return 'Review due'
  if(status==='watch')return 'Watch'
  if(status==='unverified_published')return 'Published unverified'
  return 'Current'
}

function statusDetail(row:any){
  if(row.verified&&row.current_as_of==null)return 'Verified bundle is missing a current-as-of date.'
  if(Number(row.open_review_requests)>=2)return `${row.open_review_requests} open stale-content reports.`
  if(Number(row.open_review_requests)===1)return 'A teacher or student requested a content review.'
  if(row.health_status==='review_due')return `Current-as-of date is ${row.days_since_current_as_of} days old.`
  if(row.health_status==='watch'&&Number(row.review_count)>=3&&Number(row.average_rating)<3.5)return `Student rating is ${Number(row.average_rating).toFixed(1)} from ${row.review_count} completed-practice reviews.`
  if(row.health_status==='watch')return `Current-as-of date is ${row.days_since_current_as_of} days old.`
  if(row.health_status==='unverified_published')return 'Published in the primary catalog without CramLoop Verified status.'
  return row.current_as_of?`Current as of ${new Date(`${row.current_as_of}T00:00:00`).toLocaleDateString()}.`:'No maintenance signal currently requires action.'
}

export default async function ContentHealthPage(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:isAdmin}=await supabase.rpc('is_platform_admin')
  if(!isAdmin)redirect('/dashboard')
  const{data,error}=await supabase.rpc('admin_get_content_health')
  const summary=data?.summary??{}
  const bundles:any[]=Array.isArray(data?.bundles)?data.bundles:[]

  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between"><div><h1>Content Health</h1><p className="muted">Manual owner review queue for the CramLoop Verified library. Nothing here changes content automatically.</p></div><Link className="button" href="/admin/suggestions">Open suggestions</Link></div>
    {error&&<p className="bad">{error.message}</p>}

    <section className="grid four pass-stats">
      <div className="card"><span className="muted">Platform bundles</span><b>{Number(summary.total_bundles||0)}</b></div>
      <div className="card"><span className="muted">CramLoop Verified</span><b>{Number(summary.verified||0)}</b></div>
      <div className="card"><span className="muted">Needs review</span><b>{Number(summary.needs_attention||0)}</b></div>
      <div className="card"><span className="muted">Open stale reports</span><b>{Number(summary.open_review_requests||0)}</b></div>
    </section>

    <section className="card"><h2>How priority works</h2><p className="muted">The queue rises when users request a review, a verified bundle is missing maintenance metadata, its current-as-of date ages, or sustained completed-practice reviews indicate a possible quality issue. These are review signals only—not automatic verification decisions.</p></section>

    <h2>Bundle review queue</h2>
    {!bundles.length?<section className="card"><p>No platform bundles found.</p></section>:<div className="stack">{bundles.map((b:any)=><section className="card" key={b.id}>
      <div className="row between"><div><h3 style={{marginBottom:4}}>{b.title}</h3><p className="muted">{b.category||'Uncategorized'}{b.jurisdiction?` · ${b.jurisdiction}`:''} · {b.publication_status}</p></div><span className="pill">{statusLabel(String(b.health_status))}</span></div>
      <p>{statusDetail(b)}</p>
      <div className="grid three pass-stats">
        <div><span className="muted">Trust</span><b>{b.verified?`Verified v${b.content_version||'—'}`:'Not verified'}</b></div>
        <div><span className="muted">Stale reports</span><b>{Number(b.open_review_requests||0)}</b></div>
        <div><span className="muted">Student experience</span><b>{Number(b.review_count||0)>0?`${Number(b.average_rating).toFixed(1)} / 5`:'No reviews'}</b></div>
      </div>
      <div className="row"><Link className="button" href={`/practice-library/bundles/${b.id}`}>View bundle</Link><Link href="/admin/bundles">Manage bundle</Link>{Number(b.open_review_requests||0)>0&&<Link href="/admin/suggestions">Review reports</Link>}</div>
    </section>)}</div>}
  </main>
}
