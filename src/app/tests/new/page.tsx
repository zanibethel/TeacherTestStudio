import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import SimpleTestBuilder from './SimpleTestBuilder'
import {createTest} from './actions'

export default async function NewTest({searchParams}:{searchParams:Promise<{error?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:bank}=await supabase.from('question_bank').select('id,prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,focused_retake_hint').eq('teacher_id',user.id).order('updated_at',{ascending:false}).limit(2000)
  const query=await searchParams
  return <main>
    <div className="row between" style={{alignItems:'center',gap:12,flexWrap:'wrap'}}><Link href="/dashboard">← Dashboard</Link><Link href="/assignments/new">Create assignment →</Link></div>
    <div style={{marginTop:18}}><span className="eyebrow">BUILD A TEST</span><p className="muted" style={{margin:'8px 0 0'}}>Give it a name and choose questions from your Question Bank. Assignment settings come later.</p></div>
    {query.error&&<p className="bad notice">{query.error}</p>}
    <SimpleTestBuilder action={createTest} bankQuestions={(bank??[]) as any}/>
  </main>
}
