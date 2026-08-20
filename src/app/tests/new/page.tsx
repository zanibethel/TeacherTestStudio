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
    <Link href="/dashboard">← Dashboard</Link>
    <div className="row between" style={{alignItems:'flex-start',gap:12,flexWrap:'wrap'}}><div><span className="eyebrow">BUILD A TEST</span><h1 style={{margin:'5px 0'}}>Build a test</h1><p className="muted" style={{margin:0}}>Give it a name and choose questions from your Question Bank. Assignment settings come later.</p></div><Link className="secondary button" href="/assignments/new">Create assignment instead</Link></div>
    {query.error&&<p className="bad notice">{query.error}</p>}
    <SimpleTestBuilder action={createTest} bankQuestions={(bank??[]) as any}/>
  </main>
}
