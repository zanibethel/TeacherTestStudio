import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createTeacherInvite } from './actions'

export default async function TeacherAccess({searchParams}:{searchParams:Promise<{invite?:string,error?:string}>}){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved,teacher_can_invite').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved||!profile.teacher_can_invite)redirect('/dashboard')
  const q=await searchParams
  const{data:invites}=await supabase.from('teacher_invites').select('code,created_at,expires_at,used_at,used_by').eq('created_by',user.id).order('created_at',{ascending:false})
  const inviteUrl=q.invite?`https://teacher-test-studio.vercel.app/login?role=teacher&invite=${encodeURIComponent(q.invite)}`:null
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <h1>Teacher access</h1>
    <p className="muted">Only teachers invited from this page can unlock teacher tools. Invite links expire after 7 days and can be used once.</p>
    {q.error&&<p className="bad notice">{q.error}</p>}
    {inviteUrl&&<section className="card"><h2>Invite ready</h2><p>Send this private link to the teacher you approve:</p><input readOnly value={inviteUrl}/><p className="muted">Once it is used, it cannot be reused.</p></section>}
    <section className="card"><h2>Invite another teacher</h2><form action={createTeacherInvite}><button>Create one-time teacher invite</button></form></section>
    <section className="card"><h2>Invite history</h2>{!invites?.length?<p className="muted">No teacher invites yet.</p>:(invites||[]).map((i:any)=><div className="result-row" key={i.code}><div><b className="code">{i.code}</b><p className="muted">Created {new Date(i.created_at).toLocaleString()} · Expires {new Date(i.expires_at).toLocaleString()}</p></div><span className="pill">{i.used_at?'Used':new Date(i.expires_at)<new Date()?'Expired':'Active'}</span></div>)}</section>
  </main>
}
