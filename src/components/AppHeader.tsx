import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppMenu from './AppMenu'

export default async function AppHeader(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  let role:string|null=null,canInvite=false,isAdmin=false
  if(user){
    const[{data:profile},{data:adminFlag}]=await Promise.all([
      supabase.from('profiles').select('role,teacher_can_invite').eq('id',user.id).single(),
      supabase.rpc('is_platform_admin')
    ])
    role=profile?.role??null
    canInvite=Boolean(profile?.teacher_can_invite)
    isAdmin=Boolean(adminFlag)
  }

  return <header className="site-header">
    <div className="site-header-inner">
      <Link className="brand" href={user?'/dashboard':'/'}><b>CramLoop</b></Link>
      {!user?<Link href="/login">Sign in</Link>:<AppMenu role={role} canInvite={canInvite} isAdmin={isAdmin}/>} 
    </div>
  </header>
}
