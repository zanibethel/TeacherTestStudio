import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { copyTest } from './actions'
import StudentAssignments from './StudentAssignments'

export default async function Dashboard({searchParams}:{searchParams:Promise<{error?:string}>}){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('full_name,role,teacher_approved,teacher_can_invite').eq('id',user.id).single();const query=await searchParams
  if(profile?.role==='teacher'){
    if(!profile.teacher_approved)return <main className="narrow"><div className="row between"><h1>Teacher access pending</h1><form action="/auth/signout" method="post"><button className="ghost">Sign out</button></form></div><section className="card"><p>This account does not have approved teacher access.</p><p className="muted">Teacher tools are invite-only. Ask the approved teacher who invited you to send a valid one-time invitation link.</p></section></main>
    const{data:tests}=await supabase.from('tests').select('id,title,status,share_code,created_at,updated_at,randomize_questions,assessment_type,attempts(count)').order('updated_at',{ascending:false})
    const{count:bankCount}=await supabase.from('question_bank').select('*',{count:'exact',head:true})
    return <main>
      <div className="dashboard-heading"><div><span className="eyebrow">TEACHER WORKSPACE</span><h1>Teacher dashboard</h1><p className="muted">Welcome, {profile.full_name||user.email}</p></div><form action="/auth/signout" method="post"><button className="ghost">Sign out</button></form></div>
      {query.error&&<p className="bad notice">{query.error}</p>}
      <section className="card dashboard-actions">
        <div className="dashboard-primary-actions"><Link className="button dashboard-create" href="/tests/new">+ Create a test</Link></div>
        <div className="dashboard-tool-grid"><Link className="dashboard-tool" href="/question-bank"><b>Question bank</b><span>{bankCount??0} saved questions</span></Link><Link className="dashboard-tool" href="/shared-library"><b>Shared resources</b><span>Browse reusable teacher content</span></Link><Link className="dashboard-tool" href="/teacher-roster"><b>Student roster</b><span>Manage your students</span></Link><Link className="dashboard-tool" href="/teacher-groups"><b>Groups</b><span>Organize classes and cohorts</span></Link>{profile.teacher_can_invite&&<Link className="dashboard-tool" href="/teacher-access"><b>Teacher access</b><span>Invite approved teachers</span></Link>}</div>
      </section>
      <div className="row between dashboard-library-heading"><div><h2>Your test library</h2><p className="muted">Create once, then share, review, and reuse.</p></div><Link href="/tests/new">Create new →</Link></div>
      {!tests?.length?<div className="card empty-state"><h3>No tests yet</h3><p className="muted">Create your first reusable test, then share it with students when you are ready.</p><Link className="button" href="/tests/new">Create your first test</Link></div>:tests.map((t:any)=><section className="card" key={t.id}><div className="row between"><div><h3 style={{marginBottom:4}}>{t.title}</h3><p className="muted" style={{marginTop:0}}>Created {new Date(t.created_at).toLocaleDateString()} · Edited {new Date(t.updated_at).toLocaleDateString()} · {t.attempts?.[0]?.count??0} attempt(s)</p></div><span className="pill">{t.status}</span></div><p className="muted">{t.assessment_type==='psi_practice'?'PSI practice · ':''}{t.randomize_questions?'Randomized questions · ':''}Code <b className="code">{t.share_code}</b></p><div className="row" style={{flexWrap:'wrap',gap:8}}><Link className="button" href={`/tests/${t.id}`}>Share</Link><Link className="secondary button" href={`/tests/${t.id}/reports`}>Reports</Link><Link className="secondary button" href={`/tests/${t.id}/preview`}>Student view</Link><Link className="secondary button" href={`/tests/${t.id}/edit`} aria-label={`Edit ${t.title}`}>✎ Edit</Link><form action={copyTest.bind(null,t.id)}><button className="secondary" aria-label={`Copy ${t.title}`}>⧉ Copy</button></form></div></section>)}
    </main>
  }

  const[{data:attempts},{data:assignments},{data:practiceSessions}]=await Promise.all([
    supabase.from('attempts').select('id,test_id,share_id,score_percent,submitted_at,started_at,attempt_number,tests(title),test_shares(token)').order('started_at',{ascending:false}),
    supabase.rpc('get_my_student_assignments'),
    supabase.from('practice_sessions').select('id,status,score_percent,source_attempt_id,source_share_id,created_at').eq('student_id',user.id).order('created_at',{ascending:false})
  ])
  const completed=(attempts??[]).filter((a:any)=>a.submitted_at)
  return <main><div className="row between"><div><h1>Student dashboard</h1><p className="muted">Welcome, {profile?.full_name||user.email}</p></div><form action="/auth/signout" method="post"><button className="ghost">Sign out</button></form></div>{query.error&&<p className="bad">{query.error}</p>}
    <div style={{marginTop:20}}><h2 style={{marginBottom:4}}>My assignments</h2><p className="muted" style={{marginTop:0}}>Your next step updates automatically as you test, remediate weak areas, and retest.</p></div>
    <StudentAssignments assignments={(assignments??[]) as any[]} attempts={(attempts??[]) as any[]} practiceSessions={(practiceSessions??[]) as any[]}/>
    <form action="/take/go" method="get" className="card"><h2>Open with a test code</h2><label>Teacher&apos;s test code</label><input name="code" required autoCapitalize="characters" placeholder="AB12CD34"/><button>Open test</button><div className="row" style={{marginTop:'1rem',flexWrap:'wrap'}}><Link className="secondary button" href="/practice-library">Browse practice passes</Link><Link className="secondary button" href="/find-teacher">Find my teacher</Link></div><p className="muted">Assigned work appears above automatically. Use Find my teacher only when you need to connect with a teacher who has not assigned anything to you yet.</p></form>
    {completed.length>0&&<details className="card"><summary style={{cursor:'pointer',fontWeight:800}}>Attempt history · {completed.length}</summary><div style={{marginTop:12}}>{completed.map((a:any)=><Link className="card card-link result-row" key={a.id} href={`/attempts/${a.id}`}><div><b>{Array.isArray(a.tests)?a.tests[0]?.title:a.tests?.title}</b><p className="muted">Attempt {a.attempt_number} · {new Date(a.submitted_at).toLocaleString()}</p></div><strong>{a.score_percent}%</strong></Link>)}</div></details>}
  </main>
}
