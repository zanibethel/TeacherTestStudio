'use client'

import Link from 'next/link'
import { useRef } from 'react'

export default function AppMenu({role,canInvite,isAdmin}:{role:string|null;canInvite:boolean;isAdmin:boolean}){
  const detailsRef=useRef<HTMLDetailsElement>(null)
  const closeMenu=()=>{if(detailsRef.current)detailsRef.current.open=false}

  return <details className="app-menu" ref={detailsRef}>
    <summary aria-label="Open navigation menu"><span className="hamburger" aria-hidden="true">☰</span><span className="menu-label">Menu</span></summary>
    <nav className="menu-panel" aria-label="Main navigation" onClick={e=>{if((e.target as HTMLElement).closest('a'))closeMenu()}}>
      {role==='teacher'?<>
        <Link href="/dashboard">My Tests</Link>
        <Link href="/tests/new">+ Create Test</Link>
        <Link href="/reports">Reports</Link>
        <Link href="/teacher-roster">Students / Roster</Link>
        <Link href="/teacher-groups">Groups</Link>
        <Link href="/shared-library">Browse Test Bundles</Link>
        <Link href="/question-bank">Question Bank</Link>
        <Link href="/suggest-content">Suggest CramLoop Content</Link>
        {canInvite&&<Link href="/teacher-access">Teacher Access</Link>}
      </>:<>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/my-passes">My Passes</Link>
        <Link href="/practice-library">Browse Practice Passes</Link>
        <Link href="/suggest-content">Suggest CramLoop Content</Link>
        <Link href="/find-teacher">Find My Teacher</Link>
      </>}
      <span className="menu-section-label">Support</span><Link href="/help">Help & FAQs</Link>
      {isAdmin&&<><span className="menu-section-label">Platform</span><Link href="/admin/content-health">Content Health</Link><Link href="/admin/bundles">Bundle Manager</Link><Link href="/admin/pricing">Special Pricing</Link><Link href="/admin/suggestions">Content Suggestions</Link></>}
      <form action="/auth/signout" method="post"><button className="menu-logout" type="submit">Log out</button></form>
    </nav>
  </details>
}
