import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addStudentEmail, removeStudent, updateStudentRoster } from './actions'
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
  const groupIdsByRoster=new Map<string,string[]>()
  for(const m of members??[]){
    const groupId=String((m as any).group_id);const name=groupNameById.get(groupId);if(!name)continue;const key=String((m as any).roster_id)
    classesByRoster.set(key,[...(classesByRoster.get(key)??[]),String(name)])
    groupIdsByRoster.set(key,[...(groupIdsByRoster.get(key)??[]),groupId])
  }
  const groupOptions=(groups??[]).map((g:any)=>({id:String(g.id),name:String(g.name)}))

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
      <ClassAutocomplete groups={groupOptions}/>
      <p className="muted">Choose an existing class suggestion to keep names consistent, or enter a new class and CramLoop will create it automatically.</p>
      <button>Add student</button>
    </form>
    <div className="row between"><h2>Your students</h2><Link href="/teacher-groups">Manage classes →</Link></div>
    {!(rows??[]).length?<section className="card"><p className="muted">No students have been added yet.</p></section>:(rows??[]).map((r:any)=>{
      const rosterId=String(r.id)
      const displayName=[r.student_first_name,r.student_last_name].filter(Boolean).join(' ')
      const classes=classesByRoster.get(rosterId)??[]
      const selectedGroupIds=new Set(groupIdsByRoster.get(rosterId)??[])
      return <section className="card roster-student-card" key={r.id}>
        <div className="row between roster-student-summary">
          <div>{displayName&&<b>{displayName}</b>}<p style={{margin:displayName?'4px 0':'0'}}>{r.student_email}</p>{classes.length>0&&<div className="row roster-class-pills">{classes.map(name=><span className="pill" key={name}>{name}</span>)}</div>}<p className="muted">{r.student_id?'Account connected':'Waiting for matching student account'}</p></div>
          <div className="row"><details className="roster-edit-details"><summary className="secondary button">Edit</summary></details><form action={removeStudent.bind(null,r.id)}><button className="ghost">Remove</button></form></div>
        </div>
        <details className="roster-edit-panel">
          <summary>Edit student details</summary>
          <form action={updateStudentRoster.bind(null,r.id)} className="stack roster-edit-form">
            <div className="settings-grid">
              <div><label>First name <span className="muted">(optional)</span></label><input name="first_name" defaultValue={r.student_first_name??''} autoComplete="given-name"/></div>
              <div><label>Last name <span className="muted">(optional)</span></label><input name="last_name" defaultValue={r.student_last_name??''} autoComplete="family-name"/></div>
            </div>
            <label>Student email</label>
            <input name="email" type="email" required defaultValue={r.student_email} autoComplete="email"/>
            {(groups??[]).length>0&&<fieldset className="roster-class-fieldset"><legend>Current classes</legend><div className="roster-class-checks">{groupOptions.map(group=><label className="check" key={group.id}><input type="checkbox" name="group_ids" value={group.id} defaultChecked={selectedGroupIds.has(group.id)}/><span>{group.name}</span></label>)}</div></fieldset>}
            <ClassAutocomplete groups={groupOptions} name="class_name" inputId={`roster-class-${rosterId}`} label="Add or create another class" helperMode="add"/>
            <p className="muted">Uncheck a current class to remove the student from it. Type another class to add or create one.</p>
            <div className="row"><button type="submit">Save changes</button><Link className="secondary button" href="/teacher-groups">Manage classes</Link></div>
          </form>
        </details>
      </section>
    })}
  </main>
}
