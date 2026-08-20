import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {saveExamPreset} from './actions'

export default async function ExamPresetAdmin({searchParams}:{searchParams:Promise<{bundle?:string;message?:string;error?:string}>}){
  const query=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:isAdmin}=await supabase.rpc('is_platform_admin');if(!isAdmin)redirect('/dashboard')
  const{data,error}=await supabase.rpc('admin_get_practice_bundles')
  const bundles=Array.isArray(data)?data:[]
  const selected=bundles.find((b:any)=>b.id===query.bundle)??bundles[0]
  const presets=Array.isArray(selected?.exam_presets)?selected.exam_presets:[]
  return <main>
    <Link href="/admin/bundles">← Bundle manager</Link>
    <div className="row between"><div><h1>Exam preset manager</h1><p className="muted">Presets belong to CramLoop practice bundles, not teachers. Use them for licensing, certification, or other bundle-specific exam simulations.</p></div><span className="pill">Platform admin</span></div>
    {query.message&&<p className="good">{query.message}</p>}{(query.error||error)&&<p className="bad">{query.error||error?.message}</p>}
    <section className="card"><h2>Choose bundle</h2><div className="row" style={{flexWrap:'wrap'}}>{bundles.map((b:any)=><Link key={b.id} className={selected?.id===b.id?'button':'secondary button'} href={`/admin/exam-presets?bundle=${b.id}`}>{b.title}</Link>)}</div></section>
    {!selected?<section className="card"><p className="muted">Create a practice bundle first.</p></section>:<>
      <section className="card"><div className="row between"><div><h2>{selected.title}</h2><p className="muted">New presets inherit this bundle&apos;s exam-domain blueprint when one exists. You can refine preset-specific weights later without changing teacher data.</p></div><Link href={`/practice-library/bundles/${selected.id}`}>Student bundle view →</Link></div></section>
      {presets.map((p:any)=><section className="card" key={p.id}><h2>{p.title}</h2><form action={saveExamPreset.bind(null,selected.id,p.id)} className="stack">
        <div className="grid two"><label>Preset title<input name="title" defaultValue={p.title} required/></label><label>Slug<input name="slug" defaultValue={p.slug} required/></label><label>Provider label<input name="provider_label" defaultValue={p.provider_label??''} placeholder="PSI, Pearson VUE, State Board..."/></label><label>Mode label<input name="mode_label" defaultValue={p.mode_label||'Exam simulation'}/></label><label>Question count<input name="question_count" type="number" min="5" max="200" defaultValue={p.question_count}/></label><label>Duration minutes<input name="duration_minutes" type="number" min="0" max="600" defaultValue={p.duration_minutes}/></label><label>Passing target %<input name="passing_score_percent" type="number" min="0" max="100" defaultValue={p.passing_score_percent}/></label><label>Readiness target %<input name="readiness_target_percent" type="number" min="0" max="100" defaultValue={p.readiness_target_percent}/></label><label>Order<input name="position" type="number" defaultValue={p.position??0}/></label></div>
        <label>Description<textarea name="description" rows={3} defaultValue={p.description??''}/></label><div className="row" style={{flexWrap:'wrap'}}><label className="check"><input type="checkbox" name="active" defaultChecked={Boolean(p.active)}/>Active</label><label className="check"><input type="checkbox" name="is_free_preview" defaultChecked={Boolean(p.is_free_preview)}/>Free preview</label></div><button type="submit">Save preset</button>
      </form></section>)}
      <section className="card"><h2>Add exam preset</h2><form action={saveExamPreset.bind(null,selected.id,'')} className="stack"><div className="grid two"><label>Preset title<input name="title" required placeholder="State Licensing Practice Exam"/></label><label>Slug<input name="slug" required placeholder="state-licensing-practice"/></label><label>Provider label<input name="provider_label" placeholder="Exam provider"/></label><label>Mode label<input name="mode_label" defaultValue="Licensing exam simulation"/></label><label>Question count<input name="question_count" type="number" min="5" max="200" defaultValue="100"/></label><label>Duration minutes<input name="duration_minutes" type="number" min="0" max="600" defaultValue="120"/></label><label>Passing target %<input name="passing_score_percent" type="number" min="0" max="100" defaultValue="70"/></label><label>Readiness target %<input name="readiness_target_percent" type="number" min="0" max="100" defaultValue="70"/></label><label>Order<input name="position" type="number" defaultValue="0"/></label></div><label>Description<textarea name="description" rows={3} placeholder="What this simulation prepares the learner for."/></label><label className="check"><input type="checkbox" name="active" defaultChecked/>Active</label><label className="check"><input type="checkbox" name="is_free_preview"/>Free preview</label><button type="submit">Add preset</button></form></section>
    </>}
  </main>
}
