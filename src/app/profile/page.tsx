import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {saveTeacherProfile} from './actions'

export default async function ProfilePage({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}){
  const q=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('full_name,role,teacher_approved,teacher_display_name,teacher_organization,teacher_title').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const displayName=profile.teacher_display_name||profile.full_name||'Teacher'
  const secondary=[profile.teacher_organization,profile.teacher_title].filter(Boolean).join(' ')
  return <main className="narrow"><Link href="/dashboard">← Teacher dashboard</Link><h1>Profile</h1><p className="muted">Manage how your name and teaching role appear to students when they find you or open one of your tests.</p>{q.error&&<p className="bad notice">{q.error}</p>}{q.saved&&<p className="good notice">Profile saved.</p>}
    <section className="card"><span className="eyebrow">STUDENT PREVIEW</span><h2 style={{marginBottom:4}}>{displayName}</h2>{secondary&&<p className="muted" style={{marginTop:0}}>{secondary}</p>}</section>
    <form action={saveTeacherProfile} className="card stack"><h2>Teacher identity</h2><div><label>Display name</label><input name="display_name" required defaultValue={displayName} placeholder="Mrs. Perez"/><p className="muted">Use the name students normally know you by.</p></div><div><label>School / organization</label><input name="organization" defaultValue={profile.teacher_organization||''} placeholder="Monterey"/></div><div><label>Teaching title</label><input name="title" defaultValue={profile.teacher_title||''} placeholder="Cosmetology Instructor"/></div><button>Save profile</button></form>
  </main>
}
