import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { importCollection,refreshCollectionFromLibrary } from './actions'

function sameChoices(a:any,b:any){return JSON.stringify(Array.isArray(a)?a:[])===JSON.stringify(Array.isArray(b)?b:[])}

export default async function SharedLibrary({searchParams}:{searchParams:Promise<{q?:string;subject?:string;error?:string;message?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const query=await searchParams
  let request=supabase.from('shared_collections').select('id,title,description,subject,collection_type,student_available,shared_collection_questions(count)').eq('active',true).is('parent_collection_id',null).order('title')
  if(query.q?.trim())request=request.ilike('title',`%${query.q.trim()}%`)
  if(query.subject?.trim())request=request.eq('subject',query.subject.trim())
  const{data:collections,error}=await request
  const{data:subjects}=await supabase.from('shared_collections').select('subject').eq('active',true).is('parent_collection_id',null)
  const subjectList=[...new Set((subjects??[]).map((x:any)=>x.subject).filter(Boolean))].sort()

  const collectionIds=(collections??[]).map((c:any)=>c.id)
  const[{data:memberships},{data:bankRows}]=collectionIds.length?await Promise.all([
    supabase.from('shared_collection_questions').select('collection_id,question_id').in('collection_id',collectionIds),
    supabase.from('question_bank').select('id,imported_collection_id,shared_question_id,normalized_prompt,prompt,choices,correct_index,content_area,explanation,focused_retake_hint').eq('teacher_id',user.id).limit(2000)
  ]):[{data:[] as any[]},{data:[] as any[]}]
  const sourceIds=[...new Set((memberships??[]).map((m:any)=>m.question_id))] as string[]
  const{data:sources}=sourceIds.length?await supabase.from('shared_questions').select('id,normalized_prompt,prompt,choices,correct_index,content_area,explanation,focused_retake_hint').in('id',sourceIds):{data:[] as any[]}
  const sourceMap=new Map((sources??[]).map((s:any)=>[s.id,s]))
  const bankByNorm=new Map((bankRows??[]).map((b:any)=>[b.normalized_prompt,b]))

  function statusFor(collectionId:string){
    const members=(memberships??[]).filter((m:any)=>m.collection_id===collectionId)
    const linked=(bankRows??[]).filter((b:any)=>b.imported_collection_id===collectionId&&b.shared_question_id)
    const linkedBySource=new Map(linked.map((b:any)=>[b.shared_question_id,b]))
    let updates=0
    for(const member of members){
      const source=sourceMap.get(member.question_id) as any
      if(!source)continue
      const bank=linkedBySource.get(member.question_id) as any
      if(!bank){if(!bankByNorm.has(source.normalized_prompt))updates++;continue}
      if(bank.prompt!==source.prompt||!sameChoices(bank.choices,source.choices)||bank.correct_index!==source.correct_index||bank.content_area!==source.content_area||bank.explanation!==source.explanation||bank.focused_retake_hint!==source.focused_retake_hint)updates++
    }
    return{inBank:linked.length>0,linkedCount:linked.length,updates}
  }

  return <main>
    <div className="row between"><div><Link href="/dashboard">← Dashboard</Link><h1>Shared resource library</h1><p className="muted">Browse complete CramLoop resources. Open one to preview questions or choose focused content areas before importing.</p></div><Link className="secondary button" href="/question-bank">My question bank</Link></div>
    {query.error&&<p className="bad notice">{query.error}</p>}{query.message&&<p className="good notice">{query.message}</p>}{error&&<p className="bad notice">{error.message}</p>}
    <form className="card shared-library-filter" method="get"><div className="settings-grid"><div><label>Search resources</label><input name="q" defaultValue={query.q??''} placeholder="cosmetology, sanitation..."/></div><div><label>Subject</label><select name="subject" defaultValue={query.subject??''}><option value="">All subjects</option>{subjectList.map(subject=><option key={subject} value={subject}>{subject}</option>)}</select></div></div><button>Filter library</button></form>
    <p className="muted">{collections?.length??0} resource{collections?.length===1?'':'s'} available</p>
    {!collections?.length?<section className="card"><p className="muted">No shared resources match this filter yet.</p></section>:<div className="shared-library-grid">{(collections??[]).map((c:any)=>{const count=c.shared_collection_questions?.[0]?.count??0;const type=String(c.collection_type).replaceAll('_',' ');const status=statusFor(c.id);return <section className="card shared-resource-card" key={c.id}><div className="shared-resource-top"><div><p className="eyebrow">{c.subject}</p><h2>{c.title}</h2></div><div className="row" style={{gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>{status.inBank&&<span className="pill">In your bank</span>}{status.updates>0&&<span className="pill" style={{background:'#fff7ed',color:'#9a3412'}}>Updates available</span>}{c.student_available&&<span className="pill">Practice-ready</span>}</div></div><p className="shared-resource-meta">{count} questions · {type}</p><p className="shared-resource-description">{c.description||'Curated teacher resource.'}</p><div className="shared-resource-actions"><Link className="secondary button" href={`/shared-library/${c.id}`}>Open & preview</Link>{status.inBank?<form action={refreshCollectionFromLibrary.bind(null,c.id)}><button>{status.updates>0?'Refresh your bank':'Check for updates'}</button></form>:<form action={importCollection.bind(null,c.id)}><button>Add full bank</button></form>}</div>{status.inBank&&<p className="muted" style={{fontSize:12,margin:'8px 0 0'}}>{status.updates>0?`${status.updates} shared question${status.updates===1?' has':'s have'} newer content available.`:`Your linked questions are up to date.`}</p>}</section>})}</div>}
  </main>
}
