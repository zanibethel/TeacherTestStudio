import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addStudentEmail, removeStudent } from './actions'

export default async function TeacherRoster({searchParams}:{searchParams:Promise<{error?:string,message?:string}>}){
  const q=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:rows}=await supabase.from('teacher_student_roster').select('id,student_email,student_id,created_at').eq('teacher_id',user.id).order('created_at',{ascending:false})

  return <main className="narrow">
    <Link href="/dashboard">← Teacher dashboard</Link>
    <h1>Student roster</h1>
    <p className="muted">Add student emails before or after they create an account. When they sign in with the same email and find you, Teacher Test Studio can recognize the relationship automatically.</p>
    {q.error&&<p className="bad notice">{q.error}</p>}{q.message&&<p className="good notice">{q.message}</p>}
    <form action={addStudentEmail} className="card">
      <label>Student email</label>
      <input name="email" type="email" required placeholder="student@example.com"/>
      <button>Add student</button>
    </form>
    <h2>Your students</h2>
    {!(rows??[]).length?<section className="card"><p className="muted">No student emails have been added yet.</p></section>:(rows??[]).map((r:any)=><section className="card" key={r.id}><div className="row between"><div><b>{r.student_email}</b><p className="muted">{r.student_id?'Account connected':'Waiting for matching student account'}</p></div><form action={removeStudent.bind(null,r.id)}><button className="ghost">Remove</button></form></div></section>)}
  </main>
}
