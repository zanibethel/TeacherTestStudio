import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createGroup, deleteGroup, saveGroupMembers } from '@/app/teacher-roster/actions'

export default async function TeacherGroups(){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single();if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const{data:roster}=await supabase.from('teacher_student_roster').select('id,student_email,student_id').eq('teacher_id',user.id).order('student_email')
  const{data:groups}=await supabase.from('teacher_groups').select('id,name,teacher_group_members(roster_id)').eq('teacher_id',user.id).order('name')
  return <main className="narrow"><Link href="/dashboard">← Teacher dashboard</Link><h1>Student groups</h1><p className="muted">Create reusable groups for test sharing. One share can target an entire group, and membership changes stay managed here.</p>
    <section className="card"><h2>Create group</h2><form action={createGroup} className="stack"><label>Group name</label><input name="name" required placeholder="Cosmetology AM"/>{(roster??[]).map((r:any)=><label className="check" key={r.id}><input type="checkbox" name="roster_ids" value={r.id}/>{r.student_email}</label>)}{!(roster??[]).length&&<p className="muted">Add students to your roster first.</p>}<button>Create group</button></form></section>
    <h2>Your groups</h2>{!(groups??[]).length?<section className="card"><p className="muted">No groups yet.</p></section>:(groups??[]).map((g:any)=>{const memberIds=new Set((g.teacher_group_members??[]).map((m:any)=>m.roster_id));return <section className="card" key={g.id}><div className="row between"><div><h3>{g.name}</h3><p className="muted">{memberIds.size} member{memberIds.size===1?'':'s'}</p></div><form action={deleteGroup.bind(null,g.id)}><button className="ghost">Delete</button></form></div><form action={saveGroupMembers.bind(null,g.id)} className="stack">{(roster??[]).map((r:any)=><label className="check" key={r.id}><input type="checkbox" name="roster_ids" value={r.id} defaultChecked={memberIds.has(r.id)}/>{r.student_email}</label>)}<button className="secondary">Save members</button></form></section>})}
    <section className="card"><Link className="secondary button" href="/teacher-roster">Manage student roster</Link></section>
  </main>
}
