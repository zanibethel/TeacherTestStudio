import Link from 'next/link'
import { notFound,redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { importCollection } from '../actions'

export default async function SharedCollectionPreview({params}:{params:Promise<{id:string}>}){
  const{id}=await params
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data,error}=await supabase.rpc('get_shared_collection_preview',{p_collection_id:id,p_limit:5})
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
      {areas.length>0&&<div className="row shared-preview-areas">{areas.slice(0,9).map(area=><span className="pill" key={area}>{area}</span>)}</div>}
      <form action={importCollection.bind(null,id)}><button>Add all {collection.question_count} to my bank</button></form>
    </section>
    <div className="row between"><div><h2>Question preview</h2><p className="muted">Sample of the first {questions.length} approved questions.</p></div></div>
    {questions.map((q:any,index:number)=>{const choices=Array.isArray(q.choices)?q.choices:[];return <section className="card preview-question-card" key={q.id}><p className="question-progress">Question {index+1}{q.content_area?` · ${q.content_area}`:''}</p><h3>{q.prompt}</h3><div className="preview-choice-list">{choices.map((choice:string,choiceIndex:number)=><div className={choiceIndex===q.correct_index?'preview-choice correct-preview':'preview-choice'} key={choiceIndex}><span>{String.fromCharCode(65+choiceIndex)}</span><p>{choice}</p>{choiceIndex===q.correct_index&&<b>Correct</b>}</div>)}</div>{q.explanation&&<div className="notice preview-explanation"><b>Explanation</b><p>{q.explanation}</p></div>}</section>})}
    <section className="card shared-preview-footer"><h2>Ready to use it?</h2><p className="muted">Importing creates editable copies in your personal bank. The CramLoop shared version stays unchanged.</p><form action={importCollection.bind(null,id)}><button>Add to my bank</button></form></section>
  </main>
}
