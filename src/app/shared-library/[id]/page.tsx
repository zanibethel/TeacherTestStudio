import Link from 'next/link'
import { notFound,redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { importCollection,refreshCollectionFromDetail } from '../actions'

function sameChoices(a:any,b:any){return JSON.stringify(Array.isArray(a)?a:[])===JSON.stringify(Array.isArray(b)?b:[])}

export default async function SharedCollectionPreview({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;message?:string}>}){
  const{id}=await params
  const query=await searchParams
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const[{data,error},{data:children}]=await Promise.all([
    supabase.rpc('get_shared_collection_preview',{p_collection_id:id,p_limit:5}),
    supabase.from('shared_collections').select('id,title,description,subject,collection_type,student_available,shared_collection_questions(count)').eq('parent_collection_id',id).eq('active',true).order('title')
  ])
  if(error||!data?.collection)notFound()
  const collection=data.collection as any
  const questions=(data.questions??[]) as any[]
  const areas=(collection.areas??[]) as string[]
  const collectionIds=[id,...(children??[]).map((c:any)=>c.id)]
  const[{data:memberships},{data:bankRows}]=await Promise.all([
    supabase.from('shared_collection_questions').select('collection_id,question_id').in('collection_id',collectionIds),
    supabase.from('question_bank').select('id,imported_collection_id,shared_question_id,normalized_prompt,prompt,choices,correct_index,content_area,explanation,focused_retake_hint').eq('teacher_id',user.id).limit(2000)
  ])
  const sourceIds=[...new Set((memberships??[]).map((m:any)=>m.question_id))] as string[]
  const{data:sources}=sourceIds.length?await supabase.from('shared_questions').select('id,normalized_prompt,prompt,choices,correct_index,content_area,explanation,focused_retake_hint').in('id',sourceIds):{data:[] as any[]}
  const sourceMap=new Map((sources??[]).map((s:any)=>[s.id,s]))
  const bankByNorm=new Map((bankRows??[]).map((b:any)=>[b.normalized_prompt,b]))
  function statusFor(collectionId:string){
    const members=(memberships??[]).filter((m:any)=>m.collection_id===collectionId)
    const linked=(bankRows??[]).filter((b:any)=>b.imported_collection_id===collectionId&&b.shared_question_id)
    const linkedBySource=new Map(linked.map((b:any)=>[b.shared_question_id,b]))
    let updates=0
    for(const member of members){const source=sourceMap.get(member.question_id) as any;if(!source)continue;const bank=linkedBySource.get(member.question_id) as any;if(!bank){if(!bankByNorm.has(source.normalized_prompt))updates++;continue}if(bank.prompt!==source.prompt||!sameChoices(bank.choices,source.choices)||bank.correct_index!==source.correct_index||bank.content_area!==source.content_area||bank.explanation!==source.explanation||bank.focused_retake_hint!==source.focused_retake_hint)updates++}
    return{inBank:linked.length>0,updates}
  }
  const mainStatus=statusFor(id)

  return <main className="narrow shared-preview-page">
    <Link href="/shared-library">← Shared resource library</Link>
    {query.error&&<p className="bad notice">{query.error}</p>}{query.message&&<p className="good notice">{query.message}</p>}
    <section className="card shared-preview-hero">
      <p className="eyebrow">{collection.subject}</p>
      <div className="row between"><div><h1>{collection.title}</h1><p className="muted">{collection.question_count} questions · {String(collection.collection_type).replaceAll('_',' ')}</p></div><div className="row" style={{gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>{mainStatus.inBank&&<span className="pill">In your bank</span>}{mainStatus.updates>0&&<span className="pill" style={{background:'#fff7ed',color:'#9a3412'}}>Updates available</span>}{collection.student_available&&<span className="pill">Practice-ready</span>}</div></div>
      {collection.description&&<p>{collection.description}</p>}
      {areas.length>0&&<div className="row shared-preview-areas">{areas.slice(0,12).map(area=><span className="pill" key={area}>{area}</span>)}</div>}
      {mainStatus.inBank?<div><form action={refreshCollectionFromDetail.bind(null,id)}><button>{mainStatus.updates>0?'Refresh your bank':'Check for updates'}</button></form><p className="muted" style={{fontSize:12,marginTop:8}}>{mainStatus.updates>0?`${mainStatus.updates} shared question${mainStatus.updates===1?' has':'s have'} newer content available.`:'Your linked questions are up to date.'}</p></div>:<form action={importCollection.bind(null,id)}><button>Add full {collection.question_count}-question bank</button></form>}
    </section>

    {(children??[]).length>0&&<section className="focused-pack-section">
      <div><h2>Focused practice areas</h2><p className="muted">Use these when you only want questions from a specific topic. They also power weak-area practice and study-guide recommendations.</p></div>
      <div className="focused-pack-grid">{(children??[]).map((c:any)=>{const count=c.shared_collection_questions?.[0]?.count??0;const status=statusFor(c.id);return <article className="card focused-pack-card" key={c.id}><div><div className="row between" style={{gap:8}}><h3>{c.title.replace(' Practice Set','')}</h3>{status.updates>0?<span className="pill" style={{background:'#fff7ed',color:'#9a3412'}}>Updates available</span>:status.inBank?<span className="pill">In your bank</span>:null}</div><p className="muted">{count} questions</p></div><p>{c.description||'Focused practice for this content area.'}</p><div className="shared-resource-actions"><Link className="secondary button" href={`/shared-library/${c.id}`}>Preview</Link>{status.inBank?<form action={refreshCollectionFromDetail.bind(null,c.id)}><button>{status.updates>0?'Refresh':'Check updates'}</button></form>:<form action={importCollection.bind(null,c.id)}><button>Add topic</button></form>}</div></article>})}</div>
    </section>}

    <div className="row between"><div><h2>Question preview</h2><p className="muted">Sample of {questions.length} approved questions from this resource.</p></div></div>
    {questions.map((q:any,index:number)=>{const choices=Array.isArray(q.choices)?q.choices:[];return <section className="card preview-question-card" key={q.id}><p className="question-progress">Question {index+1}{q.content_area?` · ${q.content_area}`:''}</p><h3>{q.prompt}</h3><div className="preview-choice-list">{choices.map((choice:string,choiceIndex:number)=><div className={choiceIndex===q.correct_index?'preview-choice correct-preview':'preview-choice'} key={choiceIndex}><span>{String.fromCharCode(65+choiceIndex)}</span><p>{choice}</p>{choiceIndex===q.correct_index&&<b>Correct</b>}</div>)}</div>{q.explanation&&<div className="notice preview-explanation"><b>Explanation</b><p>{q.explanation}</p></div>}</section>})}
    <section className="card shared-preview-footer"><h2>{mainStatus.inBank?'Keep your bank current':'Ready to use it?'}</h2><p className="muted">{mainStatus.inBank?'Refresh this resource whenever CramLoop publishes improved wording, choices, topics, explanations, hints, or new questions.':'Import the full resource or choose only the focused areas you need. Imported questions become editable copies in your personal bank.'}</p>{mainStatus.inBank?<form action={refreshCollectionFromDetail.bind(null,id)}><button>{mainStatus.updates>0?'Refresh your bank':'Check for updates'}</button></form>:<form action={importCollection.bind(null,id)}><button>Add full bank</button></form>}</section>
  </main>
}
