import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addStudentEmail, removeStudent } from './actions'
import ClassAutocomplete from './ClassAutocomplete'

export default async function TeacherRoster({searchParams}:{searchParams:Promise<{error?:string,message?:string}>}){
  const q=await searchParams
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const[{data:rows},{data:groups}]=await Promise.all([
    supabase.from('teacher_student_roster').select('id,student_email,student_id,student_first_name,student_last_name,created_at').eq('teacher_id',user.id).order('created_at',{ascending:false}),
    supabase.from('teacher_groups').select('id,name').eq('teacher_id',user.id).order('name',{ascending:true})
  ])
  const groupIds=(groups??[]).map((g:any)=>g.id)
  const{data:members}=groupIds.length?await supabase.from('teacher_group_members').select('group_id,roster_id').in('group_id',groupIds):{data:[] as any[]}
  const groupNameById=new Map((groups??[]).map((g:any)=>[g.id,g.name]))
  const classesByRoster=new Map<string,string[]>()
  for(const m of members??[]){const name=groupNameById.get((m as any).group_id);if(!name)continue;const key=String((m as any).roster_id);classesByRoster.set(key,[...(classesByRoster.get(key)??[]),String(name)])}

  return <main className="narrow">
    <Link href="/dashboard">← Teacher dashboard</Link>
    <h1>Student roster</h1>
    <p className="muted">Add students before or after they create an account. Email is required so CramLoop can match the account later. Names and class are optional.</p>
    {q.error&&<p className="bad notice">{q.error}</p>}{q.message&&<p className="good notice">{q.message}</p>}
    <form action={addStudentEmail} className="card roster-add-card">
      <div className="settings-grid">
        <div><label>First name <span className="muted">(optional)</span></label><input name="first_name" autoComplete="given-name" placeholder="First name"/></div>
        <div><label>Last name <span className="muted">(optional)</span></label><input name="last_name" autoComplete="family-name" placeholder="Last name"/></div>
      </div>
      <label>Student email</label>
      <input name="email" type="email" required autoComplete="email" placeholder="student@example.com"/>
      <ClassAutocomplete groups={(groups??[]).map((g:any)=>({id:g.id,name:g.name}))}/>
      <p className="muted">Choose an existing class suggestion to keep names consistent, or enter a new class and CramLoop will create it automatically.</p>
      <button>Add student</button>
    </form>
    <div className="row between"><h2>Your students</h2><Link href="/teacher-groups">Manage classes →</Link></div>
    {!(rows??[]).length?<section className="card"><p className="muted">No students have been added yet.</p></section>:(rows??[]).map((r:any)=>{const displayName=[r.student_first_name,r.student_last_name].filter(Boolean).join(' ');const classes=classesByRoster.get(String(r.id))??[];return <section className="card" key={r.id}><div className="row between"><div>{displayName&&<b>{displayName}</b>}<p style={{margin:displayName?'4px 0':'0'}}>{r.student_email}</p>{classes.length>0&&<div className="row roster-class-pills">{classes.map(name=><span className="pill" key={name}>{name}</span>)}</div>}<p className="muted">{r.student_id?'Account connected':'Waiting for matching student account'}</p></div><form action={removeStudent.bind(null,r.id)}><button className="ghost">Remove</button></form></div></section>})}
  </main>
}
