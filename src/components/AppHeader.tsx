import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AppHeader(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser()
  let role:string|null=null,canInvite=false
  if(user){
    const{data:profile}=await supabase.from('profiles').select('role,teacher_can_invite').eq('id',user.id).single()
    role=profile?.role??null
    canInvite=Boolean(profile?.teacher_can_invite)
  }

  return <header className="site-header">
    <div className="site-header-inner">
      <Link className="brand" href={user?'/dashboard':'/'}><b>CramLoop</b></Link>
      {!user?<Link href="/login">Sign in</Link>:<details className="app-menu">
        <summary aria-label="Open navigation menu"><span className="hamburger" aria-hidden="true">☰</span><span className="menu-label">Menu</span></summary>
        <nav className="menu-panel" aria-label="Main navigation">
          {role==='teacher'?<>
            <Link href="/dashboard">My Tests</Link>
            <Link href="/tests/new">+ Create Test</Link>
            <Link href="/reports">Reports</Link>
            <Link href="/teacher-roster">Students / Roster</Link>
            <Link href="/teacher-groups">Groups</Link>
            <Link href="/shared-library">Browse Test Bundles</Link>
            <Link href="/question-bank">Question Bank</Link>
            {canInvite&&<Link href="/teacher-access">Teacher Access</Link>}
          </>:<>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/practice-library">Browse Practice Passes</Link>
            <Link href="/find-teacher">Find My Teacher</Link>
          </>}
          <form action="/auth/signout" method="post"><button className="menu-logout" type="submit">Log out</button></form>
        </nav>
      </details>}
    </div>
  </header>
}
