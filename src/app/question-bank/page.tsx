import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteBankQuestion } from './actions'
import QuestionBankBrowser from './QuestionBankBrowser'

export default async function QuestionBank(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:questions}=await supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,source_type,shared_question_id,imported_collection_id').order('updated_at',{ascending:false}).limit(1000)
  const collectionIds=[...new Set((questions??[]).map((q:any)=>q.imported_collection_id).filter(Boolean))] as string[]
  const{data:collections}=collectionIds.length?await supabase.from('shared_collections').select('id,title,parent_collection_id').in('id',collectionIds):{data:[] as any[]}
  const parentIds=[...new Set((collections??[]).map((c:any)=>c.parent_collection_id).filter(Boolean))] as string[]
  const{data:parents}=parentIds.length?await supabase.from('shared_collections').select('id,title').in('id',parentIds):{data:[] as any[]}
  const parentMap=new Map((parents??[]).map((p:any)=>[p.id,p.title]))
  const collectionMap=new Map((collections??[]).map((c:any)=>[c.id,{title:c.title,parentTitle:c.parent_collection_id?parentMap.get(c.parent_collection_id)??null:null}]))
  const bank=(questions??[]).map((q:any)=>{const source=q.imported_collection_id?collectionMap.get(q.imported_collection_id):null;return{...q,collection_title:source?.parentTitle||source?.title||null,collection_section:source?.parentTitle?source.title:null}})
  return <main>
    <div className="row between"><div><Link href="/dashboard">← Dashboard</Link><h1>Question bank</h1><p className="muted">Browse by bundle and topic, or search to jump straight to matching questions.</p></div><div className="row"><Link className="secondary button" href="/shared-library">Browse shared library</Link><Link className="button" href="/tests/new">+ Build a test</Link></div></div>
    <QuestionBankBrowser questions={bank as any} deleteAction={deleteBankQuestion}/>
  </main>
}
