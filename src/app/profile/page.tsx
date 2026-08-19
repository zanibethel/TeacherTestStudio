import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import TeacherProfileForm from './TeacherProfileForm'

export default async function ProfilePage({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}){
  const q=await searchParams;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('full_name,role,teacher_approved,teacher_display_name,teacher_organization,teacher_title').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')
  const displayName=profile.teacher_display_name||profile.full_name||'Teacher'
  return <main className="narrow"><Link href="/dashboard">← Teacher dashboard</Link><h1>Profile</h1><p className="muted">Manage how your name and teaching role appear to students when they find you or open one of your tests. The preview updates while you type; changes go live after you save.</p>{q.error&&<p className="bad notice">{q.error}</p>}{q.saved&&<p className="good notice">Profile saved.</p>}
    <TeacherProfileForm displayName={displayName} organization={profile.teacher_organization||''} title={profile.teacher_title||''}/>
  </main>
}
