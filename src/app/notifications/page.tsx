import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function assignmentTitle(share:any){
  const test=Array.isArray(share.test)?share.test[0]:share.test
  return share.label||test?.title||'Assignment'
}

export default async function NotificationCenter(){
  const supabase=await createClient()
  const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
  const{data:profile}=await supabase.from('profiles').select('role,teacher_approved').eq('id',user.id).single()
  if(profile?.role!=='teacher'||!profile.teacher_approved)redirect('/dashboard')

  const now=Date.now(),soon=now+48*60*60*1000
  const[{data:requests},{data:shares}]=await Promise.all([
    supabase.from('student_teacher_connection_requests').select('id,student_email,student_name,created_at').eq('teacher_id',user.id).eq('status','pending').order('created_at',{ascending:false}),
    supabase.from('test_shares').select('id,label,due_at,created_at,test:tests(id,title)').eq('teacher_id',user.id).eq('active',true).order('created_at',{ascending:false})
  ])
  const active=shares??[]
  const dueSoon=active.filter((s:any)=>{if(!s.due_at)return false;const due=new Date(s.due_at).getTime();return due>now&&due<=soon})
  const pastDue=active.filter((s:any)=>s.due_at&&new Date(s.due_at).getTime()<=now)
  const attentionCount=(requests?.length??0)+dueSoon.length+pastDue.length

  const sectionStyle={padding:0,overflow:'hidden'} as const
  const summaryStyle={cursor:'pointer',listStyle:'none',padding:'16px',display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:12,alignItems:'center'} as const
  const bodyStyle={borderTop:'1px solid #e4e7ef',padding:'4px 16px 16px'} as const

  return <main className="narrow">
    <div className="row between" style={{alignItems:'flex-start',gap:12}}><div><Link href="/dashboard">← Dashboard</Link><h1 style={{marginBottom:4}}>Notification Center</h1><p className="muted" style={{marginTop:0}}>Things that may need your attention now.</p></div><span className="pill" style={{marginTop:28,background:attentionCount?'#fff7ed':'#ecfdf5',color:attentionCount?'#c2410c':'#047857',whiteSpace:'nowrap'}}>{attentionCount?`${attentionCount} need attention`:'All clear'}</span></div>

    <div className="stack" style={{marginTop:16}}>
      <details className="card" style={sectionStyle} open={(requests?.length??0)>0}>
        <summary style={summaryStyle}><div><b>Student requests</b><p className="muted" style={{margin:'3px 0 0'}}>Students waiting for your approval.</p></div><span className="pill">{requests?.length??0}</span></summary>
        <div style={bodyStyle}>{!(requests??[]).length?<p className="muted">No student requests are waiting.</p>:(requests??[]).map((r:any)=><div className="question-summary" key={r.id}><b>{r.student_name||'Student'}</b><p style={{margin:'4px 0'}}>{r.student_email}</p><p className="muted" style={{margin:'4px 0'}}>Requested {new Date(r.created_at).toLocaleString()}</p></div>)}<Link className="button" href="/teacher-roster">Review requests</Link></div>
      </details>

      <details className="card" style={sectionStyle} open={dueSoon.length>0}>
        <summary style={summaryStyle}><div><b>Due soon</b><p className="muted" style={{margin:'3px 0 0'}}>Assignments due within the next 48 hours.</p></div><span className="pill">{dueSoon.length}</span></summary>
        <div style={bodyStyle}>{!dueSoon.length?<p className="muted">Nothing is due within 48 hours.</p>:dueSoon.map((s:any)=><div className="question-summary" key={s.id}><b>{assignmentTitle(s)}</b><p className="muted" style={{margin:'4px 0'}}>Due {new Date(s.due_at).toLocaleString()}</p></div>)}<Link className="button" href="/teacher-progress">View student progress</Link></div>
      </details>

      <details className="card" style={sectionStyle} open={pastDue.length>0}>
        <summary style={summaryStyle}><div><b>Past due</b><p className="muted" style={{margin:'3px 0 0'}}>Active assignments whose due date has passed.</p></div><span className="pill">{pastDue.length}</span></summary>
        <div style={bodyStyle}>{!pastDue.length?<p className="muted">No active assignments are past due.</p>:pastDue.map((s:any)=><div className="question-summary" key={s.id}><b>{assignmentTitle(s)}</b><p className="muted" style={{margin:'4px 0'}}>Was due {new Date(s.due_at).toLocaleString()}</p></div>)}<Link className="button" href="/teacher-progress">Review past-due work</Link></div>
      </details>

      <details className="card" style={sectionStyle}>
        <summary style={summaryStyle}><div><b>Active assignments</b><p className="muted" style={{margin:'3px 0 0'}}>Everything currently available to students.</p></div><span className="pill">{active.length}</span></summary>
        <div style={bodyStyle}>{!active.length?<p className="muted">No active assignments.</p>:active.map((s:any)=><div className="question-summary" key={s.id}><b>{assignmentTitle(s)}</b><p className="muted" style={{margin:'4px 0'}}>{s.due_at?`Due ${new Date(s.due_at).toLocaleString()}`:'No due date'} · Created {new Date(s.created_at).toLocaleDateString()}</p></div>)}<div className="row" style={{flexWrap:'wrap',gap:8}}><Link className="button" href="/reports">Assignment reports</Link><Link className="secondary button" href="/assignments/new">Create assignment</Link></div></div>
      </details>
    </div>
  </main>
}
