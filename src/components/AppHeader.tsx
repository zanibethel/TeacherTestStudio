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

  return <header className="site-header">
    <div className="site-header-inner">
      <Link className="brand" href={user?'/dashboard':'/'}><b>CramLoop</b></Link>
      {!user?<Link href="/login">Sign in</Link>:<div className="row" style={{gap:8,alignItems:'center'}}>
        {role==='teacher'&&<Link href="/notifications" aria-label={attentionCount?`Notifications, ${attentionCount} items need attention`:'Notifications'} title="Notifications" style={{position:'relative',display:'grid',placeItems:'center',width:44,height:44,borderRadius:12,color:'inherit',textDecoration:'none',fontSize:24}}>
          <span aria-hidden>🔔</span>
          {attentionCount>0&&<span aria-hidden style={{position:'absolute',top:2,right:0,minWidth:20,height:20,padding:'0 5px',borderRadius:999,display:'grid',placeItems:'center',background:'#ef4444',color:'#fff',fontSize:11,fontWeight:900,lineHeight:1}}>{attentionCount>99?'99+':attentionCount}</span>}
        </Link>}
        <AppMenu role={role} canInvite={canInvite} isAdmin={isAdmin}/>
      </div>} 
    </div>
  </header>
}
