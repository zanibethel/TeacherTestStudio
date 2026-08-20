import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppMenu from './AppMenu'

export default async function AppHeader(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  let role:string|null=null,canInvite=false,isAdmin=false,attentionCount=0
  if(user){
    const[{data:profile},{data:adminFlag}]=await Promise.all([
      supabase.from('profiles').select('role,teacher_approved,teacher_can_invite').eq('id',user.id).single(),
      supabase.rpc('is_platform_admin')
    ])
    role=profile?.role??null
    canInvite=Boolean(profile?.teacher_can_invite)
    isAdmin=Boolean(adminFlag)
    if(role==='teacher'&&profile?.teacher_approved){
      const now=Date.now(),soon=now+48*60*60*1000
      const[{count:pending},{data:shares}]=await Promise.all([
        supabase.from('student_teacher_connection_requests').select('*',{count:'exact',head:true}).eq('teacher_id',user.id).eq('status','pending'),
        supabase.from('test_shares').select('due_at').eq('teacher_id',user.id).eq('active',true).not('due_at','is',null)
      ])
      const dueSoon=(shares??[]).filter((s:any)=>{const due=new Date(s.due_at).getTime();return due>now&&due<=soon}).length
      const pastDue=(shares??[]).filter((s:any)=>new Date(s.due_at).getTime()<=now).length
      attentionCount=(pending??0)+dueSoon+pastDue
    }
  }
  const workspaceLabel=role==='teacher'?'Teacher workspace':role==='student'?'Student workspace':isAdmin?'Admin workspace':null

  return <header className="site-header">
    <div className="site-header-inner">
      <Link className="brand" href={user?'/dashboard':'/'}>
        <b>CramLoop</b>
        {user&&workspaceLabel&&<span className="brand-workspace">{workspaceLabel}</span>}
      </Link>
      {!user?<Link href="/login">Sign in</Link>:<div className="site-header-actions">
        {role==='teacher'&&<Link className="notification-bell" href="/notifications" aria-label={attentionCount?`Notifications, ${attentionCount} items need attention`:'Notifications'} title="Notifications">
          <span aria-hidden>🔔</span>
          {attentionCount>0&&<span className="notification-count" aria-hidden>{attentionCount>99?'99+':attentionCount}</span>}
        </Link>}
        <AppMenu role={role} canInvite={canInvite} isAdmin={isAdmin}/>
      </div>}
    </div>
  </header>
}
