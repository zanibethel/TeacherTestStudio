import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createBundle,saveAccessOption,saveBundle,saveBundleResource } from './actions'

export default async function BundleAdmin({searchParams}:{searchParams:Promise<{message?:string;error?:string;bundle?:string}>}){
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:isAdmin}=await supabase.rpc('is_platform_admin')
  if(!isAdmin)redirect('/dashboard')
  const[{data:rawBundles,error},{data:collections}]=await Promise.all([
    supabase.rpc('admin_get_practice_bundles'),
    supabase.rpc('admin_get_available_practice_collections')
  ])
  const bundles=Array.isArray(rawBundles)?rawBundles:[]
  const selected=bundles.find((b:any)=>b.id===query.bundle)??bundles[0]
  const available=collections??[]
  const attached=new Map((selected?.resources??[]).map((r:any)=>[r.id,r]))

  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between"><div><h1>Bundle manager</h1><p className="muted">Build, review, verify, and publish CramLoop platform bundles without touching SQL.</p></div><span className="pill">Platform admin</span></div>
    {query.message&&<p className="good">{query.message}</p>}{(query.error||error)&&<p className="bad">{query.error||error?.message}</p>}

    <section className="card">
      <h2>Create draft bundle</h2>
      <form action={createBundle} className="grid two">
        <label>Title<input name="title" required placeholder="Texas Class A Barber Practice Pass"/></label>
        <label>Slug<input name="slug" required placeholder="texas-class-a-barber"/></label>
        <label>Subject<input name="subject" required placeholder="Texas Class A Barber"/></label>
        <label>Category<input name="category" placeholder="Beauty & Cosmetology"/></label>
        <div><button type="submit">Create draft</button></div>
      </form>
    </section>

    <div className="admin-bundle-layout">
      <aside className="card admin-bundle-list"><h2>Bundles</h2>{bundles.map((b:any)=><Link key={b.id} className={`admin-bundle-link ${selected?.id===b.id?'active':''}`} href={`/admin/bundles?bundle=${b.id}`}><b>{b.title}</b><span>{b.verified?'✓ Verified · ':''}{b.publication_status} · {b.category||'Uncategorized'}</span></Link>)}</aside>
      <div>
        {!selected?<section className="card"><p className="muted">Create your first platform bundle above.</p></section>:<>
          <section className="card">
            <div className="row between"><h2>Bundle details</h2><span className="pill">{selected.verified?'CramLoop Verified':selected.publication_status}</span></div>
            <form action={saveBundle.bind(null,selected.id)}>
              <label>Title<input name="title" defaultValue={selected.title} required/></label>
              <label>Description<textarea name="description" defaultValue={selected.description??''} rows={4}/></label>
              <div className="grid two">
                <label>Subject<input name="subject" defaultValue={selected.subject} required/></label>
                <label>Category<input name="category" defaultValue={selected.category??''}/></label>
                <label>Subcategory<input name="subcategory" defaultValue={selected.subcategory??''}/></label>
                <label>Jurisdiction<input name="jurisdiction" defaultValue={selected.jurisdiction??''}/></label>
                <label>Language<input name="language" defaultValue={selected.language||'English'}/></label>
                <label>Content version<input name="content_version" defaultValue={selected.content_version||'1.0'} placeholder="1.0"/></label>
                <label>Current as of<input name="current_as_of" type="date" defaultValue={selected.current_as_of??''}/></label>
                <label>Sort priority<input name="sort_priority" type="number" defaultValue={selected.sort_priority??0}/></label>
                <label>Publication<select name="publication_status" defaultValue={selected.publication_status}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="retired">Retired</option></select></label>
              </div>
              <label>Alignment / reference note<textarea name="alignment_note" defaultValue={selected.alignment_note??''} rows={3} placeholder="Aligned to the current Texas licensing content outline and candidate bulletin reviewed on the date above."/></label>
              <label className="check"><input type="checkbox" name="verified" defaultChecked={Boolean(selected.verified)}/><b>CramLoop Verified</b> — only check this after the content has been deliberately reviewed for its stated exam or skill goal</label>
              <label className="check"><input type="checkbox" name="featured" defaultChecked={Boolean(selected.featured)}/> Featured bundle</label>
              <p className="muted">Verified bundles require a Current as of date. Saving a verified published bundle records a fresh review timestamp.</p>
              <div className="row" style={{marginTop:16}}><button type="submit">Save bundle</button>{selected.publication_status==='published'&&<Link href={`/practice-library/bundles/${selected.id}`}>Student view →</Link>}</div>
            </form>
          </section>

          <section className="card"><h2>Access options</h2><p className="muted">Prices are stored in cents. Leave price blank until we are ready to sell.</p>
            {(selected.options??[]).map((o:any)=><form className="admin-option-row" key={o.id} action={saveAccessOption.bind(null,selected.id,o.id)}>
              <input name="label" defaultValue={o.label} aria-label="Option label"/>
              <input name="duration_hours" type="number" min="1" defaultValue={o.duration_hours} aria-label="Duration hours"/>
              <input name="price_cents" type="number" min="0" defaultValue={o.price_cents??''} placeholder="Price cents" aria-label="Price cents"/>
              <input name="badge" defaultValue={o.badge??''} placeholder="Badge" aria-label="Badge"/>
              <input name="position" type="number" defaultValue={o.position??0} aria-label="Position"/>
              <label className="check"><input type="checkbox" name="active" defaultChecked={Boolean(o.active)}/>Active</label><button type="submit">Save</button>
            </form>)}
            <h3>Add option</h3><form className="admin-option-row" action={saveAccessOption.bind(null,selected.id,'')}>
              <input name="label" placeholder="24-Hour Cram" required/><input name="duration_hours" type="number" min="1" defaultValue="24"/><input name="price_cents" type="number" min="0" placeholder="Price cents"/><input name="badge" placeholder="Badge"/><input name="position" type="number" defaultValue="0"/><label className="check"><input type="checkbox" name="active" defaultChecked/>Active</label><button type="submit">Add</button>
            </form>
          </section>

          <section className="card"><h2>Included resources</h2><p className="muted">Attach approved platform question collections and choose which ones students can preview for free. Teacher-created resources do not enter this bundle automatically.</p>
            <div className="admin-resource-list">{available.map((c:any)=>{const current=attached.get(c.id) as any;return <form className="admin-resource-row" key={c.id} action={saveBundleResource.bind(null,selected.id,c.id)}><div><b>{c.title}</b><p className="muted">{c.subject} · {String(c.collection_type).replaceAll('_',' ')}</p></div><label className="check"><input type="checkbox" name="attached" defaultChecked={Boolean(current)}/>Included</label><label className="check"><input type="checkbox" name="is_free_preview" defaultChecked={Boolean(current?.is_free_preview)}/>Free preview</label><label>Order<input name="position" type="number" defaultValue={current?.position??0}/></label><button type="submit">Save</button></form>})}</div>
          </section>
        </>}
      </div>
    </div>
  </main>
}
