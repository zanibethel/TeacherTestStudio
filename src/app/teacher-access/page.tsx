import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createTeacherInvite } from './actions'

export default async function TeacherAccess({searchParams}:{searchParams:Promise<{invite?:string,email?:string,error?:string}>}){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved,teacher_can_invite').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved||!profile.teacher_can_invite)redirect('/dashboard')
  const q=await searchParams
  const{data:invites}=await supabase.from('teacher_invites').select('code,invited_email,created_at,expires_at,used_at,used_by').eq('created_by',user.id).order('created_at',{ascending:false})
  const inviteUrl=q.invite?`https://cramloop.app/login?role=teacher&invite=${encodeURIComponent(q.invite)}${q.email?`&email=${encodeURIComponent(q.email)}`:''}`:null
  return <main>
    <Link href="/dashboard">← Dashboard</Link>
    <h1>Teacher access</h1>
    <p className="muted">Teacher invites are private, expire after 7 days, work once, and can only approve the email address you specify.</p>
    {q.error&&<p className="bad notice">{q.error}</p>}
    {inviteUrl&&<section className="card"><h2>Invite ready</h2><p>Send this private link to <b>{q.email}</b>:</p><input readOnly value={inviteUrl}/><p className="muted">The invite will only grant teacher access when that same email creates the account.</p></section>}
    <section className="card"><h2>Invite another teacher</h2><form action={createTeacherInvite}><label>Teacher email</label><input name="email" type="email" required autoComplete="email" placeholder="teacher@school.org"/><button>Create one-time teacher invite</button></form></section>
    <section className="card"><h2>Invite history</h2>{!invites?.length?<p className="muted">No teacher invites yet.</p>:(invites||[]).map((i:any)=><div className="result-row" key={i.code}><div><b>{i.invited_email||'Legacy unbound invite'}</b><p className="muted"><span className="code">{i.code}</span> · Created {new Date(i.created_at).toLocaleString()} · Expires {new Date(i.expires_at).toLocaleString()}</p></div><span className="pill">{i.used_at?'Used':new Date(i.expires_at)<new Date()?'Expired':'Active'}</span></div>)}</section>
  </main>
}
