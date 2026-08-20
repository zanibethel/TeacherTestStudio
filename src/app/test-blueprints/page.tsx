import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import BlueprintEditor from './BlueprintEditor'
import {deleteBlueprint,generateFromBlueprint,saveBlueprint} from './actions'

function chapterText(filters:any[]){if(!Array.isArray(filters)||!filters.length)return'All chapters';return filters.map(f=>f?.chapter_number?`Chapter ${f.chapter_number}${f.chapter_title?` — ${f.chapter_title}`:''}`:f?.chapter_title||'').filter(Boolean).join(', ')}
function weightText(weights:any){if(!weights||typeof weights!=='object'||Array.isArray(weights)||!Object.keys(weights).length)return'Balanced automatically';return Object.entries(weights).filter(([,v])=>Number(v)>0).map(([k,v])=>`${k} ${v}%`).join(' · ')}
function sourceText(filters:any[],weights:any){if(!Array.isArray(filters)||!filters.length)return'All current question sources';const custom=weights&&typeof weights==='object'&&!Array.isArray(weights)&&Object.keys(weights).length;return filters.map(f=>`${f.title||f.key}${custom&&Number(weights[f.key])>=0?` ${weights[f.key]}%`:''}`).join(' · ')}

export default async function TestBlueprints({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}){
 const query=await searchParams
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
 const[{data:questionsRaw},{data:blueprints},{data:bundlePresetData}]=await Promise.all([
  supabase.from('question_bank').select('chapter_number,chapter_title,subject_category,content_area,imported_collection_id').eq('teacher_id',user.id).limit(3000),
  supabase.from('teacher_test_blueprints').select('*').eq('teacher_id',user.id).order('updated_at',{ascending:false}),
  supabase.rpc('get_teacher_builder_bundle_presets'),
 ])
 const collectionIds=[...new Set((questionsRaw??[]).map((q:any)=>q.imported_collection_id).filter(Boolean))]
 const{data:collections}=collectionIds.length?await supabase.from('shared_collections').select('id,title').in('id',collectionIds):{data:[] as any[]}
 const collectionTitle=new Map((collections??[]).map((c:any)=>[c.id,c.title]))
 const bundlePresets=Array.isArray(bundlePresetData)?bundlePresetData:[];const collectionBundle=new Map<string,{id:string;title:string}>()
 for(const preset of bundlePresets as any[]){for(const cid of preset.collection_ids??[]){if(!collectionBundle.has(cid))collectionBundle.set(cid,{id:preset.bundle_id,title:preset.bundle_title})}}
 const sourceMap=new Map<string,{key:string;title:string;collection_ids:Set<string>;questionCount:number}>()
 const questions=(questionsRaw??[]).map((q:any)=>{const bundle=q.imported_collection_id?collectionBundle.get(q.imported_collection_id):undefined;const key=!q.imported_collection_id?'custom':bundle?`bundle:${bundle.id}`:`collection:${q.imported_collection_id}`;const title=!q.imported_collection_id?'My custom questions':bundle?.title||collectionTitle.get(q.imported_collection_id)||'Imported resource';const current=sourceMap.get(key)??{key,title,collection_ids:new Set<string>(),questionCount:0};current.questionCount++;if(q.imported_collection_id)current.collection_ids.add(q.imported_collection_id);sourceMap.set(key,current);return{...q,source_bucket_key:key}})
 const sourceBuckets=[...sourceMap.values()].map(x=>({key:x.key,title:x.title,collection_ids:[...x.collection_ids],questionCount:x.questionCount})).sort((a,b)=>a.title.localeCompare(b.title))
 return <main><Link href="/dashboard">← Dashboard</Link><div className="row between" style={{alignItems:'flex-start',gap:12,flexWrap:'wrap'}}><div><h1>Smart-test blueprints</h1><p className="muted">Save source banks, chapters, and weighting rules, then generate a fresh editable test whenever you need one.</p></div><div className="row" style={{flexWrap:'wrap'}}><Link className="secondary button" href="/question-bank">Question bank</Link><Link className="button" href="/tests/new">Build manually</Link></div></div>{query.error&&<p className="bad notice">{query.error}</p>}{query.saved&&<p className="good notice">Blueprint saved.</p>}
 {blueprints?.length?<section className="card"><div className="row between"><div><h2>Saved blueprints</h2><p className="muted">The recipe stays fixed while newly added matching questions become eligible.</p></div><span className="pill">{blueprints.length}</span></div><div style={{display:'grid',gap:10}}>{blueprints.map((b:any)=><article key={b.id} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:16,alignItems:'center',border:'1px solid #e4e7ef',borderRadius:12,padding:14}}><div><h3 style={{margin:'0 0 5px'}}>{b.name}</h3>{b.description&&<p style={{margin:'3px 0'}}>{b.description}</p>}<p className="muted" style={{margin:'3px 0'}}><b>Sources:</b> {sourceText(b.source_filters,b.source_weights)}</p><p className="muted" style={{margin:'3px 0'}}><b>Chapters:</b> {chapterText(b.chapter_filters)}</p><p className="muted" style={{margin:'3px 0'}}><b>Subjects:</b> {weightText(b.subject_weights)}</p><p className="muted" style={{margin:'3px 0'}}>{b.question_count} questions · {b.duration_minutes?`${b.duration_minutes} min`:'Untimed'} · {b.passing_score_percent}% passing</p></div><div className="row" style={{flexWrap:'wrap'}}><form action={generateFromBlueprint.bind(null,b.id)} style={{margin:0}}><button>Generate fresh draft</button></form><Link className="secondary button" href={`/test-blueprints/${b.id}/edit`}>Edit</Link><form action={deleteBlueprint.bind(null,b.id)} style={{margin:0}}><button className="ghost danger">Delete</button></form></div></article>)}</div></section>:<section className="card"><h2>No saved blueprints yet</h2><p className="muted">Create one below. A blueprint stores selection rules, not a fixed set of questions.</p></section>}
 <BlueprintEditor action={saveBlueprint} questions={questions as any} sourceBuckets={sourceBuckets}/>
 </main>
}
