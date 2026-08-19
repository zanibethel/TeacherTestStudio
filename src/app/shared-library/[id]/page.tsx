import Link from 'next/link'
import { notFound,redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { importCollection } from '../actions'

export default async function SharedCollectionPreview({params}:{params:Promise<{id:string}>}){
  const{id}=await params
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
  return <main className="narrow shared-preview-page">
    <Link href="/shared-library">← Shared resource library</Link>
    <section className="card shared-preview-hero">
      <p className="eyebrow">{collection.subject}</p>
      <div className="row between"><div><h1>{collection.title}</h1><p className="muted">{collection.question_count} questions · {String(collection.collection_type).replaceAll('_',' ')}</p></div>{collection.student_available&&<span className="pill">Practice-ready</span>}</div>
      {collection.description&&<p>{collection.description}</p>}
      {areas.length>0&&<div className="row shared-preview-areas">{areas.slice(0,12).map(area=><span className="pill" key={area}>{area}</span>)}</div>}
      <form action={importCollection.bind(null,id)}><button>Add full {collection.question_count}-question bank</button></form>
    </section>

    {(children??[]).length>0&&<section className="focused-pack-section">
      <div><h2>Focused practice areas</h2><p className="muted">Use these when you only want questions from a specific topic. They also power weak-area practice and study-guide recommendations.</p></div>
      <div className="focused-pack-grid">{(children??[]).map((c:any)=>{const count=c.shared_collection_questions?.[0]?.count??0;return <article className="card focused-pack-card" key={c.id}><div><h3>{c.title.replace(' Practice Set','')}</h3><p className="muted">{count} questions</p></div><p>{c.description||'Focused practice for this content area.'}</p><div className="shared-resource-actions"><Link className="secondary button" href={`/shared-library/${c.id}`}>Preview</Link><form action={importCollection.bind(null,c.id)}><button>Add topic</button></form></div></article>})}</div>
    </section>}

    <div className="row between"><div><h2>Question preview</h2><p className="muted">Sample of {questions.length} approved questions from this resource.</p></div></div>
    {questions.map((q:any,index:number)=>{const choices=Array.isArray(q.choices)?q.choices:[];return <section className="card preview-question-card" key={q.id}><p className="question-progress">Question {index+1}{q.content_area?` · ${q.content_area}`:''}</p><h3>{q.prompt}</h3><div className="preview-choice-list">{choices.map((choice:string,choiceIndex:number)=><div className={choiceIndex===q.correct_index?'preview-choice correct-preview':'preview-choice'} key={choiceIndex}><span>{String.fromCharCode(65+choiceIndex)}</span><p>{choice}</p>{choiceIndex===q.correct_index&&<b>Correct</b>}</div>)}</div>{q.explanation&&<div className="notice preview-explanation"><b>Explanation</b><p>{q.explanation}</p></div>}</section>})}
    <section className="card shared-preview-footer"><h2>Ready to use it?</h2><p className="muted">Import the full resource or choose only the focused areas you need. Imported questions become editable copies in your personal bank.</p><form action={importCollection.bind(null,id)}><button>Add full bank</button></form></section>
  </main>
}
