import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deletePricingRule,savePricingRule,setPricingRuleActive } from './actions'

function moneyValue(rule:any){return rule.adjustment_type==='percent_off'?rule.adjustment_value:(Number(rule.adjustment_value||0)/100).toFixed(2)}
function ruleSummary(rule:any){
  const audience=rule.audience_type==='group'?`Group: ${rule.group_name||'Selected group'}`:'Everyone'
  const product=rule.product_scope==='bundle'?rule.bundle_title:rule.product_scope==='category'?rule.category:'All platform bundles'
  const adjustment=rule.adjustment_type==='percent_off'?`${rule.adjustment_value}% off`:rule.adjustment_type==='amount_off'?`$${(rule.adjustment_value/100).toFixed(2)} off`:`$${(rule.adjustment_value/100).toFixed(2)} fixed price`
  return `${audience} · ${product} · ${adjustment}`
}

export default async function PricingAdmin({searchParams}:{searchParams:Promise<{message?:string;error?:string}>}){
  const query=await searchParams
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:isAdmin}=await supabase.rpc('is_platform_admin');if(!isAdmin)redirect('/dashboard')
  const[{data:rawRules,error},{data:context}]=await Promise.all([supabase.rpc('admin_get_pricing_rules'),supabase.rpc('admin_get_pricing_context')])
  const rules=Array.isArray(rawRules)?rawRules:[]
  const bundles=Array.isArray(context?.bundles)?context.bundles:[]
  const groups=Array.isArray(context?.groups)?context.groups:[]
  const categories=Array.isArray(context?.categories)?context.categories:[]
  const allOptions=bundles.flatMap((b:any)=>(b.options??[]).map((o:any)=>({...o,bundleTitle:b.title})))
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between"><div><h1>Special pricing</h1><p className="muted">Create temporary CramLoop pricing for everyone or a selected student group.</p></div><span className="pill">Platform admin</span></div>
    {query.message&&<p className="good">{query.message}</p>}{(query.error||error)&&<p className="bad">{query.error||error?.message}</p>}

    <section className="card">
      <h2>Create promotion</h2>
      <p className="muted">Promotions do not stack. The highest-priority, most specific valid promotion wins.</p>
      <form action={savePricingRule}>
        <div className="grid two">
          <label>Internal name<input name="name" required placeholder="Back to school special"/></label>
          <label>Student-facing label<input name="label" placeholder="Back to School"/></label>
          <label>Who gets it?<select name="audience_type" defaultValue="everyone"><option value="everyone">Everyone</option><option value="group">Specific teacher group</option></select></label>
          <label>Group<select name="group_id" defaultValue=""><option value="">None / everyone</option>{groups.map((g:any)=><option key={g.id} value={g.id}>{g.teacher_name||'Teacher'} — {g.name} ({g.member_count})</option>)}</select></label>
          <label>Applies to<select name="product_scope" defaultValue="platform"><option value="platform">All platform bundles</option><option value="category">One category</option><option value="bundle">One bundle</option></select></label>
          <label>Category<select name="category" defaultValue=""><option value="">Select category</option>{categories.map((c:string)=><option key={c} value={c}>{c}</option>)}</select></label>
          <label>Bundle<select name="bundle_id" defaultValue=""><option value="">Select bundle</option>{bundles.map((b:any)=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
          <label>Specific cram/prep option<select name="access_option_id" defaultValue=""><option value="">All durations</option>{allOptions.map((o:any)=><option key={o.id} value={o.id}>{o.bundleTitle} — {o.label}</option>)}</select></label>
          <label>Price change<select name="adjustment_type" defaultValue="percent_off"><option value="percent_off">Percent off</option><option value="amount_off">Dollar amount off</option><option value="fixed_price">Fixed promotional price</option></select></label>
          <label>Value<input name="adjustment_value" type="number" min="0" step="0.01" required placeholder="20 or 2.99"/></label>
          <label>Starts<input name="starts_at" type="datetime-local"/></label>
          <label>Ends<input name="ends_at" type="datetime-local"/></label>
          <label>Priority<input name="priority" type="number" defaultValue="0"/><span className="muted">Higher wins when two promotions overlap.</span></label>
          <label className="check"><input type="checkbox" name="active" defaultChecked/> Active immediately / when start time arrives</label>
        </div>
        <button type="submit">Save promotion</button>
      </form>
    </section>

    <section className="card"><div className="row between"><h2>Current promotions</h2><Link href="/admin/bundles">Bundle base prices →</Link></div>
      {!rules.length?<p className="muted">No special pricing rules yet. Base bundle prices remain unchanged.</p>:<div className="pricing-rule-list">{rules.map((r:any)=><div className="pricing-rule-row" key={r.id}><div><div className="row"><b>{r.name}</b><span className="pill">{r.active?'Active':'Paused'}</span>{r.label&&<span className="pill">{r.label}</span>}</div><p>{ruleSummary(r)}</p><p className="muted">{r.access_option_label?`Only ${r.access_option_label} · `:''}{r.starts_at?`Starts ${new Date(r.starts_at).toLocaleString()} · `:''}{r.ends_at?`Ends ${new Date(r.ends_at).toLocaleString()} · `:''}Priority {r.priority}</p></div><div className="row"><form action={setPricingRuleActive.bind(null,r.id,!r.active)}><button className="secondary" type="submit">{r.active?'Pause':'Activate'}</button></form><form action={deletePricingRule.bind(null,r.id)}><button className="ghost danger" type="submit">Delete</button></form></div></div>)}</div>}
    </section>

    <section className="card"><h2>Examples this supports</h2><p className="muted">20% off every CramLoop bundle for launch week · $1.99 24-hour cram across Beauty & Cosmetology · 50% off one bundle for Sara's student group · school/group-wide pricing across every platform bundle.</p></section>
  </main>
}
