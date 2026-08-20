import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { bulkUpdateBankQuestionMetadata,deleteBankQuestion,refreshSharedBankQuestions } from './actions'
import QuestionBankBrowser from './QuestionBankBrowser'

export default async function QuestionBank({searchParams}:{searchParams:Promise<{error?:string;refreshed?:string;bulkUpdated?:string}>}){
  const query=await searchParams
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:questions}=await supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,source_type,shared_question_id,imported_collection_id').order('updated_at',{ascending:false}).limit(1000)
  const collectionIds=[...new Set((questions??[]).map((q:any)=>q.imported_collection_id).filter(Boolean))] as string[]
  const{data:collections}=collectionIds.length?await supabase.from('shared_collections').select('id,title,parent_collection_id').in('id',collectionIds):{data:[] as any[]}
  const parentIds=[...new Set((collections??[]).map((c:any)=>c.parent_collection_id).filter(Boolean))] as string[]
  const{data:parents}=parentIds.length?await supabase.from('shared_collections').select('id,title').in('id',parentIds):{data:[] as any[]}
  const parentMap=new Map((parents??[]).map((p:any)=>[p.id,p.title]))
  const collectionMap=new Map((collections??[]).map((c:any)=>[c.id,{title:c.title,parentTitle:c.parent_collection_id?parentMap.get(c.parent_collection_id)??null:null}]))
  const bank=(questions??[]).map((q:any)=>{const source=q.imported_collection_id?collectionMap.get(q.imported_collection_id):null;return{...q,collection_title:source?.parentTitle||source?.title||null,collection_section:source?.parentTitle?source.title:null}})
  const importedCount=(questions??[]).filter((q:any)=>q.shared_question_id).length
  return <main>
    <div className="row between" style={{alignItems:'flex-start',gap:12,flexWrap:'wrap'}}><div><Link href="/dashboard">← Dashboard</Link><h1>Question bank</h1><p className="muted">Organize questions by source, chapter, and subject category so they can be reused in smart tests.</p></div><div className="row" style={{flexWrap:'wrap'}}><Link className="secondary button" href="/shared-library">Browse shared library</Link><Link className="button" href="/tests/new">+ Build a test</Link></div></div>
    {query.error&&<p className="bad notice">{query.error}</p>}
    {query.refreshed!==undefined&&<p className="good notice">Shared questions refreshed. {Number(query.refreshed)||0} bank question{Number(query.refreshed)===1?'':'s'} updated.</p>}
    {query.bulkUpdated!==undefined&&<p className="good notice">Organization updated for {Number(query.bulkUpdated)||0} question{Number(query.bulkUpdated)===1?'':'s'}.</p>}
    {importedCount>0&&<section className="card" style={{padding:'14px 16px'}}><div className="row between" style={{alignItems:'center',gap:12,flexWrap:'wrap'}}><div><b>Imported shared questions</b><p className="muted" style={{margin:'4px 0 0'}}>Pull the latest shared-library wording, answers, chapter metadata, subject categories, explanations, and focused-retake hints. Custom questions are not changed.</p></div><form action={refreshSharedBankQuestions}><button className="secondary">Refresh shared questions</button></form></div></section>}
    <QuestionBankBrowser questions={bank as any} deleteAction={deleteBankQuestion} bulkAction={bulkUpdateBankQuestionMetadata}/>
  </main>
}
