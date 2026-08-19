import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitContentSuggestion } from './actions'

export default async function SuggestContent({searchParams}:{searchParams:Promise<{type?:string;bundle?:string;submitted?:string;error?:string}>}){
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
  if(!['teacher','student'].includes(profile?.role??''))redirect('/dashboard')
  const{data:bundles}=await supabase.from('practice_bundles').select('id,title,subject,current_as_of,content_version,verified').eq('catalog_scope','platform').eq('publication_status','published').order('title')
  const type=query.type==='review_existing'?'review_existing':'new_bundle'
  const selectedBundle=(bundles??[]).find((b:any)=>b.id===query.bundle)
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <h1>Suggest CramLoop content</h1>
    <p className="muted">Help us grow the trusted library without turning it into an open upload feed. Suggestions go to the platform review queue; they do not publish content automatically.</p>
    {query.submitted&&<p className="good">Thanks — your suggestion is in the review queue.</p>}
    {query.error&&<p className="bad">{query.error}</p>}

    <div className="grid two">
      <section className="card"><h2>Request a new bundle</h2><p className="muted">Use this when the certification, course, exam, or skill goal you need is not in CramLoop yet.</p><Link className="button secondary" href="/suggest-content?type=new_bundle">Open new-bundle form</Link></section>
      <section className="card"><h2>Suggest a content review</h2><p className="muted">Use this when an existing bundle looks stale, a rule or exam outline may have changed, or something needs another accuracy review.</p><Link className="button secondary" href="/suggest-content?type=review_existing">Open review form</Link></section>
    </div>

    <section className="card">
      <div className="row between"><h2>{type==='review_existing'?'Suggest a review':'Request a new bundle'}</h2><span className="pill">{profile?.role==='teacher'?'Teacher suggestion':'Student suggestion'}</span></div>
      <form action={submitContentSuggestion} className="stack">
        <input type="hidden" name="suggestion_type" value={type}/>
        {type==='new_bundle'?<>
          <label>What bundle should we add?<input name="requested_title" required placeholder="Texas Class A Barber, CNA, GED Math, CompTIA A+..."/></label>
          <div className="grid two"><label>Category<input name="category" placeholder="Healthcare, Beauty & Cosmetology, IT..."/></label><label>Jurisdiction / provider<input name="jurisdiction" placeholder="Texas, national, CompTIA, etc."/></label></div>
        </>:<>
          <label>Which bundle needs another review?<select name="bundle_id" required defaultValue={selectedBundle?.id??''}><option value="">Choose a bundle</option>{(bundles??[]).map((b:any)=><option key={b.id} value={b.id}>{b.title}{b.content_version?` · v${b.content_version}`:''}</option>)}</select></label>
          {selectedBundle&&<p className="muted">Selected: {selectedBundle.title}{selectedBundle.current_as_of?` · current as of ${new Date(`${selectedBundle.current_as_of}T00:00:00`).toLocaleDateString()}`:''}</p>}
        </>}
        <label>{type==='review_existing'?'What seems stale or questionable?':'Why would this bundle be useful?'}<textarea name="reason" required rows={5} maxLength={1500} placeholder={type==='review_existing'?'Example: The licensing board published a new candidate bulletin, or this rule looks outdated.':'Tell us the exam, certification, course, or skill goal and who would use it.'}/></label>
        <label>Optional official/reference link<input name="reference_url" type="url" placeholder="https://..."/></label>
        <p className="muted">Suggestions and student reviews can flag priorities, but CramLoop Verified status is assigned only after platform review.</p>
        <button type="submit">Submit suggestion</button>
      </form>
    </section>
  </main>
}
