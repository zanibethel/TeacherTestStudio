import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteBankQuestion } from './actions'
import QuestionBankBrowser from './QuestionBankBrowser'

export default async function QuestionBank(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const[{data:questions},{data:areas}]=await Promise.all([
    supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,source_type,shared_question_id,imported_collection_id').order('updated_at',{ascending:false}).limit(1000),
    supabase.from('question_bank').select('content_area').not('content_area','is',null)
  ])
  const areaList=[...new Set((areas??[]).map((x:any)=>x.content_area).filter(Boolean))].sort()
  return <main>
    <div className="row between"><div><Link href="/dashboard">← Dashboard</Link><h1>Question bank</h1><p className="muted">Your private, editable collection. Search updates instantly as you type.</p></div><div className="row"><Link className="secondary button" href="/shared-library">Browse shared library</Link><Link className="button" href="/tests/new">+ Build a test</Link></div></div>
    <QuestionBankBrowser questions={(questions??[]) as any} areas={areaList as string[]} deleteAction={deleteBankQuestion}/>
  </main>
}
