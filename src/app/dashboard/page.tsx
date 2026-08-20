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
    const now=Date.now();const soon=now+48*60*60*1000
    const[{data:tests},{count:bankCount},{count:pendingConnections},{count:connectedStudents},{count:groupCount},{data:activeShares}]=await Promise.all([
      supabase.from('tests').select('id,title,status,share_code,created_at,updated_at,randomize_questions,assessment_type,attempts(count)').order('updated_at',{ascending:false}),
      supabase.from('question_bank').select('*',{count:'exact',head:true}),
      supabase.from('student_teacher_connection_requests').select('*',{count:'exact',head:true}).eq('teacher_id',user.id).eq('status','pending'),
      supabase.from('teacher_student_roster').select('*',{count:'exact',head:true}).eq('teacher_id',user.id).not('student_id','is',null),
      supabase.from('teacher_groups').select('*',{count:'exact',head:true}).eq('teacher_id',user.id),
      supabase.from('test_shares').select('id,label,due_at,created_at,test:tests(title)').eq('teacher_id',user.id).eq('active',true).order('created_at',{ascending:false})
    ])
    const classroomShares=(activeShares??[]).filter((s:any)=>s.due_at||s.label)
    const dueSoon=classroomShares.filter((s:any)=>{if(!s.due_at)return false;const due=new Date(s.due_at).getTime();return due>now&&due<=soon})
    const pastDue=classroomShares.filter((s:any)=>s.due_at&&new Date(s.due_at).getTime()<=now)
    const attentionCount=(pendingConnections??0)+dueSoon.length+pastDue.length
    const totalAttempts=(tests??[]).reduce((sum:number,t:any)=>sum+Number(t.attempts?.[0]?.count??0),0)
    const gettingStarted=[
      {done:(connectedStudents??0)>0,label:'Add or approve a student',detail:(connectedStudents??0)>0?`${connectedStudents} connected`:'Build your classroom roster',href:'/teacher-roster'},
      {done:(groupCount??0)>0,label:'Create a class',detail:(groupCount??0)>0?`${groupCount} class${groupCount===1?'':'es'} ready`:'Organize students into a class',href:'/teacher-groups'},
      {done:(bankCount??0)>0||(tests??[]).length>0,label:'Add teaching content',detail:(bankCount??0)>0?`${bankCount} questions in your bank`:(tests??[]).length>0?`${tests?.length} test${tests?.length===1?'':'s'} built`:'Add Question Bank content or build a test',href:(bankCount??0)>0?'/tests/new':'/shared-library'},
      {done:classroomShares.length>0,label:'Create an assignment',detail:classroomShares.length>0?`${classroomShares.length} active assignment${classroomShares.length===1?'':'s'}`:'Choose a test, students, and preset',href:'/assignments/new'},
      {done:totalAttempts>0,label:'Review student progress',detail:totalAttempts>0?`${totalAttempts} attempt${totalAttempts===1?'':'s'} recorded`:'Progress appears after a student starts testing',href:'/teacher-progress'},
    ]
    const setupComplete=gettingStarted.every(step=>step.done)
    const setupDone=gettingStarted.filter(step=>step.done).length
    return <main>
      <div className="dashboard-heading"><div><span className="eyebrow">TEACHER WORKSPACE</span><h1>Teacher dashboard</h1><p className="muted">Welcome, {profile.full_name||user.email}</p></div><form action="/auth/signout" method="post"><button className="ghost">Sign out</button></form></div>
      {query.error&&<p className="bad notice">{query.error}</p>}

      {!setupComplete&&<section className="card" style={{padding:18}}>
        <div className="row between" style={{alignItems:'flex-start'}}><div><span className="eyebrow">GETTING STARTED</span><h2 style={{margin:'5px 0 3px'}}>Set up your classroom</h2><p className="muted" style={{margin:0}}>CramLoop checks these off automatically as you work.</p></div><span className="pill">{setupDone}/5 complete</span></div>
        <div style={{display:'grid',gap:8,marginTop:14}}>{gettingStarted.map((step,index)=><Link key={step.label} href={step.href} style={{display:'grid',gridTemplateColumns:'30px minmax(0,1fr) auto',alignItems:'center',gap:10,padding:'10px 12px',border:'1px solid #e4e7ef',borderRadius:12,background:step.done?'#f0fdf4':'#fff',color:'#172033'}}><span aria-hidden style={{width:26,height:26,borderRadius:999,display:'grid',placeItems:'center',fontWeight:850,background:step.done?'#dcfce7':'#eef2ff',color:step.done?'#047857':'#4338ca'}}>{step.done?'✓':index+1}</span><span style={{minWidth:0}}><b style={{display:'block'}}>{step.label}</b><small className="muted">{step.detail}</small></span><span aria-hidden style={{color:'#4338ca',fontWeight:800}}>→</span></Link>)}</div>
      </section>}

      <section className="card" style={{padding:18}}>
        <div className="row between" style={{alignItems:'flex-start'}}><div><span className="eyebrow">WHAT NEEDS ME</span><h2 style={{margin:'5px 0 3px'}}>Classroom attention</h2><p className="muted" style={{margin:0}}>Start with the items most likely to need action today.</p></div><span className="pill" style={{background:attentionCount?'#fff7ed':'#ecfdf5',color:attentionCount?'#c2410c':'#047857'}}>{attentionCount?`${attentionCount} item${attentionCount===1?'':'s'}`:'All clear'}</span></div>
        <div className="dashboard-tool-grid" style={{marginTop:14}}>
          <Link className="dashboard-tool" href="/teacher-roster"><b>Student requests</b><span>{pendingConnections??0} waiting for approval</span></Link>
          <Link className="dashboard-tool" href="/teacher-progress"><b>Due soon</b><span>{dueSoon.length} assignment{dueSoon.length===1?'':'s'} due within 48 hours</span></Link>
          <Link className="dashboard-tool" href="/teacher-progress"><b>Past due</b><span>{pastDue.length} active assignment{pastDue.length===1?'':'s'} past due</span></Link>
          <Link className="dashboard-tool" href="/reports"><b>Active assignments</b><span>{classroomShares.length} assignment{classroomShares.length===1?'':'s'} active</span></Link>
        </div>
      </section>

      <section className="card dashboard-actions">
        <div className="dashboard-primary-actions" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}><Link className="button dashboard-create" href="/tests/new">Build a test</Link><Link className="secondary button dashboard-create" href="/assignments/new">Create assignment</Link></div>
        <div className="dashboard-tool-grid"><Link className="dashboard-tool" href="/question-bank"><b>Question bank</b><span>{bankCount??0} saved questions</span></Link><Link className="dashboard-tool" href="/shared-library"><b>Shared resources</b><span>Browse reusable teacher content</span></Link><Link className="dashboard-tool" href="/teacher-progress"><b>Student progress</b><span>See who needs attention now</span></Link><Link className="dashboard-tool" href="/teacher-roster"><b>Student roster</b><span>Manage your students</span></Link><Link className="dashboard-tool" href="/teacher-groups"><b>Groups</b><span>Organize classes and cohorts</span></Link>{profile.teacher_can_invite&&<Link className="dashboard-tool" href="/teacher-access"><b>Teacher access</b><span>Invite approved teachers</span></Link>}</div>
      </section>
      <div className="row between dashboard-library-heading"><div><h2>Tests</h2><p className="muted">Tests hold content. Assignments decide who gets them and how they are delivered.</p></div><Link href="/tests/new">Build new →</Link></div>
      {!tests?.length?<div className="card empty-state"><h3>No tests yet</h3><p className="muted">Build a reusable test from your Question Bank, then create an assignment when you are ready.</p><Link className="button" href="/tests/new">Build your first test</Link></div>:tests.map((t:any)=><section className="card" key={t.id}><div className="row between"><div><h3 style={{marginBottom:4}}>{t.title}</h3><p className="muted" style={{marginTop:0}}>Built {new Date(t.created_at).toLocaleDateString()} · Edited {new Date(t.updated_at).toLocaleDateString()} · {t.attempts?.[0]?.count??0} attempt(s)</p></div><span className="pill">{t.status}</span></div><div className="row" style={{flexWrap:'wrap',gap:8}}><Link className="button" href={`/assignments/new?test=${t.id}`}>Create assignment</Link><Link className="secondary button" href={`/tests/${t.id}/preview`}>Preview</Link><Link className="secondary button" href={`/tests/${t.id}/edit`} aria-label={`Edit ${t.title}`}>✎ Edit</Link><Link className="secondary button" href={`/tests/${t.id}/reports`}>Reports</Link><form action={copyTest.bind(null,t.id)}><button className="secondary" aria-label={`Copy ${t.title}`}>⧉ Copy</button></form></div></section>)}
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
