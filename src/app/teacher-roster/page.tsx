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
  const{data:rows}=await supabase.from('teacher_student_roster').select('id,student_email,student_id,student_first_name,student_last_name,created_at').eq('teacher_id',user.id).order('created_at',{ascending:false})

  return <main className="narrow">
    <Link href="/dashboard">← Teacher dashboard</Link>
    <h1>Student roster</h1>
    <p className="muted">Add students before or after they create an account. Email is required so CramLoop can match the account later; first and last name are optional labels for your roster.</p>
    {q.error&&<p className="bad notice">{q.error}</p>}{q.message&&<p className="good notice">{q.message}</p>}
    <form action={addStudentEmail} className="card">
      <div className="settings-grid">
        <div><label>First name <span className="muted">(optional)</span></label><input name="first_name" autoComplete="given-name" placeholder="First name"/></div>
        <div><label>Last name <span className="muted">(optional)</span></label><input name="last_name" autoComplete="family-name" placeholder="Last name"/></div>
      </div>
      <label>Student email</label>
      <input name="email" type="email" required autoComplete="email" placeholder="student@example.com"/>
      <button>Add student</button>
    </form>
    <h2>Your students</h2>
    {!(rows??[]).length?<section className="card"><p className="muted">No students have been added yet.</p></section>:(rows??[]).map((r:any)=>{const displayName=[r.student_first_name,r.student_last_name].filter(Boolean).join(' ');return <section className="card" key={r.id}><div className="row between"><div>{displayName&&<b>{displayName}</b>}<p style={{margin:displayName?'4px 0':'0'}}>{r.student_email}</p><p className="muted">{r.student_id?'Account connected':'Waiting for matching student account'}</p></div><form action={removeStudent.bind(null,r.id)}><button className="ghost">Remove</button></form></div></section>})}
  </main>
}
