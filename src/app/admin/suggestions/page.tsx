import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateSuggestion } from './actions'

export default async function SuggestionAdmin({searchParams}:{searchParams:Promise<{message?:string;error?:string}>}){
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:isAdmin}=await supabase.rpc('is_platform_admin')
  if(!isAdmin)redirect('/dashboard')
  const{data:raw}=await supabase.rpc('admin_get_content_suggestions')
  const suggestions=Array.isArray(raw)?raw:[]
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between"><div><h1>Content suggestions</h1><p className="muted">Teacher and student requests for new bundles or another review of existing trusted content.</p></div><span className="pill">{suggestions.filter((s:any)=>s.status==='new').length} new</span></div>
    {query.message&&<p className="good">{query.message}</p>}{query.error&&<p className="bad">{query.error}</p>}
    {!suggestions.length?<section className="card"><p className="muted">No suggestions yet.</p></section>:<div className="stack">{suggestions.map((s:any)=><section className="card" key={s.id}>
      <div className="row between"><div><h2 style={{marginBottom:4}}>{s.suggestion_type==='new_bundle'?(s.requested_title||'New bundle request'):`Review: ${s.bundle_title||'Existing bundle'}`}</h2><p className="muted">{s.submitter_role} · {s.submitted_name||'CramLoop user'} · {new Date(s.created_at).toLocaleString()}</p></div><span className="pill">{String(s.status).replaceAll('_',' ')}</span></div>
      {(s.category||s.jurisdiction)&&<p className="muted">{[s.category,s.jurisdiction].filter(Boolean).join(' · ')}</p>}
      <p>{s.reason}</p>
      {s.reference_url&&<p><a href={s.reference_url} target="_blank" rel="noreferrer">Open submitted reference ↗</a></p>}
      {s.bundle_id&&<p><Link href={`/practice-library/bundles/${s.bundle_id}`}>Open bundle →</Link></p>}
      <form action={updateSuggestion.bind(null,s.id)} className="stack"><div className="grid two"><label>Status<select name="status" defaultValue={s.status}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="planned">Planned</option><option value="completed">Completed</option><option value="declined">Declined</option></select></label><label>Admin note<input name="admin_note" defaultValue={s.admin_note??''} placeholder="Internal decision or follow-up"/></label></div><div><button type="submit">Update suggestion</button></div></form>
    </section>)}</div>}
  </main>
}
